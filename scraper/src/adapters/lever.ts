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
  };
  description?: string;
  descriptionPlain?: string;
  salaryRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
}

export class LeverAdapter implements AtsAdapter {
  async listJobs(company: { id: string; name: string; baseUrl: string }): Promise<ScrapedJobData[]> {
    const url = `${company.baseUrl}?mode=json`;
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

      const locationType = inferLocationType(location);

      jobs.push({
        externalJobId: posting.id,
        title: posting.text,
        url: posting.hostedUrl,
        department: posting.categories?.team ?? null,
        locations: [location].filter(Boolean),
        locationType,
        salaryMin: posting.salaryRange?.min ?? null,
        salaryMax: posting.salaryRange?.max ?? null,
        salaryCurrency: posting.salaryRange?.currency ?? "USD",
        jobDescriptionHtml: posting.description ?? posting.descriptionPlain ?? "",
        postedAt: null,
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
