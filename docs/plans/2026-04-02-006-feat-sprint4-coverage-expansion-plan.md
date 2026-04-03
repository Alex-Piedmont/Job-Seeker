---
date: 2026-04-02
plan: 006
type: feat
source: sprints/sprint-4.md (F-24, F-25, F-26, F-27)
depth: Standard
status: Draft
---

# Plan: Sprint 4 -- Coverage Expansion

## Context Summary

Sprint 4 covers four features across the scraper subsystem. Research probes resolved key unknowns upfront:

**F-24 (Workday Unresolved):** Of the 3 companies, only Nordstrom is actually on Workday (siteId `nordstrom_careers`, 1,010 jobs). BNY Mellon and Waste Management have decommissioned their Workday tenants and migrated to Oracle Cloud HCM. BNY Mellon is at `eofe.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001`, WM is at `emcm.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/WMCareers`. F-24 reduces to 3 DB inserts.

**F-26 (Netflix Eightfold Fallback):** Netflix's career portal is at `explore.jobs.netflix.net`, not `jobs.netflix.com`. The search page at `/careers?query=&...` returns all 646 jobs as an embedded `positions` JSON array in a single page load -- no PCSX auth needed. Individual job pages expose JSON-LD with full descriptions. The approach is to add a third Eightfold variant (`careers-page`) that parses embedded positions from the search page HTML, then fetches JSON-LD detail per job using the existing `fetchJsonLdDetail()`.

**F-25 (Oracle Taleo Adapter):** Taleo REST API confirmed via live probing against `valero.taleo.net`. Search is POST to `/careersection/rest/jobboard/searchjobs?lang=en&portal={portalNo}`. The `portalNo` is NOT the URL path segment -- it must be scraped from the career section HTML page. Session cookie required. No REST detail endpoint -- detail comes from parsing `jobdetail.ftl` page's `initialHistory` hidden field. Page size is server-fixed at 25. UHG may have migrated off Taleo. Taleo is NOT sunset.

**F-27 (Skip Unchanged Job Descriptions):** Already planned in `docs/plans/2026-04-01-005-feat-skip-unchanged-job-descriptions-plan.md`. Content-hash skip is already implemented in the production scraper; remaining work is the Next.js initial-scrape path only. This plan references but does not duplicate Plan 005.

**Institutional learnings applied:**
- Content-hash cache key mismatch bug (verify read-key === write-key)
- Workday 422 = wrong siteId, not WAF (confirmed by probes)
- Validate API parameter limits empirically before coding (Taleo page size is server-fixed at 25)
- Cookie harvesting utility is reusable across adapters (Taleo may need session cookies)

## Requirements Trace

| Requirement | Source | Atomic Unit(s) |
|-------------|--------|----------------|
| R1: Import Nordstrom (Workday) into production DB | F-24 | AU-1 |
| R2: Import BNY Mellon and WM as Oracle HCM into production DB | F-24 | AU-1 |
| R3: Netflix jobs are scraped via Eightfold adapter without PCSX auth | F-26 | AU-2 |
| R4: Eightfold adapter detects Netflix-style portals and uses careers-page variant | F-26 | AU-2 |
| R5: Taleo adapter scrapes job listings from *.taleo.net career sections | F-25 | AU-3, AU-4 |
| R6: Taleo adapter extracts full job details from FTL detail pages | F-25 | AU-4 |
| R7: Taleo companies are probed and imported into production DB | F-25 | AU-5 |
| R8: Next.js initial-scrape path persists contentHash and skips unchanged conversions | F-27 | Plan 005 |

## Scope Boundaries

- No changes to the production scraper's existing content-hash skip logic (already working)
- No Greenhouse `updated_at` optimization (out of scope per Plan 005)
- No traditional `*.icims.com` portal support (separate feature)
- No salary extraction from Taleo (not available in structured API fields)
- Taleo adapter targets the 8 companies listed in docs/roadmap.md; Ross Stores is confirmed but others need probing

## Atomic Units

### AU-1: Insert Nordstrom, BNY Mellon, and Waste Management [F-24]
- [ ] **Goal:** Add 3 companies to production DB with correct platforms and URLs.
**Requirements:** R1, R2
**Dependencies:** None
**Files:**
- `scripts/insert-sprint4-companies.ts` -- New insert script for 3 companies
**Approach:**
Write a script following the pattern in `scripts/insert-lincoln.ts`. Insert 3 rows:
1. Nordstrom: `atsPlatform=WORKDAY`, `baseUrl=https://nordstrom.wd501.myworkdayjobs.com/nordstrom_careers`
2. BNY Mellon: `atsPlatform=ORACLE`, `baseUrl=https://eofe.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001`
3. Waste Management: `atsPlatform=ORACLE`, `baseUrl=https://emcm.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/WMCareers`

