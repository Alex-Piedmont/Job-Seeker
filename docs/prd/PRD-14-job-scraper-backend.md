# PRD: Job Scraper Backend

**Version:** 1.0
**Date:** 2026-03-06
**Author:** Product Management
**Status:** Draft
**Project:** Job Seeker -- Job Application Tracker

---

## 1. Introduction / Overview

The job scraper backend is an automated service that discovers and catalogs job postings from corporate career sites. Rather than requiring users to manually find and enter job postings, the scraper continuously monitors a curated list of companies, extracts structured job data from their ATS (Applicant Tracking System) platforms, and stores it in a shared database for users to browse.

The system uses ATS-platform adapters (not per-company adapters). An admin adds a company by specifying which ATS platform it uses (Greenhouse, Lever, Workday, or iCIMS) and providing the company's career site base URL. The adapter for that ATS platform handles the rest -- listing jobs, extracting structured fields, and converting job descriptions from HTML to Markdown.

The scraper runs as a Docker cron service on Railway, sharing the same PostgreSQL database and Prisma schema as the main Next.js application. It runs twice daily (8am ET and 8pm PT), iterating through all enabled companies and storing results in the `ScrapedJob` table. When a previously-seen job URL disappears from a company's listings, the scraper marks it as removed rather than deleting it. Jobs not seen for 7 consecutive days are auto-archived from search results.

This PRD covers three things: the new database models (`Company`, `ScrapedJob`, `UserJobArchive`), the scraper service itself (under `/scraper` in the monorepo), and the four V1 ATS adapters. The admin UI for managing companies (adding, editing, enabling/disabling) will be a new tab in the existing admin panel (PRD-6) but is not specified here -- that will be a follow-up PRD.

---

## 2. Goals

- **Automated job discovery:** The scraper shall discover new job postings from enabled companies twice daily without manual intervention.
- **Structured data extraction:** Each scraped job shall have structured fields (title, location, salary, department, job description) extracted directly from ATS-native data -- no LLM processing.
- **Platform-adapter architecture:** Adding a new company that uses a supported ATS shall require only a database row (name, ATS type, base URL), not new code.
- **Removal detection:** When a job posting is taken down, the scraper shall detect its absence and mark it as removed, preserving the historical record.
- **Respectful scraping:** The scraper shall introduce delays between requests, set proper user-agent headers, and avoid overwhelming target servers.
- **Scale readiness:** The system shall handle up to ~100 corporate sites and 100+ net-new postings daily without performance issues.

### What Success Looks Like

An admin navigates to the admin panel, adds "Stripe" with ATS type "Greenhouse" and base URL `https://boards.greenhouse.io/stripe`. At the next scheduled run (8am ET or 8pm PT), the scraper picks up Stripe, hits the Greenhouse JSON API, and inserts 150 job postings into the `ScrapedJob` table with structured titles, locations, departments, salary data (where available), and Markdown-formatted job descriptions. The next day, 3 of those jobs have been taken down -- the scraper marks them as removed. Seven days later, those 3 jobs are auto-archived and no longer appear in default search results. Meanwhile, 12 new Stripe postings have appeared and are available to users immediately after the scrape completes.

---

## 3. User Stories

### US-1: Company Configuration

**As an** admin, **I want to** add a company to the scrape list by specifying its ATS platform and base URL, **so that** the scraper automatically discovers its job postings.

**Acceptance Criteria:**
- [ ] A `Company` record can be created with fields: `name`, `atsPlatform` (enum: `GREENHOUSE`, `LEVER`, `WORKDAY`, `ICIMS`), `baseUrl`, and `enabled` (defaults to `true`)
- [ ] The `baseUrl` is validated to be a well-formed URL on save
- [ ] The `name` field is unique (case-insensitive) -- attempting to add a duplicate returns an error
- [ ] The `enabled` flag can be toggled to pause/resume scraping for a company without deleting its data
- [ ] When a company is disabled, its existing `ScrapedJob` records are preserved and remain searchable
- [ ] The `lastScrapeAt` and `scrapeStatus` fields are updated by the scraper after each run (not editable by admin)

### US-2: Scheduled Scraping

**As an** operator, **I want** the scraper to run automatically twice daily, **so that** job data stays current without manual intervention.

**Acceptance Criteria:**
- [ ] The scraper runs on a cron schedule: `0 13 * * *` (8am ET / 1pm UTC) and `0 4 * * *` (8pm PT / 4am UTC next day)
- [ ] Each run iterates through all `Company` records where `enabled === true`
- [ ] For each company, the scraper selects the correct ATS adapter based on `atsPlatform`
- [ ] The scraper updates `Company.lastScrapeAt` to the current timestamp after processing each company
- [ ] The scraper updates `Company.scrapeStatus` to `SUCCESS`, `PARTIAL_FAILURE`, or `FAILURE` after each company
- [ ] A full scrape run completes within 60 minutes for 100 companies
- [ ] If a single company fails, the scraper logs the error and continues to the next company (no full-run abort)

