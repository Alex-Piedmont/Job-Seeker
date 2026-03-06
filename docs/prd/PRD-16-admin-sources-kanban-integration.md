# PRD: Admin Job Sources & Kanban Integration

**Version:** 1.0
**Date:** 2026-03-06
**Author:** Product Management
**Status:** Draft
**Project:** Job Seeker -- Job Application Tracker

---

## 1. Introduction / Overview

This PRD covers two connected features that bridge the job scraping pipeline with the user-facing Kanban board.

**Feature A: Admin Job Sources Tab.** A new "Job Sources" tab in the existing admin panel (`/admin`) lets the platform operator manage the list of companies whose job postings are scraped. The admin can add, remove, enable/disable companies, view scrape status, and trigger manual scrapes. This extends the admin panel established in PRD 6 (which already has Overview, Users, Generations, and Feedback tabs) with a fifth tab.

**Feature B: Kanban Integration.** From the Find Jobs modal (PRD 15), users can import scraped jobs onto their Kanban board. Importing creates a new `JobApplication` pre-populated with data from the `ScrapedJob`, including a frozen snapshot of the job description. When a scraped posting is later marked as removed by the scraper, any linked applications display a prominent warning in the card detail drawer.

The frozen snapshot design is central: the user's application data is stable regardless of future scraper activity. The `ScrapedJob` may update or disappear, but the user's copy of the JD, salary, and location data remains unchanged from the moment of import.

---

## 2. Goals

- **Centralized source management:** Admin shall manage the full list of scraper targets (companies) from within the existing admin panel, without direct database access.
- **Seamless import flow:** Users shall add scraped jobs to their Kanban board with a single click, with all available fields pre-populated.
- **Data integrity:** Imported job data shall be a frozen snapshot -- independent of future scraper updates or deletions.
- **Removal transparency:** Users shall be warned when a scraped posting is no longer publicly available, so they can adjust their application strategy.
- **URL provenance:** Scraped job URLs shall be read-only on the Kanban card to preserve data integrity from the source system.

### What Success Looks Like

The admin navigates to `/admin?tab=job-sources`, sees a table of tracked companies with their ATS platform, scrape status, and job counts. They click "Add Company", fill in the name, ATS platform (Greenhouse), and base URL, and save. They click the refresh icon on that row to trigger a manual scrape. The status updates to "Scraping..." and eventually shows "Last scraped: 2 minutes ago, 47 jobs."

Meanwhile, a user opens the Find Jobs modal (PRD 15), finds a role at that company, and clicks "Add to Board." A new card appears in their "Saved" column, pre-populated with company, title, location, salary range, and a frozen copy of the full job description. The card detail drawer shows the posting URL as a clickable "Apply Here!" button (not an editable text field). A week later, the scraper detects the posting has been removed. The user opens the card and sees an amber warning: "This posting is no longer publicly available" next to the Apply Here button.

---

## 3. User Stories

### US-1: Admin Manages Scraper Companies

**As an** admin, **I want to** add, edit, enable/disable, and remove companies from the scraper target list, **so that** I can control which companies' job postings are scraped.

**Acceptance Criteria:**
- [ ] The "Job Sources" tab appears as the fifth tab in the admin panel at `/admin?tab=job-sources`
- [ ] The tab shows a data table with columns: Company Name, ATS Platform, Base URL, Enabled (toggle), Last Scraped, Total Jobs, Actions
- [ ] An "Add Company" button opens a form dialog with fields: Company Name (required, string, max 200 chars), ATS Platform (required, select: GREENHOUSE, LEVER, WORKDAY, ICIMS), Base URL (required, valid URL, max 500 chars)
- [ ] Submitting the form creates a new `Company` record with `enabled: true` by default
- [ ] Each row has an inline toggle to enable/disable the company (updates `Company.enabled`)
- [ ] Each row has an edit action that opens the same form dialog pre-populated with existing values
- [ ] Each row has a delete action with a confirmation dialog: "Remove {company name}? This will not delete previously scraped jobs."
- [ ] Deleting a `Company` sets `isRemoved: true` (soft delete) rather than hard-deleting the record
- [ ] The table supports sorting by Company Name, Last Scraped, and Total Jobs
- [ ] Validation errors show inline: "Company name is required", "Invalid URL format", "A company with this name already exists"
- [ ] Success toasts: "Company added", "Company updated", "Company removed"
- [ ] Only users with `role === "ADMIN"` can access this tab and its API endpoints

