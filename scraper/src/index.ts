import { prisma } from "./prisma.js";
import { scrapeCompany } from "./services/scrape-runner.js";
import { autoArchiveStaleJobs } from "./services/archive.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  logger.info("Scraper starting");

  try {
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