### US-3: Job Discovery and Storage

**As a** user, **I want** newly posted jobs to appear in the system within 12 hours of being published, **so that** I can find and apply to fresh opportunities.

**Acceptance Criteria:**
- [ ] Each scraped job is stored as a `ScrapedJob` record with fields: `title`, `companyId` (FK to Company), `externalJobId` (the ATS-native job identifier), `url` (direct link to the posting), `department`, `locations` (JSON array of location strings), `locationType` (Remote/Hybrid/On-site, when detectable), `salaryMin`, `salaryMax`, `salaryCurrency` (defaults to `USD`), `jobDescriptionMd` (Markdown), `firstSeenAt`, `lastSeenAt`, `removedAt`
- [ ] A job is uniquely identified by the composite key `(companyId, externalJobId)` -- if a job with the same key already exists, the scraper updates `lastSeenAt` and any changed fields rather than creating a duplicate
- [ ] The `firstSeenAt` field is set once on initial discovery and never updated (this serves as the "posting date" in the UI)
- [ ] The `lastSeenAt` field is updated to the current scrape timestamp on every run where the job is still present
- [ ] Job descriptions are converted from HTML to Markdown at scrape time using a library (e.g., Turndown)
- [ ] Only US-based roles are stored; international-only roles are filtered out during scraping (based on location data from the ATS)

### US-4: Removal Detection

**As a** user, **I want** jobs that have been taken down to be clearly marked, **so that** I don't waste time applying to closed positions.

**Acceptance Criteria:**
- [ ] When a previously-scraped job URL no longer appears in the company's ATS listing, the scraper sets `removedAt` to the current timestamp
- [ ] If a removed job reappears in a subsequent scrape (re-opened role), `removedAt` is set back to `null` and `lastSeenAt` is updated
- [ ] Removed jobs are never deleted from the database -- the record is preserved indefinitely
- [ ] Jobs where `removedAt` is non-null are excluded from default search results (but remain queryable with a filter)

### US-5: Auto-Archive

**As a** user, **I want** stale job postings to be automatically hidden from search, **so that** I see only currently-relevant opportunities.

**Acceptance Criteria:**
- [ ] A job is considered "stale" when `removedAt` is non-null and `removedAt` is more than 7 days ago
- [ ] Stale jobs have `archivedAt` set to the current timestamp by a daily cleanup task (can run as part of the scraper cron or a separate lightweight cron)
- [ ] `archivedAt` is a **global** flag set by the scraper/cron -- it is NOT per-user. It applies to the `ScrapedJob` record itself and affects all users equally
- [ ] The default Find Jobs query excludes jobs where `archivedAt IS NOT NULL`
- [ ] A "Show Archived" toggle in the UI reveals all archived jobs (both globally auto-archived and per-user archived via `UserJobArchive`)
- [ ] Archived jobs are also accessible via direct URL
- [ ] Auto-archiving does not affect any `UserJobArchive` records -- user-level archives are independent

### US-6: Per-User Job Archive

**As a** user, **I want to** archive (hide) individual job postings from my view, **so that** I can curate my job feed without affecting other users.

**Acceptance Criteria:**
- [ ] A `UserJobArchive` record links a `userId` to a `scrapedJobId` with a `createdAt` timestamp
- [ ] The composite key `(userId, scrapedJobId)` is unique -- a user can archive a job only once
- [ ] When a user archives a job, it is hidden from their search/browse results but remains visible to other users
- [ ] A user can un-archive a job by deleting the `UserJobArchive` record
- [ ] Archiving is a lightweight operation (single row insert, no cascading updates)

### US-7: Greenhouse Adapter

**As the** scraper, **I want to** fetch jobs from Greenhouse-powered career sites via their public JSON API, **so that** I can extract structured job data without browser automation.

**Acceptance Criteria:**
- [ ] The adapter hits `{baseUrl}/jobs.json` (e.g., `https://boards.greenhouse.io/stripe/jobs.json`) which returns a JSON array of jobs
- [ ] For each job, the adapter extracts: `title`, `id` (as `externalJobId`), `absolute_url` (as `url`), `location.name`, `departments[0].name` (as `department`), and `content` (HTML, converted to Markdown)
- [ ] The adapter paginates if the API returns paginated results (Greenhouse uses `?page=N` pagination)
- [ ] Salary data is extracted from `metadata` fields when available (Greenhouse exposes salary ranges via custom fields on some boards)
- [ ] Location filtering: roles where `location.name` does not contain a US state, US city, "United States", or "Remote" are skipped
- [ ] The adapter sets a `User-Agent` header: `JobSeekerBot/1.0 (+https://jobseeker.app/bot)`
- [ ] A delay of 1-2 seconds is introduced between paginated requests to the same host
- [ ] If the API returns a non-200 status, the adapter throws a descriptive error including the status code and company name