### US-2: Admin Views Scrape Status

**As an** admin, **I want to** see the last scrape timestamp and total jobs per company, **so that** I can monitor scraper health.

**Acceptance Criteria:**
- [ ] The "Last Scraped" column shows the `Company.lastScrapeAt` timestamp in relative format (e.g., "2 hours ago") with a tooltip showing the full ISO datetime. If `Company.scrapeStatus` indicates an error, show `Company.scrapeError` as a tooltip on a warning icon beside the timestamp.
- [ ] If `lastScrapeAt` is null, the column shows "Never"
- [ ] The "Total Jobs" column shows the count of `ScrapedJob` records linked to that `Company` where `removedAt` is null
- [ ] If a scrape is currently in progress (within the last 5 minutes and no completion recorded), the Last Scraped column shows a spinner with "Scraping..."
- [ ] Rows where `enabled === false` are visually muted (lower opacity or muted text color)

### US-3: Admin Triggers Manual Scrape

**As an** admin, **I want to** trigger an on-demand scrape for a specific company, **so that** I can refresh job listings without waiting for the next scheduled run.

**Acceptance Criteria:**
- [ ] Each row has a refresh/sync icon button in the Actions column
- [ ] Clicking the button calls `POST /api/admin/companies/[id]/scrape`
- [ ] The button is disabled while a scrape is in progress for that company
- [ ] The button is disabled if the company is not enabled (tooltip: "Enable this company to trigger a scrape")
- [ ] Success toast: "Scrape triggered for {company name}"
- [ ] Error toast: "Failed to trigger scrape for {company name}. Please try again."
- [ ] The API endpoint publishes a scrape request that the scraper service listens to (implementation of the scraper service itself is out of scope)

### US-4: User Imports Scraped Job to Kanban Board

**As a** user, **I want to** add a scraped job from the Find Jobs modal to my Kanban board, **so that** I can track my application for that role.

**Acceptance Criteria:**
- [ ] The "Add to Board" button in the Find Jobs modal (PRD 15) calls `POST /api/applications/import`
- [ ] The endpoint creates a new `JobApplication` with the following field mapping:
  - `ScrapedJob.company.name` (via Company relation) -> `JobApplication.company`
  - `ScrapedJob.title` -> `JobApplication.role`
  - `ScrapedJob.locations` (first entry) -> `JobApplication.primaryLocation`
  - `ScrapedJob.locations` (remaining entries, comma-separated) -> `JobApplication.additionalLocations`
  - `ScrapedJob.salaryMin` -> `JobApplication.salaryMin`
  - `ScrapedJob.salaryMax` -> `JobApplication.salaryMax`
  - `ScrapedJob.jobDescriptionMd` -> `JobApplication.jobDescription` (frozen snapshot, copied at import time)
  - `ScrapedJob.url` -> `JobApplication.postingUrl` (read-only once set via import)
  - `ScrapedJob.id` -> `JobApplication.scrapedJobId` (foreign key linking back to source)
- [ ] The `JobApplication` is created in the user's first column (the "Saved" column, `order: 0`) at `columnOrder: 0` (top of column)
- [ ] The `JobApplication` receives the next auto-incrementing `serialNumber` for the user
- [ ] Existing applications in the "Saved" column have their `columnOrder` incremented by 1 to make room
- [ ] The job description is COPIED into `JobApplication.jobDescription`, not linked -- future scraper updates do not affect the user's copy
- [ ] If the user has already imported this `ScrapedJob` (duplicate `scrapedJobId` for the same `userId`), return `409 { error: "You have already added this job to your board" }`
- [ ] Success response returns the created `JobApplication` with all fields
- [ ] The Find Jobs modal shows a success toast: "Added {company} - {role} to your board"
- [ ] After import, the "Add to Board" button for that job changes to "Already on Board" (disabled state)
- [ ] The Kanban board auto-refreshes or optimistically updates to show the new card

### US-5: Scraped Job URL Displayed as Apply Here Button

**As a** user viewing an imported job's card detail drawer, **I want to** see the posting URL as a clickable "Apply Here!" button, **so that** I can easily navigate to the job posting to apply.

**Acceptance Criteria:**
- [ ] When `JobApplication.scrapedJobId` is not null, the Posting URL field in the card detail drawer renders as a styled "Apply Here!" button instead of an editable text input
- [ ] The button opens the URL in a new tab (`target="_blank"`, `rel="noopener noreferrer"`)
- [ ] The button uses a primary/accent style with an external link icon (lucide-react `ExternalLink`)
- [ ] The URL is NOT editable -- no text input is shown for the URL field when `scrapedJobId` is set
- [ ] When `scrapedJobId` is null (manually created application), the URL field remains an editable text input as it is today
- [ ] The button shows the truncated URL as a tooltip on hover for transparency

