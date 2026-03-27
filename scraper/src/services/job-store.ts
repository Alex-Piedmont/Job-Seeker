import { createHash } from "node:crypto";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "../prisma.js";
import { htmlToMarkdown } from "../utils/html-to-md.js";
import { logger } from "../utils/logger.js";
import type { ScrapedJobData, ExistingJobRecord } from "../adapters/types.js";

const BATCH_SIZE = 50;

/** Number of columns per row in the bulk INSERT. */
const COLS_PER_ROW = 16;

export interface UpsertResult {
  added: number;
  updated: number;
  removed: number;
  reopened: number;
  skipped: number;
}

/** SHA-256 hex digest of raw HTML for content-hash dedup. */
export function computeContentHash(html: string): string {
  return createHash("sha256").update(html).digest("hex");
}

/**
 * Bulk upsert scraped jobs for a single company using raw SQL.
 *
 * @param companyId      The company's CUID
 * @param scrapedJobs    Jobs returned by the adapter
 * @param existingJobs   Pre-loaded map of externalJobId -> ExistingJobRecord (from DB)
 */
export async function upsertJobs(
  companyId: string,
  scrapedJobs: ScrapedJobData[],
  existingJobs: Map<string, ExistingJobRecord> = new Map(),
): Promise<UpsertResult> {
  const now = new Date();
  let added = 0;
  let updated = 0;
  let reopened = 0;
  let skipped = 0;

  const seenExternalIds: string[] = [];

  // Prepare rows: compute hashes, convert markdown, pre-generate IDs
  interface PreparedRow {
    id: string;
    companyId: string;
    externalJobId: string;
    title: string;
    url: string;
    department: string | null;
    locationsJson: string;
    locationType: string | null;
    salaryMin: number | null;
    salaryMax: number | null;
    salaryCurrency: string;
    jobDescriptionMd: string;
    contentHash: string | null;
    firstSeenAt: Date;
    lastSeenAt: Date;
    postingEndDate: Date | null;
  }

  const preparedRows: PreparedRow[] = [];
  const preparedIndex = new Map<string, number>(); // externalJobId -> index in preparedRows

  for (const job of scrapedJobs) {
    seenExternalIds.push(job.externalJobId);

    const contentHash = job.jobDescriptionHtml
      ? computeContentHash(job.jobDescriptionHtml)
      : null;

    const existing = existingJobs.get(job.externalJobId);

    // Content hash skip: if hash matches existing, skip htmlToMarkdown
    let jobDescriptionMd = "";
    if (existing && contentHash && existing.contentHash === contentHash) {
      // Hash match -- pass empty string; SQL COALESCE(NULLIF(...)) preserves existing
      jobDescriptionMd = "";
      skipped++;
    } else if (job.jobDescriptionHtml) {
      jobDescriptionMd = htmlToMarkdown(job.jobDescriptionHtml);
    }

    const row: PreparedRow = {
      id: createId(), // Always pre-generate; only used for INSERT (ON CONFLICT uses existing row's id)
      companyId,
      externalJobId: job.externalJobId,
      title: job.title,
      url: job.url,
      department: job.department,
      locationsJson: JSON.stringify(job.locations),
      locationType: job.locationType,
      salaryMin: job.salaryMin != null ? Math.round(job.salaryMin) : null,
      salaryMax: job.salaryMax != null ? Math.round(job.salaryMax) : null,
      salaryCurrency: job.salaryCurrency,
      jobDescriptionMd,
      contentHash,
      firstSeenAt: job.postedAt ? new Date(job.postedAt) : now,
      lastSeenAt: now,
      postingEndDate: job.postingEndDate ? new Date(job.postingEndDate) : null,
    };

    // Deduplicate: if adapter returned the same externalJobId twice, keep the later one
    const existingIdx = preparedIndex.get(job.externalJobId);
    if (existingIdx != null) {
      preparedRows[existingIdx] = row;
    } else {
      preparedIndex.set(job.externalJobId, preparedRows.length);
      preparedRows.push(row);
    }
  }

  // Process in batches
  for (let i = 0; i < preparedRows.length; i += BATCH_SIZE) {
    const batch = preparedRows.slice(i, i + BATCH_SIZE);

    try {
      const result = await executeBatchUpsert(batch);
      added += result.added;
      updated += result.updated;
      reopened += result.reopened;
    } catch (err) {
      logger.warn("Batch upsert failed, retrying row-by-row", {
        companyId,
        batchStart: i,
        batchSize: batch.length,
        error: err instanceof Error ? err.message : String(err),
      });

      // Retry batch with size 1 to isolate bad rows
      for (const row of batch) {
        try {
          const result = await executeBatchUpsert([row]);
          added += result.added;
          updated += result.updated;
          reopened += result.reopened;
        } catch (rowErr) {
          logger.error("Single row upsert failed", {
            companyId,
            externalJobId: row.externalJobId,
            error: rowErr instanceof Error ? rowErr.message : String(rowErr),
          });
        }
      }
    }
  }

  // Removal detection: single query per company
  const removed = await detectRemovals(companyId, seenExternalIds);

  return { added, updated, removed, reopened, skipped };
}

