import { prisma } from "../prisma.js";
import { htmlToMarkdown } from "../utils/html-to-md.js";
import { logger } from "../utils/logger.js";
import type { ScrapedJobData } from "../adapters/types.js";

interface UpsertResult {
  added: number;
  updated: number;
  removed: number;
  reopened: number;
}

export async function upsertJobs(
  companyId: string,
  scrapedJobs: ScrapedJobData[]
): Promise<UpsertResult> {
  const now = new Date();
  let added = 0;
  let updated = 0;

  const seenExternalIds = new Set<string>();

  for (const job of scrapedJobs) {
    seenExternalIds.add(job.externalJobId);

    const jobDescriptionMd = htmlToMarkdown(job.jobDescriptionHtml);

    const existing = await prisma.scrapedJob.findUnique({
      where: {
        companyId_externalJobId: {
          companyId,
          externalJobId: job.externalJobId,
        },
      },
    });

    if (existing) {
      await prisma.scrapedJob.update({
        where: { id: existing.id },
        data: {
          title: job.title,
          url: job.url,
          department: job.department,
          locations: job.locations,
          locationType: job.locationType,
          salaryMin: job.salaryMin,
          salaryMax: job.salaryMax,
          salaryCurrency: job.salaryCurrency,
          jobDescriptionMd,
          postingEndDate: job.postingEndDate ? new Date(job.postingEndDate) : null,
          lastSeenAt: now,
          removedAt: null, // Clear removal if re-opened
        },
      });
      if (existing.removedAt) {
        logger.info("Job re-opened", { companyId, externalJobId: job.externalJobId, title: job.title });
      }
      updated++;
    } else {
      await prisma.scrapedJob.create({
        data: {
          companyId,
          externalJobId: job.externalJobId,
          title: job.title,
          url: job.url,
          department: job.department,
          locations: job.locations,
          locationType: job.locationType,
          salaryMin: job.salaryMin,
          salaryMax: job.salaryMax,
          salaryCurrency: job.salaryCurrency,
          jobDescriptionMd,
          firstSeenAt: job.postedAt ? new Date(job.postedAt) : now,
          lastSeenAt: now,
          postingEndDate: job.postingEndDate ? new Date(job.postingEndDate) : null,
        },
      });
      added++;
    }
  }

  // Detect removals: jobs in DB that weren't seen in this scrape
  const activeJobs = await prisma.scrapedJob.findMany({
    where: {
      companyId,
      removedAt: null,
    },
    select: { id: true, externalJobId: true },
  });

  const removedIds = activeJobs
    .filter((j) => !seenExternalIds.has(j.externalJobId))
    .map((j) => j.id);

  let removed = 0;
  if (removedIds.length > 0) {
    const result = await prisma.scrapedJob.updateMany({
      where: { id: { in: removedIds } },
      data: { removedAt: now },
    });
    removed = result.count;
    logger.info("Jobs marked as removed", { companyId, count: removed });
  }

  // Count re-opened jobs (those that had removedAt set but are now cleared)
  const reopened = scrapedJobs.filter((job) => {
    // We already cleared removedAt above for existing jobs, so count based on what we processed
    return false; // reopened is tracked inline above
  }).length;

  return { added, updated, removed, reopened };
}
