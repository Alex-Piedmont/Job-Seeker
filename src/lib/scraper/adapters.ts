/**
 * Lightweight fetch-based ATS adapters for Greenhouse and Lever.
 * Ported from scraper/src/adapters/ for use within the Next.js runtime
 * (no Playwright dependency). Used to trigger an initial scrape when
 * an admin creates a new company.
 */

const USER_AGENT = "JobSeekerBot/1.0";
const BETWEEN_REQUESTS_MS = 500;

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface ScrapedJobData {
  externalJobId: string;
  title: string;
  url: string;
  department: string | null;
  locations: string[];
  locationType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  jobDescriptionHtml: string;
}

// ---------------------------------------------------------------------------
// Location filter (ported from scraper/src/utils/location-filter.ts)
// ---------------------------------------------------------------------------

const US_STATE_ABBREVIATIONS = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC",
]);

const US_KEYWORDS = ["united states", "remote", "u.s.", "usa"];

const US_MAJOR_CITIES = [
  "new york", "los angeles", "chicago", "houston", "phoenix",
  "philadelphia", "san antonio", "san diego", "dallas", "san jose",
  "austin", "jacksonville", "san francisco", "seattle", "denver",
  "washington", "boston", "nashville", "portland", "las vegas",
  "atlanta", "miami", "minneapolis", "raleigh", "charlotte",
  "pittsburgh", "salt lake city",
];