### US-6: Removal Warning on Linked Applications

**As a** user, **I want to** be warned when a scraped job posting is no longer publicly available, **so that** I know the listing may have been filled or removed.

**Acceptance Criteria:**
- [ ] When a `ScrapedJob` linked to a `JobApplication` has `removedAt !== null`, the card detail drawer shows a warning indicator
- [ ] The warning appears next to (below) the "Apply Here!" button in the card detail drawer
- [ ] The warning consists of an amber/yellow `AlertTriangle` icon (lucide-react) + text: "This posting is no longer publicly available"
- [ ] The warning uses amber styling: `text-amber-600` icon, `text-amber-700` text, `bg-amber-50` background, `border-amber-200` border (light mode); appropriate dark mode equivalents
- [ ] The warning is visually prominent but not blocking -- the user can still interact with all other card fields
- [ ] The "Apply Here!" button remains functional even when the warning is shown (the URL may still resolve)
- [ ] On the Kanban board card itself (not the drawer), a small amber `AlertTriangle` icon appears in the card corner/header if the linked `ScrapedJob.removedAt !== null`
- [ ] Hovering the card-level warning icon shows a tooltip: "Posting no longer available"

### US-7: Admin Access Control for Job Sources

**As the** system, **I need to** restrict the Job Sources tab and its API endpoints to admin users only, **so that** regular users cannot manage scraper configuration.

**Acceptance Criteria:**
- [ ] All `/api/admin/companies/*` endpoints verify `session.user.role === "ADMIN"` and return `403 { error: "Forbidden" }` for non-admin users
- [ ] The "Job Sources" tab is only rendered in the admin panel tab list when `session.user.role === "ADMIN"` (already true for the entire admin page, but verified at the tab level too)
- [ ] Unauthenticated requests to admin endpoints return `401 { error: "Unauthorized" }`

---

## 4. Technical Architecture / Stack

### Database Changes

**Uses the `Company` model defined in PRD-14.** PRD-14 defines the `Company` model with fields: `id`, `name`, `atsPlatform`, `baseUrl`, `enabled`, `lastScrapeAt`, `scrapeStatus`, `scrapeError`, `createdAt`, `updatedAt`. This PRD does not redefine the model.

**Extension:** Add `isRemoved Boolean @default(false)` to the `Company` model (extends PRD-14) to support soft delete of companies from the admin panel.

**Note:** The `ScrapedJob` model is defined in PRD-14. It has the following fields: `id`, `companyId` (FK to Company), `title`, `locations` (Json), `salaryMin` (Int?), `salaryMax` (Int?), `jobDescriptionMd` (String @db.Text), `url`, `removedAt` (DateTime?), `firstSeenAt`, `lastSeenAt`.

**Modified model: `JobApplication`**

Add the following field:

```prisma
model JobApplication {
  // ... existing fields ...
  scrapedJobId  String?

  scrapedJob    ScrapedJob? @relation(fields: [scrapedJobId], references: [id], onDelete: SetNull)

  @@unique([userId, scrapedJobId]) // Prevents duplicate imports
  // ... existing indexes ...
}
```

Key decisions:
- `scrapedJobId` is nullable -- manually created applications have `null`
- `onDelete: SetNull` -- if a `ScrapedJob` record is hard-deleted, the `JobApplication` survives with `scrapedJobId` set to null (reverts to normal editable behavior)
- The `@@unique([userId, scrapedJobId])` constraint prevents a user from importing the same scraped job twice. Note: this unique constraint must allow multiple nulls for `scrapedJobId` (Prisma/PostgreSQL handles this correctly -- multiple rows with `NULL` in a unique constraint are allowed)

**Migration name:** `add_company_import_link`

### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/companies` | List all companies with job counts and scrape status |
| `POST` | `/api/admin/companies` | Create a new company |
| `PUT` | `/api/admin/companies/[id]` | Update a company (name, ATS platform, base URL) |
| `DELETE` | `/api/admin/companies/[id]` | Soft-delete a company (set `isRemoved: true`) |
| `PATCH` | `/api/admin/companies/[id]/toggle` | Toggle `enabled` status |
| `POST` | `/api/admin/companies/[id]/scrape` | Trigger a manual scrape for a specific company |
| `POST` | `/api/applications/import` | Import a scraped job to the user's Kanban board |

