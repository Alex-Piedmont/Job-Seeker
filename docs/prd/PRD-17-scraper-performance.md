# PRD: Scraper Performance Optimization

**Version:** 1.0
**Date:** 2026-03-10
**Author:** Product Management
**Status:** Final
**Project:** Job Seeker

---

## 1. Introduction / Overview

The job scraper currently processes companies sequentially in a single-threaded loop (`scraper/src/index.ts`, 68 lines). Each company's jobs are upserted one at a time (`scraper/src/services/job-store.ts`, 112 lines), and "expensive" adapters (Workday, Oracle) make 1+N API calls with 500ms delays between each. At the current scale (~30 companies), a full scrape run takes 7+ hours. With a planned bulk import of 200+ companies, projected runtime balloons to 12-24 hours -- exceeding the 12-hour interval between the twice-daily cron runs (8am ET, 8pm PT).

This PRD addresses the problem through two complementary strategies: (1) a concurrent pipeline that parallelizes work at the company and job-detail levels with bulk database operations, and (2) smart scraping techniques that reduce unnecessary work by skipping unchanged content and leveraging API-level filtering where available. A queue-based fan-out architecture was evaluated and deferred (see Non-Goals).

---

## 2. Goals

- **Sub-60-minute full scrape:** 200+ enabled companies complete within a single cron window, with margin to spare.
- **Sub-30-minute incremental scrape:** When most job listings are unchanged, smart-skip logic avoids redundant API calls and HTML conversion, cutting runtime further.
- **No new infrastructure:** All changes remain within the existing Railway Docker container. No Redis, no queue service, no additional deployments.
- **Rate-limit safety:** Concurrent requests to ATS platforms are bounded per-domain to avoid 429s or IP bans.
- **Backward compatibility:** Existing `ScrapedJob` rows are unaffected. New schema fields are additive (nullable or defaulted).

### What Success Looks Like

The operator triggers the twice-daily cron and sees all 200+ companies complete within 60 minutes. Companies using cheap adapters (Greenhouse, Lever, SuccessFactors) finish in seconds. Workday/Oracle companies with hundreds of jobs finish in 1-3 minutes each instead of 5-10. On the second run of the day, most jobs are skipped entirely because their content hash is unchanged, and the full run completes in under 30 minutes. The admin panel's "last scraped" column shows timestamps within the same hour, not spread across 7+ hours.

---

## 3. User Stories

### US-1: Concurrent company scraping

**As a** platform operator, **I want** companies to be scraped concurrently, **so that** the total wall-clock time is bounded by the slowest company rather than the sum of all companies.

**Acceptance Criteria:**
- [ ] Companies are processed with configurable concurrency (see FR-4 for defaults)
- [ ] A full run of 200 companies completes in under 60 minutes
- [ ] Failures in one company do not block or delay other companies
- [ ] Logs clearly show which companies are running concurrently

### US-2: Per-adapter rate limiting

**As a** platform operator, **I want** concurrent scrapes to respect per-ATS-platform rate limits, **so that** the scraper is not blocked or banned by Workday, Oracle, or other providers.

**Acceptance Criteria:**
- [ ] Configurable concurrency limit per ATS platform (see FR-4 for defaults)
- [ ] Global concurrency limit caps total parallel work regardless of platform mix (nested semaphore: acquire global slot first, then per-adapter slot)
- [ ] Rate limit config is centralized in `scraper/src/config.ts`

### US-3: Concurrent job detail fetching

**As a** platform operator, **I want** Workday and Oracle job detail pages fetched concurrently within a single company, **so that** large companies with 300+ jobs do not take 5+ minutes.

**Acceptance Criteria:**
- [ ] Job detail requests within a company run with configurable concurrency (see FR-4 for defaults)
- [ ] Per-host rate limiting prevents exceeding safe request rates
- [ ] A 300-job Workday company completes end-to-end (list + details + upsert) in under 90 seconds (down from ~5 minutes)

### US-4: Bulk database upserts

**As a** platform operator, **I want** job upserts to use batch SQL operations, **so that** database round trips are reduced from 2N to ~N/50.

