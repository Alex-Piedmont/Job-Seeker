/**
 * Orchestrator for initial company scrape triggered via after().
 * Picks the right adapter, fetches jobs, upserts them, and updates
 * the company's scrape status.
 */

import { prisma } from "@/lib/prisma";
import { scrapeGreenhouse, scrapeLever, scrapeWorkday } from "./adapters";
import type { ScrapedJobData } from "./adapters";
import { upsertJob, upsertJobs } from "./job-store";

const batchScrapers: Record<string, (company: { name: string; baseUrl: string }) => Promise<ScrapedJobData[]>> = {
  GREENHOUSE: scrapeGreenhouse,
  LEVER: scrapeLever,
};

export async function scrapeCompany(company: {
  id: string;
  name: string;
  baseUrl: string;
  atsPlatform: string;
}): Promise<void> {
  const batchScraper = batchScrapers[company.atsPlatform];
  const isWorkday = company.atsPlatform === "WORKDAY";

  if (!batchScraper && !isWorkday) {
    console.log(
      `[scrape] Skipping initial scrape for ${company.name} — ` +
      `${company.atsPlatform} requires Playwright (will scrape on next cron run)`,
    );
    return;
  }

  const startTime = Date.now();
  let status: "SUCCESS" | "FAILURE" = "SUCCESS";
  let error: string | null = null;

  try {
    if (isWorkday) {
      // Stream jobs to DB one at a time so partial results survive timeouts
      let count = 0;
      await scrapeWorkday(company, async (job) => {
        await upsertJob(company.id, job);
        count++;
      });

      console.log(
        `[scrape] ${company.name} complete — ${count} jobs upserted (${Date.now() - startTime}ms)`,
      );
    } else {
      const jobs = await batchScraper!(company);
      const result = await upsertJobs(company.id, jobs);

      console.log(
        `[scrape] ${company.name} complete — ` +
        `${jobs.length} found, ${result.added} added, ${result.updated} updated, ` +
        `${result.removed} removed (${Date.now() - startTime}ms)`,
      );
    }
  } catch (err) {
    status = "FAILURE";
    error = err instanceof Error ? err.message : String(err);
    error = error.slice(0, 1000);

    console.error(
      `[scrape] ${company.name} failed — ${error} (${Date.now() - startTime}ms)`,
    );
  }

  await prisma.company.update({
    where: { id: company.id },
    data: {
      lastScrapeAt: new Date(),
      scrapeStatus: status,
      scrapeError: status === "SUCCESS" ? null : error,
    },
  });
}