### Admin Company Endpoints

**`GET /api/admin/companies`** returns:

```typescript
interface CompanyListResponse {
  sources: Array<{
    id: string;
    name: string;
    atsPlatform: "GREENHOUSE" | "LEVER" | "WORKDAY" | "ICIMS";
    baseUrl: string;
    enabled: boolean;
    lastScrapeAt: string | null; // ISO datetime
    scrapeStatus: string | null; // from Company.scrapeStatus
    scrapeError: string | null; // from Company.scrapeError
    totalJobs: number; // COUNT of ScrapedJob where removedAt is null
  }>;
}
```

Supports query params: `?sort=name|lastScrapeAt|totalJobs&order=asc|desc`. Default: `name` ASC.

**`POST /api/admin/companies`** accepts:

```typescript
interface CreateCompanyRequest {
  name: string;        // required, max 200 chars, unique
  atsPlatform: "GREENHOUSE" | "LEVER" | "WORKDAY" | "ICIMS"; // required
  baseUrl: string;     // required, valid URL, max 500 chars
}
```

Validation:
- `name` is required, max 200 characters, must be unique (case-insensitive check)
- `atsPlatform` must be one of the enum values
- `baseUrl` must be a valid URL (starts with `https://`)
- Duplicate name returns `409 { error: "A company with this name already exists" }`

**`PUT /api/admin/companies/[id]`** accepts the same body as POST. The `id` path param must be a valid CUID referencing an existing, non-removed `Company`.

**`DELETE /api/admin/companies/[id]`** performs a soft delete: sets `isRemoved: true` on the `Company`. Does NOT delete associated `ScrapedJob` records.

**`PATCH /api/admin/companies/[id]/toggle`** toggles `enabled` between `true` and `false`. Returns the updated source.

**`POST /api/admin/companies/[id]/scrape`** triggers a manual scrape:
- Validates the source exists and is enabled
- If not enabled: `400 { error: "Cannot scrape a disabled company" }`
- Publishes a scrape event/message that the scraper service listens to (the exact pub/sub mechanism is implementation-defined -- could be a database flag, queue, or webhook)
- Returns `202 { message: "Scrape triggered", sourceId: string }`

### Import Endpoint

**`POST /api/applications/import`** accepts:

```typescript
interface ImportScrapedJobRequest {
  scrapedJobId: string; // required, CUID referencing ScrapedJob
}
```

Logic:
1. Verify the authenticated user's session
2. Fetch the `ScrapedJob` by `scrapedJobId` -- if not found, return `404 { error: "Job not found" }`
3. Check for existing `JobApplication` with same `userId` + `scrapedJobId` -- if exists, return `409 { error: "You have already added this job to your board" }`
4. Find the user's "Saved" column (the `KanbanColumn` with `order: 0` for the user)
5. Increment `columnOrder` on all existing applications in the Saved column (shift down by 1)
6. Compute the next `serialNumber` for the user (`MAX(serialNumber) + 1`)
7. Create the `JobApplication` with mapped fields (see US-4 acceptance criteria)
8. Return the created `JobApplication`

```typescript
interface ImportScrapedJobResponse {
  id: string;
  serialNumber: number;
  company: string;
  role: string;
  postingUrl: string | null;
  primaryLocation: string | null;
  additionalLocations: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  jobDescription: string | null;
  scrapedJobId: string;
  columnId: string;
  columnOrder: number;
  createdAt: string;
}
```

The entire import operation (column order shift + serial number computation + application creation) shall be wrapped in a Prisma `$transaction` to prevent race conditions.

### Architecture

**New frontend files:**

| File | Purpose |
|---|---|
| `src/components/admin/job-sources-tab.tsx` | Job Sources tab with data table, add/edit dialog, toggle, delete |
| `src/components/admin/company-form.tsx` | Reusable form dialog for creating/editing a company |

**Modified frontend files:**

| File | Change |
|---|---|
| `src/app/(authenticated)/admin/page.tsx` | Add "Job Sources" as fifth tab |
| `src/components/kanban/application-detail-drawer.tsx` | Conditionally render "Apply Here!" button vs. editable URL input based on `scrapedJobId`; render removal warning |
| `src/components/kanban/application-card.tsx` | Show amber warning icon on card when linked `ScrapedJob.removedAt !== null` |

**New API files:**

