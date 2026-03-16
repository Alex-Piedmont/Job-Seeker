import type { AtsAdapter, ScrapedJobData, ExistingJobRecord } from "./types.js";
import { config } from "../config.js";
import { hostRateLimiter } from "../utils/concurrency.js";
import { fetchWithRetry } from "../utils/fetch-retry.js";
import { isUSLocation } from "../utils/location-filter.js";
import { delay } from "../utils/delay.js";
import { logger } from "../utils/logger.js";

// Eightfold's CloudFront WAF is aggressive — enforce ~500ms between requests
// (global minRequestIntervalMs is 100ms which is too fast for this platform).
const EIGHTFOLD_REQUEST_DELAY_MS = 750;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EightfoldVariant = "pcsx" | "smartapply";

interface PCSXPosition {
  id: number;
  name: string;
  locations?: string[];
  standardizedLocations?: string[];
  department?: string;
  postedTs?: number;
  workLocationOption?: string;
  positionUrl?: string;
}

interface PCSXFilterOption {
  label?: string;
  value?: string;
  count?: number;
}

interface PCSXListResponse {
  status: number;
  data?: {
    count?: number;
    positions?: PCSXPosition[];
    filterDef?: {
      facets?: Record<string, PCSXFilterOption[]>;
      allFilters?: Record<string, PCSXFilterOption[]>;
    };
  };
  error?: string;
}

interface PCSXDetailData {
  id: number;
  name?: string;
  jobDescription?: string;
  location?: string;
  locations?: string[];
  department?: string;
  postedTs?: number;
  workLocationOption?: string;
  efcustomTextPayRangenonretail?: string;
}

interface PCSXDetailResponse {
  status: number;
  data?: PCSXDetailData;
}

interface SmartApplyPosition {
  id: number;
  name: string;
  locations?: string[];
  department?: string;
  t_create?: number;
  work_location_option?: string;
}

interface SmartApplyListResponse {
  count?: number;
  positions?: SmartApplyPosition[];
}

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

function parseBaseUrl(baseUrl: string): {
  host: string;
  domain: string;
  filterParams: URLSearchParams;
} {
  const url = new URL(baseUrl);
  const host = url.hostname;

  // Extract domain from query params, or derive from hostname
  let domain = url.searchParams.get("domain") ?? "";
  if (!domain) {
    const sub = host.split(".")[0];
    domain = `${sub}.com`;
  }

  // Collect filter_* params
  const filterParams = new URLSearchParams();
  for (const [key, value] of url.searchParams) {
    if (key.startsWith("filter_")) {
      filterParams.append(key, value);
    }
  }

  return { host, domain, filterParams };
}

// ---------------------------------------------------------------------------
// Variant detection (cached per-host for session)
// ---------------------------------------------------------------------------

const variantCache = new Map<string, EightfoldVariant>();

/** Rate-limit wrapper: global limiter + Eightfold-specific extra delay */
async function acquireSlot(host: string): Promise<void> {
  await hostRateLimiter.acquire(host);
  await delay(EIGHTFOLD_REQUEST_DELAY_MS);
}

function browserHeaders(host: string): Record<string, string> {
  return {
    "User-Agent": config.userAgent,
    "Accept": "application/json, text/plain, */*",
    "Referer": `https://${host}/careers`,
    "Origin": `https://${host}`,
  };
}

async function detectVariant(host: string, domain: string): Promise<EightfoldVariant> {
  const cached = variantCache.get(host);
  if (cached) return cached;

  const pcsxUrl = `https://${host}/api/pcsx/search?domain=${encodeURIComponent(domain)}&start=0&sort_by=relevance`;
  await acquireSlot(host);
  try {
    const res = await fetchWithRetry(pcsxUrl, {
      headers: browserHeaders(host),
      signal: AbortSignal.timeout(15000),
    });

    if (res.ok) {
      const data = (await res.json()) as PCSXListResponse;
      if (data.status === 200 && data.data?.positions) {
        variantCache.set(host, "pcsx");
        return "pcsx";
      }
    }
  } catch {
    // PCSX not available, fall through
  }

  variantCache.set(host, "smartapply");
  return "smartapply";
}

