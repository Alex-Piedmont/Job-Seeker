import { prisma } from "../prisma.js";
import { getAdapter } from "../adapters/registry.js";
import { upsertJobs } from "./job-store.js";
import { logger } from "../utils/logger.js";
import type { ExistingJobRecord } from "../adapters/types.js";

type ScrapeStatus = "SUCCESS" | "PARTIAL_FAILURE" | "FAILURE" | "PENDING";

export async function scrapeCompany(company: {
  id: string;
  name: string;
  baseUrl: string;
  atsPlatform: string;
  lastScrapeAt: Date | null;
}): Promise<void> {
  const startTime = Date.now();
  let status: ScrapeStatus = "SUCCESS";
  let error: string | null = null;

  try {
    // FR-14: capture scrape start time before adapter call
    const scrapeStartTime = new Date();

    // Pre-load existing jobs for this company
    const existingRows = await prisma.scrapedJob.findMany({
      where: { companyId: company.id, removedAt: null },
      select: { externalJobId: true, title: true, contentHash: true },
    });

    const existingJobs = new Map<string, ExistingJobRecord>();
    for (const row of existingRows) {
      existingJobs.set(row.externalJobId, {
        externalJobId: row.externalJobId,
        title: row.title,
        contentHash: row.contentHash,
      });
    }

    const adapter = getAdapter(company.atsPlatform);
    const jobs = await adapter.listJobs(company, existingJobs);

    const result = await upsertJobs(company.id, jobs, existingJobs);

    logger.info("Scrape complete", {
      company: company.name,
      platform: company.atsPlatform,
      jobsFound: jobs.length,
      added: result.added,
      updated: result.updated,
      removed: result.removed,
      reopened: result.reopened,
      skipped: result.skipped,
      durationMs: Date.now() - startTime,
    });

    // FR-14: persist scrapeStartTime as lastScrapeAt only on success
    try {
      await prisma.company.update({
        where: { id: company.id },
        data: {
          lastScrapeAt: scrapeStartTime,
          scrapeStatus: "SUCCESS",
          scrapeError: null,
        },
      });
    } catch (dbErr) {
      logger.error("Failed to update company scrape status", {
        company: company.name,
        error: dbErr instanceof Error ? dbErr.message : String(dbErr),
      });
    }
  } catch (err) {
    status = "FAILURE";
    error = err instanceof Error ? err.message : String(err);
    error = error.slice(0, 1000);

    logger.error("Scrape failed", {
      company: company.name,
      platform: company.atsPlatform,
      error,
      durationMs: Date.now() - startTime,
    });

    // On failure, update status but do NOT advance lastScrapeAt
    try {
      await prisma.company.update({
        where: { id: company.id },
        data: {
          scrapeStatus: status,
          scrapeError: error,
        },
      });
    } catch (dbErr) {
      logger.error("Failed to update company scrape status", {
        company: company.name,
        error: dbErr instanceof Error ? dbErr.message : String(dbErr),
      });
    }
  }
}