| File | Purpose |
|---|---|
| `src/app/api/admin/companies/route.ts` | GET (list) + POST (create) |
| `src/app/api/admin/companies/[id]/route.ts` | PUT (update) + DELETE (soft delete) |
| `src/app/api/admin/companies/[id]/toggle/route.ts` | PATCH (toggle enabled) |
| `src/app/api/admin/companies/[id]/scrape/route.ts` | POST (trigger manual scrape) |
| `src/app/api/applications/import/route.ts` | POST (import scraped job to board) |

**Modified schema files:**

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `isRemoved` field to `Company` model, add `scrapedJobId` FK to `JobApplication` |

---

## 5. UI/UX Design

### Job Sources Tab Layout

```
+----------------------------------------------------------+
| Admin Panel                                              |
| [Overview] [Users] [Generations] [Feedback] [Job Sources]|
+----------------------------------------------------------+
|                                                          |
|  Job Sources                          [+ Add Company]    |
|                                                          |
| +------------------------------------------------------+ |
| | Company      | ATS       | Base URL   | Enabled |    | |
| | Name         | Platform  |            |         |    | |
| |              |           |            |         |    | |
| | Last Scraped | Total     | Actions    |         |    | |
| |              | Jobs      |            |         |    | |
| +------------------------------------------------------+ |
| | Acme Corp    | GREENHOUSE| https://.. | [ON]    |    | |
| |              |           |            |         |    | |
| | 2 hours ago  | 47        | [Sync][Edit][Delete] |    | |
| +------------------------------------------------------+ |
| | Beta Inc     | LEVER     | https://.. | [OFF]   |    | |
| |              |           |  (muted row)         |    | |
| | Never        | 0         | [Sync][Edit][Delete] |    | |
| +------------------------------------------------------+ |
| | Gamma LLC    | WORKDAY   | https://.. | [ON]    |    | |
| |              |           |            |         |    | |
| | Scraping...  | 23        | [Sync][Edit][Delete] |    | |
| +------------------------------------------------------+ |
|                                                          |
+----------------------------------------------------------+
```

### Add/Edit Company Dialog

```
+----------------------------------------------------+
|  Add Company                              [X]      |
|                                                     |
|  Company Name                                      |
|  [_________________________________________]       |
|                                                     |
|  ATS Platform                                      |
|  [v GREENHOUSE                           ]         |
|                                                     |
|  Base URL                                          |
|  [_________________________________________]       |
|                                                     |
|                           [Cancel] [Save]          |
+----------------------------------------------------+
```

### Card Detail Drawer -- Imported Job URL Section

**Normal (scraped job active):**
```
+------------------------------------------------------+
|  Posting URL                                          |
|  +--------------------------------------------------+|
|  |  [ExternalLink] Apply Here!                      ||
|  +--------------------------------------------------+|
+------------------------------------------------------+
```

**With removal warning:**
```
+------------------------------------------------------+
|  Posting URL                                          |
|  +--------------------------------------------------+|
|  |  [ExternalLink] Apply Here!                      ||
|  +--------------------------------------------------+|
|  +--------------------------------------------------+|
|  | [AlertTriangle] This posting is no longer        ||
|  |                 publicly available                ||
|  +--------------------------------------------------+|
+------------------------------------------------------+
```

### Kanban Card -- Removal Warning Badge

```
+----------------------------------+
| #42                [AlertTriangle]|
| Acme Corp                        |
| Senior Engineer                  |
| San Francisco, CA                |
+----------------------------------+
```

The amber `AlertTriangle` icon appears in the top-right corner of the card, with a tooltip on hover: "Posting no longer available".

### User Experience

**Journey 1: Admin adds a new company to scrape**
1. Admin navigates to `/admin?tab=job-sources`
2. Clicks "Add Company"
3. Enters "Acme Corp", selects "GREENHOUSE", enters `https://boards.greenhouse.io/acmecorp`
4. Clicks "Save" -- toast: "Company added"
5. Row appears in table with Enabled=ON, Last Scraped="Never", Total Jobs=0
6. Admin clicks the sync icon -- toast: "Scrape triggered for Acme Corp"
7. Row shows "Scraping..." in the Last Scraped column
8. On next page refresh, Last Scraped shows "2 minutes ago", Total Jobs shows "47"