### US-8: Lever Adapter

**As the** scraper, **I want to** fetch jobs from Lever-powered career sites via their public JSON API, **so that** I can extract structured data without browser automation.

**Acceptance Criteria:**
- [ ] The adapter hits `{baseUrl}?mode=json` (e.g., `https://jobs.lever.co/stripe?mode=json`) which returns a JSON array of postings
- [ ] For each posting, the adapter extracts: `text` (as `title`), `id` (as `externalJobId`), `hostedUrl` (as `url`), `categories.location`, `categories.team` (as `department`), and `descriptionPlain` or `description` (HTML, converted to Markdown)
- [ ] Lever returns all postings in a single response (no pagination needed for most companies); if the response exceeds 1000 postings, the adapter logs a warning
- [ ] Salary data is extracted from `salaryRange` fields when present in the Lever response (newer Lever API versions expose this)
- [ ] Location filtering: roles where `categories.location` does not reference a US location or "Remote" are skipped
- [ ] The adapter sets a `User-Agent` header: `JobSeekerBot/1.0 (+https://jobseeker.app/bot)`
- [ ] If the API returns a non-200 status, the adapter throws a descriptive error including the status code and company name

### US-9: Workday Adapter

**As the** scraper, **I want to** fetch jobs from Workday-powered career sites using browser automation, **so that** I can extract data from their JavaScript-rendered pages.

**Acceptance Criteria:**
- [ ] The adapter uses Playwright (headless Chromium) to navigate the Workday career site
- [ ] The adapter navigates to the base URL, waits for the job listing to render, and extracts job cards from the DOM
- [ ] For each job card, the adapter extracts: title, external job ID (from URL or data attribute), location, department, and the direct URL to the job detail page
- [ ] The adapter navigates to each job detail page to extract the full job description HTML, which is converted to Markdown
- [ ] Pagination: the adapter clicks "Show More" or navigates pagination controls until all jobs are loaded
- [ ] A delay of 2-3 seconds is introduced between page navigations to avoid rate limiting
- [ ] Location filtering: roles whose location does not reference a US location or "Remote" are skipped
- [ ] The adapter sets a recognizable user-agent string on the Playwright browser context
- [ ] If the career site structure changes and expected selectors are not found, the adapter throws a descriptive error: `"Workday adapter: expected selector '{selector}' not found for {companyName}"`
- [ ] The Playwright browser instance is properly closed in a `finally` block to prevent resource leaks

### US-10: iCIMS Adapter

**As the** scraper, **I want to** fetch jobs from iCIMS-powered career sites using browser automation, **so that** I can extract data from their JavaScript-rendered pages.

**Acceptance Criteria:**
- [ ] The adapter uses Playwright (headless Chromium) to navigate the iCIMS career portal
- [ ] The adapter navigates to the base URL, waits for the job listing to render, and extracts job entries from the DOM
- [ ] For each job entry, the adapter extracts: title, external job ID (from URL or data attribute), location, department/category, and the direct URL to the job detail page
- [ ] The adapter navigates to each job detail page to extract the full job description HTML, which is converted to Markdown
- [ ] Pagination: the adapter handles iCIMS pagination (typically page number links or "Next" buttons) until all jobs are listed
- [ ] A delay of 2-3 seconds is introduced between page navigations to avoid rate limiting
- [ ] Location filtering: roles whose location does not reference a US location or "Remote" are skipped
- [ ] The adapter sets a recognizable user-agent string on the Playwright browser context
- [ ] If the career site structure changes and expected selectors are not found, the adapter throws a descriptive error: `"iCIMS adapter: expected selector '{selector}' not found for {companyName}"`
- [ ] The Playwright browser instance is properly closed in a `finally` block to prevent resource leaks

### US-11: Scrape Logging and Observability

**As an** operator, **I want to** see scrape run results in the admin panel and in logs, **so that** I can diagnose failures and monitor data freshness.

