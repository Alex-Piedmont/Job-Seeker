import { prisma } from "../prisma.js";
import { getAdapter } from "../adapters/registry.js";
import { upsertJobs } from "./job-store.js";
import { logger } from "../utils/logger.js";

type ScrapeStatus = "SUCCESS" | "PARTIAL_FAILURE" | "FAILURE" | "PENDING";

export async function scrapeCompany(company: {
  id: string;
  name: string;
  baseUrl: string;
  atsPlatform: string;
}): Promise<void> {
  const startTime = Date.now();
  let status: ScrapeStatus = "SUCCESS";
  let error: string | null = null;

  try {
    const adapter = getAdapter(company.atsPlatform);
    const jobs = await adapter.listJobs(company);

    const result = await upsertJobs(company.id, jobs);

    logger.info("Scrape complete", {
      company: company.name,
      platform: company.atsPlatform,
      jobsFound: jobs.length,
      added: result.added,
      updated: result.updated,
      removed: result.removed,
      durationMs: Date.now() - startTime,
    });
  } catch (err) {
    status = "FAILURE";
    error = err instanceof Error ? err.message : String(err);
    error = error.slice(0, 1000); // Truncate to 1000 chars

    logger.error("Scrape failed", {
      company: company.name,
      platform: company.atsPlatform,
      error,
      durationMs: Date.now() - startTime,
    });
  }

  try {
    await prisma.company.update({
      where: { id: company.id },
      data: {
        lastScrapeAt: new Date(),
        scrapeStatus: status,
        scrapeError: status === "SUCCESS" ? null : error,
      },
    });
  } catch (dbErr) {
    logger.error("Failed to update company scrape status", {
      company: company.name,
      error: dbErr instanceof Error ? dbErr.message : String(dbErr),
    });
  }
}