**Journey 2: User imports a job to their board**
1. User opens Find Jobs modal (PRD 15)
2. Browses scraped jobs, finds "Senior Engineer at Acme Corp"
3. Clicks "Add to Board" -- toast: "Added Acme Corp - Senior Engineer to your board"
4. Button changes to "Already on Board" (disabled)
5. User closes modal, sees new card at top of "Saved" column: "#42 Acme Corp - Senior Engineer"
6. Opens card detail drawer -- sees frozen JD, location, salary
7. Clicks "Apply Here!" -- opens Acme Corp's Greenhouse posting in new tab

**Journey 3: Posting removed after import**
1. Scraper detects the Acme Corp Senior Engineer role is no longer listed
2. Sets `ScrapedJob.removedAt` to the current timestamp
3. User opens the Kanban board -- sees amber warning icon on card #42
4. Hovers icon -- tooltip: "Posting no longer available"
5. Opens card detail drawer -- sees "Apply Here!" button with amber warning below: "This posting is no longer publicly available"
6. User can still click "Apply Here!" (the URL may still work) and interact with all other fields

**Loading States:**
- Job Sources table: skeleton rows while fetching source list
- Add/Edit dialog: "Save" button shows spinner, disabled during save
- Sync button: spinner replaces the sync icon while scrape request is in flight
- Import button in Find Jobs modal: spinner on "Add to Board" button during import

**Error States:**
- API error on source list load: toast "Failed to load job sources"
- Create source fails (duplicate name): inline validation error "A company with this name already exists"
- Create source fails (invalid URL): inline validation error "Invalid URL format"
- Import fails (already imported): toast "You have already added this job to your board"
- Import fails (job not found): toast "This job is no longer available"
- Manual scrape fails: toast "Failed to trigger scrape for {company name}. Please try again."
- Toggle enable/disable fails: toast "Failed to update company status"

---

## 6. API Endpoints

See Section 4 (Technical Architecture / Stack) for full endpoint specifications, request/response types, and validation rules.