**Acceptance Criteria:**
- [ ] Each scrape run produces structured log output (JSON) with: company name, ATS platform, jobs found, jobs added, jobs updated, jobs marked removed, duration (ms), and any errors
- [ ] The `Company.scrapeStatus` field is set to `SUCCESS` when all jobs are processed without errors
- [ ] The `Company.scrapeStatus` field is set to `PARTIAL_FAILURE` when some jobs fail to parse but others succeed (with `scrapeError` containing the error summary)
- [ ] The `Company.scrapeStatus` field is set to `FAILURE` when the adapter throws an unrecoverable error (with `scrapeError` containing the error message)
- [ ] Logs are written to stdout for Railway's log aggregation
- [ ] The `Company.scrapeError` field stores the last error message (truncated to 1000 characters); cleared on successful runs

---

## 4. Technical Architecture / Stack

### Service Architecture

```
┌────────────────────────────┐     ┌───────────────────────────────┐
│  Next.js App (Railway)     │     │  Scraper Service (Railway)    │
│                            │     │  Docker cron container        │
│  /admin  ──► Company CRUD  │     │                               │
│  /api    ──► ScrapedJob    │     │  cron: 0 13 * * *, 0 4 * * * │
│              queries       │     │                               │
│                            │     │  ┌─────────────────────────┐  │
│                            │     │  │  Adapter Registry        │  │
│                            │     │  │  ├─ GreenhouseAdapter    │  │
│                            │     │  │  ├─ LeverAdapter         │  │
│                            │     │  │  ├─ WorkdayAdapter       │  │
│                            │     │  │  └─ iCIMSAdapter         │  │
│                            │     │  └─────────────────────────┘  │
└────────────┬───────────────┘     └──────────────┬────────────────┘
             │                                    │
             └───────── PostgreSQL (shared) ──────┘
```

### Technology Choices

| Component | Technology | Rationale |
|---|---|---|
| Runtime | Node.js 22 (LTS) | Same runtime as Next.js app; shared TypeScript tooling |
| ORM | Prisma (shared schema) | Models added to existing `prisma/schema.prisma`; single migration path |
| Scheduling | Railway cron / Docker entrypoint | No additional scheduler dependency; Railway-native |
| HTTP client (API adapters) | `fetch` (Node built-in) | No dependency needed for Greenhouse/Lever JSON APIs |
| Browser automation | Playwright | Required for Workday/iCIMS; headless Chromium in Docker |
| HTML-to-Markdown | Turndown | Well-maintained, configurable, handles ATS HTML quirks |
| Container | Docker (multi-stage) | Playwright requires specific system deps; Docker ensures reproducibility |

### Directory Structure

```
/scraper
├── Dockerfile
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Entry point: load companies, run adapters
│   ├── config.ts             # Environment variables, constants
│   ├── adapters/
│   │   ├── types.ts          # AtsAdapter interface, ScrapedJobData type
│   │   ├── registry.ts       # Maps AtsPlatform enum → adapter instance
│   │   ├── greenhouse.ts     # Greenhouse JSON API adapter
│   │   ├── lever.ts          # Lever JSON API adapter
│   │   ├── workday.ts        # Workday Playwright adapter
│   │   └── icims.ts          # iCIMS Playwright adapter
│   ├── services/
│   │   ├── scrape-runner.ts  # Orchestrates scrape for one company
│   │   ├── job-store.ts      # Upsert/removal logic against ScrapedJob table
│   │   └── archive.ts        # Auto-archive stale jobs
│   └── utils/
│       ├── html-to-md.ts     # Turndown wrapper with ATS-specific rules
│       ├── location-filter.ts # US-only location detection
│       ├── delay.ts          # Configurable sleep between requests
│       └── logger.ts         # Structured JSON logger
```

### Adapter Interface

```typescript
// /scraper/src/adapters/types.ts

export interface ScrapedJobData {
  externalJobId: string;
  title: string;
  url: string;
  department: string | null;
  locations: string[];           // e.g., ["San Francisco, CA", "Remote"]
  locationType: string | null;   // "Remote" | "Hybrid" | "On-site" | null
  salaryMin: number | null;      // In USD cents? No -- whole dollars, matching JobApplication
  salaryMax: number | null;
  salaryCurrency: string;        // Defaults to "USD"
  jobDescriptionHtml: string;    // Raw HTML from ATS
}

export interface AtsAdapter {
  /**
   * Fetch all active job postings for a company.
   * Returns structured data for each job found.
   * Throws on unrecoverable errors (network failure, site structure change).
   */
  listJobs(company: {
    id: string;
    name: string;
    baseUrl: string;
  }): Promise<ScrapedJobData[]>;
}
```

### Scrape Runner Flow

For each enabled company, the scrape runner executes:

1. **Fetch:** Call `adapter.listJobs(company)` to get all current postings
2. **Filter:** Remove non-US roles via `location-filter.ts`
3. **Transform:** Convert `jobDescriptionHtml` to Markdown via `html-to-md.ts`
4. **Upsert:** For each job, upsert into `ScrapedJob` by `(companyId, externalJobId)`:
   - If new: insert with `firstSeenAt = now()`, `lastSeenAt = now()`
   - If existing: update `lastSeenAt = now()` and any changed fields (title, salary, description, etc.)