function isUSLocation(location: string): boolean {
  if (!location || location.trim() === "") return false;
  const lower = location.toLowerCase().trim();

  for (const keyword of US_KEYWORDS) {
    if (lower.includes(keyword)) return true;
  }

  const stateMatch = location.match(/,\s*([A-Z]{2})\b/) || location.match(/\b([A-Z]{2})$/);
  if (stateMatch && US_STATE_ABBREVIATIONS.has(stateMatch[1])) return true;

  for (const city of US_MAJOR_CITIES) {
    if (lower.includes(city)) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inferLocationType(location: string): string | null {
  const lower = location.toLowerCase();
  if (lower.includes("remote")) return "Remote";
  if (lower.includes("hybrid")) return "Hybrid";
  return null;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Greenhouse
// ---------------------------------------------------------------------------

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  location: { name: string };
  departments: Array<{ name: string }>;
  content: string;
  metadata?: Array<{ name: string; value: unknown }>;
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
  meta?: { total: number };
}

function extractSalary(metadata?: Array<{ name: string; value: unknown }>): { min: number | null; max: number | null } {
  if (!metadata) return { min: null, max: null };
  let min: number | null = null;
  let max: number | null = null;

  for (const field of metadata) {
    const name = field.name.toLowerCase();
    if (name.includes("salary") || name.includes("compensation")) {
      const value = String(field.value);
      const numbers = value.match(/\d[\d,]*\d/g)?.map((n) => parseInt(n.replace(/,/g, ""), 10)) ?? [];
      if (numbers.length >= 2) {
        min = Math.min(...numbers);
        max = Math.max(...numbers);
      } else if (numbers.length === 1) {
        min = numbers[0];
        max = numbers[0];
      }
    }
  }
  return { min, max };
}

export async function scrapeGreenhouse(company: { name: string; baseUrl: string }): Promise<ScrapedJobData[]> {
  const jobs: ScrapedJobData[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${company.baseUrl}/jobs.json?page=${page}`;
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!response.ok) {
      throw new Error(`Greenhouse API returned ${response.status} for ${company.name}`);
    }

    const data = (await response.json()) as GreenhouseResponse;

    if (!data.jobs || data.jobs.length === 0) {
      hasMore = false;
      break;
    }

    for (const job of data.jobs) {
      const locationName = job.location?.name ?? "";
      if (!isUSLocation(locationName)) continue;

      const salaryData = extractSalary(job.metadata);
      const locationType = inferLocationType(locationName);

      jobs.push({
        externalJobId: String(job.id),
        title: job.title,
        url: job.absolute_url,
        department: job.departments?.[0]?.name ?? null,
        locations: [locationName].filter(Boolean),
        locationType,
        salaryMin: salaryData.min,
        salaryMax: salaryData.max,
        salaryCurrency: "USD",
        jobDescriptionHtml: job.content ?? "",
      });
    }

    page++;
    if (data.jobs.length < 100) {
      hasMore = false;
    } else {
      await delay(BETWEEN_REQUESTS_MS);
    }
  }

  return jobs;
}

// ---------------------------------------------------------------------------
// Lever
// ---------------------------------------------------------------------------

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  categories: {
    location?: string;
    team?: string;
  };
  description?: string;
  descriptionPlain?: string;
  salaryRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
}

// ---------------------------------------------------------------------------
// Workday (CXS JSON API)
// ---------------------------------------------------------------------------

const US_COUNTRY_FACET_ID = "bc33aa3152ec42d4995f4791a106ed09";

interface CxsListResponse {
  total: number;
  facets?: Array<{
    facetParameter: string;
    values: Array<{ descriptor: string; id: string }>;
  }>;
  jobPostings: Array<{
    title: string;
    externalPath: string;
    locationsText: string;
  }>;
}

interface CxsDetailResponse {
  jobPostingInfo: {
    jobReqId?: string;
    externalPath: string;
    title: string;
    location: string;
    additionalLocations?: string[];
    jobDescription: string;
    jobFamilyGroup?: string;
  };
}

function parseWorkdayUrl(baseUrl: string): { host: string; tenant: string; siteId: string } {
  const url = new URL(baseUrl);
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 1) {
    throw new Error(`Cannot parse Workday URL – expected /<siteId> path: ${baseUrl}`);
  }
  return { host: url.host, tenant: url.hostname.split(".")[0], siteId: segments[0] };
}

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

export async function scrapeWorkday(
  company: { name: string; baseUrl: string },
  onJob?: (job: ScrapedJobData) => Promise<void>,
): Promise<ScrapedJobData[]> {
  const { host, tenant, siteId } = parseWorkdayUrl(company.baseUrl);
  const listUrl = `https://${host}/wday/cxs/${tenant}/${siteId}/jobs`;

  // Discover facets with an initial probe request
  const appliedFacets: Record<string, string[]> = {};

  const probeRes = await fetch(listUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify({ appliedFacets: {}, limit: 1, offset: 0, searchText: "" }),
  });

  if (probeRes.ok) {
    const probeData = (await probeRes.json()) as CxsListResponse;
    const facets = probeData.facets ?? [];

    // Auto-discover country facet (parameter name varies: locationCountry vs Location_Country)
    const countryFacet = facets.find((f) => f.facetParameter.toLowerCase().includes("country"));
    const usValue = countryFacet?.values.find((v) => v.id === US_COUNTRY_FACET_ID);
    if (countryFacet && usValue) {
      appliedFacets[countryFacet.facetParameter] = [usValue.id];
    }

    // Auto-discover full-time facet
    const timeTypeFacet = facets.find((f) => f.facetParameter === "timeType");
    const fullTimeValue = timeTypeFacet?.values.find((v) => v.descriptor.toLowerCase().includes("full time"));
    if (fullTimeValue) {
      appliedFacets.timeType = [fullTimeValue.id];
    }
  }

  await delay(BETWEEN_REQUESTS_MS);

  const jobs: ScrapedJobData[] = [];
  let offset = 0;
  let totalJobs = -1;
  const limit = 20;

  while (true) {
    const listRes = await fetch(listUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
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
    if (totalJobs < 0) totalJobs = data.total;

    for (const posting of data.jobPostings) {
      try {
        await delay(BETWEEN_REQUESTS_MS);

        const path = posting.externalPath.replace(/^\/job\//, "");
        const detailUrl = `https://${host}/wday/cxs/${tenant}/${siteId}/job/${path}`;
        const detailRes = await fetch(detailUrl, {
          headers: { "User-Agent": USER_AGENT },
        });

        if (!detailRes.ok) {
          console.warn(`[workday] Detail request failed for ${posting.externalPath}: ${detailRes.status}`);
          continue;
        }

        const detail = (await detailRes.json()) as CxsDetailResponse;
        const info = detail.jobPostingInfo;

        const locations = [info.location, ...(info.additionalLocations ?? [])].filter(Boolean);
        const locationType = inferLocationType(locations.join(", "));
        const salary = extractSalaryFromHtml(info.jobDescription ?? "");

        if (salary.isHourly) continue;

        const job: ScrapedJobData = {
          externalJobId: info.jobReqId ?? posting.externalPath,
          title: info.title ?? posting.title,
          url: `https://${host}/en-US/${siteId}/job/${path}`,
          department: info.jobFamilyGroup ?? null,
          locations,
          locationType,
          salaryMin: salary.min,
          salaryMax: salary.max,
          salaryCurrency: "USD",
          jobDescriptionHtml: info.jobDescription ?? "",
        };

        jobs.push(job);
        if (onJob) await onJob(job);
      } catch (err) {
        console.warn(`[workday] Detail fetch error for ${posting.externalPath}:`, err);
      }
    }

    offset += data.jobPostings.length;
    if (offset >= totalJobs) break;

    await delay(BETWEEN_REQUESTS_MS);
  }

  return jobs;
}

// ---------------------------------------------------------------------------
// Lever
// ---------------------------------------------------------------------------

export async function scrapeLever(company: { name: string; baseUrl: string }): Promise<ScrapedJobData[]> {
  const url = `${company.baseUrl}?mode=json`;
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Lever API returned ${response.status} for ${company.name}`);
  }

  const postings = (await response.json()) as LeverPosting[];
  const jobs: ScrapedJobData[] = [];

  for (const posting of postings) {
    const location = posting.categories?.location ?? "";
    if (!isUSLocation(location)) continue;

    jobs.push({
      externalJobId: posting.id,
      title: posting.text,
      url: posting.hostedUrl,
      department: posting.categories?.team ?? null,
      locations: [location].filter(Boolean),
      locationType: inferLocationType(location),
      salaryMin: posting.salaryRange?.min ?? null,
      salaryMax: posting.salaryRange?.max ?? null,
      salaryCurrency: posting.salaryRange?.currency ?? "USD",
      jobDescriptionHtml: posting.description ?? posting.descriptionPlain ?? "",
    });
  }

  return jobs;
}
