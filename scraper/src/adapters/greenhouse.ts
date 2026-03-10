import type { AtsAdapter, ScrapedJobData, ExistingJobRecord } from "./types.js";
import { config } from "../config.js";
import { isUSLocation } from "../utils/location-filter.js";
import { logger } from "../utils/logger.js";

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  location: { name: string };
  departments: Array<{ name: string }>;
  content: string;
  metadata?: Array<{ name: string; value: unknown }>;
  first_published?: string;
}

/** Lightweight job summary returned when fetching without ?content=true */
interface GreenhouseJobSummary {
  id: number;
  title: string;
  absolute_url: string;
  location: { name: string };
  departments: Array<{ name: string }>;
  metadata?: Array<{ name: string; value: unknown }>;
  first_published?: string;
}

/** Extract the board slug from a Greenhouse baseUrl (e.g. "https://boards.greenhouse.io/stripe" → "stripe"). */
function extractSlug(baseUrl: string): string {
  const url = new URL(baseUrl);
  // Support both boards.greenhouse.io/{slug} and boards-api.greenhouse.io/v1/boards/{slug}
  const segments = url.pathname.split("/").filter(Boolean);
  return segments[segments.length - 1];
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
  meta?: { total: number };
}

interface GreenhouseSummaryResponse {
  jobs: GreenhouseJobSummary[];
  meta?: { total: number };
}

export class GreenhouseAdapter implements AtsAdapter {
  async listJobs(
    company: { id: string; name: string; baseUrl: string; atsPlatform: string; lastScrapeAt: Date | null },
    _existingJobs?: Map<string, ExistingJobRecord>,
  ): Promise<ScrapedJobData[]> {
    const slug = extractSlug(company.baseUrl);

    // If we have a previous scrape timestamp, try incremental fetching
    if (company.lastScrapeAt) {
      const result = await this.tryIncrementalFetch(slug, company);
      if (result !== null) {
        return result;
      }
      // Fallback: incremental fetch failed or was unsupported, do full fetch
      logger.info("Greenhouse incremental fetch unavailable, falling back to full fetch", {
        company: company.name,
      });
    }

    // Full fetch (first scrape or fallback)
    return this.fullFetch(slug, company);
  }

