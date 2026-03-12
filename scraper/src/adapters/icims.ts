import type { AtsAdapter, ScrapedJobData, ExistingJobRecord } from "./types.js";
import { config } from "../config.js";
import { hostRateLimiter } from "../utils/concurrency.js";
import { logger } from "../utils/logger.js";

// ---------------------------------------------------------------------------
// Jibe API types (iCIMS's modern frontend layer)
// ---------------------------------------------------------------------------

interface JibeJob {
  slug: string;
  req_id: string;
  title: string;
  description: string;
  city: string;
  state: string;
  country_code: string;
  location_name: string;
  additional_locations?: Array<{ city: string; state: string; country: string }>;
  employment_type: string;
  categories: Array<{ name: string }>;
  posted_date: string;
  posting_expiry_date: string | null;
  apply_url: string;
  salary_range?: string | null;
  tags?: string;
  tags1?: string;
  tags2?: string;
  tags3?: string;
  tags4?: string;
}

interface JibeResponse {
  jobs: Array<{ data: JibeJob }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HOURLY_RATE_THRESHOLD = 1000;

/**
 * Parse salary from Jibe `salary_range` text field.
 * Common formats: "$203,500.00 - $305,500.00 / Annually", "$80,000 - $120,000"
 */
function parseSalaryRange(salaryRange: string | null | undefined): {
  min: number | null;
  max: number | null;
  isHourly: boolean;
} {
  if (!salaryRange) return { min: null, max: null, isHourly: false };
  const match = salaryRange.match(/\$\s*([\d,]+(?:\.\d+)?)\s*(?:[-–—]|to)\s*\$\s*([\d,]+(?:\.\d+)?)/i);
  if (!match) return { min: null, max: null, isHourly: false };
  const min = Math.round(parseFloat(match[1].replace(/,/g, "")));
  const max = Math.round(parseFloat(match[2].replace(/,/g, "")));
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

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class ICIMSAdapter implements AtsAdapter {
  async listJobs(
    company: { id: string; name: string; baseUrl: string; atsPlatform: string; lastScrapeAt: Date | null },
    _existingJobs?: Map<string, ExistingJobRecord>,
  ): Promise<ScrapedJobData[]> {
    // baseUrl should be the Jibe-powered job site, e.g. https://jobs.statefarm.com
    const base = company.baseUrl.replace(/\/+$/, "");
    const hostname = new URL(base).host;
    const jobs: ScrapedJobData[] = [];
    let page = 1;

    logger.info("Starting iCIMS/Jibe scrape", { company: company.name, baseUrl: base });

    while (true) {
      await hostRateLimiter.acquire(hostname);
      const url = `${base}/api/jobs?page=${page}&location=United+States&limit=100`;
      const res = await fetch(url, {
        headers: { "User-Agent": config.userAgent },
      });

      if (!res.ok) {
        throw new Error(`iCIMS Jibe API returned ${res.status} for ${company.name} (page ${page})`);
      }

      const data = (await res.json()) as JibeResponse;
      if (!data.jobs || data.jobs.length === 0) break;

      for (const { data: job } of data.jobs) {
        // Filter: US only
        if (job.country_code !== "US") continue;

        // Filter: full-time only
        if (job.employment_type && job.employment_type !== "FULL_TIME") continue;

        // Parse salary and filter hourly roles
        const salary = parseSalaryRange(job.salary_range);
        if (salary.isHourly) {
          logger.info("Skipping hourly role", { company: company.name, title: job.title, salaryMax: salary.max });
          continue;
        }

        // Build locations list
        const locations: string[] = [];
        if (job.location_name) locations.push(job.location_name);
        if (job.additional_locations) {
          for (const loc of job.additional_locations) {
            const parts = [loc.city, loc.state, loc.country].filter(Boolean);
            if (parts.length) locations.push(parts.join(", "));
          }
        }

        // Infer location type from all location text + tags
        const allText = [
          ...locations,
          job.tags ?? "",
          job.tags1 ?? "",
          job.tags2 ?? "",
          job.tags3 ?? "",
          job.tags4 ?? "",
        ].join(" ");
        const locationType = inferLocationType(allText);

        jobs.push({
          externalJobId: job.req_id || job.slug,
          title: job.title,
          url: job.apply_url,
          department: job.categories?.[0]?.name ?? null,
          locations,
          locationType,
          salaryMin: salary.min,
          salaryMax: salary.max,
          salaryCurrency: "USD",
          jobDescriptionHtml: job.description ?? "",
          postedAt: job.posted_date ?? null,
          postingEndDate: job.posting_expiry_date ?? null,
        });
      }

      page++;
    }

    logger.info("iCIMS/Jibe scrape complete", { company: company.name, jobCount: jobs.length });
    return jobs;
  }
}