**Acceptance Criteria:**
- [ ] Jobs are upserted in batches of 50 using `INSERT ... ON CONFLICT DO UPDATE`
- [ ] Removal detection uses a single query per company (not per-job)
- [ ] New jobs get correct `firstSeenAt`; existing jobs preserve their `firstSeenAt`
- [ ] Re-opened jobs (previously removed, now seen again) have `removedAt` cleared

### US-5: Content hash deduplication

**As a** platform operator, **I want** unchanged job descriptions to be skipped during re-scrape, **so that** expensive HTML-to-Markdown conversion is avoided for the ~90% of jobs that don't change between runs.

**Acceptance Criteria:**
- [ ] A SHA-256 hash of `jobDescriptionHtml` is stored on each `ScrapedJob`
- [ ] On re-scrape, if the hash matches, `jobDescriptionMd` is not regenerated
- [ ] `lastSeenAt` is still updated even when content is unchanged
- [ ] Metadata fields (title, location, salary) are still updated regardless of hash match

### US-6: Greenhouse incremental fetching

**As a** platform operator, **I want** Greenhouse scrapes to only fetch jobs updated since the last scrape, **so that** companies with large stable listings complete near-instantly on re-scrape.

**Acceptance Criteria:**
- [ ] Greenhouse adapter passes `updated_after` parameter using company's `lastScrapeAt`
- [ ] New jobs and updated jobs are returned; unchanged jobs are not re-fetched
- [ ] Removal detection still works correctly (requires separate lightweight listing call)
- [ ] First scrape (no `lastScrapeAt`) fetches all jobs as before

### US-7: Conditional detail fetch for Workday/Oracle

**As a** platform operator, **I want** Workday and Oracle adapters to skip detail page fetches for jobs whose list-level metadata is unchanged, **so that** the most expensive API calls are avoided when only the listing page needs checking.

**Acceptance Criteria:**
- [ ] Before fetching a job detail page, the adapter checks if the job's `title` matches the existing DB record
- [ ] If title matches and `contentHash` is non-null, the detail fetch is skipped
- [ ] If title differs or `contentHash` is null, the detail page is fetched
- [ ] Skipped jobs still have `lastSeenAt` updated

---

## 4. Functional Requirements

### Concurrency Engine

- **FR-1:** Replace the sequential `for` loop in `scraper/src/index.ts` with a concurrency-limited worker pool using `p-limit`. Semaphores are nested: each company scrape must acquire a global slot first, then a per-adapter slot. This guarantees total concurrency never exceeds the global limit while preventing any single adapter from monopolizing all slots. All concurrency defaults are defined in FR-4.

- **FR-2:** Introduce per-adapter concurrency semaphores. Each ATS platform has a configurable max concurrency. Default values:

| Platform | Max Concurrent Companies | Rationale |
|---|---|---|
| `GREENHOUSE` | 8 | Single fast API call, low risk |
| `LEVER` | 8 | Single fast API call, low risk |
| `SUCCESSFACTORS` | 8 | Single XML feed, low risk |
| `ICIMS` | 4 | Paginated, moderate request volume |
| `WORKDAY` | 3 | 1+N calls per company, rate-limit sensitive |
| `ORACLE` | 3 | 1+N calls per company, rate-limit sensitive |

- **FR-3:** Within Workday and Oracle adapters, replace the sequential detail-fetch loop with a concurrency-limited pool (see FR-4 for concurrency and rate-limit defaults). Rate limiting uses a shared singleton keyed by hostname (not by company), so two companies on the same Workday tenant (e.g., subsidiaries sharing `*.wd1.myworkdayjobs.com`) share a single rate limiter. Implemented as a per-host async mutex that enforces a minimum `minRequestIntervalMs` gap between the start of consecutive requests to the same hostname (simple timestamp + delay approach, not token bucket). This replaces the existing 500ms fixed delay entirely -- the host-level rate limiter is the sole pacing mechanism for all request types (pagination and detail fetches alike).

- **FR-4:** Expand `scraper/src/config.ts` to include all concurrency settings:

