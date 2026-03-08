import { prisma } from "../prisma.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export async function autoArchiveStaleJobs(): Promise<number> {
  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - config.archiveAfterDays);

  const result = await prisma.scrapedJob.updateMany({
    where: {
      archivedAt: null,
      OR: [
        // Jobs removed from careers page and past the grace period
        { removedAt: { not: null, lte: cutoff } },
        // Jobs past their posting end date
        { postingEndDate: { not: null, lt: now } },
      ],
    },
    data: { archivedAt: now },
  });

  if (result.count > 0) {
    logger.info("Auto-archived stale jobs", { count: result.count, cutoffDate: cutoff.toISOString() });
  }

  return result.count;
}
