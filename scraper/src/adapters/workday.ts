import type { AtsAdapter, ScrapedJobData, ExistingJobRecord } from "./types.js";
import { config } from "../config.js";
import { workdayRateLimiter } from "../utils/concurrency.js";
import { fetchWithRetry } from "../utils/fetch-retry.js";
import { logger } from "../utils/logger.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Rate-limit wrapper: global Workday limiter (500ms across all hosts) */
async function acquireSlot(): Promise<void> {
  await workdayRateLimiter.acquire("__workday__");
}

/** Extract tenant and siteId from a Workday careers URL. */
function parseWorkdayUrl(baseUrl: string): { host: string; tenant: string; siteId: string } {
  const url = new URL(baseUrl);
  // e.g. https://coke.wd1.myworkdayjobs.com/coca-cola-careers
  // Strip locale prefixes like /en-US/ before extracting siteId
  const segments = url.pathname.split("/").filter(Boolean).filter((s) => !/^[a-z]{2}(-[A-Z]{2})?$/.test(s));
  if (segments.length < 1) {
    throw new Error(`Cannot parse Workday URL – expected /<siteId> path: ${baseUrl}`);
  }
  const tenant = url.hostname.split(".")[0];
  const siteId = segments[0];
  return { host: url.host, tenant, siteId };
}

/** Threshold below which parsed salary values are assumed to be hourly rates. */
const HOURLY_RATE_THRESHOLD = 1000;

/** If a single jobFamilyGroup category exceeds this share of total jobs, treat it as retail-dominant. */
const RETAIL_DOMINANT_THRESHOLD = 0.8;

/** Tier 2: keyword patterns that identify retail/branch job family categories. */
const RETAIL_KEYWORD_PATTERNS = [/\bstore\b/i, /\bretail\b/i, /\bbranch\b/i];
const RETAIL_KEYWORD_THRESHOLD = 0.3;

/** Best-effort salary extraction from Workday HTML description. */
function extractSalaryFromHtml(html: string): { min: number | null; max: number | null; isHourly: boolean } {
  // Common patterns: "Pay Range: $80,000 - $120,000", "$80,000.00 to $120,000.00"
  const match = html.match(/\$\s*([\d,]+(?:\.\d+)?)\s*(?:[-–—]|to)\s*\$\s*([\d,]+(?:\.\d+)?)/i);
  if (!match) return { min: null, max: null, isHourly: false };
  const min = Math.round(parseFloat(match[1].replace(/,/g, "")));
  const max = Math.round(parseFloat(match[2].replace(/,/g, "")));
  if (isNaN(min) || isNaN(max)) return { min: null, max: null, isHourly: false };
  // Values under threshold are hourly rates (e.g. $20.82 - $37.45)
  const isHourly = max < HOURLY_RATE_THRESHOLD;
  return { min, max, isHourly };
}

// ---------------------------------------------------------------------------
// CXS API types
// ---------------------------------------------------------------------------

interface CxsFacetValue {
  descriptor: string;
  id: string;
  count: number;
}

interface CxsFacet {
  facetParameter: string;
  descriptor: string;
  values: CxsFacetValue[];
}

interface CxsListResponse {
  total: number;
  facets?: CxsFacet[];
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
    externalUrl?: string;
    title: string;
    location: string;
    additionalLocations?: string[];
    jobDescription: string;  // HTML
    timeType?: string;
    jobFamilyGroup?: string;
    startDate?: string;      // ISO date, e.g. "2026-03-08"
    endDate?: string;        // ISO date when listing expires
    country?: { id: string; descriptor: string };
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

const US_COUNTRY_FACET_ID = "bc33aa3152ec42d4995f4791a106ed09";

export class WorkdayAdapter implements AtsAdapter {
  async listJobs(
    company: { id: string; name: string; baseUrl: string; atsPlatform: string; lastScrapeAt: Date | null },
    existingJobs?: Map<string, ExistingJobRecord>,
  ): Promise<ScrapedJobData[]> {
    const { host, tenant, siteId } = parseWorkdayUrl(company.baseUrl);
    const listUrl = `https://${host}/wday/cxs/${tenant}/${siteId}/jobs`;

    // Create concurrency limiter for detail fetches within this company
    const pLimit = (await import("p-limit")).default;
    const detailLimit = pLimit(config.concurrency.jobDetailConcurrency);

    // Discover facets with an initial probe request
    const appliedFacets: Record<string, string[]> = {};

    await acquireSlot();
    const probeRes = await fetchWithRetry(listUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": config.userAgent },
      body: JSON.stringify({ appliedFacets: {}, limit: 1, offset: 0, searchText: "" }),
    });