Before inserting, verify each endpoint returns jobs (fetch list endpoint, check count > 0). Use `ON CONFLICT (name) DO NOTHING` to be idempotent. Update `tasks/ats-import-unresolved.md` to reflect the resolution.
**Test Scenarios:**
- Script inserts 3 rows when none exist
- Script skips gracefully when company already exists
- Each endpoint is verified as returning jobs before insert
**Verification:**
Query production DB: `SELECT name, "atsPlatform", "baseUrl" FROM companies WHERE name IN ('Nordstrom', 'BNY Mellon', 'Waste Management')` returns 3 rows with correct platforms.

---

### AU-2: Add careers-page variant to Eightfold adapter [F-26]
- [ ] **Goal:** Netflix (and similar Eightfold sites with PCSX disabled) are scraped via embedded positions JSON from the careers search page + JSON-LD detail.
**Requirements:** R3, R4
**Dependencies:** None
**Files:**
- `scraper/src/adapters/eightfold.ts` -- Add `careers-page` variant detection and `listCareersPage()` function
**Approach:**
Add a third variant type: `type EightfoldVariant = "pcsx" | "smartapply" | "careers-page"`.

**Variant detection change in `detectVariant()`:** After PCSX fails, before falling through to SmartApply, try the careers search page at `https://{host}/careers?query=&domain={domain}&sort_by=relevance&triggerGo498=true`. Fetch HTML, regex-match for an embedded `positions` array (look for a JSON array containing objects with `id`, `name`, `locations` fields). If found and contains positions, set variant to `careers-page`.

**New `listCareersPage()` function:**
1. Fetch the careers search page (single request gets all positions embedded in HTML)
2. Extract the positions JSON from the HTML using regex (look for the serialized array between script tags or in a data attribute -- the exact pattern will be determined during implementation by inspecting the page source)
3. Each position has: `id`, `name`, `locations`, `department`, `work_location_option`, `t_create`
4. Filter to US positions using `isUSPositionLocations()`
5. For each eligible position, use `p-limit(jobDetailConcurrency)` + `acquireSlot()` + existing `fetchJsonLdDetail()` to get full description
6. Content-hash skip follows the same pattern as SmartApply (check `existingJobs`, skip detail fetch if title+hash match)
7. Construct `ScrapedJobData` with job URL: `https://{host}/careers/job/{id}`

The Netflix company record's `baseUrl` should be set to `https://explore.jobs.netflix.net/careers?domain=netflix.com` -- the host+domain are extracted by `parseBaseUrl()`.

**Key decision:** The careers-page variant is structurally similar to SmartApply (list from one endpoint, detail from JSON-LD) but the list mechanism differs (HTML-embedded JSON vs paginated API). Keep it as a separate function for clarity rather than parameterizing SmartApply.

**Test Scenarios:**
- PCSX disabled host falls through to careers-page detection (not SmartApply) when embedded positions found
- PCSX disabled host with no embedded positions falls through to SmartApply (existing behavior preserved)
- Careers-page variant extracts correct position count from embedded JSON
- US location filter applied correctly to careers-page positions
- JSON-LD detail fetch produces valid job descriptions
- Content-hash skip works for careers-page variant (returns empty `jobDescriptionHtml`)
**Verification:**
Run the scraper against Netflix company record. Confirm: variant detected as `careers-page`, US-filtered positions returned with job descriptions, no PCSX auth errors.

---

### AU-3: Taleo Prisma enum and adapter scaffold [F-25]
- [ ] **Goal:** Add TALEO to the AtsPlatform enum, create the adapter file with URL parsing and session management, register it.
**Requirements:** R5
**Dependencies:** None
**Files:**
- `prisma/schema.prisma` -- Add `TALEO` to `AtsPlatform` enum
- `prisma/migrations/YYYYMMDD_add_taleo_platform/migration.sql` -- Generated migration
- `scraper/src/adapters/taleo.ts` -- New file: `TaleoAdapter` class with URL parsing, session cookie acquisition, portal ID discovery
- `scraper/src/adapters/registry.ts` -- Import and register `TaleoAdapter`
- `scraper/src/config.ts` -- Add `TALEO: 3` to `concurrency.perAdapter`
**Approach:**
**URL parsing:** Taleo URLs follow `https://{tenant}.taleo.net/careersection/{csCode}/jobsearch.ftl`. Extract `tenant` (subdomain) and `csCode` (path segment) from `baseUrl`. The `csCode` is the career section code used in API URLs but NOT the portal number.

**Session + portal discovery:** Before any API call, the adapter must:
1. Fetch the career section HTML page at `https://{tenant}.taleo.net/careersection/{csCode}/jobsearch.ftl`
2. Extract the session cookie from the response `Set-Cookie` header
3. Extract `portalNo` via regex: `portalNo:\s*'(\d+)'`
4. Cache both per-tenant for the session

