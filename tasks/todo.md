# PRD-17: Scraper Performance Optimization — Implementation Plan

## Phase 1: Bulk DB Upserts + Adapter Interface

**Goal:** Replace per-job upsert with batch SQL. Expand adapter interface. Add `contentHash` column.

### Steps

- [x] **1.1** Install `@paralleldrive/cuid2` in `scraper/package.json`, run `npm install`
- [x] **1.2** Add `contentHash String?` to `ScrapedJob` in `prisma/schema.prisma` (after `jobDescriptionMd`). Run `npx prisma migrate dev --name add-content-hash` and `npx prisma generate`
- [x] **1.3** Expand `scraper/src/adapters/types.ts`:
  - Add `ExistingJobRecord` interface (`externalJobId`, `title`, `contentHash`)
  - Expand `AtsAdapter.listJobs` to accept full company record (incl. `lastScrapeAt`) + optional `existingJobs?: Map<string, ExistingJobRecord>`
- [x] **1.4** Update all 6 adapter `listJobs` signatures to match new interface (signature-only, no logic changes): `greenhouse.ts`, `lever.ts`, `workday.ts`, `oracle.ts`, `icims.ts`, `successfactors.ts`
- [x] **1.5** Rewrite `scraper/src/services/job-store.ts` (full rewrite):
  - Import `createId` from `@paralleldrive/cuid2`, `createHash` from `node:crypto`
  - Add `computeContentHash(html)` helper (SHA-256 hex digest)
  - Add `skipped` to `UpsertResult`
  - Accept `existingJobs` map as third parameter to `upsertJobs()`
  - Chunk jobs into batches of 50
  - Build parameterized `INSERT ... ON CONFLICT DO UPDATE` SQL per batch
  - Use `$N::jsonb` casting for `locations`, `JSON.stringify()` for param value
  - Use `COALESCE(NULLIF(EXCLUDED.job_description_md, ''), scraped_jobs.job_description_md)` for markdown preservation
  - Use `COALESCE(EXCLUDED.salary_min, scraped_jobs.salary_min)` for salary fields (prevents Phase 6 nullification)
  - Pre-generate IDs via `createId()` for new rows
  - `firstSeenAt` only in INSERT, not in ON CONFLICT UPDATE
  - Detect re-opened jobs via CTE with RETURNING (no extra query)
  - Removal detection: single `UPDATE ... WHERE external_job_id NOT IN (unnest($2::text[]))` per company
  - Error handling: on batch failure, retry with batch size 1 to isolate bad row
  - **Table name:** use `scraped_jobs` not `ScrapedJob` in raw SQL
- [x] **1.6** Update `scraper/src/services/scrape-runner.ts`:
  - Pre-load existing jobs: `prisma.scrapedJob.findMany({ where: { companyId, removedAt: null }, select: { externalJobId, title, contentHash } })`
  - Build `existingJobs` map, pass to `adapter.listJobs()` and `upsertJobs()`
  - **FR-14:** Capture `scrapeStartTime = new Date()` before adapter call. Persist as `lastScrapeAt` only on success.
  - Pass full company object (with `lastScrapeAt`, `atsPlatform`) to adapter
- [x] **1.7** Verify `index.ts` passes full company record (Prisma `findMany` already returns it — just ensure `scrapeCompany` type accepts it)

### Verify before Phase 2
- [x] Migration succeeds, `contentHash` column exists
- [x] `npx tsc --noEmit` passes
- [ ] Test scrape one company: same jobs inserted, `content_hash` populated
- [ ] Removal detection works (manually remove a job, re-scrape)
- [ ] Re-opened detection works (set `removed_at`, re-scrape, confirm cleared + logged)
- [ ] `first_seen_at` preserved for existing rows

---

## Phase 2: Content Hash Skip

**Goal:** Skip `htmlToMarkdown()` when content hash is unchanged.

### Steps