5. **Detect removals:** Find all `ScrapedJob` records for this company where `removedAt IS NULL` and `externalJobId NOT IN (fetched job IDs)` -- set `removedAt = now()`
6. **Detect re-openings:** Find all `ScrapedJob` records for this company where `removedAt IS NOT NULL` and `externalJobId IN (fetched job IDs)` -- set `removedAt = null`
7. **Update company:** Set `lastScrapeAt = now()`, `scrapeStatus`, and `scrapeError`

### Docker Configuration

```dockerfile
# /scraper/Dockerfile
FROM node:22-slim AS base
RUN npx playwright install --with-deps chromium

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY scraper ./scraper
RUN cd scraper && npm ci --omit=dev && npm run build

CMD ["node", "scraper/dist/index.js"]
```

Railway cron configuration (in `railway.toml` or Railway dashboard):
- Schedule: `0 13 * * *` and `0 4 * * *`
- Restart policy: on-failure (max 2 retries)

---

## 5. Data Model

The following Prisma models shall be added to the existing schema at `/prisma/schema.prisma`. The migration shall be named `add_job_scraper`.

### Enum: AtsPlatform

```prisma
enum AtsPlatform {
  GREENHOUSE
  LEVER
  WORKDAY
  ICIMS
}

enum ScrapeStatus {
  SUCCESS
  PARTIAL_FAILURE
  FAILURE
  PENDING
}
```

### Model: Company

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | Yes | `cuid()` | Primary key |
| `name` | String | Yes | -- | Company display name; unique |
| `atsPlatform` | AtsPlatform | Yes | -- | Which ATS adapter to use |
| `baseUrl` | String | Yes | -- | Career site base URL for the adapter |
| `enabled` | Boolean | Yes | `true` | Whether to include in scrape runs |
| `lastScrapeAt` | DateTime | No | null | Timestamp of last completed scrape |
| `scrapeStatus` | ScrapeStatus | Yes | `PENDING` | Result of last scrape run |
| `scrapeError` | String (Text) | No | null | Last error message (truncated to 1000 chars); null on success |
| `createdAt` | DateTime | Yes | `now()` | -- |
| `updatedAt` | DateTime | Yes | `@updatedAt` | -- |

Unique constraint: `@@unique([name])` -- company names are unique.

Index: `@@index([enabled])` -- for filtering enabled companies during scrape runs.

Relations: `scrapedJobs` (1:many to ScrapedJob)

```prisma
model Company {
  id            String        @id @default(cuid())
  name          String        @unique
  atsPlatform   AtsPlatform
  baseUrl       String
  enabled       Boolean       @default(true)
  lastScrapeAt  DateTime?
  scrapeStatus  ScrapeStatus  @default(PENDING)
  scrapeError   String?       @db.Text
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  scrapedJobs ScrapedJob[]

  @@index([enabled])
  @@map("companies")
}
```

### Model: ScrapedJob

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | Yes | `cuid()` | Primary key |
| `companyId` | String | Yes | -- | FK to Company |
| `externalJobId` | String | Yes | -- | ATS-native job identifier (Greenhouse ID, Lever ID, etc.) |
| `title` | String | Yes | -- | Job title |
| `url` | String | Yes | -- | Direct URL to the job posting |
| `department` | String | No | null | Department or team name |
| `locations` | Json | Yes | `[]` | JSON array of location strings, e.g., `["San Francisco, CA", "New York, NY"]` |
| `locationType` | String | No | null | `"Remote"`, `"Hybrid"`, `"On-site"`, or null if not determinable |
| `salaryMin` | Int | No | null | Minimum salary in whole USD dollars |
| `salaryMax` | Int | No | null | Maximum salary in whole USD dollars |
| `salaryCurrency` | String | Yes | `"USD"` | Currency code |
| `jobDescriptionMd` | String (Text) | Yes | -- | Job description in Markdown (converted from HTML at scrape time) |
| `firstSeenAt` | DateTime | Yes | `now()` | When the scraper first discovered this job; never updated |
| `lastSeenAt` | DateTime | Yes | `now()` | Updated on every scrape where the job is still present |
| `removedAt` | DateTime | No | null | Set when the job is no longer in the ATS listing; cleared if it reappears |
| `archivedAt` | DateTime | No | null | **Global** flag set by auto-archive cron when `removedAt` is 7+ days old. Not per-user; affects default query for all users. Per-user archive is handled separately via `UserJobArchive`. |