Use the global `hostRateLimiter` (100ms) for rate limiting. Set per-adapter concurrency to 3 (same as Oracle).

**Scaffold only:** This AU creates the file, URL parsing, session management, and registers the adapter. The `listJobs()` method returns an empty array with a TODO. Full implementation is AU-4.

**Test Scenarios:**
- URL parsing correctly extracts tenant and csCode from various Taleo URLs
- Session cookie is acquired from career section page
- Portal ID is extracted from embedded JS
- Adapter is registered and `getAdapter("TALEO")` returns it
**Verification:**
`npx prisma migrate dev` succeeds. TypeScript compiles without errors. `getAdapter("TALEO")` does not throw.

---

### AU-4: Taleo adapter -- search pagination and detail parsing [F-25]
- [ ] **Goal:** TaleoAdapter.listJobs() paginates the search API and extracts full job details from FTL detail pages.
**Requirements:** R5, R6
**Dependencies:** AU-3
**Files:**
- `scraper/src/adapters/taleo.ts` -- Implement search pagination, detail page parsing, US filtering, location/salary extraction
**Approach:**
**Search pagination:**
POST to `https://{tenant}.taleo.net/careersection/rest/jobboard/searchjobs?lang=en&portal={portalNo}` with:
- Session cookie from AU-3
- `Content-Type: application/json`
- `tz: GMT-05:00` header
- Request body with `pageNo` (1-indexed), empty filters
- Response contains `requisitionList` (array of jobs) and `pagingData` (currentPageNo, pageSize=25, totalCount)
- Paginate until `currentPageNo * pageSize >= totalCount`

**List-level filtering:**
Each requisition has a `column` array where locations are at a known index (JSON-encoded string array like `["US-TX-Houston"]`). Filter to jobs with US locations (prefix `US-`). The column order may vary per career section -- use the first request to detect it by examining `locationsColumns` field on requisitions, which indicates which column indices contain location data.

**Detail page parsing:**
For each eligible job, fetch `https://{tenant}.taleo.net/careersection/{csCode}/jobdetail.ftl?job={contestNo}` with the session cookie. Parse the hidden `initialHistory` form field (pipe-delimited, URL-encoded). Extract:
- Job title, description HTML (parts 14-17), department (parts 18-19), location (parts 20-21), posting date (parts 24-25)
- The `initialHistory` field structure may vary -- implementation should defensively parse and log warnings on unexpected formats

Use `p-limit(config.concurrency.jobDetailConcurrency)` for concurrent detail fetches, same as Oracle adapter.

**Content-hash skip:** Follow the same pattern as Oracle/Eightfold -- check `existingJobs` map by `contestNo`, skip detail fetch if title+hash match.

**Test Scenarios:**
- Search pagination iterates all pages for companies with > 25 jobs
- US-only filter excludes non-US locations (e.g., `["CA-ON-Toronto"]`)
- Detail page `initialHistory` is parsed correctly for description, location, posting date
- Content-hash skip avoids detail fetch for unchanged jobs
- Graceful handling when detail page returns unexpected format (log warning, skip job)
- Empty `requisitionList` on first page returns empty array (company may have migrated)
**Verification:**
Run adapter against Valero Energy (32 jobs, confirmed working). Verify: correct pagination (2 pages), US-filtered jobs returned with descriptions, no errors in logs.

---

### AU-5: Probe and import Taleo companies [F-25]
- [ ] **Goal:** Discover working Taleo career sections for the 8 target companies and insert resolved ones into production DB.
**Requirements:** R7
**Dependencies:** AU-4
**Files:**
- `scripts/probe-taleo.ts` -- New probe script
- `scripts/insert-taleo-companies.ts` -- New insert script for resolved companies
**Approach:**
**Probe script:** For each of the 8 Taleo companies (UHG, American Express, J&J, HCA Healthcare, Valero Energy, United Airlines, Textron, Ross Stores):
1. Fetch the career section HTML page
2. Check for `careerSectionUnAvailable: true` (means migrated/disabled)
3. If available, extract portalNo and hit the search API with `pageNo: 1`
4. Report company name, tenant, csCode, portalNo, totalCount (or "unavailable")

**Insert script:** For resolved companies, insert with `atsPlatform=TALEO` and `baseUrl=https://{tenant}.taleo.net/careersection/{csCode}/jobsearch.ftl`. Pattern follows `scripts/insert-lincoln.ts`.

**Known risks:** UHG returned `careerSectionUnAvailable: true` during research -- it may have migrated to Oracle Recruiting Cloud. Other companies may have similarly migrated. The probe step catches this before insertion.

