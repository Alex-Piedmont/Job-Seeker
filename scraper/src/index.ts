import { prisma } from "./prisma.js";
import { scrapeCompany } from "./services/scrape-runner.js";
import { autoArchiveStaleJobs } from "./services/archive.js";
import { logger } from "./utils/logger.js";
import { config } from "./config.js";
import { createConcurrencyLimiters } from "./utils/concurrency.js";

const MAX_STARTUP_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

async function waitForDatabase(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_STARTUP_RETRIES; attempt++) {
    try {
      await prisma.$queryRawUnsafe("SELECT 1");
      logger.info("Database connected", { attempt });
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt === MAX_STARTUP_RETRIES) {
        throw new Error(`Database unreachable after ${MAX_STARTUP_RETRIES} attempts: ${msg}`);
      }
      logger.warn("Database not ready, retrying", { attempt, error: msg });
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
}

async function main(): Promise<void> {
  logger.info("Scraper starting");

  try {
    await waitForDatabase();

    // Load enabled companies
    const companies = await prisma.company.findMany({
      where: { enabled: true },
      orderBy: { name: "asc" },
    });

    logger.info("Companies to scrape", {
      count: companies.length,
      globalConcurrency: config.concurrency.global,
    });

    const wallStart = Date.now();
    const { globalLimit, adapterLimits } = await createConcurrencyLimiters();

    // Scrape companies concurrently with nested semaphores:
    // each company acquires a global slot, then a per-adapter slot
    const results = await Promise.allSettled(
      companies.map((company) =>
        globalLimit(() => {
          const adapterLimit =
            adapterLimits[company.atsPlatform] ?? adapterLimits["GREENHOUSE"]; // fallback to highest concurrency
          return adapterLimit(() => scrapeCompany(company));
        })
      )
    );

    // FR-11: Summary logging
    let successCount = 0;
    let failureCount = 0;
    for (const result of results) {
      if (result.status === "fulfilled") {
        successCount++;
      } else {
        failureCount++;
      }
    }

    // Auto-archive stale jobs
    const archived = await autoArchiveStaleJobs();

    const wallTimeMs = Date.now() - wallStart;
    const wallTimeSec = (wallTimeMs / 1000).toFixed(1);
    const wallTimeMin = (wallTimeMs / 60000).toFixed(1);

    logger.info("Scraper finished", {
      companiesProcessed: companies.length,
      succeeded: successCount,
      failed: failureCount,
      wallTimeMs,
      wallTime: wallTimeMs > 60000 ? `${wallTimeMin}m` : `${wallTimeSec}s`,
      autoArchived: archived,
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  logger.error("Fatal scraper error", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
