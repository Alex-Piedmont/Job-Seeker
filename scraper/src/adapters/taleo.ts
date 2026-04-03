import type { AtsAdapter, ScrapedJobData, ExistingJobRecord } from "./types.js";
import { config } from "../config.js";
import { hostRateLimiter } from "../utils/concurrency.js";
import { fetchWithRetry } from "../utils/fetch-retry.js";
import { isUSLocation } from "../utils/location-filter.js";
import { logger } from "../utils/logger.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaleoSession {
  cookie: string;
  portalNo: string;
}

interface TaleoRequisition {
  jobId: string;
  contestNo: string;
  column: string[];
  locationsColumns?: number[];
}

interface TaleoSearchResponse {
  requisitionList?: TaleoRequisition[];
  pagingData?: {
    currentPageNo: number;
    pageSize: number;
    totalCount: number;
  };
}

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

function parseTaleoUrl(baseUrl: string): { tenant: string; csCode: string; host: string } {
  const url = new URL(baseUrl);
  const host = url.hostname;
  // Tenant is the subdomain: "valero" from "valero.taleo.net"
  const tenant = host.split(".")[0];
  // csCode is the path segment after /careersection/: "2" from "/careersection/2/jobsearch.ftl"
  const pathMatch = url.pathname.match(/\/careersection\/([^/]+)/);
  const csCode = pathMatch?.[1] ?? "";
  return { tenant, csCode, host };
}

// ---------------------------------------------------------------------------
// Session management (cookie + portalNo discovery)
// ---------------------------------------------------------------------------

const sessionCache = new Map<string, TaleoSession>();

