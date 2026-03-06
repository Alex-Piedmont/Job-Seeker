import { prisma } from "../prisma.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export async function autoArchiveStaleJobs(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - config.archiveAfterDays);

  const result = await prisma.scrapedJob.updateMany({
    where: {
      removedAt: { not: null, lte: cutoff },
      archivedAt: null,
    },
    data: { archivedAt: new Date() },
  });

  if (result.count > 0) {
    logger.info("Auto-archived stale jobs", { count: result.count, cutoffDate: cutoff.toISOString() });
  }

  return result.count;
}