- [ ] **2.1** In `job-store.ts` batch loop, before `htmlToMarkdown()`:
  - Compute `newHash = computeContentHash(job.jobDescriptionHtml)`
  - Look up job in `existingJobs` map by `externalJobId`
  - If found AND `existing.contentHash === newHash`: set `jobDescriptionMd = ""`, increment `skipped` (SQL COALESCE preserves existing)
  - If not found OR hash differs/null: call `htmlToMarkdown()`, include new hash
- [ ] **2.2** Add `skipped: result.skipped` to scrape-runner log output

### Verify before Phase 3
- [ ] Scrape a company, then immediately scrape again
- [ ] Second run shows >90% `skipped` in logs
- [ ] Second run is measurably faster
- [ ] `job_description_md` is NOT overwritten with empty string on skipped jobs (check DB)
- [ ] Changed HTML gets markdown re-generated and new hash stored

---

## Phase 3: Company-Level Concurrency

**Goal:** Replace sequential loop with `p-limit` pool + nested per-adapter semaphores.

### Steps

- [x] **3.1** Install `p-limit` (v6+, ESM-only — works with `tsx`) in `scraper/package.json`
- [x] **3.2** Update `scraper/src/config.ts`:
  - Kept `delays.betweenRequests` and `delays.betweenPages` (adapters still reference them; Phase 4 removes)
  - Keep `delays.rateLimitWait` (60000)
  - Add `concurrency` block: `global: 8`, `perAdapter` map, `jobDetailConcurrency: 5`, `minRequestIntervalMs: 100`
  - Support env var overrides: `parseInt(process.env.SCRAPER_GLOBAL_CONCURRENCY ?? "8")`
- [x] **3.3** Create `scraper/src/utils/concurrency.ts`:
  - `createConcurrencyLimiters()`: returns `globalLimit` (p-limit) + `adapterLimits` (record of p-limit per platform)
  - `HostRateLimiter` class (singleton): per-host async mutex with promise-chain serialization, enforces `minRequestIntervalMs` gap between requests to same hostname
  - Used dynamic `import("p-limit")` to handle ESM-only module in CJS/Node16 context
- [x] **3.4** Rewrite main loop in `scraper/src/index.ts`:
  - Replace `for` loop with `Promise.allSettled(companies.map(c => globalLimit(() => adapterLimit(() => scrapeCompany(c)))))`
  - Nested semaphore: acquire global slot, then per-adapter slot
  - Add FR-11 summary logging (wall time, success/failure counts)
- [x] **3.5** Do NOT remove `delay()` calls from adapters yet (Phase 4 replaces them with host rate limiter)

### Verify before Phase 4
- [ ] Full scrape with 8+ companies: logs show concurrent processing
- [ ] Wall time drops proportionally to concurrency
- [ ] No 429 errors
- [ ] No new failures vs sequential baseline
- [ ] Monitor memory usage

---

## Phase 4: Job-Detail Concurrency + Host Rate Limiter

**Goal:** Parallelize Workday/Oracle detail fetches. Replace fixed delays with host-level rate limiter.

### Steps

- [x] **4.1** Workday adapter (`scraper/src/adapters/workday.ts`):
  - Import `hostRateLimiter` from `../utils/concurrency.js` and `pLimit`
  - Remove all `await delay(config.delays.betweenRequests)` calls
  - Add `await hostRateLimiter.acquire(host)` before every `fetch()` call
  - Replace sequential detail-fetch loop with `pLimit(config.concurrency.jobDetailConcurrency)` pool
  - Each detail task returns `ScrapedJobData | null`; filter nulls after `Promise.allSettled`
  - Pagination loop stays sequential (page by page); detail fetches within each page are concurrent
- [x] **4.2** Oracle adapter (`scraper/src/adapters/oracle.ts`): same pattern as Workday
  - Filter US + full-time from list FIRST, then parallelize detail fetches for eligible jobs only
- [x] **4.3** iCIMS adapter (`scraper/src/adapters/icims.ts`): replace `delay()` with `hostRateLimiter.acquire()`
- [x] **4.4** Remove dead delay config values from `config.ts` (`betweenRequests`, `betweenPages`)

