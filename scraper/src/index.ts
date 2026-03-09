import { prisma } from "./prisma.js";
import { scrapeCompany } from "./services/scrape-runner.js";
import { autoArchiveStaleJobs } from "./services/archive.js";
import { logger } from "./utils/logger.js";

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

    logger.info("Companies to scrape", { count: companies.length });

    // Scrape each company sequentially
    for (const company of companies) {
      try {
        await scrapeCompany(company);
      } catch (err) {
        // scrapeCompany handles its own errors, but catch any unexpected ones
        logger.error("Unexpected error scraping company", {
          company: company.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Auto-archive stale jobs
    const archived = await autoArchiveStaleJobs();
    logger.info("Scraper finished", {
      companiesProcessed: companies.length,
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