**Test Scenarios:**
- Probe reports "unavailable" for migrated companies (UHG)
- Probe reports job count for active companies (Valero: 32 jobs)
- Insert script is idempotent (ON CONFLICT DO NOTHING)
- Dry-run mode reports without inserting
**Verification:**
Run probe script with `--dry-run`. Confirm resolved companies show job counts. Run insert against production DB. Query `SELECT name, "atsPlatform" FROM companies WHERE "atsPlatform" = 'TALEO'` returns expected rows.

---

### AU-6: F-27 -- Execute Plan 005 [F-27]
- [ ] **Goal:** Content-hash skip in the Next.js initial-scrape path + skip count in logs.
**Requirements:** R8
**Dependencies:** None
**Files:** See `docs/plans/2026-04-01-005-feat-skip-unchanged-job-descriptions-plan.md` (AU-1 and AU-2)
**Approach:** Execute Plan 005 as-is. That plan defines 2 atomic units covering `src/lib/scraper/job-store.ts` and `src/lib/scraper/scrape-company.ts`.
**Verification:** Per Plan 005 verification steps.

## Dependency Graph

```
AU-1 (F-24 inserts)         -- independent
AU-2 (F-26 Eightfold)       -- independent
AU-3 (F-25 Taleo scaffold)  -> AU-4 (Taleo implementation) -> AU-5 (Taleo probe+insert)
AU-6 (F-27 Plan 005)        -- independent
```

AU-1, AU-2, AU-3, and AU-6 can all begin in parallel. AU-4 depends on AU-3. AU-5 depends on AU-4.

## Key Technical Decisions

- **BNY Mellon and WM are Oracle HCM, not Workday:** Probes confirmed tenants are decommissioned (422 on all siteIds, maintenance page redirects). Their new Oracle HCM URLs are verified with job counts. F-24's scope changes from "resolve Workday siteIds" to "insert on correct platforms."
- **Careers-page as a third Eightfold variant (not a Netflix special case):** The embedded-positions pattern may apply to other Eightfold deployments where PCSX is disabled. Implementing as a general variant keeps the adapter extensible.
- **Taleo detail via FTL page parsing, not REST:** There is no REST detail endpoint. The `jobdetail.ftl` page embeds structured data in `initialHistory`. This is fragile but it's the only option.
- **Taleo portalNo must be scraped from HTML:** The URL path segment (e.g., `2`) is the career section code, not the portal number. The actual portal number (e.g., `101430233`) is embedded in JavaScript on the page. Getting this wrong returns `careerSectionUnAvailable: true`.
- **Duplicate F-27 `computeContentHash` in Next.js path:** Per Plan 005, the scraper and Next.js app are separate build targets; sharing code would require monorepo tooling changes that are out of scope.

## Unchanged Invariants

- Existing adapter behavior for all 8 current platforms must not change
- Eightfold PCSX and SmartApply variant paths must continue working identically for existing companies
- `ScrapedJobData` contract (`scraper/src/adapters/types.ts`) must not change -- Taleo adapter returns the same shape
- Job upsert SQL in `scraper/src/services/job-store.ts` must not change
- Concurrency limiter infrastructure (`concurrency.ts`) must not change
- Content-hash skip logic in production scraper (`job-store.ts:72-86`) must not change

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Taleo `initialHistory` format varies across tenants | Med | Med | Defensive parsing with fallback to empty description; test against 2+ tenants during AU-4 |
| Taleo career sections migrated (returns unavailable) | Med | Low | Probe before insert (AU-5); skip unavailable companies |
| Netflix embedded positions JSON format changes | Low | Med | Regex extraction may break; adapter should gracefully fall through to SmartApply |
| Taleo session cookies expire mid-scrape | Low | Low | Re-acquire session cookie on 401/403 response |

## Sources & References

- `scraper/src/adapters/eightfold.ts` -- Existing adapter with PCSX/SmartApply variants and JSON-LD detail
- `scraper/src/adapters/oracle.ts` -- Template pattern for new adapter (URL parsing, pagination, detail concurrency)
- `scraper/src/services/job-store.ts` -- Content-hash skip and batch upsert logic
- `docs/plans/2026-04-01-005-feat-skip-unchanged-job-descriptions-plan.md` -- F-27 plan (referenced, not duplicated)
- `docs/solutions/integration-issues/cloudflare-bot-management-cookie-harvesting.md` -- Cookie harvesting pattern reusable for Taleo if needed
- `docs/solutions/performance-issues/workday-detail-skip-key-mismatch.md` -- Content-hash key mismatch warning
- `docs/solutions/integration-issues/workday-cxs-page-size-limit.md` -- Validate API limits empirically
- `tasks/ats-import-unresolved.md` -- F-24 source: unresolved Workday companies
- Live API probing: Valero Taleo (search response structure), Netflix Eightfold (careers page + JSON-LD)
