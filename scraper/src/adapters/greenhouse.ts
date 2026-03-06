import type { AtsAdapter, ScrapedJobData } from "./types.js";
import { config } from "../config.js";
import { delay } from "../utils/delay.js";
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
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
  meta?: { total: number };
}

export class GreenhouseAdapter implements AtsAdapter {
  async listJobs(company: { id: string; name: string; baseUrl: string }): Promise<ScrapedJobData[]> {
    const jobs: ScrapedJobData[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${company.baseUrl}/jobs.json?page=${page}`;
      logger.info("Fetching Greenhouse jobs", { company: company.name, page, url });

      const response = await fetch(url, {
        headers: { "User-Agent": config.userAgent },
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
        await delay(config.delays.betweenRequests);
      }
    }

    logger.info("Greenhouse scrape complete", { company: company.name, jobCount: jobs.length });
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
