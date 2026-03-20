/**
 * Orchestrator for initial company scrape triggered via after().
 * Picks the right adapter, fetches jobs, upserts them, and updates
 * the company's scrape status.
 */

import { prisma } from "@/lib/prisma";
import { scrapeGreenhouse, scrapeLever, scrapeWorkday, scrapeICIMS, scrapeOracle, scrapeSuccessFactors } from "./adapters";
import type { ScrapedJobData } from "./adapters";
import { upsertJob, upsertJobs } from "./job-store";

const batchScrapers: Record<string, (company: { name: string; baseUrl: string }) => Promise<ScrapedJobData[]>> = {
  GREENHOUSE: scrapeGreenhouse,
  LEVER: scrapeLever,
  ICIMS: scrapeICIMS,
  SUCCESSFACTORS: scrapeSuccessFactors,
};

/** Adapters that fetch per-job details and benefit from streaming upsert. */
const streamScrapers: Record<
  string,
  (company: { name: string; baseUrl: string }, onJob: (job: ScrapedJobData) => Promise<void>) => Promise<ScrapedJobData[]>
> = {
  WORKDAY: scrapeWorkday,
  ORACLE: scrapeOracle,
};

export async function scrapeCompany(company: {
  id: string;
  name: string;
  baseUrl: string;
  atsPlatform: string;
}): Promise<void> {
  const batchScraper = batchScrapers[company.atsPlatform];
  const streamScraper = streamScrapers[company.atsPlatform];

  if (!batchScraper && !streamScraper) {
    console.log(
      `[scrape] Skipping initial scrape for ${company.name} — ` +
      `${company.atsPlatform} requires Playwright (will scrape on next cron run)`,
    );
    return;
  }

  const startTime = Date.now();
  let status: "SUCCESS" | "FAILURE" = "SUCCESS";
  let error: string | null = null;
  let jobsFound: number | null = null;
  let jobsAdded: number | null = null;
  let jobsUpdated: number | null = null;
  let jobsRemoved: number | null = null;

  try {
    if (streamScraper) {
      // Stream jobs to DB one at a time so partial results survive timeouts
      let count = 0;
      await streamScraper(company, async (job) => {
        await upsertJob(company.id, job);
        count++;
      });
      jobsFound = count;

      console.log(
        `[scrape] ${company.name} complete — ${count} jobs upserted (${Date.now() - startTime}ms)`,
      );
    } else {
      const jobs = await batchScraper!(company);
      const result = await upsertJobs(company.id, jobs);
      jobsFound = jobs.length;
      jobsAdded = result.added;
      jobsUpdated = result.updated;
      jobsRemoved = result.removed;

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

  const durationMs = Date.now() - startTime;

  await prisma.$transaction([
    prisma.company.update({
      where: { id: company.id },
      data: {
        lastScrapeAt: new Date(),
        scrapeStatus: status,
        scrapeError: status === "SUCCESS" ? null : error,
      },
    }),
    prisma.scrapeLog.create({
      data: {
        companyId: company.id,
        status,
        error: status === "SUCCESS" ? null : error,
        durationMs,
        jobsFound,
        jobsAdded,
        jobsUpdated,
        jobsRemoved,
      },
    }),
  ]);
}