### Verify before Phase 5
- [ ] Large Workday company (100+ jobs): detail fetches run 5 concurrently
- [ ] Detail phase ~5x faster than sequential
- [ ] No 429 errors from Workday or Oracle
- [ ] Two companies on same Workday tenant share rate limiting
- [ ] Full scrape: no regressions

---

## Phase 5: Greenhouse Incremental Fetching

**Goal:** Use `updated_after` to only fetch changed Greenhouse jobs. Maintain removal detection.

### Steps

- [x] **5.1** Update Greenhouse adapter (`scraper/src/adapters/greenhouse.ts`):
  - If `company.lastScrapeAt` exists, append `&updated_after={ISO8601}` to URL
  - **Implementation risk:** Boards API may not support `updated_after`. If API returns error, catch and fallback to full fetch without parameter
  - For removal detection with incremental mode: also fetch lightweight ID-only list (`/jobs` without `?content=true`)
  - For unchanged jobs (in ID list but not in incremental response): create lightweight `ScrapedJobData` entries with empty `jobDescriptionHtml` (hash-skip preserves existing markdown)
  - This ensures `seenExternalIds` in job-store gets the full list for removal detection
  - Added detection for API ignoring `updated_after` (returns same count as full list) → falls back to full fetch
- [ ] **5.2** Test `updated_after` against real Greenhouse Boards API

### Verify before Phase 6
- [ ] If `updated_after` works: second scrape returns fewer jobs, non-updated jobs filled from ID list
- [ ] If it doesn't work: fallback to full fetch is seamless
- [ ] Removal detection still marks removed jobs correctly
- [ ] No jobs lost between incremental runs

---

## Phase 6: Conditional Detail Skip (Workday/Oracle)

**Goal:** Skip detail page fetches when title matches and content hash exists.

### Steps

- [x] **6.1** Workday adapter: inside detail-fetch pool (from Phase 4), before fetching:
  - Look up job in `existingJobs` map (try `externalPath` as key)
  - If found AND `existing.contentHash` non-null AND `existing.title === posting.title`: return lightweight `ScrapedJobData` with empty `jobDescriptionHtml`
  - **Gotcha:** Workday `externalJobId` may be `jobReqId` (from detail page), not `externalPath` (from listing). On first scrape, all details are fetched. On subsequent scrapes, try matching by `externalPath` — if not found, fetch detail as normal.
- [x] **6.2** Oracle adapter: same pattern but simpler — `req.Id` is available at list time and matches stored `externalJobId`
  - Look up `existingJobs.get(req.Id)`, compare title, skip if hash exists
- [x] **6.3** Verify salary fields preserved on skipped jobs (COALESCE in Phase 1 SQL handles this)
- [x] **6.4** Add detail-skip counting to adapter logs

### Final Verification
- [ ] Scrape large Workday company twice: detail fetch count drops >70% on second run
- [ ] Skipped jobs retain `jobDescriptionMd` and salary fields
- [ ] `lastSeenAt` still updated for skipped jobs
- [ ] Same tests for Oracle
- [ ] Full end-to-end: 200+ companies < 60 min wall time
- [ ] Second run within the hour: < 30 min (incremental)

---

## Cross-Phase Gotchas

1. **Raw SQL table names:** Use `scraped_jobs` not `ScrapedJob` (Prisma `@@map`)
2. **`p-limit` v6+ is ESM-only:** Works with `tsx` but verify at install
3. **COALESCE for salary fields:** Must be in Phase 1 SQL to prevent Phase 6 nullification
4. **Host rate limiter must use promise-chain mutex:** Simple timestamp has race condition with concurrent callers
5. **Greenhouse `updated_after` may not work on Boards API:** Content-hash skip (Phase 2) provides most savings as fallback
6. **Workday `externalJobId` mismatch:** `externalPath` (listing) vs `jobReqId` (detail) — test with real data