  /**
   * Attempt incremental fetching using updated_after parameter.
   * Returns null if the API doesn't support it (triggering fallback to full fetch).
   */
  private async tryIncrementalFetch(
    slug: string,
    company: { id: string; name: string; baseUrl: string; atsPlatform: string; lastScrapeAt: Date | null },
  ): Promise<ScrapedJobData[] | null> {
    const updatedAfter = company.lastScrapeAt!.toISOString();
    const incrementalUrl = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true&updated_after=${encodeURIComponent(updatedAfter)}`;

    logger.info("Attempting Greenhouse incremental fetch", {
      company: company.name,
      updatedAfter,
      url: incrementalUrl,
    });

    // Step 1: Fetch updated jobs (with content)
    let incrementalData: GreenhouseResponse;
    try {
      const response = await fetch(incrementalUrl, {
        headers: { "User-Agent": config.userAgent },
      });

      if (!response.ok) {
        // API may not support updated_after — return null to trigger fallback
        logger.warn("Greenhouse incremental fetch returned error, will fallback to full fetch", {
          company: company.name,
          status: response.status,
        });
        return null;
      }

      incrementalData = (await response.json()) as GreenhouseResponse;
    } catch (err) {
      logger.warn("Greenhouse incremental fetch failed, will fallback to full fetch", {
        company: company.name,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }

    // Step 2: Fetch lightweight ID list (without content) for removal detection
    const allJobSummaries = await this.fetchIdList(slug, company.name);
    if (allJobSummaries === null) {
      // If we can't get the full ID list, fall back to full fetch for safety
      // (we need the complete list for removal detection)
      logger.warn("Greenhouse ID list fetch failed, falling back to full fetch", {
        company: company.name,
      });
      return null;
    }

    // Step 3: Validate that incremental mode is actually working
    // If the API returned the same number of jobs as the full list, it likely
    // ignored the updated_after parameter — fall back to full fetch
    const incrementalJobs = incrementalData.jobs ?? [];
    if (incrementalJobs.length > 0 && incrementalJobs.length >= allJobSummaries.length) {
      logger.info("Greenhouse API appears to ignore updated_after (returned all jobs), falling back to full fetch", {
        company: company.name,
        incrementalCount: incrementalJobs.length,
        totalCount: allJobSummaries.length,
      });
      return null;
    }

    // Step 4: Build the result set
    // Updated/new jobs get full content from incremental response
    const updatedJobIds = new Set(incrementalJobs.map((j) => j.id));
    const jobs: ScrapedJobData[] = [];

    // Add updated/new jobs with full content
    for (const job of incrementalJobs) {
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
        postedAt: job.first_published ?? null,
        postingEndDate: null,
      });
    }

    // Add lightweight entries for unchanged jobs (in ID list but not in incremental response)
    // These have empty jobDescriptionHtml — the content hash skip in job-store
    // will preserve existing markdown via COALESCE(NULLIF(...))
    let unchangedCount = 0;
    for (const summary of allJobSummaries) {
      if (updatedJobIds.has(summary.id)) continue; // Already included with full content

      const locationName = summary.location?.name ?? "";
      if (!isUSLocation(locationName)) continue;

      const salaryData = extractSalary(summary.metadata);
      const locationType = inferLocationType(locationName);

      jobs.push({
        externalJobId: String(summary.id),
        title: summary.title,
        url: summary.absolute_url,
        department: summary.departments?.[0]?.name ?? null,
        locations: [locationName].filter(Boolean),
        locationType,
        salaryMin: salaryData.min,
        salaryMax: salaryData.max,
        salaryCurrency: "USD",
        jobDescriptionHtml: "", // Empty — hash skip preserves existing markdown
        postedAt: summary.first_published ?? null,
        postingEndDate: null,
      });
      unchangedCount++;
    }

    logger.info("Greenhouse incremental scrape complete", {
      company: company.name,
      updatedJobs: incrementalJobs.length,
      unchangedJobs: unchangedCount,
      totalJobs: jobs.length,
    });

    return jobs;
  }

  /**
   * Fetch a lightweight list of all active job IDs (without content).
   * Returns null on failure.
   */
  private async fetchIdList(slug: string, companyName: string): Promise<GreenhouseJobSummary[] | null> {
    const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": config.userAgent },
      });

      if (!response.ok) {
        logger.warn("Greenhouse ID list fetch returned error", {
          company: companyName,
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as GreenhouseSummaryResponse;
      return data.jobs ?? [];
    } catch (err) {
      logger.warn("Greenhouse ID list fetch failed", {
        company: companyName,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /** Full fetch — fetches all jobs with content. Used on first scrape or as fallback. */
  private async fullFetch(
    slug: string,
    company: { id: string; name: string; baseUrl: string; atsPlatform: string; lastScrapeAt: Date | null },
  ): Promise<ScrapedJobData[]> {
    const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
    logger.info("Fetching Greenhouse jobs (full)", { company: company.name, url });

    const response = await fetch(url, {
      headers: { "User-Agent": config.userAgent },
    });

    if (!response.ok) {
      throw new Error(`Greenhouse API returned ${response.status} for ${company.name}`);
    }

    const data = (await response.json()) as GreenhouseResponse;

    if (!data.jobs || data.jobs.length === 0) {
      logger.info("Greenhouse scrape complete", { company: company.name, jobCount: 0 });
      return [];
    }

    const jobs: ScrapedJobData[] = [];

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
        postedAt: job.first_published ?? null,
        postingEndDate: null,
      });
    }

    logger.info("Greenhouse scrape complete (full fetch)", { company: company.name, jobCount: jobs.length });
    return jobs;
  }
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

function inferLocationType(location: string): string | null {
  const lower = location.toLowerCase();
  if (lower.includes("remote")) return "Remote";
  if (lower.includes("hybrid")) return "Hybrid";
  return null;
}