```typescript
export const config = {
  databaseUrl: process.env.DATABASE_URL!,
  userAgent: "JobSeekerBot/1.0 (+https://jobseeker.app/bot)",
  // Old fixed delays (betweenRequests: 500, betweenPages: 2500) are removed.
  // Rate limiting is now handled by the host-level rate limiter (minRequestIntervalMs).
  delays: {
    rateLimitWait: 60000,         // 60s wait on 429
  },
  retries: {
    network: 3,
    rateLimit: 1,
    serverError: 2,
  },
  concurrency: {
    global: 8,                    // max companies in parallel
    perAdapter: {
      GREENHOUSE: 8,
      LEVER: 8,
      SUCCESSFACTORS: 8,
      ICIMS: 4,
      WORKDAY: 3,
      ORACLE: 3,
    },
    jobDetailConcurrency: 5,      // concurrent detail fetches within one company
    minRequestIntervalMs: 100,    // minimum gap between requests to same host
  },
  archiveAfterDays: 7,
  playwrightTimeout: 30000,
} as const;
```

### Bulk Database Operations

- **FR-5:** Replace the per-job `findUnique` + `create`/`update` loop in `job-store.ts` with a batch `INSERT ... ON CONFLICT DO UPDATE` using `$queryRawUnsafe`. Batch size: 50 jobs per query. IDs for new rows shall be pre-generated in application code using `@paralleldrive/cuid2` to maintain format consistency with existing Prisma-generated CUIDs. The `locations` JSON array shall be passed as `JSON.stringify(locations)` with explicit `::jsonb` casting in SQL.

```sql
INSERT INTO scraped_jobs (
  id, company_id, external_job_id, title, url, department,
  locations, location_type, salary_min, salary_max, salary_currency,
  job_description_md, content_hash, first_seen_at, last_seen_at, posting_end_date
)
VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $15, $16), ...
ON CONFLICT (company_id, external_job_id) DO UPDATE SET
  title = EXCLUDED.title,
  url = EXCLUDED.url,
  department = EXCLUDED.department,
  locations = EXCLUDED.locations,
  location_type = EXCLUDED.location_type,
  salary_min = EXCLUDED.salary_min,
  salary_max = EXCLUDED.salary_max,
  salary_currency = EXCLUDED.salary_currency,
  job_description_md = COALESCE(NULLIF(EXCLUDED.job_description_md, ''), scraped_jobs.job_description_md),
  content_hash = COALESCE(EXCLUDED.content_hash, scraped_jobs.content_hash),
  last_seen_at = EXCLUDED.last_seen_at,
  posting_end_date = EXCLUDED.posting_end_date,
  removed_at = NULL;
```

Note: `firstSeenAt` is only in the INSERT, not in the ON CONFLICT UPDATE clause. This preserves the original discovery date for existing rows, including re-opened jobs.

- **FR-5a:** Detect re-opened jobs for logging using a CTE with `RETURNING` on the bulk upsert. The upsert query shall return rows where `removed_at` was non-null before the update (i.e., jobs that were re-opened). This avoids a separate pre-query. Implementation detail is left to the engineer, but the approach should not require an extra round trip.

- **FR-6:** Removal detection shall use a single query per company:

```sql
UPDATE scraped_jobs
SET removed_at = NOW()
WHERE company_id = $1
  AND removed_at IS NULL
  AND external_job_id NOT IN (SELECT unnest($2::text[]));
```

### Adapter Interface Changes

- **FR-9a:** Expand the `listJobs()` adapter interface to accept the full company record (including `lastScrapeAt`) and an optional `existingJobs` map:

```typescript
interface ExistingJobRecord {
  externalJobId: string;
  title: string;
  contentHash: string | null;
}

interface AtsAdapter {
  listJobs(
    company: { id: string; name: string; baseUrl: string; atsPlatform: string; lastScrapeAt: Date | null },
    existingJobs?: Map<string, ExistingJobRecord>,
  ): Promise<ScrapedJobData[]>;
}
```