Unique constraint: `@@unique([companyId, externalJobId])` -- a job is uniquely identified by company + ATS ID.

Indexes:
- `@@index([companyId])` -- for per-company queries during scraping
- `@@index([removedAt])` -- for filtering active vs. removed jobs
- `@@index([archivedAt])` -- for filtering archived jobs from search results
- `@@index([firstSeenAt])` -- for sorting by "date posted" (newest first)

Relations: `company` (many:1 to Company), `userArchives` (1:many to UserJobArchive)

```prisma
model ScrapedJob {
  id                String    @id @default(cuid())
  companyId         String
  externalJobId     String
  title             String
  url               String
  department        String?
  locations         Json      @default("[]")
  locationType      String?
  salaryMin         Int?
  salaryMax         Int?
  salaryCurrency    String    @default("USD")
  jobDescriptionMd  String    @db.Text
  firstSeenAt       DateTime  @default(now())
  lastSeenAt        DateTime  @default(now())
  removedAt         DateTime?
  archivedAt        DateTime?

  company       Company          @relation(fields: [companyId], references: [id], onDelete: Cascade)
  userArchives  UserJobArchive[]

  @@unique([companyId, externalJobId])
  @@index([companyId])
  @@index([removedAt])
  @@index([archivedAt])
  @@index([firstSeenAt])
  @@map("scraped_jobs")
}
```

### Model: UserJobArchive

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | Yes | `cuid()` | Primary key |
| `userId` | String | Yes | -- | FK to User |
| `scrapedJobId` | String | Yes | -- | FK to ScrapedJob |
| `createdAt` | DateTime | Yes | `now()` | When the user archived this job |

Unique constraint: `@@unique([userId, scrapedJobId])` -- each user can archive a job only once.

Relations: `user` (many:1 to User), `scrapedJob` (many:1 to ScrapedJob)

```prisma
model UserJobArchive {
  id           String   @id @default(cuid())
  userId       String
  scrapedJobId String
  createdAt    DateTime @default(now())

  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  scrapedJob ScrapedJob @relation(fields: [scrapedJobId], references: [id], onDelete: Cascade)

  @@unique([userId, scrapedJobId])
  @@index([userId])
  @@index([scrapedJobId])
  @@map("user_job_archives")
}
```

### Relations Added to Existing Models

- **User:** Add `userJobArchives UserJobArchive[]` relation.

### Foreign Key Cascade Rules

| Parent | Child | onDelete | Rationale |
|---|---|---|---|
| Company | ScrapedJob | Cascade | Deleting a company removes all its scraped jobs |
| ScrapedJob | UserJobArchive | Cascade | Deleting a scraped job removes all user archive records for it |
| User | UserJobArchive | Cascade | Deleting a user removes their archive records |

---

## 6. API Endpoints

These endpoints are served by the existing Next.js application (not the scraper service). They expose scraped job data to the frontend and support admin management of companies.

### Admin Endpoints (require `role === "ADMIN"`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/companies` | List all companies with scrape status |
| `POST` | `/api/admin/companies` | Create a new company |
| `PUT` | `/api/admin/companies/[id]` | Update company (name, baseUrl, atsPlatform, enabled) |
| `DELETE` | `/api/admin/companies/[id]` | Delete company and all its scraped jobs |

**Example request -- create company:**
```json
POST /api/admin/companies
{
  "name": "Stripe",
  "atsPlatform": "GREENHOUSE",
  "baseUrl": "https://boards.greenhouse.io/stripe",
  "enabled": true
}
```

**Example response:**
```json
{
  "id": "clx3abc...",
  "name": "Stripe",
  "atsPlatform": "GREENHOUSE",
  "baseUrl": "https://boards.greenhouse.io/stripe",
  "enabled": true,
  "lastScrapeAt": null,
  "scrapeStatus": "PENDING",
  "scrapeError": null,
  "createdAt": "2026-03-06T12:00:00.000Z",
  "updatedAt": "2026-03-06T12:00:00.000Z"
}
```

**Example response -- list companies:**
```json
GET /api/admin/companies
{
  "companies": [
    {
      "id": "clx3abc...",
      "name": "Stripe",
      "atsPlatform": "GREENHOUSE",
      "baseUrl": "https://boards.greenhouse.io/stripe",
      "enabled": true,
      "lastScrapeAt": "2026-03-06T13:00:00.000Z",
      "scrapeStatus": "SUCCESS",
      "scrapeError": null,
      "_count": { "scrapedJobs": 152 }
    }
  ]
}
```

### User Endpoints (require authenticated session)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/scraped-jobs` | Search/browse scraped jobs (paginated, filterable) |
| `GET` | `/api/scraped-jobs/[id]` | Fetch a single scraped job with full details |
| `POST` | `/api/scraped-jobs/[id]/archive` | Archive a job for the current user |
| `DELETE` | `/api/scraped-jobs/[id]/archive` | Un-archive a job for the current user |