    if (probeRes.ok) {
      const probeData = (await probeRes.json()) as CxsListResponse;

      // Flatten facets — some tenants nest country/city inside locationMainGroup
      const facets: CxsFacet[] = [];
      for (const f of probeData.facets ?? []) {
        if (f.values?.length && f.values[0]?.id != null) {
          facets.push(f);
        }
        // Check for nested facets (e.g. locationMainGroup contains locationCountry)
        for (const child of f.values ?? []) {
          if ("facetParameter" in child && "values" in child) {
            facets.push(child as unknown as CxsFacet);
          }
        }
      }

      // Auto-discover country facet (parameter name varies: locationCountry vs Location_Country)
      const countryFacet = facets.find((f) => f.facetParameter.toLowerCase().includes("country"));
      const usValue = countryFacet?.values?.find((v) => v.id === US_COUNTRY_FACET_ID);
      if (countryFacet && usValue) {
        appliedFacets[countryFacet.facetParameter] = [usValue.id];
        logger.info("Workday US country facet discovered", { company: company.name, param: countryFacet.facetParameter });
      } else {
        logger.warn("Workday US country facet not found, scraping without country filter", { company: company.name });
      }

      // Auto-detect retail-dominant jobFamilyGroup and filter to corporate categories
      const jobFamilyFacet = facets.find((f) => f.facetParameter === "jobFamilyGroup");
      if (jobFamilyFacet && jobFamilyFacet.values?.length >= 3) {
        const totalFacetJobs = jobFamilyFacet.values.reduce((sum, v) => sum + v.count, 0);
        const sorted = [...jobFamilyFacet.values].sort((a, b) => b.count - a.count);

        // Tier 1: Single dominant category exceeds 80% (e.g. Dollar Tree, Lowe's, DaVita)
        const dominant = sorted[0];
        if (totalFacetJobs > 0 && dominant.count / totalFacetJobs > RETAIL_DOMINANT_THRESHOLD) {
          const corporateCategories = sorted.slice(1);
          const corporateTotal = corporateCategories.reduce((sum, v) => sum + v.count, 0);
          if (corporateTotal > 0) {
            appliedFacets.jobFamilyGroup = corporateCategories.map((v) => v.id);
            logger.info("Workday retail-dominant jobFamilyGroup detected, filtering to corporate categories", {
              company: company.name,
              excludedCategory: dominant.descriptor,
              excludedCount: dominant.count,
              corporateCategories: corporateCategories.length,
              corporateJobCount: corporateTotal,
            });
          }
        }

        // Tier 2: Multiple retail/branch keyword categories collectively exceed 30% (e.g. CVS, PNC)
        if (!appliedFacets.jobFamilyGroup && totalFacetJobs > 0) {
          const matched = jobFamilyFacet.values.filter((v) =>
            RETAIL_KEYWORD_PATTERNS.some((p) => p.test(v.descriptor)),
          );
          const matchedCount = matched.reduce((sum, v) => sum + v.count, 0);
          const nonMatched = jobFamilyFacet.values.filter((v) =>
            !RETAIL_KEYWORD_PATTERNS.some((p) => p.test(v.descriptor)),
          );
          if (matchedCount / totalFacetJobs > RETAIL_KEYWORD_THRESHOLD && nonMatched.length >= 2) {
            const corporateTotal = nonMatched.reduce((sum, v) => sum + v.count, 0);
            appliedFacets.jobFamilyGroup = nonMatched.map((v) => v.id);
            logger.info("Workday retail/branch keyword filter applied", {
              company: company.name,
              matchedCategories: matched.map((v) => v.descriptor),
              excludedCount: matchedCount,
              corporateCategories: nonMatched.length,
              corporateJobCount: corporateTotal,
            });
          }
        }
      }

      // Auto-discover full-time facet
      const timeTypeFacet = facets.find((f) => f.facetParameter === "timeType");
      const fullTimeValue = timeTypeFacet?.values?.find((v) => v.descriptor.toLowerCase().includes("full time"));
      if (fullTimeValue) {
        appliedFacets.timeType = [fullTimeValue.id];
        logger.info("Workday full-time facet discovered", { company: company.name, id: fullTimeValue.id });
      } else {
        logger.info("Workday timeType facet not available", { company: company.name });
      }
    }