The scrape runner pre-loads the existing jobs map from the database (one query per company) and passes it to the adapter. Cheap adapters (Greenhouse, Lever, SuccessFactors, iCIMS) ignore the `existingJobs` parameter. Workday and Oracle use it for conditional detail skip logic (FR-10). Greenhouse uses `lastScrapeAt` for incremental fetching (FR-9). This keeps adapters free of direct database dependencies.

### Content Hash & Smart Skipping

- **FR-7:** Add `contentHash` column to `ScrapedJob` model:

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `contentHash` | `String?` | No | `null` | SHA-256 hex digest of raw `jobDescriptionHtml` |

Migration is additive (nullable column, no backfill required). Existing rows will have `null` and will be fully processed on next scrape, at which point the hash is populated.

- **FR-8:** In the upsert flow, before calling `htmlToMarkdown()`:
  1. Compute SHA-256 of the raw `jobDescriptionHtml`
  2. If the job exists in the current batch's DB lookup and `contentHash` matches, skip `htmlToMarkdown()` and pass an empty string for `job_description_md` in the upsert (the `COALESCE(NULLIF(...))` in FR-5 preserves the existing value)
  3. If hash differs or is null, run `htmlToMarkdown()` and include the new hash

- **FR-9:** For Greenhouse, pass `updated_after` query parameter set to the company's `lastScrapeAt` (ISO 8601). On first scrape (no `lastScrapeAt`), omit the parameter. Removal detection requires a separate lightweight call to list all active job IDs (Greenhouse supports `?per_page=500&fields=id` for minimal payloads). The adapter receives `lastScrapeAt` via the expanded company parameter (see FR-9a).

  **Implementation risk:** The `updated_after` parameter must be validated against the Greenhouse Boards API (`boards-api.greenhouse.io`) at implementation time. The Boards API is unauthenticated and may not support this parameter (it is documented for the authenticated Harvest API). If unsupported, Phase 5 falls back to full-fetch-only for Greenhouse, relying on the content hash skip (FR-8) to avoid redundant `htmlToMarkdown` conversion. This fallback still provides meaningful savings.

- **FR-10:** For Workday and Oracle, before fetching a job's detail page:
  1. Look up the job by `(companyId, externalJobId)` in the `existingJobs` map passed to `listJobs()` (see FR-9a)
  2. If title matches AND `contentHash` is non-null, skip the detail fetch (FR-8 hash-skip logic preserves existing markdown)
  3. If title differs or `contentHash` is null, fetch the detail page as normal