**Example request -- search scraped jobs:**
```
GET /api/scraped-jobs?q=product+manager&company=Stripe&page=1&limit=20
```

**Query parameters:**
| Param | Type | Default | Description |
|---|---|---|---|
| `q` | string | -- | Full-text search on title and job description |
| `company` | string | -- | Filter by company name (exact match) |
| `companyId` | string | -- | Filter by company ID |
| `location` | string | -- | Substring match on locations JSON |
| `locationType` | string | -- | Filter by Remote/Hybrid/On-site |
| `includeRemoved` | boolean | `false` | Include jobs with `removedAt` set |
| `includeArchived` | boolean | `false` | Include jobs with `archivedAt` set |
| `page` | number | `1` | Page number (1-indexed) |
| `limit` | number | `20` | Results per page (max 100) |
| `sort` | string | `firstSeenAt` | Sort field: `firstSeenAt`, `title`, `salaryMax` |
| `order` | string | `desc` | Sort order: `asc` or `desc` |

**Example response:**
```json
{
  "jobs": [
    {
      "id": "clx4def...",
      "title": "Senior Product Manager",
      "url": "https://boards.greenhouse.io/stripe/jobs/12345",
      "department": "Product",
      "locations": ["San Francisco, CA", "Remote"],
      "locationType": "Remote",
      "salaryMin": 180000,
      "salaryMax": 220000,
      "salaryCurrency": "USD",
      "firstSeenAt": "2026-03-06T13:00:00.000Z",
      "removedAt": null,
      "archivedAt": null,
      "company": {
        "id": "clx3abc...",
        "name": "Stripe"
      },
      "isArchived": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 152,
    "totalPages": 8
  }
}
```

The `isArchived` field indicates whether the current user has archived this job (via `UserJobArchive`). The `jobDescriptionMd` field is omitted from list responses for payload size -- it is included only in the single-job detail endpoint.

---

## 7. Error Handling

### Scraper Errors

| Scenario | Behavior |
|---|---|
| Network timeout fetching ATS API | Retry up to 3 times with exponential backoff (1s, 2s, 4s). On final failure, set `scrapeStatus = FAILURE`, log error, continue to next company. |
| ATS API returns 429 (rate limited) | Wait 60 seconds, retry once. On second 429, set `scrapeStatus = FAILURE` and move on. |
| ATS API returns 404 | Set `scrapeStatus = FAILURE`, `scrapeError = "Career page not found (404). Verify baseUrl is correct."`. Do NOT mark existing jobs as removed (the page itself is broken, not the jobs). |
| ATS API returns 5xx | Retry up to 2 times with 10s delay. On final failure, set `scrapeStatus = FAILURE`. |
| Playwright selector not found | Throw descriptive error with selector name and company. Set `scrapeStatus = FAILURE`. This likely indicates a site redesign requiring adapter update. |
| Playwright navigation timeout | Default timeout: 30 seconds. On timeout, retry once. On second timeout, set `scrapeStatus = FAILURE`. |
| HTML-to-Markdown conversion fails | Store raw HTML in `jobDescriptionMd` with a prefix: `<!-- Markdown conversion failed -->\n`. Log warning. Do not fail the entire job. |
| Individual job parse failure | Log the error, skip the job, continue processing remaining jobs. If >50% of jobs fail to parse, set `scrapeStatus = PARTIAL_FAILURE`. |
| Database connection failure | Retry connection 3 times with 5s delay. On final failure, abort entire scrape run (no company data is stale; will recover on next scheduled run). |

### API Errors

| Scenario | HTTP Status | Response Body |
|---|---|---|
| Unauthenticated request | 401 | `{ "error": "Authentication required" }` |
| Non-admin accessing admin endpoints | 403 | `{ "error": "Admin access required" }` |
| Company not found | 404 | `{ "error": "Company not found" }` |
| Scraped job not found | 404 | `{ "error": "Job not found" }` |
| Duplicate company name | 409 | `{ "error": "A company with this name already exists" }` |
| Invalid `atsPlatform` value | 400 | `{ "error": "Invalid ATS platform. Must be one of: GREENHOUSE, LEVER, WORKDAY, ICIMS" }` |
| Invalid `baseUrl` format | 400 | `{ "error": "Invalid URL format for baseUrl" }` |
| Invalid pagination params | 400 | `{ "error": "Invalid pagination: page must be >= 1, limit must be 1-100" }` |
| Already archived | 409 | `{ "error": "Job is already archived" }` |

---

## 8. Testing Strategy