async function acquireSession(
  host: string,
  tenant: string,
  csCode: string,
): Promise<TaleoSession> {
  const cacheKey = `${tenant}/${csCode}`;
  const cached = sessionCache.get(cacheKey);
  if (cached) return cached;

  await hostRateLimiter.acquire(host);
  const pageUrl = `https://${host}/careersection/${csCode}/jobsearch.ftl`;
  const resp = await fetchWithRetry(pageUrl, {
    headers: { "User-Agent": config.userAgent },
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    throw new Error(`Failed to load Taleo career section page: ${resp.status}`);
  }

  // Extract session cookie
  const setCookie = resp.headers.get("set-cookie") ?? "";
  const cookieMatch = setCookie.match(/([A-Z0-9_]+SESSION[A-Z0-9_]*=[^;]+)/i)
    ?? setCookie.match(/([A-Z0-9_]+=[\w-]+)/);
  const cookie = cookieMatch?.[1] ?? "";

  // Extract portalNo from embedded JS or URL parameters
  // Variants: portalNo: '101430233' | portalNo='101430233' | portal=201430233
  const html = await resp.text();
  const portalMatch = html.match(/portalNo\s*[:=]\s*['"]?(\d+)['"]?/)
    ?? html.match(/portal\s*=\s*['"]?(\d{6,})['"]?/);
  if (!portalMatch) {
    throw new Error(`Could not extract portalNo from ${pageUrl}`);
  }
  const portalNo = portalMatch[1];

  logger.info("Taleo session acquired", { tenant, csCode, portalNo, hasCookie: cookie.length > 0 });

  const session: TaleoSession = { cookie, portalNo };
  sessionCache.set(cacheKey, session);
  return session;
}

// ---------------------------------------------------------------------------
// Location helpers
// ---------------------------------------------------------------------------

/**
 * Taleo locations follow "US-TX-Houston" format.
 * Parse the JSON-encoded locations column and check for US prefix.
 */
function extractLocations(columnValue: string): string[] {
  try {
    const parsed = JSON.parse(columnValue);
    if (Array.isArray(parsed)) return parsed as string[];
    if (typeof parsed === "string") return [parsed];
  } catch {
    // Not JSON, treat as plain string
    if (columnValue) return [columnValue];
  }
  return [];
}

function isTaleoUSLocation(locations: string[]): boolean {
  return locations.some((loc) => {
    if (loc.startsWith("US-") || loc.startsWith("US ")) return true;
    // Also check via the shared isUSLocation for "City, ST" format
    return isUSLocation(loc);
  });
}

function formatTaleoLocation(loc: string): string {
  // "US-TX-Houston" -> "Houston, TX"
  const parts = loc.match(/^US-([A-Z]{2})-(.+)$/);
  if (parts) return `${parts[2]}, ${parts[1]}`;
  return loc;
}

// ---------------------------------------------------------------------------
// Detail page parsing
// ---------------------------------------------------------------------------

/**
 * Safely decode URL-encoded strings, handling malformed sequences gracefully.
 * Taleo uses `%5C:` (backslash-colon) in CSS which can trip up decodeURIComponent
 * if other sequences are malformed.
 */
function safeDecode(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    // Fallback: decode only well-formed sequences
    return str.replace(/%([0-9A-Fa-f]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
  }
}

async function fetchJobDetail(
  host: string,
  csCode: string,
  contestNo: string,
  session: TaleoSession,
): Promise<{ description: string; postedAt: string | null }> {
  const detailUrl = `https://${host}/careersection/${csCode}/jobdetail.ftl?job=${contestNo}`;
  await hostRateLimiter.acquire(host);
  const resp = await fetchWithRetry(detailUrl, {
    headers: {
      "User-Agent": config.userAgent,
      "Cookie": session.cookie,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    logger.warn("Taleo detail page fetch failed", { contestNo, status: resp.status });
    return { description: "", postedAt: null };
  }

  const html = await resp.text();

  // Extract the initialHistory hidden field
  // Format: fields separated by !|! with URL-encoded values
  const historyMatch = html.match(/name\s*=\s*["']initialHistory["'][^>]*value\s*=\s*["']([^"']+)["']/i);
  if (historyMatch) {
    const raw = historyMatch[1];
    const parts = raw.split("!|!");

    // Find the longest HTML-containing part (description)
    // Description parts start with %3C (encoded '<') and contain HTML tags
    let description = "";
    for (const part of parts) {
      // Skip sub-separators like !*!
      const cleanPart = part.replace(/^!\*!/, "").replace(/!\*!$/, "");
      if (cleanPart.includes("%3C") || cleanPart.includes("%3c")) {
        const decoded = safeDecode(cleanPart);
        if (decoded.includes("<") && decoded.length > description.length) {
          description = decoded;
        }
      }
    }

    if (description) {
      return { description, postedAt: null };
    }
  }

  return { description: "", postedAt: null };
}

// ---------------------------------------------------------------------------
// Search API
// ---------------------------------------------------------------------------

function buildSearchBody(pageNo: number): object {
  return {
    multilineEnabled: false,
    sortingSelection: {
      sortBySelectionParam: "1",
      ascendingSortingOrder: "false",
    },
    fieldData: {
      fields: { KEYWORD: "", LOCATION: "" },
      valid: true,
    },
    filterSelectionParam: {
      searchFilterSelections: [
        { id: "POSTING_DATE", selectedValues: [] },
        { id: "LOCATION", selectedValues: [] },
        { id: "JOB_FIELD", selectedValues: [] },
        { id: "JOB_TYPE", selectedValues: [] },
        { id: "JOB_SCHEDULE", selectedValues: [] },
      ],
    },
    advancedSearchFiltersSelectionParam: {
      searchFilterSelections: [
        { id: "ORGANIZATION", selectedValues: [] },
        { id: "LOCATION", selectedValues: [] },
        { id: "JOB_FIELD", selectedValues: [] },
        { id: "JOB_NUMBER", selectedValues: [] },
        { id: "URGENT_JOB", selectedValues: [] },
        { id: "EMPLOYEE_STATUS", selectedValues: [] },
      ],
    },
    pageNo,
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class TaleoAdapter implements AtsAdapter {
  async listJobs(
    company: { id: string; name: string; baseUrl: string; atsPlatform: string; lastScrapeAt: Date | null },
    existingJobs?: Map<string, ExistingJobRecord>,
  ): Promise<ScrapedJobData[]> {
    const { tenant, csCode, host } = parseTaleoUrl(company.baseUrl);
    logger.info("Starting Taleo scrape", { company: company.name, tenant, csCode });

    // Acquire session (cookie + portalNo)
    const session = await acquireSession(host, tenant, csCode);

    const jobs: ScrapedJobData[] = [];
    const pLimit = (await import("p-limit")).default;
    const detailLimit = pLimit(config.concurrency.jobDetailConcurrency);
    let detailSkipped = 0;
    let page = 1;
    let totalCount = -1;
    let locationColIndex = -1;
    let titleColIndex = 0;
    let dateColIndex = -1;

    // Paginate search results
    while (true) {
      await hostRateLimiter.acquire(host);
      const searchUrl = `https://${host}/careersection/rest/jobboard/searchjobs?lang=en&portal=${session.portalNo}`;
      const resp = await fetchWithRetry(searchUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": config.userAgent,
          "Cookie": session.cookie,
          "tz": "GMT-05:00",
        },
        body: JSON.stringify(buildSearchBody(page)),
        signal: AbortSignal.timeout(20000),
      });

      if (!resp.ok) {
        logger.error("Taleo search API error", { company: company.name, page, status: resp.status });
        break;
      }

      const data = (await resp.json()) as TaleoSearchResponse;
      const paging = data.pagingData;

      if (totalCount < 0 && paging) {
        totalCount = paging.totalCount;
        logger.info("Taleo total jobs", { company: company.name, total: totalCount });
      }

      const reqs = data.requisitionList ?? [];
      if (reqs.length === 0) break;

      // Detect column layout from first page
      if (page === 1 && reqs[0]) {
        const firstReq = reqs[0];
        // locationsColumns tells us which column indices have location data
        if (firstReq.locationsColumns && firstReq.locationsColumns.length > 0) {
          locationColIndex = firstReq.locationsColumns[0];
        }
        // Title is typically column[0] (linkedColumn index)
        titleColIndex = 0;
        // Date is typically the last column
        dateColIndex = (firstReq.column?.length ?? 1) - 1;
      }

      // Process each requisition
      const eligible: Array<{ req: TaleoRequisition; title: string; locations: string[]; postedAt: string | null }> = [];

      for (const req of reqs) {
        const title = req.column?.[titleColIndex] ?? "";
        const locationRaw = locationColIndex >= 0 ? (req.column?.[locationColIndex] ?? "") : "";
        const locations = extractLocations(locationRaw);

        // US filter at list level
        if (locations.length > 0 && !isTaleoUSLocation(locations)) continue;

        // Parse posting date from column
        let postedAt: string | null = null;
        if (dateColIndex >= 0 && req.column?.[dateColIndex]) {
          try {
            const d = new Date(req.column[dateColIndex]);
            if (!isNaN(d.getTime())) {
              postedAt = d.toISOString().split("T")[0];
            }
          } catch {
            // skip
          }
        }

        eligible.push({ req, title, locations, postedAt });
      }

      // Fetch details concurrently
      const detailTasks = eligible.map(({ req, title, locations, postedAt }) =>
        detailLimit(async (): Promise<ScrapedJobData | null> => {
          try {
            const externalId = req.contestNo;

            // Content-hash skip
            if (existingJobs) {
              const existing = existingJobs.get(externalId);
              if (existing && existing.contentHash && existing.title === title) {
                detailSkipped++;
                return {
                  externalJobId: externalId,
                  title,
                  url: `https://${host}/careersection/${csCode}/jobdetail.ftl?job=${req.contestNo}`,
                  department: null,
                  locations: locations.map(formatTaleoLocation),
                  locationType: null,
                  salaryMin: null,
                  salaryMax: null,
                  salaryCurrency: "USD",
                  jobDescriptionHtml: "",
                  postedAt,
                  postingEndDate: null,
                };
              }
            }

            const detail = await fetchJobDetail(host, csCode, req.contestNo, session);

            return {
              externalJobId: externalId,
              title,
              url: `https://${host}/careersection/${csCode}/jobdetail.ftl?job=${req.contestNo}`,
              department: null,
              locations: locations.map(formatTaleoLocation),
              locationType: null,
              salaryMin: null,
              salaryMax: null,
              salaryCurrency: "USD",
              jobDescriptionHtml: detail.description,
              postedAt: detail.postedAt ?? postedAt,
              postingEndDate: null,
            };
          } catch (err) {
            logger.warn("Taleo detail error", {
              company: company.name,
              contestNo: req.contestNo,
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

      // Next page
      if (paging && page * paging.pageSize >= paging.totalCount) break;
      page++;
    }

    logger.info("Taleo scrape complete", {
      company: company.name,
      jobCount: jobs.length,
      detailSkipped,
      totalFromAPI: totalCount,
    });

    return jobs;
  }
}
