import type { AtsAdapter, ScrapedJobData, ExistingJobRecord } from "./types.js";
import { config } from "../config.js";
import { hostRateLimiter } from "../utils/concurrency.js";
import { isUSLocation } from "../utils/location-filter.js";
import { logger } from "../utils/logger.js";

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

/** Extract the company identifier from a SmartRecruiters API URL. */
function parseCompanyId(baseUrl: string): string {
  // e.g. https://api.smartrecruiters.com/v1/companies/Visa → "Visa"
  const url = new URL(baseUrl);
  const segments = url.pathname.split("/").filter(Boolean);
  const companiesIdx = segments.indexOf("companies");
  if (companiesIdx === -1 || companiesIdx + 1 >= segments.length) {
    throw new Error(`Cannot parse SmartRecruiters URL – expected /companies/{id} path: ${baseUrl}`);
  }
  return segments[companiesIdx + 1];
}

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

interface SRLocation {
  country?: string;
  city?: string;
  region?: string;
  remote?: boolean;
}

interface SRListPosting {
  id: string;
  name: string;
  department?: { label?: string };
  location?: SRLocation & { fullLocation?: string };
  releasedDate?: string;
  ref?: string;
}

interface SRListResponse {
  totalFound: number;
  offset: number;
  limit: number;
  content: SRListPosting[];
}

interface SRCompensation {
  min?: number;
  max?: number;
  currency?: string;
}

interface SRJobAdSection {
  text?: string;
}

interface SRJobAd {
  sections?: {
    companyDescription?: SRJobAdSection;
    jobDescription?: SRJobAdSection;
    qualifications?: SRJobAdSection;
    additionalInformation?: SRJobAdSection;
  };
}

interface SRDetailResponse {
  id: string;
  name: string;
  postingUrl?: string;
  department?: { label?: string };
  location?: SRLocation & { fullLocation?: string };
  compensation?: SRCompensation;
  jobAd?: SRJobAd;
  releasedDate?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapLocationType(location?: SRLocation & { fullLocation?: string }): string | null {
  if (!location) return null;
  if (location.remote) return "Remote";
  // Check if fullLocation hints at hybrid
  if (location.fullLocation?.toLowerCase().includes("hybrid")) return "Hybrid";
  return null;
}

function isUSPosting(posting: SRListPosting): boolean {
  if (posting.location?.country?.toLowerCase() === "us") return true;
  if (posting.location?.fullLocation && isUSLocation(posting.location.fullLocation)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

const API_HOST = "api.smartrecruiters.com";
const PAGE_SIZE = 100;

export class SmartRecruitersAdapter implements AtsAdapter {
  async listJobs(
    company: { id: string; name: string; baseUrl: string; atsPlatform: string; lastScrapeAt: Date | null },
    existingJobs?: Map<string, ExistingJobRecord>,
  ): Promise<ScrapedJobData[]> {
    const companyId = parseCompanyId(company.baseUrl);
    const apiBase = `https://${API_HOST}/v1/companies/${companyId}`;

    const pLimit = (await import("p-limit")).default;
    const detailLimit = pLimit(config.concurrency.jobDetailConcurrency);

    const jobs: ScrapedJobData[] = [];
    let offset = 0;
    let totalFound = -1;
    let detailSkipped = 0;

    logger.info("Starting SmartRecruiters scrape", { company: company.name, companyId });
    logger.info("Server-side country filtering applied (country=US); client-side filter retained as safety net");

    // Paginate list endpoint
    while (true) {
      const listUrl = `${apiBase}/postings?limit=${PAGE_SIZE}&offset=${offset}&country=US`;

      await hostRateLimiter.acquire(API_HOST);
      const res = await fetch(listUrl, {
        headers: { "User-Agent": config.userAgent },
      });

      if (!res.ok) {
        throw new Error(`SmartRecruiters API returned ${res.status} for ${company.name} (offset ${offset})`);
      }

      const data = (await res.json()) as SRListResponse;

      if (totalFound < 0) {
        totalFound = data.totalFound;
        logger.info("SmartRecruiters total postings reported", { company: company.name, total: totalFound });
      }

      if (!data.content || data.content.length === 0) break;

      // Filter to US postings
      const eligible = data.content.filter(isUSPosting);

      const detailTasks = eligible.map((posting) =>
        detailLimit(async (): Promise<ScrapedJobData | null> => {
          try {
            const externalId = String(posting.id);

            // Content hash skip: if title matches and contentHash exists, skip detail fetch
            if (existingJobs) {
              const existing = existingJobs.get(externalId);
              if (existing && existing.contentHash && existing.title === posting.name) {
                detailSkipped++;
                return {
                  externalJobId: externalId,
                  title: posting.name,
                  url: `https://jobs.smartrecruiters.com/${companyId}/${posting.id}`,
                  department: posting.department?.label ?? null,
                  locations: posting.location?.fullLocation ? [posting.location.fullLocation] : [],
                  locationType: mapLocationType(posting.location),
                  salaryMin: null,
                  salaryMax: null,
                  salaryCurrency: "USD",
                  jobDescriptionHtml: "",
                  postedAt: posting.releasedDate ? posting.releasedDate.split("T")[0] : null,
                  postingEndDate: null,
                };
              }
            }

            await hostRateLimiter.acquire(API_HOST);

            const detailUrl = `${apiBase}/postings/${posting.id}`;
            const detailRes = await fetch(detailUrl, {
              headers: { "User-Agent": config.userAgent },
            });

            if (!detailRes.ok) {
              logger.warn("SmartRecruiters detail request failed", {
                company: company.name,
                postingId: posting.id,
                status: detailRes.status,
              });
              return null;
            }

            const detail = (await detailRes.json()) as SRDetailResponse;

            // Build description from jobAd sections
            const sections = detail.jobAd?.sections;
            const descriptionParts = [
              sections?.companyDescription?.text,
              sections?.jobDescription?.text,
              sections?.qualifications?.text,
              sections?.additionalInformation?.text,
            ].filter(Boolean);
            const descriptionHtml = descriptionParts.join("\n");

            const url = detail.postingUrl || `https://jobs.smartrecruiters.com/${companyId}/${posting.id}`;

            return {
              externalJobId: externalId,
              title: detail.name,
              url,
              department: detail.department?.label ?? null,
              locations: detail.location?.fullLocation ? [detail.location.fullLocation] : [],
              locationType: mapLocationType(detail.location),
              salaryMin: detail.compensation?.min ?? null,
              salaryMax: detail.compensation?.max ?? null,
              salaryCurrency: detail.compensation?.currency ?? "USD",
              jobDescriptionHtml: descriptionHtml,
              postedAt: detail.releasedDate ? detail.releasedDate.split("T")[0] : null,
              postingEndDate: null,
            };
          } catch (err) {
            logger.warn("SmartRecruiters detail fetch error", {
              company: company.name,
              postingId: posting.id,
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

      offset += data.content.length;
      if (offset >= totalFound) break;
    }

    logger.info("SmartRecruiters scrape complete", { company: company.name, jobCount: jobs.length, detailSkipped });
    return jobs;
  }
}