### Unit Tests

- **Location filter:** Test `isUSLocation()` with cases: `"San Francisco, CA"` (true), `"Remote"` (true), `"London, UK"` (false), `"United States"` (true), `"New York, NY"` (true), `"Toronto, Canada"` (false), `"Remote - US"` (true), `""` (false)
- **HTML-to-Markdown:** Test `htmlToMarkdown()` with Greenhouse-style HTML (nested lists, bold/italic, links, tables) and verify clean Markdown output
- **Adapter registry:** Test that `getAdapter("GREENHOUSE")` returns GreenhouseAdapter, unknown platform throws `"Unsupported ATS platform: {platform}"`
- **Job store upsert logic:** Test that upserting an existing job updates `lastSeenAt` without changing `firstSeenAt`
- **Job store removal detection:** Test that jobs present in DB but missing from scrape results get `removedAt` set
- **Job store re-opening:** Test that a removed job reappearing in scrape results gets `removedAt` cleared
- **Auto-archive:** Test that jobs with `removedAt` older than 7 days get `archivedAt` set; jobs with `removedAt` within 7 days are untouched

### Integration Tests

- **Greenhouse adapter:** Mock the `jobs.json` endpoint with a fixture response; verify correct field extraction, pagination handling, and location filtering
- **Lever adapter:** Mock the `?mode=json` endpoint with a fixture response; verify correct field extraction and location filtering
- **Workday adapter:** Use Playwright's route interception to mock a Workday career page; verify DOM extraction and pagination
- **iCIMS adapter:** Use Playwright's route interception to mock an iCIMS portal; verify DOM extraction and pagination
- **Full scrape run:** Test the scrape runner end-to-end with a mocked adapter: company fetch, job upsert, removal detection, status update
- **API endpoints:** Test company CRUD (create, list, update, delete) with admin auth; test scraped-job search with pagination, filters, and sorting; test archive/un-archive flow

### Fixture Data

- Greenhouse fixture: 3 US jobs, 1 international job (to verify filtering), 1 job with salary data, 1 without
- Lever fixture: 5 US jobs with varying location formats (`"San Francisco, CA"`, `"Remote"`, `"New York, NY or Remote"`)
- Workday fixture: HTML snapshot of a Workday career page with 10 job cards
- iCIMS fixture: HTML snapshot of an iCIMS portal with 8 job entries

### Smoke Tests (Production)

- After deployment, trigger a manual scrape for one Greenhouse company and verify rows appear in `ScrapedJob`
- Verify the cron schedule fires at the expected times by checking Railway logs
- Verify the auto-archive cleanup runs and archives jobs with `removedAt` > 7 days old

---

## 9. Scope / Out of Scope

### In Scope

- Database models: `Company`, `ScrapedJob`, `UserJobArchive` (added to shared Prisma schema)
- Prisma migration: `add_job_scraper`
- Scraper service: Docker container under `/scraper` directory in monorepo
- ATS adapters: Greenhouse (JSON API), Lever (JSON API), Workday (Playwright), iCIMS (Playwright)
- Field extraction: structured data from ATS-native APIs/HTML (no LLM)
- HTML-to-Markdown conversion at scrape time
- US-only role filtering
- Removal detection (mark removed, don't delete)
- Auto-archive after 7 days of removal
- Per-user job archive (hide/unhide)
- Admin API endpoints for company CRUD
- User API endpoints for browsing/searching scraped jobs
- Railway deployment configuration (Docker, cron)
- Respectful scraping: delays, user-agent headers

### Out of Scope

- **Admin UI for company management:** covered in PRD-16
- **User-facing job browse/search UI:** Frontend for browsing scraped jobs -- separate PRD
- **International roles:** Only US-based roles are scraped in V1
- **LLM-based field extraction:** All fields are extracted from ATS-native structured data
- **Real-time scraping / webhooks:** Scraping is batch-only on a cron schedule
- **Per-company adapter customization:** No company-specific CSS selectors or field mappings; adapters are ATS-platform-level
- **Job alerts / notifications:** No email or push notifications when new jobs match user criteria
- **Job deduplication across companies:** Same role posted on multiple boards is stored as separate records
- **Salary normalization:** Salary data is stored as-is from the ATS; no conversion between hourly/annual/equity
- **ATS platforms beyond V1 four:** Additional platforms (Ashby, BambooHR, Jobvite, etc.) are future work
- **Scraping rate limiting / IP rotation:** V1 uses simple delays; proxy rotation is out of scope
- **Import scraped jobs into Kanban board:** covered in PRD-16
- **Resume generation from scraped JDs:** Integration with PRD-4 resume generation is future work
- **GDPR / data retention policies for scraped data:** Public job postings; no PII scraped