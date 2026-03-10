import type { AtsAdapter, ScrapedJobData, ExistingJobRecord } from "./types.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { isUSLocation } from "../utils/location-filter.js";
import { XMLParser } from "fast-xml-parser";

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

/**
 * Extract host and companyId from a SuccessFactors career site URL.
 * Expected format: https://career{N}.successfactors.{tld}/career?company={companyId}
 */
function parseSuccessFactorsUrl(baseUrl: string): { host: string; companyId: string } {
  const url = new URL(baseUrl);
  const companyId = url.searchParams.get("company");
  if (!companyId) {
    throw new Error(`Cannot parse SuccessFactors URL – missing ?company= parameter: ${baseUrl}`);
  }
  return { host: url.host, companyId };
}

// ---------------------------------------------------------------------------
// XML types (after parsing)
// ---------------------------------------------------------------------------

interface SFJob {
  JobTitle: string;
  "Job-Description": string;
  ReqId: string | number;
  "Posted-Date"?: string;             // "MM/DD/YYYY" format
  filter1?: { label: string; value: string } | string;
  filter2?: { label: string; value: string } | string;
  filter3?: { label: string; value: string } | string;
}

interface SFJobListing {
  "Job-Listing": {
    Job: SFJob | SFJob[];
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HOURLY_RATE_THRESHOLD = 1000;

function extractSalaryFromHtml(html: string): { min: number | null; max: number | null; isHourly: boolean } {
  const match = html.match(/\$\s*([\d,]+(?:\.\d+)?)\s*(?:[-–—]|to)\s*\$\s*([\d,]+(?:\.\d+)?)/i);
  if (!match) return { min: null, max: null, isHourly: false };
  const min = parseFloat(match[1].replace(/,/g, ""));
  const max = parseFloat(match[2].replace(/,/g, ""));
  if (isNaN(min) || isNaN(max)) return { min: null, max: null, isHourly: false };
  const isHourly = max < HOURLY_RATE_THRESHOLD;
  return { min, max, isHourly };
}

function inferLocationType(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes("remote")) return "Remote";
  if (lower.includes("hybrid")) return "Hybrid";
  return null;
}

/** Extract location from filter values or description text. */
function extractLocation(job: SFJob): string | null {
  // Check filter1-3 for location-like labels
  for (const key of ["filter1", "filter2", "filter3"] as const) {
    const filter = job[key];
    if (filter && typeof filter === "object") {
      const label = filter.label.toLowerCase();
      if (label.includes("location") || label.includes("city") || label.includes("state") || label.includes("office")) {
        return filter.value;
      }
    }
  }
  return null;
}

/** Extract department from filter values. */
function extractDepartment(job: SFJob): string | null {
  for (const key of ["filter1", "filter2", "filter3"] as const) {
    const filter = job[key];
    if (filter && typeof filter === "object") {
      const label = filter.label.toLowerCase();
      if (label.includes("department") || label.includes("area") || label.includes("team") || label.includes("division")) {
        return filter.value;
      }
    }
  }
  return null;
}

/** Parse "MM/DD/YYYY" date to ISO string. */
function parsePostedDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, month, day, year] = match;
  return `${year}-${month}-${day}`;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class SuccessFactorsAdapter implements AtsAdapter {
  async listJobs(
    company: { id: string; name: string; baseUrl: string; atsPlatform: string; lastScrapeAt: Date | null },
    _existingJobs?: Map<string, ExistingJobRecord>,
  ): Promise<ScrapedJobData[]> {
    const { host, companyId } = parseSuccessFactorsUrl(company.baseUrl);

    // Fetch the XML feed — returns all jobs in a single response (no pagination)
    const feedUrl = `https://${host}/career?company=${encodeURIComponent(companyId)}&career_ns=job_listing_summary&resultType=XML`;

    logger.info("Starting SuccessFactors scrape", { company: company.name, feedUrl });

    const res = await fetch(feedUrl, {
      headers: { "User-Agent": config.userAgent },
    });

    if (!res.ok) {
      throw new Error(`SuccessFactors XML feed returned ${res.status} for ${company.name}`);
    }

    const xml = await res.text();

    // Validate it's actually XML and not an HTML error page
    if (!xml.trimStart().startsWith("<?xml") && !xml.trimStart().startsWith("<Job-Listing")) {
      throw new Error(`SuccessFactors returned non-XML response for ${company.name} — check company ID and host`);
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      cdataPropName: "__cdata",
      isArray: (name) => name === "Job",
    });

    const parsed = parser.parse(xml) as SFJobListing;
    const jobList = parsed["Job-Listing"]?.Job;

    if (!jobList) {
      logger.info("SuccessFactors feed returned no jobs", { company: company.name });
      return [];
    }

    const rawJobs = Array.isArray(jobList) ? jobList : [jobList];
    const jobs: ScrapedJobData[] = [];

    for (const job of rawJobs) {
      const title = typeof job.JobTitle === "object" ? (job.JobTitle as Record<string, string>).__cdata : String(job.JobTitle ?? "");
      const descriptionHtml = typeof job["Job-Description"] === "object"
        ? (job["Job-Description"] as Record<string, string>).__cdata
        : String(job["Job-Description"] ?? "");
      const reqId = String(job.ReqId);

      if (!title || !reqId) continue;

      // Location extraction and US filtering
      const location = extractLocation(job);
      if (location) {
        if (!isUSLocation(location)) continue;
      }
      // If no structured location, we can't reliably filter — include the job
      // (admin chose this company, so it's expected to have relevant jobs)

      const locations = location ? [location] : [];
      const allText = [location ?? "", descriptionHtml].join(" ");

      const salary = extractSalaryFromHtml(descriptionHtml);
      if (salary.isHourly) {
        logger.info("Skipping hourly role", { company: company.name, title, salaryMax: salary.max });
        continue;
      }

      // Construct detail page URL
      const jobUrl = `https://${host}/career?company=${encodeURIComponent(companyId)}&career_ns=job_listing&career_job_req_id=${reqId}`;

      jobs.push({
        externalJobId: reqId,
        title,
        url: jobUrl,
        department: extractDepartment(job),
        locations,
        locationType: inferLocationType(allText),
        salaryMin: salary.min,
        salaryMax: salary.max,
        salaryCurrency: "USD",
        jobDescriptionHtml: descriptionHtml,
        postedAt: parsePostedDate(job["Posted-Date"]),
        postingEndDate: null,
      });
    }

    logger.info("SuccessFactors scrape complete", { company: company.name, total: rawJobs.length, jobCount: jobs.length });
    return jobs;
  }
}
