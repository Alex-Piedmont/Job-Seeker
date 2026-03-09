import type { AtsAdapter, ScrapedJobData } from "./types.js";
import { config } from "../config.js";
import { delay } from "../utils/delay.js";
import { logger } from "../utils/logger.js";

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

/** Extract host and siteNumber from an Oracle HCM career site URL. */
function parseOracleUrl(baseUrl: string): { host: string; siteNumber: string } {
  const url = new URL(baseUrl);
  // e.g. https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001
  const segments = url.pathname.split("/").filter(Boolean);
  const sitesIdx = segments.indexOf("sites");
  if (sitesIdx === -1 || sitesIdx + 1 >= segments.length) {
    throw new Error(`Cannot parse Oracle HCM URL – expected /sites/{siteNumber} path: ${baseUrl}`);
  }
  return { host: url.host, siteNumber: segments[sitesIdx + 1] };
}

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

interface OracleRequisition {
  Id: string;
  Title: string;
  PostedDate: string | null;
  PostingEndDate: string | null;
  PrimaryLocation: string;
  PrimaryLocationCountry: string;
  WorkplaceTypeCode: string | null;
  WorkplaceType: string | null;
  JobFamily: string | null;
  Department: string | null;
  Organization: string | null;
  ShortDescriptionStr: string | null;
  ExternalQualificationsStr: string | null;
  ExternalResponsibilitiesStr: string | null;
  JobType: string | null;
}

interface OracleListResponse {
  items: Array<{
    TotalJobsCount: number;
    requisitionList: OracleRequisition[];
  }>;
}

interface OracleDetailResponse {
  items: Array<{
    Id: string;
    Title: string;
    ExternalDescriptionStr: string | null;
    ExternalQualificationsStr: string | null;
    ExternalResponsibilitiesStr: string | null;
    PrimaryLocation: string;
    PrimaryLocationCountry: string;
    WorkplaceTypeCode: string | null;
    PostedDate: string | null;
    PostingEndDate: string | null;
    JobFamily: string | null;
    Department: string | null;
    Organization: string | null;
    secondaryLocations?: Array<{ LocationName: string }>;
  }>;
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

function mapWorkplaceType(code: string | null | undefined): string | null {
  if (!code) return null;
  const lower = code.toLowerCase();
  if (lower.includes("remote")) return "Remote";
  if (lower.includes("hybrid")) return "Hybrid";
  return null;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

const API_VERSION = "11.13.18.05";
const PAGE_SIZE = 25;

export class OracleAdapter implements AtsAdapter {
  async listJobs(company: { id: string; name: string; baseUrl: string }): Promise<ScrapedJobData[]> {
    const { host, siteNumber } = parseOracleUrl(company.baseUrl);
    const apiBase = `https://${host}/hcmRestApi/resources/${API_VERSION}`;

    const jobs: ScrapedJobData[] = [];
    let offset = 0;
    let totalJobs = -1;

    logger.info("Starting Oracle HCM scrape", { company: company.name, host, siteNumber });

    // Paginate list endpoint
    while (true) {
      const listUrl = `${apiBase}/recruitingCEJobRequisitions?finder=findReqs;siteNumber=${siteNumber},limit=${PAGE_SIZE},offset=${offset},sortBy=POSTING_DATES_DESC&onlyData=true&expand=requisitionList`;

      const res = await fetch(listUrl, {
        headers: { "User-Agent": config.userAgent },
      });

      if (!res.ok) {
        throw new Error(`Oracle HCM API returned ${res.status} for ${company.name} (offset ${offset})`);
      }

      const data = (await res.json()) as OracleListResponse;
      const wrapper = data.items?.[0];
      if (!wrapper || !wrapper.requisitionList || wrapper.requisitionList.length === 0) break;

      if (totalJobs < 0) {
        totalJobs = wrapper.TotalJobsCount;
        logger.info("Oracle total jobs reported", { company: company.name, total: totalJobs });
      }

      // Fetch detail for each US job
      for (const req of wrapper.requisitionList) {
        // Filter: US only
        if (req.PrimaryLocationCountry !== "US") continue;

        // Filter: full-time only (skip part-time, intern, etc.)
        if (req.JobType && !req.JobType.toLowerCase().includes("regular")) continue;

        try {
          await delay(config.delays.betweenRequests);

          const detailUrl = `${apiBase}/recruitingCEJobRequisitionDetails/${req.Id}?onlyData=true&expand=all`;
          const detailRes = await fetch(detailUrl, {
            headers: { "User-Agent": config.userAgent },
          });

          if (!detailRes.ok) {
            logger.warn("Oracle detail request failed", {
              company: company.name,
              reqId: req.Id,
              status: detailRes.status,
            });
            continue;
          }

          const detailData = (await detailRes.json()) as OracleDetailResponse;
          const detail = detailData.items?.[0];
          if (!detail) continue;

          // Build description from available HTML fields
          const descriptionParts = [
            detail.ExternalDescriptionStr,
            detail.ExternalQualificationsStr,
            detail.ExternalResponsibilitiesStr,
          ].filter(Boolean);
          const descriptionHtml = descriptionParts.join("\n");

          // Build locations
          const locations: string[] = [detail.PrimaryLocation].filter(Boolean);
          if (detail.secondaryLocations) {
            for (const loc of detail.secondaryLocations) {
              if (loc.LocationName) locations.push(loc.LocationName);
            }
          }

          const salary = extractSalaryFromHtml(descriptionHtml);
          if (salary.isHourly) {
            logger.info("Skipping hourly role", { company: company.name, title: req.Title, salaryMax: salary.max });
            continue;
          }

          const jobUrl = `https://${host}/hcmUI/CandidateExperience/en/sites/${siteNumber}/job/${req.Id}`;

          jobs.push({
            externalJobId: req.Id,
            title: req.Title,
            url: jobUrl,
            department: detail.Department ?? detail.Organization ?? detail.JobFamily ?? null,
            locations,
            locationType: mapWorkplaceType(detail.WorkplaceTypeCode ?? req.WorkplaceTypeCode),
            salaryMin: salary.min,
            salaryMax: salary.max,
            salaryCurrency: "USD",
            jobDescriptionHtml: descriptionHtml,
            postedAt: req.PostedDate ?? null,
            postingEndDate: req.PostingEndDate ?? null,
          });
        } catch (err) {
          logger.warn("Oracle detail fetch error", {
            company: company.name,
            reqId: req.Id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      offset += wrapper.requisitionList.length;
      if (offset >= totalJobs) break;

      await delay(config.delays.betweenRequests);
    }

    logger.info("Oracle HCM scrape complete", { company: company.name, jobCount: jobs.length });
    return jobs;
  }
}