// ---------------------------------------------------------------------------
// Salary parsing
// ---------------------------------------------------------------------------

function parseSalaryRange(text: string | undefined): { min: number | null; max: number | null } {
  if (!text) return { min: null, max: null };
  const nums = text.match(/[\$]?([\d,]+(?:\.\d+)?)\s*[kK]?/g);
  if (!nums || nums.length < 2) return { min: null, max: null };

  const parse = (s: string): number => {
    const cleaned = s.replace(/[\$,]/g, "");
    let val = parseFloat(cleaned);
    if (s.toLowerCase().includes("k")) val *= 1000;
    return Math.round(val);
  };

  return { min: parse(nums[0]), max: parse(nums[1]) };
}

// ---------------------------------------------------------------------------
// Location helpers
// ---------------------------------------------------------------------------

function isUSPositionLocations(locations: string[] | undefined): boolean {
  if (!locations || locations.length === 0) return false;
  return locations.some(
    (loc) => loc.toLowerCase() === "remote" || isUSLocation(loc),
  );
}

function mapLocationType(workOption: string | undefined): string | null {
  if (!workOption) return null;
  const lower = workOption.toLowerCase();
  if (lower === "remote") return "Remote";
  if (lower === "hybrid") return "Hybrid";
  return null;
}

// ---------------------------------------------------------------------------
// JSON-LD fallback for detail fetching (works for both variants)
// ---------------------------------------------------------------------------

interface JsonLdDetail {
  description: string;
  postedAt: string | null;
  postingEndDate: string | null;
}