    const jobs: ScrapedJobData[] = [];
    let offset = 0;
    let totalJobs = -1; // capture from first response only
    const limit = 20;
    let detailSkipped = 0;

    logger.info("Starting Workday CXS scrape", { company: company.name, listUrl });

    // Paginate list endpoint
    while (true) {
      await acquireSlot();
      const listRes = await fetchWithRetry(listUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": config.userAgent,
        },
        body: JSON.stringify({
          appliedFacets,
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

      // Capture total from first response (subsequent pages may return 0)
      if (totalJobs < 0) {
        totalJobs = data.total;
        logger.info("Workday total jobs reported", { company: company.name, total: totalJobs });
      }

      // Fetch details concurrently within each page
      const detailTasks = data.jobPostings.map((posting) =>
        detailLimit(async (): Promise<ScrapedJobData | null> => {
          if (!posting.externalPath) {
            logger.warn("Workday posting missing externalPath, skipping", {
              company: company.name,
              title: posting.title,
            });
            return null;
          }

          try {
            // Phase 6: Conditional detail skip — if title matches and contentHash exists, skip fetch
            if (existingJobs) {
              const existing = existingJobs.get(posting.externalPath);
              if (existing && existing.contentHash && existing.title === posting.title) {
                detailSkipped++;
                const path = posting.externalPath.replace(/^\/job\//, "");
                return {
                  externalJobId: existing.externalJobId,
                  title: posting.title,
                  url: `https://${host}/en-US/${siteId}/job/${path}`,
                  department: null,
                  locations: posting.locationsText ? [posting.locationsText] : [],
                  locationType: posting.locationsText?.toLowerCase().includes("remote") ? "Remote" :
                    posting.locationsText?.toLowerCase().includes("hybrid") ? "Hybrid" : null,
                  salaryMin: null,
                  salaryMax: null,
                  salaryCurrency: "USD",
                  jobDescriptionHtml: "",
                  postedAt: posting.postedOn ?? null,
                  postingEndDate: null,
                };
              }
            }

            await acquireSlot();

            const path = posting.externalPath.replace(/^\/job\//, "");
            const detailUrl = `https://${host}/wday/cxs/${tenant}/${siteId}/job/${path}`;
            const detailRes = await fetchWithRetry(detailUrl, {
              headers: { "User-Agent": config.userAgent },
            });

            if (!detailRes.ok) {
              logger.warn("Workday detail request failed", {
                company: company.name,
                externalPath: posting.externalPath,
                status: detailRes.status,
              });
              return null;
            }

            const detail = (await detailRes.json()) as CxsDetailResponse;
            const info = detail.jobPostingInfo;

            // Secondary US validation via country object
            if (info.country && info.country.id !== US_COUNTRY_FACET_ID) {
              logger.info("Skipping non-US job", { company: company.name, title: info.title, country: info.country.descriptor });
              return null;
            }

            const locations = [info.location, ...(info.additionalLocations ?? [])].filter(Boolean);
            const locationText = locations.join(", ").toLowerCase();
            const locationType = locationText.includes("remote") ? "Remote" :
              locationText.includes("hybrid") ? "Hybrid" : null;

            const salary = extractSalaryFromHtml(info.jobDescription ?? "");

            if (salary.isHourly) {
              logger.info("Skipping hourly role", { company: company.name, title: info.title, salaryMax: salary.max });
              return null;
            }

            return {
              externalJobId: posting.externalPath,
              title: info.title ?? posting.title,
              url: info.externalUrl ?? `https://${host}/en-US/${siteId}/job/${path}`,
              department: info.jobFamilyGroup ?? null,
              locations,
              locationType,
              salaryMin: salary.min,
              salaryMax: salary.max,
              salaryCurrency: "USD",
              jobDescriptionHtml: info.jobDescription ?? "",
              postedAt: info.startDate ?? null,
              postingEndDate: info.endDate ?? null,
            };
          } catch (err) {
            logger.warn("Workday detail fetch error", {
              company: company.name,
              externalPath: posting.externalPath,
              error: err instanceof Error ? err.message : String(err),
            });
            return null;
          }
        }),
      );

      const results = await Promise.allSettled(detailTasks);
      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          jobs.push(result.value);
        }
      }

      offset += data.jobPostings.length;
      if (offset >= totalJobs) break;
    }

    logger.info("Workday CXS scrape complete", { company: company.name, jobCount: jobs.length, detailSkipped });
    return jobs;
  }
}
