import type { AtsAdapter, ScrapedJobData } from "./types.js";
import { config } from "../config.js";
import { isUSLocation } from "../utils/location-filter.js";
import { logger } from "../utils/logger.js";

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  categories: {
    location?: string;
    team?: string;
    department?: string;
    allLocations?: string[];
  };
  description?: string;
  descriptionPlain?: string;
  createdAt?: number;
  workplaceType?: string;
  salaryRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
}

/** Extract the company slug from a Lever baseUrl (e.g. "https://jobs.lever.co/spotify" → "spotify"). */
function extractSlug(baseUrl: string): string {
  const url = new URL(baseUrl);
  const segments = url.pathname.split("/").filter(Boolean);
  return segments[segments.length - 1];
}

export class LeverAdapter implements AtsAdapter {
  async listJobs(company: { id: string; name: string; baseUrl: string }): Promise<ScrapedJobData[]> {
    const slug = extractSlug(company.baseUrl);
    const url = `https://api.lever.co/v0/postings/${slug}`;
    logger.info("Fetching Lever jobs", { company: company.name, url });

    const response = await fetch(url, {
      headers: { "User-Agent": config.userAgent },
    });

    if (!response.ok) {
      throw new Error(`Lever API returned ${response.status} for ${company.name}`);
    }

    const postings = (await response.json()) as LeverPosting[];

    if (postings.length > 1000) {
      logger.warn("Lever response exceeds 1000 postings", { company: company.name, count: postings.length });
    }

    const jobs: ScrapedJobData[] = [];

    for (const posting of postings) {
      const location = posting.categories?.location ?? "";
      if (!isUSLocation(location)) continue;

      const locationType = posting.workplaceType?.toLowerCase().includes("remote")
        ? "Remote"
        : inferLocationType(location);
      const locations = posting.categories?.allLocations?.length
        ? posting.categories.allLocations
        : [location].filter(Boolean);
      const postedAt = posting.createdAt
        ? new Date(posting.createdAt).toISOString()
        : null;

      jobs.push({
        externalJobId: posting.id,
        title: posting.text,
        url: posting.hostedUrl,
        department: posting.categories?.department ?? posting.categories?.team ?? null,
        locations,
        locationType,
        salaryMin: posting.salaryRange?.min ?? null,
        salaryMax: posting.salaryRange?.max ?? null,
        salaryCurrency: posting.salaryRange?.currency ?? "USD",
        jobDescriptionHtml: posting.description ?? posting.descriptionPlain ?? "",
        postedAt,
        postingEndDate: null,
      });
    }

    logger.info("Lever scrape complete", { company: company.name, jobCount: jobs.length });
    return jobs;
  }
}

function inferLocationType(location: string): string | null {
  const lower = location.toLowerCase();
  if (lower.includes("remote")) return "Remote";
  if (lower.includes("hybrid")) return "Hybrid";
  return null;
}