interface BatchResult {
  added: number;
  updated: number;
  reopened: number;
}

async function executeBatchUpsert(
  batch: Array<{
    id: string;
    companyId: string;
    externalJobId: string;
    title: string;
    url: string;
    department: string | null;
    locationsJson: string;
    locationType: string | null;
    salaryMin: number | null;
    salaryMax: number | null;
    salaryCurrency: string;
    jobDescriptionMd: string;
    contentHash: string | null;
    firstSeenAt: Date;
    lastSeenAt: Date;
    postingEndDate: Date | null;
  }>,
): Promise<BatchResult> {
  // Build parameterized VALUES clause
  const params: unknown[] = [];
  const valuesClauses: string[] = [];

  for (let j = 0; j < batch.length; j++) {
    const row = batch[j];
    const base = j * COLS_PER_ROW;
    valuesClauses.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, ` +
      `$${base + 7}::jsonb, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, ` +
      `$${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}, $${base + 16})`
    );
    params.push(
      row.id,
      row.companyId,
      row.externalJobId,
      row.title,
      row.url,
      row.department,
      row.locationsJson,
      row.locationType,
      row.salaryMin,
      row.salaryMax,
      row.salaryCurrency,
      row.jobDescriptionMd,
      row.contentHash,
      row.firstSeenAt,
      row.lastSeenAt,
      row.postingEndDate,
    );
  }

  // CTE-based upsert that returns re-opened jobs (where "removedAt" was non-null)
  // Note: Column names are camelCase (Prisma convention, no @map on fields)
  const sql = `
    WITH upserted AS (
      INSERT INTO scraped_jobs (
        "id", "companyId", "externalJobId", "title", "url", "department",
        "locations", "locationType", "salaryMin", "salaryMax", "salaryCurrency",
        "jobDescriptionMd", "contentHash", "firstSeenAt", "lastSeenAt", "postingEndDate"
      )
      VALUES ${valuesClauses.join(", ")}
      ON CONFLICT ("companyId", "externalJobId") DO UPDATE SET
        "title" = EXCLUDED."title",
        "url" = EXCLUDED."url",
        "department" = EXCLUDED."department",
        "locations" = EXCLUDED."locations",
        "locationType" = EXCLUDED."locationType",
        "salaryMin" = COALESCE(EXCLUDED."salaryMin", scraped_jobs."salaryMin"),
        "salaryMax" = COALESCE(EXCLUDED."salaryMax", scraped_jobs."salaryMax"),
        "salaryCurrency" = EXCLUDED."salaryCurrency",
        "jobDescriptionMd" = COALESCE(NULLIF(EXCLUDED."jobDescriptionMd", ''), scraped_jobs."jobDescriptionMd"),
        "contentHash" = COALESCE(EXCLUDED."contentHash", scraped_jobs."contentHash"),
        "lastSeenAt" = EXCLUDED."lastSeenAt",
        "postingEndDate" = EXCLUDED."postingEndDate",
        "removedAt" = NULL
      RETURNING
        "id",
        (xmax = 0) AS "is_insert",
        (xmax != 0 AND scraped_jobs."removedAt" IS NOT NULL) AS "is_reopened"
    )
    SELECT
      COUNT(*) FILTER (WHERE "is_insert") AS "added",
      COUNT(*) FILTER (WHERE NOT "is_insert") AS "updated",
      COUNT(*) FILTER (WHERE "is_reopened") AS "reopened"
    FROM upserted;
  `;

  const result = await prisma.$queryRawUnsafe<
    Array<{ added: bigint; updated: bigint; reopened: bigint }>
  >(sql, ...params);

  const row = result[0];

  const reopenedCount = Number(row.reopened);
  if (reopenedCount > 0) {
    logger.info("Jobs re-opened", { count: reopenedCount });
  }

  return {
    added: Number(row.added),
    updated: Number(row.updated),
    reopened: reopenedCount,
  };
}

/**
 * Mark jobs as removed if they were not seen in the current scrape.
 * Single query per company.
 */
async function detectRemovals(
  companyId: string,
  seenExternalIds: string[],
): Promise<number> {
  if (seenExternalIds.length === 0) {
    // No jobs seen -- don't mark everything as removed (adapter may have returned empty due to error)
    return 0;
  }

  const sql = `
    WITH removed AS (
      UPDATE scraped_jobs
      SET "removedAt" = NOW()
      WHERE "companyId" = $1
        AND "removedAt" IS NULL
        AND "externalJobId" NOT IN (SELECT unnest($2::text[]))
      RETURNING id
    ) SELECT COUNT(*) AS "count" FROM removed
  `;

  const result = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    sql,
    companyId,
    seenExternalIds,
  );

  const removed = Number(result[0].count);
  if (removed > 0) {
    logger.info("Jobs marked as removed", { companyId, count: removed });
  }

  return removed;
}
