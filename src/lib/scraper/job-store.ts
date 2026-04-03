/**
 * Job upsert logic for the initial scrape triggered on company creation.
 * Ported from scraper/src/services/job-store.ts to use the Next.js Prisma client.
 */

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import TurndownService from "turndown";
import type { ScrapedJobData } from "./adapters";

// ---------------------------------------------------------------------------
// HTML → Markdown (ported from scraper/src/utils/html-to-md.ts)
// ---------------------------------------------------------------------------

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

turndown.remove(["style", "script", "noscript"]);

turndown.addRule("removeEmptyParagraphs", {
  filter: (node) =>
    node.nodeName === "P" && (node.textContent?.trim() ?? "") === "",
  replacement: () => "",
});

turndown.addRule("preserveLineBreaks", {
  filter: "br",
  replacement: () => "\n",
});

function htmlToMarkdown(html: string): string {
  try {
    return turndown.turndown(html).trim();
  } catch {
    return `<!-- Markdown conversion failed -->\n${html}`;
  }
}

// ---------------------------------------------------------------------------
// Content hash (identical to scraper/src/services/job-store.ts)
// ---------------------------------------------------------------------------

function computeContentHash(html: string): string | null {
  if (!html) return null;
  return createHash("sha256").update(html).digest("hex");
}

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------

export interface UpsertResult {
  added: number;
  updated: number;
  removed: number;
  skipped: number;
}

export async function upsertJob(
  companyId: string,
  job: ScrapedJobData,
): Promise<void> {
  const now = new Date();
  const newHash = computeContentHash(job.jobDescriptionHtml);

  const existing = await prisma.scrapedJob.findUnique({
    where: {
      companyId_externalJobId: { companyId, externalJobId: job.externalJobId },
    },
  });

  if (existing) {
    // Skip markdown conversion if content hash matches
    const hashMatch = newHash && existing.contentHash === newHash;
    const jobDescriptionMd = hashMatch
      ? existing.jobDescriptionMd
      : htmlToMarkdown(job.jobDescriptionHtml);

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
        contentHash: newHash,
        postingEndDate: job.postingEndDate ? new Date(job.postingEndDate) : null,
        lastSeenAt: now,
        removedAt: null,
      },
    });
  } else {
    const jobDescriptionMd = htmlToMarkdown(job.jobDescriptionHtml);

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
        contentHash: newHash,
        firstSeenAt: job.postedAt ? new Date(job.postedAt) : now,
        lastSeenAt: now,
        postingEndDate: job.postingEndDate ? new Date(job.postingEndDate) : null,
      },
    });
  }
}

export async function upsertJobs(
  companyId: string,
  scrapedJobs: ScrapedJobData[],
): Promise<UpsertResult> {
  const now = new Date();
  let added = 0;
  let updated = 0;

  const seenExternalIds = new Set<string>();

  let skipped = 0;

  for (const job of scrapedJobs) {
    seenExternalIds.add(job.externalJobId);
    const newHash = computeContentHash(job.jobDescriptionHtml);

    const existing = await prisma.scrapedJob.findUnique({
      where: {
        companyId_externalJobId: {
          companyId,
          externalJobId: job.externalJobId,
        },
      },
    });

    if (existing) {
      // Skip markdown conversion if content hash matches
      const hashMatch = newHash && existing.contentHash === newHash;
      const jobDescriptionMd = hashMatch
        ? existing.jobDescriptionMd
        : htmlToMarkdown(job.jobDescriptionHtml);

      if (hashMatch) skipped++;

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
          contentHash: newHash,
          postingEndDate: job.postingEndDate ? new Date(job.postingEndDate) : null,
          lastSeenAt: now,
          removedAt: null,
        },
      });
      updated++;
    } else {
      const jobDescriptionMd = htmlToMarkdown(job.jobDescriptionHtml);

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
          contentHash: newHash,
          firstSeenAt: job.postedAt ? new Date(job.postedAt) : now,
          lastSeenAt: now,
          postingEndDate: job.postingEndDate ? new Date(job.postingEndDate) : null,
        },
      });
      added++;
    }
  }

  // Mark jobs not seen in this scrape as removed
  const activeJobs = await prisma.scrapedJob.findMany({
    where: { companyId, removedAt: null },
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
  }

  return { added, updated, removed, skipped };
}