Only `title` is compared. Location and salary are excluded: Workday returns `locationsText` as a single string (vs the DB's JSON array), and salary is only available on the detail page. This is a conservative strategy -- salary/location-only changes are uncommon and will be caught when content changes alter the hash.

### Logging & Observability

- **FR-11:** The scrape runner shall log a summary at completion including:
  - Total wall-clock duration
  - Companies processed (success / failure / partial)
  - Jobs added / updated / removed / skipped (hash match) / re-opened
  - Detail fetches skipped (conditional skip)
  - Peak concurrency reached (via `p-limit`'s `activeCount` / `pendingCount`)

- **FR-12:** Each company scrape shall log its individual duration and job counts, as it does today, with the addition of `skipped` count.

### Scrape Timing

- **FR-14:** `lastScrapeAt` shall be set to the scrape start time (captured before adapter execution begins) but only persisted to the database after a successful company scrape. This ensures Greenhouse's `updated_after` window captures any changes that occurred during the run, while a crashed/failed scrape does not advance the timestamp.

---

## 5. Non-Goals (Out of Scope)

- **Queue-based fan-out:** No Redis, BullMQ, or multi-container worker pools (per "No new infrastructure" goal). If scale exceeds 500+ companies, revisit.
- **Adaptive scheduling:** No variable scrape frequency per company. All enabled companies run on both cron triggers.
- **Playwright parallelism:** Workday/Oracle use HTTP APIs (CXS, HCM), not browser automation. No changes to Playwright usage.
- **Manual scrape optimization:** The Next.js `after()` single-company scrape path (`src/lib/scraper/`) is not modified in this PRD.
- **Backfill of content hashes:** Existing rows get `null` hash and are fully processed on next run. No migration script to pre-compute hashes.
- **New admin UI:** No dashboard changes for concurrency monitoring. Observability is via logs only.
- **Retry/resume from checkpoint:** If the container crashes mid-run, the next cron re-scrapes everything. No persistent progress tracking.
- **Connection pooling changes:** Database connection pool size may need tuning but is left to implementation-time profiling.
- **Deduplication across companies:** Same job posted by multiple companies remains as separate rows.

---

## 6. Design Considerations

### User Interface

No UI changes. This is a backend-only optimization.

### User Experience

**Journey: Operator monitors a scrape run**
1. Cron triggers at 8am ET
2. Logs show "Scraper starting, 200 companies, concurrency: 8"
3. Greenhouse/Lever companies finish in first 2-3 minutes (batches of 8)
4. Workday/Oracle companies process 3 at a time, each finishing in 1-3 minutes
5. Logs show per-company summaries with skip counts
6. Final summary: "Scraper finished in 42 minutes. 200 companies, 8,421 jobs (1,203 added, 6,102 skipped, 847 updated, 269 removed)"
7. Admin panel shows all "last scraped" times within a 42-minute window

### Error States

- **ATS returns 429:** Wait `rateLimitWait` (60s), retry once, then fail company. Other companies continue unaffected.
- **ATS returns 5xx:** Retry up to `retries.serverError` (2) times, then fail company.
- **Database connection error:** No shared abort signal. Each concurrent company scrape catches its own DB errors and marks status as FAILURE. If the DB is down, all in-flight scrapes fail naturally on their next DB call within seconds. The final summary log shows N failures as a clear signal to investigate.
- **Bulk upsert batch failure:** Each batch of 50 jobs is wrapped in a transaction. If a batch fails (e.g., one row has invalid data), the batch is rolled back, the error is logged, and the system retries that batch using the same raw SQL with batch size 1 to isolate the bad row. Remaining batches continue with bulk processing.
- **Memory pressure:** If concurrent Workday scrapes consume too much memory, reduce `concurrency.perAdapter.WORKDAY` in config.

---

## 7. Technical Considerations

### Architecture

```
                    ┌─────────────────────────────┐
                    │        main() entry          │
                    │   Load enabled companies     │
                    └──────────┬──────────────────-┘
                               │
                    ┌──────────▼──────────────────-┐
                    │     p-limit(global: 8)        │
                    │  ┌─────┬─────┬─────┬─────┐   │
                    │  │ Co1 │ Co2 │ Co3 │ ... │   │
                    │  └──┬──┴──┬──┴──┬──┴─────┘   │
                    └─────┼─────┼─────┼────────────┘
                          │     │     │
              ┌───────────▼─┐ ┌▼─────┴──────────┐
              │  Greenhouse │ │    Workday       │
              │  (1 call)   │ │ p-limit(detail:5)│
              │  bulk upsert│ │ ┌──┬──┬──┬──┬──┐ │
              └─────────────┘ │ │d1│d2│d3│d4│d5│ │
                              │ └──┴──┴──┴──┴──┘ │
                              │  bulk upsert     │
                              └──────────────────┘
```

**Modified files:**

| File | Lines | Changes |
|---|---|---|
| `scraper/src/index.ts` | 68 | Replace sequential loop with p-limit pool |
| `scraper/src/config.ts` | 18 | Add concurrency config block |
| `scraper/src/services/job-store.ts` | 112 | Rewrite to bulk SQL upsert + hash-aware skipping |
| `scraper/src/services/scrape-runner.ts` | 61 | Accept pre-loaded existing jobs map, pass to job-store |
| `scraper/src/adapters/workday.ts` | 256 | Concurrent detail fetches, conditional skip logic |
| `scraper/src/adapters/oracle.ts` | 219 | Concurrent detail fetches, conditional skip logic |
| `scraper/src/adapters/greenhouse.ts` | 79 | Add `updated_after` parameter, lightweight ID listing |
| `scraper/src/adapters/types.ts` | ~30 | Expand `AtsAdapter.listJobs()` signature per FR-9a (company record + existingJobs map), add `ExistingJobRecord` type |
| `prisma/schema.prisma` | ~500 | Add `contentHash` field to `ScrapedJob` |

**New files:**

| File | Purpose |
|---|---|
| `scraper/src/utils/concurrency.ts` | Nested semaphore factory (global + per-adapter), shared host-level rate limiter singleton keyed by hostname |

### Data

**Migration: Add `contentHash` to `ScrapedJob`**

```sql
ALTER TABLE scraped_jobs ADD COLUMN content_hash TEXT;
```

No new indexes required. The content hash is compared in application memory after loading existing jobs via the `(company_id, external_job_id)` unique constraint. No data backfill; null values trigger full processing on first run.

### Performance

| Metric | Current (30 companies) | Current (200 projected) | Target (200 companies) |
|---|---|---|---|
| Full scrape wall time | ~7 hours | ~15-24 hours | < 60 minutes |
| Incremental re-scrape | ~7 hours (same) | ~15-24 hours (same) | < 30 minutes |
| DB queries per company (100 jobs) | ~201 (100 find + 100 upsert + 1 removal) | same | ~4 (1 preload + 2 batch upserts + 1 removal) |
| Workday detail fetch wall time (300 jobs) | 300 sequential (150s in delays alone) | same | 300 concurrent/5 (~30s detail fetch time; ~90s end-to-end including list + upsert) |
| HTML-to-Markdown conversions | 100% of jobs every run | same | ~10% (only changed jobs) |

**Database connection pool:** Prisma manages a connection pool internally. With 8 concurrent company scrapes, set `connection_limit=10` via the `DATABASE_URL` parameter (8 active + headroom). Verify Railway's PostgreSQL plan supports this connection count at deploy time.

---

## 8. Security and Privacy

### Authentication & Authorization

No changes. The scraper uses `DATABASE_URL` from environment. No new auth surfaces.

### Input Validation

- Adapter responses are already validated/parsed before upsert. No changes.
- SHA-256 hash is computed server-side from adapter output. No user input involved.
- Raw SQL parameterized via `$queryRawUnsafe` with positional `$N` placeholders (no injection risk).

### Sensitive Data

No new sensitive data introduced. `contentHash` is a one-way hash of public job descriptions.

---

## 9. Testing Strategy

### Unit Tests

- **Bulk upsert logic:** Verify batch INSERT ... ON CONFLICT produces correct results for new jobs, updated jobs, unchanged jobs, re-opened jobs, and removed jobs
- **Content hash computation:** Verify SHA-256 produces consistent hashes for identical HTML; different hashes for different HTML
- **Hash-skip logic:** Verify `htmlToMarkdown` is not called when hash matches; is called when hash differs or is null
- **Concurrency config:** Verify per-adapter limits are respected (mock p-limit, count concurrent executions)

### Integration Tests

- **Greenhouse `updated_after`:** Mock API, verify parameter is passed, verify removal detection still works with incremental fetch
- **Conditional detail skip:** Mock Workday API, pre-populate DB with existing jobs, verify detail endpoint is not called for unchanged jobs
- **Bulk upsert with real DB:** Run against test database, verify all edge cases (new, update, remove, re-open) in a single batch

### Edge Cases

- Company with 0 jobs (empty listing page)
- Company with 1 job (batch size of 1)
- Company with 5,000+ jobs (multiple batches)
- All jobs unchanged (100% skip rate)
- All jobs new (0% skip rate, first scrape)
- Job removed then re-added in same scrape window
- Two companies sharing the same Workday tenant (host-level rate limit applies)
- Database connection drops mid-batch (transaction rollback, company marked as FAILURE)
- Adapter throws mid-list (partial results should not corrupt DB)

---

## 10. Dependencies and Assumptions

### Dependencies

**New libraries to install:**
- **`p-limit`** -- Concurrency limiter for async functions. Lightweight (0 deps), well-maintained, standard choice for Node.js concurrency control.
- **`@paralleldrive/cuid2`** -- CUID generation for bulk INSERT rows. Maintains format consistency with Prisma's `@default(cuid())` on existing rows.

**Existing dependencies (no changes):**
- `@prisma/client` -- ORM (used for non-bulk queries and schema)
- `turndown` -- HTML-to-Markdown conversion
- `playwright` -- Browser automation (Workday/Oracle if needed)

### Assumptions

- ATS platforms tolerate 3-5 concurrent requests from the same IP without triggering rate limits. If not, per-adapter concurrency can be reduced to 1-2.
- Railway's PostgreSQL plan supports 12+ concurrent connections. Current plan should be verified.
- The `htmlToMarkdown` function is the primary CPU cost per job. Skipping it via content hash provides the largest per-job savings.
- Greenhouse's `updated_after` API parameter is reliable and returns all modified jobs (not just newly created ones).

### Known Constraints

- Railway cron containers have no persistent state between runs. All concurrency state is in-memory.
- Single container means single IP. All concurrent requests share one origin IP for rate-limit purposes.
- Prisma's `$queryRawUnsafe` requires careful SQL construction. Parameterized queries mitigate injection risk but require testing.

---

## 11. Success Metrics

### Quantitative Metrics

| Metric | Target | How to Measure |
|---|---|---|
| Full scrape duration (200 companies) | < 60 minutes | Scraper completion log timestamp delta |
| Incremental scrape duration (200 companies) | < 30 minutes | Scraper completion log timestamp delta |
| Jobs skipped via hash match (incremental) | > 85% | Log `skipped` count / total jobs |
| Detail fetches skipped (Workday/Oracle, incremental) | > 70% | Log skip count / total detail-eligible jobs |
| DB queries per 100-job company | < 10 | Count queries via Prisma logging |
| Error rate per scrape run | < 5% of companies | Count FAILURE status / total companies |

### Qualitative Metrics

| Metric | How to Assess |
|---|---|
| Admin panel "last scraped" consistency | All timestamps within a 1-hour window |
| Log readability | Operator can identify bottlenecks from a single run's logs |
| Config tunability | Concurrency can be adjusted without code changes |

---

## 12. Implementation Order

| Phase | Scope | Risk Level | Verification |
|---|---|---|---|
| **Phase 1: Bulk DB upserts + adapter interface** | Rewrite `job-store.ts` to use batch INSERT ON CONFLICT. Add `contentHash` column. Expand adapter interface (FR-9a) to accept full company record + existingJobs map. | Low | Run against test DB, compare output with current per-job upsert for identical input |
| **Phase 2: Content hash skip** | Compute SHA-256, skip `htmlToMarkdown` when hash matches. Wire into bulk upsert. | Low | Scrape same company twice, verify second run has >90% skip rate and faster completion. Measure actual skip rates to validate the 30-minute incremental target; adjust if needed. |
| **Phase 3: Company-level concurrency** | Replace sequential loop with p-limit pool. Add per-adapter semaphores. | Medium | Run full scrape, verify wall time drops proportionally. Monitor for 429 errors. |
| **Phase 4: Job-detail concurrency** | Parallelize Workday/Oracle detail fetches within a company. Add host-level rate limiter. | Medium | Scrape a large Workday company, verify detail fetch time drops ~5x. Monitor for rate limits. |
| **Phase 5: Greenhouse incremental** | Add `updated_after` parameter. Implement lightweight ID listing for removal detection. | Medium | Compare job counts between full fetch and incremental fetch. Verify no jobs are missed. |
| **Phase 6: Conditional detail skip** | Skip Workday/Oracle detail pages when metadata unchanged and hash exists. | Low | Scrape large Workday company twice, verify detail fetch count drops on second run. |

---

## Clarifying Questions

**Q1: [OPTIONAL] Should the concurrency config be overridable via environment variables (e.g., `SCRAPER_GLOBAL_CONCURRENCY=4`) for quick tuning without redeployment, or is a code change acceptable?**

**Q2: [OPTIONAL] For the Greenhouse `updated_after` optimization, should removal detection use a separate lightweight API call on every run, or only run removal detection on a full scrape (e.g., once daily) while the other run is incremental-only?**

**Q3: [OPTIONAL] What is the Railway PostgreSQL connection limit? If it is below 15, the global concurrency default may need to be reduced from 8.**