Summary:

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/companies` | ADMIN | List all companies with stats |
| `POST` | `/api/admin/companies` | ADMIN | Create a new company |
| `PUT` | `/api/admin/companies/[id]` | ADMIN | Update a company |
| `DELETE` | `/api/admin/companies/[id]` | ADMIN | Soft-delete a company |
| `PATCH` | `/api/admin/companies/[id]/toggle` | ADMIN | Toggle enabled status |
| `POST` | `/api/admin/companies/[id]/scrape` | ADMIN | Trigger manual scrape |
| `POST` | `/api/applications/import` | USER/ADMIN | Import scraped job to Kanban board |

---

## 7. Error Handling

### Admin Endpoints (all `/api/admin/companies/*`)

| Scenario | HTTP Status | Response Body |
|---|---|---|
| Not authenticated | 401 | `{ error: "Unauthorized" }` |
| Not admin role | 403 | `{ error: "Forbidden" }` |
| Source not found | 404 | `{ error: "Company not found" }` |
| Duplicate company name | 409 | `{ error: "A company with this name already exists" }` |
| Invalid ATS platform | 400 | `{ error: "Invalid ATS platform. Must be one of: GREENHOUSE, LEVER, WORKDAY, ICIMS" }` |
| Invalid URL format | 400 | `{ error: "Base URL must be a valid HTTPS URL" }` |
| Name too long (>200) | 400 | `{ error: "Company name must be 200 characters or fewer" }` |
| URL too long (>500) | 400 | `{ error: "Base URL must be 500 characters or fewer" }` |
| Scrape on disabled source | 400 | `{ error: "Cannot scrape a disabled company" }` |
| Missing required fields | 400 | `{ error: "Company name, ATS platform, and base URL are required" }` |

### Import Endpoint (`POST /api/applications/import`)

| Scenario | HTTP Status | Response Body |
|---|---|---|
| Not authenticated | 401 | `{ error: "Unauthorized" }` |
| Missing scrapedJobId | 400 | `{ error: "scrapedJobId is required" }` |
| ScrapedJob not found | 404 | `{ error: "Job not found" }` |
| Already imported | 409 | `{ error: "You have already added this job to your board" }` |
| User has no Saved column | 500 | `{ error: "Failed to import job. Please refresh and try again." }` |
| Database transaction failure | 500 | `{ error: "Failed to import job. Please try again." }` |

### Client-Side Error Display

- Validation errors (400) from admin endpoints: shown as inline form errors beneath the relevant field
- Conflict errors (409): shown as toast notifications
- Server errors (500): shown as toast notifications with generic retry message
- Network errors: shown as toast "Network error. Please check your connection and try again."

---

## 8. Testing Strategy

### Build Verification

- [ ] `npm run build` passes with no type errors
- [ ] `npm run lint` passes with no new warnings
- [ ] `npx prisma migrate dev` succeeds with new migration

### Unit Tests (vitest)

**Admin Company Queries (`src/lib/__tests__/companies.test.ts`):**
- [ ] List sources returns all non-removed sources with correct job counts
- [ ] List sources with sorting by name, lastScrapeAt, totalJobs
- [ ] Create source with valid data succeeds
- [ ] Create source with duplicate name fails with 409
- [ ] Create source with invalid URL fails with 400
- [ ] Create source with missing required fields fails with 400
- [ ] Update source with valid data succeeds
- [ ] Delete source sets `isRemoved: true` (soft delete)
- [ ] Toggle enabled flips the boolean
- [ ] `requireAdmin()` with admin session passes
- [ ] `requireAdmin()` with user session throws 403

**Import Logic (`src/lib/__tests__/import.test.ts`):**
- [ ] Import with valid scrapedJobId creates JobApplication with correct field mapping
- [ ] Import maps `ScrapedJob.company.name` to `JobApplication.company`
- [ ] Import maps `ScrapedJob.title` to `JobApplication.role`
- [ ] Import maps first location to `primaryLocation`, remaining to `additionalLocations`
- [ ] Import maps `ScrapedJob.salaryMin` to `JobApplication.salaryMin` and `ScrapedJob.salaryMax` to `JobApplication.salaryMax`
- [ ] Import copies `jobDescriptionMd` to `jobDescription` (frozen snapshot)
- [ ] Import sets `postingUrl` from `ScrapedJob.url`
- [ ] Import sets `scrapedJobId` foreign key
- [ ] Import places application in Saved column (order: 0) at columnOrder: 0
- [ ] Import increments existing applications' columnOrder in Saved column
- [ ] Import assigns correct next serialNumber
- [ ] Duplicate import (same user + scrapedJobId) returns 409
- [ ] Import with non-existent scrapedJobId returns 404

### Integration Tests

**Admin Companies API (`src/app/api/admin/companies/__tests__/route.test.ts`):**
- [ ] Admin session can list, create, update, delete sources
- [ ] Non-admin session receives 403 on all endpoints
- [ ] Unauthenticated request receives 401
- [ ] Create with duplicate name returns 409
- [ ] Toggle updates enabled field
- [ ] Manual scrape on enabled source returns 202
- [ ] Manual scrape on disabled source returns 400

**Import API (`src/app/api/applications/import/__tests__/route.test.ts`):**
- [ ] Authenticated user can import a scraped job
- [ ] Import creates correct JobApplication record in database
- [ ] Duplicate import returns 409
- [ ] Non-existent scrapedJobId returns 404
- [ ] Unauthenticated request returns 401

### E2E Tests (Playwright)

**Admin Job Sources Flow (`e2e/admin-job-sources.spec.ts`):**
- [ ] Sign in as admin -> navigate to `/admin?tab=job-sources` -> add a company -> verify it appears in table -> toggle enabled off -> verify row is muted -> toggle enabled on -> edit company name -> verify update -> delete company -> verify removal

**Import to Board Flow (`e2e/import-to-board.spec.ts`):**
- [ ] Sign in as user -> open Find Jobs modal -> click "Add to Board" on a job -> verify card appears in Saved column -> verify card detail drawer shows "Apply Here!" button -> verify URL is not editable -> attempt to add same job again -> verify "Already on Board" state

### Edge Cases

- Admin deletes a `Company` that has associated `ScrapedJob` records -> soft delete only, jobs preserved
- User imports a job, then the `ScrapedJob` is hard-deleted -> `scrapedJobId` set to null via `onDelete: SetNull`, URL becomes editable again
- User imports a job with no salary data -> `salaryMin` and `salaryMax` remain null
- User imports a job with no locations -> `primaryLocation` and `additionalLocations` remain null
- User imports a job with empty `jobDescriptionMd` -> `jobDescription` is set to empty string or null
- Multiple users import the same `ScrapedJob` -> each gets their own independent `JobApplication` (unique constraint is per-user)
- Concurrent imports by the same user for different jobs -> transaction isolation prevents serial number conflicts
- `ScrapedJob.removedAt` changes from null to a timestamp -> warning appears on next load of card detail drawer (no real-time push needed)
- Company name with special characters (quotes, ampersands) -> properly escaped in all UI and API contexts

---

## 9. Scope / Out of Scope

### In Scope

- `Company` model (from PRD-14, extended with `isRemoved`) and CRUD admin endpoints
- Admin Job Sources tab UI (data table, add/edit dialog, toggle, delete, manual scrape trigger)
- `AtsPlatform` enum (GREENHOUSE, LEVER, WORKDAY, ICIMS)
- `scrapedJobId` nullable FK on `JobApplication`
- `@@unique([userId, scrapedJobId])` constraint to prevent duplicate imports
- Import API endpoint with frozen snapshot logic and transactional column order management
- "Apply Here!" button in card detail drawer for imported jobs
- Read-only URL enforcement when `scrapedJobId` is set
- Removal warning in card detail drawer and on Kanban card
- Admin access control for all new endpoints

### Out of Scope

- **Scraper service implementation:** This PRD defines the admin interface for managing scraper targets and the trigger mechanism, but the actual scraping logic (HTTP crawling, ATS-specific parsing, job diffing) is a separate service/PRD.
- **ScrapedJob model definition:** The `ScrapedJob` model is defined in PRD-14. This PRD only adds the `scrapedJobId` FK on `JobApplication` and the `isRemoved` field on `Company`.
- **Bulk import:** Users import one job at a time. Bulk "add all" is deferred.
- **Auto-refresh of scrape status:** The admin page shows scrape status on load. Real-time status updates via WebSocket/polling are not included.
- **Scrape scheduling configuration:** The admin can trigger manual scrapes but cannot configure cron schedules or scrape intervals from the UI.
- **ATS-specific configuration fields:** Beyond the base URL, no ATS-specific configuration (API keys, pagination settings) is managed in the admin panel.
- **Job description diffing:** When a `ScrapedJob` updates, there is no mechanism to notify the user that the source JD has changed relative to their frozen snapshot.
- **Editing imported fields:** Beyond the URL being read-only, all other imported fields (company, role, location, salary, JD) remain editable by the user after import. This is intentional -- users may want to customize.
- **Mobile optimization:** Admin Job Sources tab is designed for desktop/tablet. Functional on mobile but not a priority.
- **Export or reporting:** No CSV/PDF export of company data.
- **Scraper health monitoring/alerts:** No email or in-app notifications when scrapes fail or stale.

---

## 10. Implementation Order

| Phase | Scope | Risk Level | Verification |
|---|---|---|---|
| **Phase 1** | Prisma schema: Add `isRemoved` to `Company` model (PRD-14), `scrapedJobId` FK on `JobApplication`, `@@unique([userId, scrapedJobId])` constraint + migration | Low | `prisma migrate dev` succeeds, `prisma generate` succeeds |
| **Phase 2** | Admin company API: `GET`, `POST`, `PUT`, `DELETE`, `PATCH /toggle`, `POST /scrape` with `requireAdmin()` | Low | Integration tests pass for all endpoints |
| **Phase 3** | Admin Job Sources tab UI: data table, add/edit dialog, enable/disable toggle, delete confirmation, manual scrape trigger | Medium | Admin can CRUD companies from UI, toasts and validation work |
| **Phase 4** | Import API: `POST /api/applications/import` with frozen snapshot, transactional column order, duplicate prevention | Medium | Unit + integration tests pass, imported application has correct field mapping |
| **Phase 5** | Card detail drawer: "Apply Here!" button, read-only URL when `scrapedJobId` is set | Low | Imported job shows button, manual job shows editable input |
| **Phase 6** | Removal warning: drawer warning + card badge when `ScrapedJob.removedAt !== null` | Low | Warning displays correctly, tooltip on card icon |
| **Phase 7** | Wire "Add to Board" in Find Jobs modal (PRD 15) to import endpoint + "Already on Board" disabled state | Low | Full end-to-end import flow works |

---

## Clarifying Questions

**Q1: [OPTIONAL] Should the admin be able to see a list of scraped jobs per company (drill-down from the Job Sources table), or is the total count sufficient for v1?**

**Q2: [OPTIONAL] When a `ScrapedJob` is hard-deleted (vs. soft-deleted via `removedAt`), the `JobApplication.scrapedJobId` is set to null via `onDelete: SetNull`. Should the URL revert to editable in this case, or should we add a separate `isImported` boolean to preserve the read-only behavior?**

**Q3: [RESOLVED] PRD-15 already handles this: removed jobs (`removedAt !== null`) are shown grayed out in the Find Jobs modal. No additional work needed in PRD-16.**