async function fetchJsonLdDetail(
  host: string,
  domain: string,
  positionId: number,
): Promise<JsonLdDetail | null> {
  const pageUrl = `https://${host}/careers/job/${positionId}?domain=${encodeURIComponent(domain)}`;
  const pageRes = await fetchWithRetry(pageUrl, {
    headers: browserHeaders(host),
  });

  if (!pageRes.ok) return null;

  const html = await pageRes.text();
  const jsonLdMatch = html.match(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!jsonLdMatch) return null;

  try {
    const ld = JSON.parse(jsonLdMatch[1]) as {
      description?: string;
      datePosted?: string;
      validThrough?: string;
    };
    return {
      description: ld.description ?? "",
      postedAt: ld.datePosted ? ld.datePosted.split("T")[0] : null,
      postingEndDate: ld.validThrough ? ld.validThrough.split("T")[0] : null,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// PCSX server-side filter discovery
// ---------------------------------------------------------------------------

/**
 * Discover server-side filters from the first PCSX API response.
 * Returns filter params for US locations and full-time employment type
 * (when available). This dramatically reduces pagination for large companies.
 */
function discoverPCSXFilters(
  data: PCSXListResponse,
  companyName: string,
): URLSearchParams {
  const filters = new URLSearchParams();
  const filterDef = data.data?.filterDef;
  if (!filterDef) return filters;

  // 1. Location filters — select US and Remote entries
  const locationFacets = filterDef.facets?.locations;
  if (locationFacets && locationFacets.length > 0) {
    const usValues = locationFacets
      .filter((f) => {
        const val = (f.value ?? f.label ?? "").toLowerCase();
        return val.includes("united states") || val === "remote";
      })
      .map((f) => f.value ?? f.label ?? "");

    for (const val of usValues) {
      filters.append("filter_locations", val);
    }
    if (usValues.length > 0) {
      logger.info("Eightfold PCSX: applying location filters", {
        company: companyName,
        locationFilters: usValues,
      });
    }
  }

  // 2. Employment type filter — prefer full-time when available
  const employmentTypes = filterDef.allFilters?.employment_type;
  if (employmentTypes && employmentTypes.length > 0) {
    const fullTime = employmentTypes.find(
      (f) => (f.value ?? f.label ?? "").toLowerCase() === "full-time",
    );
    if (fullTime) {
      filters.set("filter_employment_type", fullTime.value ?? fullTime.label ?? "full-time");
      logger.info("Eightfold PCSX: applying employment_type=full-time filter", {
        company: companyName,
      });
    }
  }

  return filters;
}

// ---------------------------------------------------------------------------
// PCSX adapter methods
// ---------------------------------------------------------------------------

async function listPCSX(
  host: string,
  domain: string,
  filterParams: URLSearchParams,
  existingJobs: Map<string, ExistingJobRecord> | undefined,
  companyName: string,
): Promise<ScrapedJobData[]> {
  const pLimit = (await import("p-limit")).default;
  const detailLimit = pLimit(3); // Conservative for Eightfold's aggressive WAF

  const jobs: ScrapedJobData[] = [];
  let start = 0;
  let totalCount = -1;
  let detailSkipped = 0;
  let detailApiFailed = false; // Track if PCSX detail API is blocked (403)
  let filtersDiscovered = false;

  while (true) {
    const params = new URLSearchParams(filterParams);
    params.set("domain", domain);
    params.set("start", String(start));
    params.set("sort_by", "relevance");

    const listUrl = `https://${host}/api/pcsx/search?${params}`;
    await acquireSlot(host);

    const res = await fetchWithRetry(listUrl, {
      headers: browserHeaders(host),
    });

    if (!res.ok) {
      if ((res.status === 403 || res.status === 429) && jobs.length > 0) {
        logger.warn("Eightfold PCSX list blocked, returning partial results", {
          company: companyName,
          status: res.status,
          start,
          jobsSoFar: jobs.length,
        });
        break;
      }
      throw new Error(`Eightfold PCSX returned ${res.status} for ${companyName} (start ${start})`);
    }

    const data = (await res.json()) as PCSXListResponse;

    // After the first (unfiltered) page, discover server-side filters
    // and restart pagination with them applied
    if (!filtersDiscovered) {
      filtersDiscovered = true;
      const unfilteredTotal = data.data?.count ?? 0;
      const discovered = discoverPCSXFilters(data, companyName);

      if (discovered.size > 0) {
        // Merge discovered filters into filterParams for all subsequent requests
        for (const [key, value] of discovered) {
          filterParams.append(key, value);
        }

        // Re-fetch page 0 with filters to get accurate filtered count
        logger.info("Eightfold PCSX: re-fetching with server-side filters", {
          company: companyName,
          unfilteredTotal,
        });
        start = 0;
        totalCount = -1;
        continue; // restart the loop — will build new params from updated filterParams
      }

      // No filters discovered — use the current response as-is
      totalCount = unfilteredTotal;
      logger.info("Eightfold PCSX total positions", { company: companyName, total: totalCount });
    } else if (totalCount < 0) {
      totalCount = data.data?.count ?? 0;
      logger.info("Eightfold PCSX total positions (filtered)", {
        company: companyName,
        total: totalCount,
      });
    }

    const positions = data.data?.positions ?? [];
    if (positions.length === 0) break;

    // Filter to US positions
    const eligible = positions.filter((p) =>
      isUSPositionLocations(p.standardizedLocations ?? p.locations),
    );

    const detailTasks = eligible.map((pos) =>
      detailLimit(async (): Promise<ScrapedJobData | null> => {
        try {
          const externalId = String(pos.id);

          // Content hash skip
          if (existingJobs) {
            const existing = existingJobs.get(externalId);
            if (existing && existing.contentHash && existing.title === pos.name) {
              detailSkipped++;
              return {
                externalJobId: externalId,
                title: pos.name,
                url: `https://${host}/careers/job/${pos.id}`,
                department: pos.department ?? null,
                locations: pos.locations ?? [],
                locationType: mapLocationType(pos.workLocationOption),
                salaryMin: null,
                salaryMax: null,
                salaryCurrency: "USD",
                jobDescriptionHtml: "",
                postedAt: pos.postedTs ? new Date(pos.postedTs * 1000).toISOString().split("T")[0] : null,
                postingEndDate: null,
              };
            }
          }

          // Try PCSX detail API (unless already known to be blocked)
          if (!detailApiFailed) {
            await acquireSlot(host);
            const detailUrl = `https://${host}/api/pcsx/position_details?domain=${encodeURIComponent(domain)}&position_id=${pos.id}`;
            const detailRes = await fetchWithRetry(detailUrl, {
              headers: browserHeaders(host),
            });

            if (detailRes.ok) {
              const detailData = (await detailRes.json()) as PCSXDetailResponse;
              const detail = detailData.data;
              if (detail) {
                const salary = parseSalaryRange(detail.efcustomTextPayRangenonretail);
                return {
                  externalJobId: externalId,
                  title: detail.name ?? pos.name,
                  url: `https://${host}/careers/job/${pos.id}`,
                  department: detail.department ?? pos.department ?? null,
                  locations: pos.locations ?? [],
                  locationType: mapLocationType(detail.workLocationOption ?? pos.workLocationOption),
                  salaryMin: salary.min,
                  salaryMax: salary.max,
                  salaryCurrency: "USD",
                  jobDescriptionHtml: detail.jobDescription ?? "",
                  postedAt: (detail.postedTs ?? pos.postedTs)
                    ? new Date(((detail.postedTs ?? pos.postedTs)!) * 1000).toISOString().split("T")[0]
                    : null,
                  postingEndDate: null,
                };
              }
            } else if (detailRes.status === 403 || detailRes.status === 429) {
              detailApiFailed = true;
              logger.warn("Eightfold PCSX detail API blocked, falling back to JSON-LD", {
                company: companyName,
                status: detailRes.status,
              });
            }
          }

          // Fallback: fetch HTML page and parse JSON-LD
          await acquireSlot(host);
          const ld = await fetchJsonLdDetail(host, domain, pos.id);
          return {
            externalJobId: externalId,
            title: pos.name,
            url: `https://${host}/careers/job/${pos.id}`,
            department: pos.department ?? null,
            locations: pos.locations ?? [],
            locationType: mapLocationType(pos.workLocationOption),
            salaryMin: null,
            salaryMax: null,
            salaryCurrency: "USD",
            jobDescriptionHtml: ld?.description ?? "",
            postedAt: ld?.postedAt ?? (pos.postedTs ? new Date(pos.postedTs * 1000).toISOString().split("T")[0] : null),
            postingEndDate: ld?.postingEndDate ?? null,
          };
        } catch (err) {
          logger.warn("Eightfold PCSX detail error", {
            company: companyName,
            positionId: pos.id,
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

    start += positions.length;
    if (start >= totalCount) break;
  }

  logger.info("Eightfold PCSX scrape complete", {
    company: companyName,
    jobCount: jobs.length,
    detailSkipped,
    usedJsonLdFallback: detailApiFailed,
  });
  return jobs;
}

// ---------------------------------------------------------------------------
// SmartApply adapter methods
// ---------------------------------------------------------------------------

async function listSmartApply(
  host: string,
  domain: string,
  filterParams: URLSearchParams,
  existingJobs: Map<string, ExistingJobRecord> | undefined,
  companyName: string,
): Promise<ScrapedJobData[]> {
  const pLimit = (await import("p-limit")).default;
  const detailLimit = pLimit(3); // Conservative for Eightfold's aggressive WAF

  const jobs: ScrapedJobData[] = [];
  let start = 0;
  let totalCount = -1;
  let detailSkipped = 0;

  while (true) {
    const params = new URLSearchParams(filterParams);
    params.set("domain", domain);
    params.set("start", String(start));

    const listUrl = `https://${host}/api/apply/v2/jobs?${params}`;
    await acquireSlot(host);

    const res = await fetchWithRetry(listUrl, {
      headers: browserHeaders(host),
    });

    if (!res.ok) {
      if ((res.status === 403 || res.status === 429) && jobs.length > 0) {
        logger.warn("Eightfold SmartApply list blocked, returning partial results", {
          company: companyName,
          status: res.status,
          start,
          jobsSoFar: jobs.length,
        });
        break;
      }
      throw new Error(`Eightfold SmartApply returned ${res.status} for ${companyName} (start ${start})`);
    }

    const data = (await res.json()) as SmartApplyListResponse;

    if (totalCount < 0) {
      totalCount = data.count ?? 0;
      logger.info("Eightfold SmartApply total positions", { company: companyName, total: totalCount });
    }

    const positions = data.positions ?? [];
    if (positions.length === 0) break;

    // Filter to US positions
    const eligible = positions.filter((p) => isUSPositionLocations(p.locations));

    const detailTasks = eligible.map((pos) =>
      detailLimit(async (): Promise<ScrapedJobData | null> => {
        try {
          const externalId = String(pos.id);

          // Content hash skip
          if (existingJobs) {
            const existing = existingJobs.get(externalId);
            if (existing && existing.contentHash && existing.title === pos.name) {
              detailSkipped++;
              return {
                externalJobId: externalId,
                title: pos.name,
                url: `https://${host}/careers/job/${pos.id}`,
                department: pos.department ?? null,
                locations: pos.locations ?? [],
                locationType: mapLocationType(pos.work_location_option),
                salaryMin: null,
                salaryMax: null,
                salaryCurrency: "USD",
                jobDescriptionHtml: "",
                postedAt: pos.t_create ? new Date(pos.t_create * 1000).toISOString().split("T")[0] : null,
                postingEndDate: null,
              };
            }
          }

          await acquireSlot(host);
          const ld = await fetchJsonLdDetail(host, domain, pos.id);

          return {
            externalJobId: externalId,
            title: pos.name,
            url: `https://${host}/careers/job/${pos.id}`,
            department: pos.department ?? null,
            locations: pos.locations ?? [],
            locationType: mapLocationType(pos.work_location_option),
            salaryMin: null,
            salaryMax: null,
            salaryCurrency: "USD",
            jobDescriptionHtml: ld?.description ?? "",
            postedAt: ld?.postedAt ?? (pos.t_create ? new Date(pos.t_create * 1000).toISOString().split("T")[0] : null),
            postingEndDate: ld?.postingEndDate ?? null,
          };
        } catch (err) {
          logger.warn("Eightfold SmartApply detail error", {
            company: companyName,
            positionId: pos.id,
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

    start += positions.length;
    if (start >= totalCount) break;
  }

  logger.info("Eightfold SmartApply scrape complete", { company: companyName, jobCount: jobs.length, detailSkipped });
  return jobs;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class EightfoldAdapter implements AtsAdapter {
  async listJobs(
    company: { id: string; name: string; baseUrl: string; atsPlatform: string; lastScrapeAt: Date | null },
    existingJobs?: Map<string, ExistingJobRecord>,
  ): Promise<ScrapedJobData[]> {
    const { host, domain, filterParams } = parseBaseUrl(company.baseUrl);

    logger.info("Starting Eightfold scrape", { company: company.name, host, domain });

    const variant = await detectVariant(host, domain);
    logger.info("Eightfold variant detected", { company: company.name, variant });

    if (variant === "pcsx") {
      return listPCSX(host, domain, filterParams, existingJobs, company.name);
    } else {
      return listSmartApply(host, domain, filterParams, existingJobs, company.name);
    }
  }
}
