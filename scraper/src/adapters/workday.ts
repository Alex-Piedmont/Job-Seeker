import type { AtsAdapter, ScrapedJobData } from "./types.js";
import { config } from "../config.js";
import { delay } from "../utils/delay.js";
import { logger } from "../utils/logger.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract tenant and siteId from a Workday careers URL. */
function parseWorkdayUrl(baseUrl: string): { host: string; tenant: string; siteId: string } {
  const url = new URL(baseUrl);
  // e.g. https://coke.wd1.myworkdayjobs.com/coca-cola-careers
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 1) {
    throw new Error(`Cannot parse Workday URL – expected /<siteId> path: ${baseUrl}`);
  }
  const tenant = url.hostname.split(".")[0];
  const siteId = segments[0];
  return { host: url.host, tenant, siteId };
}

/** Best-effort salary extraction from Workday HTML description. */
function extractSalaryFromHtml(html: string): { min: number | null; max: number | null } {
  // Common patterns: "Pay Range: $80,000 - $120,000", "$80,000.00 to $120,000.00"
  const match = html.match(/\$\s*([\d,]+(?:\.\d+)?)\s*(?:[-–—]|to)\s*\$\s*([\d,]+(?:\.\d+)?)/i);
  if (!match) return { min: null, max: null };
  const min = parseFloat(match[1].replace(/,/g, ""));
  const max = parseFloat(match[2].replace(/,/g, ""));
  if (isNaN(min) || isNaN(max)) return { min: null, max: null };
  return { min, max };
}

// ---------------------------------------------------------------------------
// CXS API types
// ---------------------------------------------------------------------------

interface CxsListResponse {
  total: number;
  jobPostings: Array<{
    title: string;
    externalPath: string;
    locationsText: string;
    postedOn: string;
    bulletFields: string[];
  }>;
}

interface CxsDetailResponse {
  jobPostingInfo: {
    jobReqId?: string;
    externalPath: string;
    title: string;
    location: string;
    additionalLocations?: string[];
    jobDescription: string;  // HTML
    timeType?: string;
    jobFamilyGroup?: string;
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

const US_COUNTRY_FACET_ID = "bc33aa3152ec42d4995f4791a106ed09";

export class WorkdayAdapter implements AtsAdapter {
  async listJobs(company: { id: string; name: string; baseUrl: string }): Promise<ScrapedJobData[]> {
    const { host, tenant, siteId } = parseWorkdayUrl(company.baseUrl);
    const listUrl = `https://${host}/wday/cxs/${tenant}/${siteId}/jobs`;

    const jobs: ScrapedJobData[] = [];
    let offset = 0;
    const limit = 20;

    logger.info("Starting Workday CXS scrape", { company: company.name, listUrl });

    // Paginate list endpoint
    while (true) {
      const listRes = await fetch(listUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": config.userAgent,
        },
        body: JSON.stringify({
          appliedFacets: { locationCountry: [US_COUNTRY_FACET_ID] },
          limit,
          offset,
          searchText: "",
        }),
      });

      if (!listRes.ok) {
        throw new Error(`Workday CXS list returned ${listRes.status} for ${company.name}`);
      }

      const data = (await listRes.json()) as CxsListResponse;

      if (!data.jobPostings || data.jobPostings.length === 0) break;

      // Fetch detail for each job
      for (const posting of data.jobPostings) {
        try {
          await delay(config.delays.betweenRequests);

          const detailUrl = `https://${host}/wday/cxs/${tenant}/${siteId}/job/${posting.externalPath}`;
          const detailRes = await fetch(detailUrl, {
            headers: { "User-Agent": config.userAgent },
          });

          if (!detailRes.ok) {
            logger.warn("Workday detail request failed", {
              company: company.name,
              externalPath: posting.externalPath,
              status: detailRes.status,
            });
            continue;
          }

          const detail = (await detailRes.json()) as CxsDetailResponse;
          const info = detail.jobPostingInfo;

          const locations = [info.location, ...(info.additionalLocations ?? [])].filter(Boolean);
          const locationText = locations.join(", ").toLowerCase();
          const locationType = locationText.includes("remote") ? "Remote" :
            locationText.includes("hybrid") ? "Hybrid" : null;

          const salary = extractSalaryFromHtml(info.jobDescription ?? "");

          jobs.push({
            externalJobId: info.jobReqId ?? posting.externalPath,
            title: info.title ?? posting.title,
            url: `https://${host}/en-US/${siteId}/job/${posting.externalPath}`,
            department: info.jobFamilyGroup ?? null,
            locations,
            locationType,
            salaryMin: salary.min,
            salaryMax: salary.max,
            salaryCurrency: "USD",
            jobDescriptionHtml: info.jobDescription ?? "",
          });
        } catch (err) {
          logger.warn("Workday detail fetch error", {
            company: company.name,
            externalPath: posting.externalPath,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      offset += data.jobPostings.length;
      if (offset >= data.total) break;

      await delay(config.delays.betweenRequests);
    }

    logger.info("Workday CXS scrape complete", { company: company.name, jobCount: jobs.length });
    return jobs;
  }
}
