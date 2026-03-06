# PRD: Find Jobs UI

**Version:** 1.0
**Date:** 2026-03-06
**Author:** Product Management
**Status:** Draft
**Project:** Job Seeker -- Job Application Tracker

---

## 1. Introduction / Overview

The Job Seeker app currently helps users manage applications they have already decided to pursue. It does not help users discover opportunities. PRD-14 introduced a scraper that continuously collects job postings from configured company ATS pages and stores them as `ScrapedJob` records with pre-extracted structured data (title, company, locations, salary, full markdown job description).

This PRD defines the **Find Jobs** UI -- a new top-level page that lets users search, filter, sort, and browse scraped job postings. Users can expand any job into a detail modal, archive jobs they are not interested in, and (in a future PRD-16) add jobs directly to their Kanban board. The page consumes data produced by the scraper and requires no LLM calls; all data arrives pre-extracted.

Key design principles:
- **Filter-first layout:** A left sidebar with persistent filters keeps the user in control of a potentially large result set.
- **Card-based results:** Jobs render as scannable cards with key metadata, expandable to a full-detail modal.
- **Soft archive:** Users dismiss uninteresting jobs without permanent deletion, and can recover them at any time.
- **Staleness signals:** Jobs the scraper no longer finds are visually demoted, and jobs unseen for 7+ days are auto-archived.

---

## 2. Goals

- **Surface relevant jobs:** Users can quickly find jobs matching their criteria across all configured companies without visiting individual ATS sites.
- **Reduce noise:** Filters, sorting, and archive let users focus on the jobs that matter to them.
- **Provide full context:** The detail modal gives users everything they need to decide whether to apply, including the full markdown job description and a link to the original posting.
- **Signal staleness:** Users are warned when a posting is no longer publicly available, preventing wasted effort on dead listings.

### What Success Looks Like

A user opens Find Jobs and sees a list of recently scraped postings. They filter by "Senior" in the title, select two target companies, and set a minimum salary of $150k. The results narrow to 8 cards. They click one to read the full description in a modal, decide it is a good fit, and (in a future iteration) click "Add to Board" to create a Kanban application. They archive the other 7 jobs. The next day, 3 new postings appear. One job they bookmarked yesterday now shows a gray "No longer available" badge -- the scraper confirmed the posting was removed.

---

## 3. User Stories

### US-1: User browses scraped jobs

**As a** job seeker, **I want to** see a paginated list of scraped job postings, **so that** I can discover opportunities across all configured companies.

**Acceptance Criteria:**
- [ ] A "Find Jobs" link appears in the top navigation bar (`src/components/nav-bar.tsx`) between "Applications" and "Analytics" for all authenticated users
- [ ] The link navigates to `/find-jobs`
- [ ] The page is accessible only to authenticated users (protected by the `(authenticated)` layout group)
- [ ] The page fetches paginated `ScrapedJob` records from the API, displaying 24 jobs per page by default
- [ ] Each job renders as a card showing: job title, company name, location type badge (Remote/Hybrid/On-site when available), location(s), salary range (formatted as "$X - $Y" or "Salary not listed"), and posting date (`firstSeenAt`, formatted as relative time e.g. "3 days ago")
- [ ] Cards for removed jobs (`removedAt !== null`) render with reduced opacity (`opacity-60`) and a "No longer available" badge using a muted/destructive variant
- [ ] Pagination controls appear at the bottom of the results area with Previous/Next buttons and a "Page X of Y" indicator
- [ ] When no results match the current filters, an empty state displays: "No jobs match your filters. Try broadening your search."
- [ ] The page is responsive: filter sidebar collapses to a slide-out sheet on viewports below `md` breakpoint (768px), triggered by a "Filters" button

### US-2: User filters jobs

**As a** job seeker, **I want to** filter jobs by title, company, location, salary, and posting date, **so that** I can narrow results to relevant opportunities.

**Acceptance Criteria:**
- [ ] A filter sidebar renders on the left side of the page (280px wide on desktop) with the following controls:
  - **Job Title**: Text input with Search icon, filters `ScrapedJob.title` via case-insensitive substring match
  - **Company**: Multi-select dropdown populated from the `Company` table (only companies with `enabled: true`), filters by `ScrapedJob.companyId`
  - **Location**: Text input, filters `ScrapedJob.locations` via case-insensitive substring match against the locations array
  - **Salary Range**: Two number inputs (Min / Max) with dollar sign prefix, filters jobs where `salaryMax >= min` and `salaryMin <= max` (overlap logic). Jobs with partial salary data (only min or only max) are included if the available bound overlaps the filter range. Jobs with no salary data at all are excluded when a salary filter is set.
  - **Posting Date**: Date range picker (From / To) filtering on `ScrapedJob.firstSeenAt`
- [ ] Filters are applied server-side; changing any filter triggers a debounced API call (300ms debounce)
- [ ] A "Clear All" button appears in the filter sidebar header when any filter is active, resetting all filters to their default (empty) state
- [ ] Active filter count is shown as a badge on the mobile "Filters" button (e.g., "Filters (3)")
- [ ] Filter state is persisted in URL search params so that the page is shareable/bookmarkable and survives browser refresh

### US-3: User sorts job results

**As a** job seeker, **I want to** sort results by different fields, **so that** I can prioritize jobs by what matters most to me.

**Acceptance Criteria:**
- [ ] A sort control renders above the job cards (right-aligned) as a dropdown select with options: "Newest First" (default, `firstSeenAt` desc), "Oldest First" (`firstSeenAt` asc), "Title A-Z" (`title` asc), "Title Z-A" (`title` desc), "Highest Salary" (`salaryMax` desc, nulls last)
- [ ] Changing the sort triggers a new API call; sort is applied server-side
- [ ] Sort selection is persisted in URL search params (`sort` and `order` params)
- [ ] The current sort is visually indicated in the dropdown

### US-4: User views full job details

**As a** job seeker, **I want to** click a job card to see the complete job description, **so that** I can evaluate whether to apply.

**Acceptance Criteria:**
- [ ] Clicking a job card opens a modal dialog (`Dialog` component from shadcn/ui)
- [ ] The modal displays: job title (as dialog title), company name, department (labeled "Hiring Org"), location type badge, location(s), salary range, posting date (`firstSeenAt` formatted as "March 6, 2026"), and original posting URL as an external link (opens in new tab with `rel="noopener noreferrer"`)
- [ ] The full job description (`jobDescriptionMd`) is rendered as Markdown using `react-markdown` with appropriate prose styling (`prose dark:prose-invert` classes)
- [ ] If the job is removed (`removedAt !== null`), a warning banner appears at the top of the modal: "This role is no longer publicly available on the company's careers page. It may have been filled or removed." using a yellow/amber alert style
- [ ] The modal includes an "Archive" button (if not already archived) or "Unarchive" button (if archived)
- [ ] The modal includes an "Add to Board" button (disabled with tooltip "Coming soon" until PRD-16 is implemented)
- [ ] The modal is scrollable for long job descriptions and has a max-width of `3xl` (768px)
- [ ] The modal can be closed via the X button, clicking outside, or pressing Escape
- [ ] On mobile viewports (below `md`), the modal renders as a full-screen sheet (`SheetContent` side="bottom" with `h-[90vh]`)

### US-5: User archives and unarchives jobs

**As a** job seeker, **I want to** archive jobs I am not interested in and optionally view them later, **so that** my job feed stays relevant without permanently losing data.

**Acceptance Criteria:**
- [ ] Each job card has an archive button (Archive icon from lucide-react) in the top-right corner, visible on hover (desktop) or always visible (mobile)
- [ ] Clicking the archive button creates a `UserJobArchive` record (userId + scrapedJobId) via a POST to `/api/scraped-jobs/[id]/archive`
- [ ] Archived jobs are hidden from the default view
- [ ] A "Show Archived" toggle switch appears in the filter sidebar (below the filter controls), defaulting to off
- [ ] When "Show Archived" is enabled, user-archived jobs appear with a muted background and a badge reading "You archived this role. Click here to see it again." with an "Unarchive" action. Globally-archived jobs (auto-archived by scraper) appear with a muted background and a badge reading "No longer available. Will be removed in X days." (where X is calculated from `removedAt + 7 days - now`). Globally-archived jobs do not have an unarchive button.
- [ ] Clicking "Unarchive" deletes the `UserJobArchive` record via a DELETE to `/api/scraped-jobs/[id]/archive`
- [ ] Archive/unarchive operations are optimistic: the card updates immediately and reverts on API failure with a toast error "Failed to archive job. Please try again." or "Failed to unarchive job. Please try again."
- [ ] The archive button in the detail modal behaves identically to the card-level button

### US-6: Stale jobs are auto-archived

**As a** job seeker, **I want** jobs that have not been seen by the scraper for 7+ days to be automatically archived, **so that** my feed does not accumulate stale postings.

**Acceptance Criteria:**
- [ ] Jobs with `removedAt` older than 7 days are auto-archived by the scraper cron (PRD-14) via the `ScrapedJob.archivedAt` field. The Find Jobs UI excludes globally-archived jobs by default.
- [ ] The "Show Archived" toggle reveals both globally-archived (`ScrapedJob.archivedAt !== null`) and user-archived (`UserJobArchive` record exists) jobs
- [ ] Globally-archived jobs appear with a distinct badge from user-archived jobs: "No longer available. Will be removed in X days." vs. "You archived this role."

### US-7: User sees result count and loading states

**As a** job seeker, **I want to** see how many jobs match my filters and see loading feedback, **so that** I understand the scope of results and know the system is working.

**Acceptance Criteria:**
- [ ] A result count displays above the job cards (left-aligned): "Showing X-Y of Z jobs" (e.g., "Showing 1-24 of 142 jobs")
- [ ] While the API call is in flight, the job cards area shows skeleton loaders (6 skeleton cards matching the card layout)
- [ ] Filter changes show a subtle loading indicator (spinner in the results header area) without removing the current results (avoids layout shift)
- [ ] The initial page load shows skeleton loaders until the first data fetch completes

---

## 4. Technical Architecture / Stack

### Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **UI** | React 19, shadcn/ui, Tailwind CSS, lucide-react icons |
| **Markdown** | `react-markdown` (already installed) |
| **Database** | PostgreSQL via Prisma ORM |
| **Auth** | NextAuth (existing, all routes protected) |
| **State** | URL search params for filters/sort, React state for modal/archive toggle |

### New Frontend Files

| File | Purpose |
|---|---|
| `src/app/(authenticated)/find-jobs/page.tsx` | Page component: layout, filter state, data fetching |
| `src/components/find-jobs/job-card.tsx` | Individual job card component |
| `src/components/find-jobs/job-detail-modal.tsx` | Full detail modal with markdown rendering |
| `src/components/find-jobs/job-filter-sidebar.tsx` | Left sidebar with all filter controls |
| `src/components/find-jobs/job-sort-control.tsx` | Sort dropdown above results |
| `src/components/find-jobs/job-pagination.tsx` | Pagination controls |

### Modified Frontend Files

| File | Change |
|---|---|
| `src/components/nav-bar.tsx` | Add `{ href: "/find-jobs", label: "Find Jobs" }` to `navLinks` array between "Applications" and "Analytics" |

### Existing API Routes (from PRD-14)

PRD-14 already created the following endpoints that the Find Jobs UI consumes:

| Route | Purpose |
|---|---|
| `src/app/api/scraped-jobs/route.ts` | GET -- paginated, filtered, sorted job listing |
| `src/app/api/scraped-jobs/[id]/route.ts` | GET -- single job detail with full `jobDescriptionMd` |
| `src/app/api/scraped-jobs/[id]/archive/route.ts` | POST / DELETE -- archive/unarchive a job (per-user) |

### New API Routes

| Route | Purpose |
|---|---|
| `src/app/api/scraped-jobs/companies/route.ts` | GET -- enabled companies for filter dropdown |

### API Enhancements Required

The existing `/api/scraped-jobs` endpoint (and its Zod schema in `src/lib/validations/scraper.ts`) must be extended to support the additional query parameters needed by the Find Jobs UI:

| Param | Type | Description |
|---|---|---|
| `companyIds` | string | Comma-separated Company IDs for multi-select filter (extends existing single `companyId`) |
| `salaryMin` | number | Minimum salary filter (`salaryMax >= salaryMin`) |
| `salaryMax` | number | Maximum salary filter (`salaryMin <= salaryMax`) |
| `postedFrom` | ISO date | Filter `firstSeenAt >= postedFrom` |
| `postedTo` | ISO date | Filter `firstSeenAt <= postedTo` |

Additional changes to the existing API:
- Change `limit` default from 20 to 24 to match the card grid layout (divisible by 1, 2, and 3 columns)
- Change `includeRemoved` default to `true` (removed-but-not-archived jobs are shown grayed out in the UI)
- The `includeArchived` param controls both globally-archived and user-archived jobs
- Add server-side exclusion of user-archived jobs from results when `includeArchived` is false (currently the endpoint only computes `isArchived` as a flag but does not filter)

### Database Changes

No new models are introduced. This PRD consumes models defined in PRD-14:

- **ScrapedJob**: `id`, `title`, `companyId` (FK to Company), `locations` (Json), `salaryMin` (Int?), `salaryMax` (Int?), `jobDescriptionMd` (String @db.Text), `firstSeenAt` (DateTime), `lastSeenAt` (DateTime), `removedAt` (DateTime?), `archivedAt` (DateTime?), `url` (String), `externalJobId` (String)
- **Company**: `id`, `name`, `atsType`, `enabled` (Boolean)
- **UserJobArchive**: `id`, `userId` (FK to User), `scrapedJobId` (FK to ScrapedJob), `createdAt` (DateTime). Unique constraint on `[userId, scrapedJobId]`. This model is purely for per-user manual archive.


---

## 5. UI/UX Design

### Page Layout

```
+----------------------------------------------------------------+
| NavBar: Dashboard | Resume Source | Applications | [Find Jobs] | Analytics
+----------------------------------------------------------------+
|          |                                                      |
| FILTERS  |  Showing 1-24 of 142 jobs          [Sort: Newest v] |
|          |                                                      |
| Title    |  +------------------+  +------------------+         |
| [______] |  | Sr. Engineer     |  | Product Manager  |         |
|          |  | Acme Corp        |  | Globex Inc       |         |
| Company  |  | Remote, NYC      |  | San Francisco    |         |
| [v Multi]|  | $150k - $200k    |  | $140k - $180k    |         |
|          |  | 2 days ago    [x]|  | 5 days ago    [x]|         |
| Location |  +------------------+  +------------------+         |
| [______] |                                                      |
|          |  +------------------+  +------------------+         |
| Salary   |  | Data Scientist   |  | [grayed out]     |         |
| Min [__] |  | DataCo           |  | Designer - GONE  |         |
| Max [__] |  | Austin, TX       |  | No longer avail. |         |
|          |  | $130k - $170k    |  | Globex Inc       |         |
| Posted   |  | 1 day ago     [x]|  | 3 days ago    [x]|         |
| From [__]|  +------------------+  +------------------+         |
| To   [__]|                                                      |
|          |           [< Previous]  Page 1 of 6  [Next >]       |
| [Clear]  |                                                      |
|          |                                                      |
| [Toggle] |                                                      |
| Show     |                                                      |
| Archived |                                                      |
+----------------------------------------------------------------+
```

Cards render in a responsive grid: 1 column on `sm`, 2 columns on `md`, 3 columns on `lg` and above.

### Job Card Component (`JobCard`)

```
+----------------------------------+
| Sr. Software Engineer        [x] |  <- [x] = archive button (hover-visible)
| Acme Corporation                 |
|                                  |
| Remote, New York, NY             |  <- locations joined with ", "
| $150,000 - $200,000              |  <- formatted with toLocaleString
| Posted 2 days ago                |  <- relative time from firstSeenAt
+----------------------------------+
```

**Removed job variant:**
```
+----------------------------------+
| [No longer available]            |  <- badge, top-right
| Sr. Software Engineer        [x] |
| Acme Corporation                 |  <- entire card at opacity-60
| ...                              |
+----------------------------------+
```

**Archived job variant (when "Show Archived" is on):**
```
+----------------------------------+
| [Archived]                       |  <- badge, muted variant
| Sr. Software Engineer      [undo]|  <- undo = unarchive button
| Acme Corporation                 |
| ...                              |
+----------------------------------+
```

### Detail Modal

```
+------------------------------------------------------+
| Sr. Software Engineer at Acme Corporation        [X]  |
|                                                       |
| [!] This role is no longer publicly available...      |  <- only if removedAt !== null
|                                                       |
| Location:   Remote, New York, NY                      |
| Salary:     $150,000 - $200,000                       |
| Posted:     March 6, 2026                             |
| Posting:    [View Original ->]                        |  <- external link
|                                                       |
| ---------------------------------------------------- |
|                                                       |
| ## About the Role                                     |
|                                                       |
| We are looking for a senior software engineer to...   |
| (full markdown rendered with react-markdown)          |
|                                                       |
| ---------------------------------------------------- |
|                                                       |
|              [Archive]    [Add to Board (Coming soon)] |
+------------------------------------------------------+
```

### Mobile Layout (below `md` breakpoint)

- Filter sidebar collapses to a slide-out `Sheet` triggered by a "Filters" button with active filter count badge
- Job cards render in a single column
- Detail modal renders as a bottom sheet at 90vh height
- Archive button on cards is always visible (no hover state on touch)

### Loading States

- **Initial load / filter change:** 6 skeleton cards in the grid layout, matching card dimensions
- **Pagination:** Skeleton cards replace current results during page transition
- **Archive action:** Optimistic update -- card animates out (if hiding) or toggles badge immediately

### Empty State

```
+----------------------------------+
|                                  |
|   [SearchX icon]                 |
|                                  |
|   No jobs match your filters.    |
|   Try broadening your search.    |
|                                  |
|   [Clear All Filters]            |
|                                  |
+----------------------------------+
```

---

## 6. API Endpoints

### GET `/api/scraped-jobs`

Fetches a paginated, filtered, sorted list of scraped jobs.

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | `1` | Page number (1-indexed) |
| `limit` | number | `24` | Results per page (max 100) |
| `q` | string | `""` | Case-insensitive substring filter on `ScrapedJob.title` |
| `companyId` | string | `""` | Single Company ID filter (existing) |
| `companyIds` | string | `""` | Comma-separated Company IDs for multi-select filter (new) |
| `company` | string | `""` | Filter by company name, exact match (existing) |
| `location` | string | `""` | Substring filter on `ScrapedJob.locations` array |
| `salaryMin` | number | - | Minimum salary (filters `salaryMax >= salaryMin`) |
| `salaryMax` | number | - | Maximum salary (filters `salaryMin <= salaryMax`) |
| `postedFrom` | ISO date | - | Filter `firstSeenAt >= postedFrom` |
| `postedTo` | ISO date | - | Filter `firstSeenAt <= postedTo` |
| `sort` | string | `"firstSeenAt"` | Sort field: `firstSeenAt`, `title`, `salaryMax` |
| `order` | string | `"desc"` | Sort direction: `asc` or `desc` |
| `includeRemoved` | boolean | `true` | Include removed-but-not-archived jobs (shown grayed out) |
| `includeArchived` | boolean | `false` | Include globally-archived and user-archived jobs in results |

**Response (200):**

```json
{
  "jobs": [
    {
      "id": "clxyz...",
      "title": "Sr. Software Engineer",
      "company": { "id": "clxyz...", "name": "Acme Corporation" },
      "locations": ["Remote", "New York, NY"],
      "salaryMin": 150000,
      "salaryMax": 200000,
      "firstSeenAt": "2026-03-04T12:00:00Z",
      "lastSeenAt": "2026-03-06T08:00:00Z",
      "removedAt": null,
      "url": "https://acme.com/careers/12345",
      "isArchived": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 24,
    "total": 142,
    "totalPages": 6
  }
}
```

**Auth:** Requires authenticated session. Returns 401 if unauthenticated.

**Implementation notes:**
- Join `UserJobArchive` on the current user's ID to compute `isArchived` per job
- By default, removed jobs (`removedAt !== null` but `archivedAt === null`, i.e. removed less than 7 days ago) ARE shown in results but rendered grayed out. Globally archived jobs (`archivedAt !== null`) are excluded by default, as are user-archived jobs (`UserJobArchive` record exists)
- When `showArchived` is true, both globally-archived and user-archived jobs are included in results
- For location filtering, use Prisma's JSON `path` queries or raw SQL to match against the JSON locations array
- Job description is intentionally excluded from the list response (fetched separately in the detail endpoint)

### GET `/api/scraped-jobs/[id]`

Fetches a single job with full details including the markdown description.

**Response (200):**

```json
{
  "id": "clxyz...",
  "title": "Sr. Software Engineer",
  "company": { "id": "clxyz...", "name": "Acme Corporation" },
  "locations": ["Remote", "New York, NY"],
  "salaryMin": 150000,
  "salaryMax": 200000,
  "jobDescriptionMd": "## About the Role\n\nWe are looking for...",
  "firstSeenAt": "2026-03-04T12:00:00Z",
  "lastSeenAt": "2026-03-06T08:00:00Z",
  "removedAt": null,
  "url": "https://acme.com/careers/12345",
  "isArchived": false
}
```

**Errors:**
- `404`: `{ "error": "Job not found" }`
- `401`: Unauthenticated

### POST `/api/scraped-jobs/[id]/archive`

Archives a job for the current user. Already implemented in PRD-14.

**Response (201):** Returns the created `UserJobArchive` record.

**Errors:**
- `404`: `{ "error": "Job not found" }`
- `409`: `{ "error": "Job is already archived" }`
- `401`: Unauthenticated

### DELETE `/api/scraped-jobs/[id]/archive`

Unarchives a job for the current user. Already implemented in PRD-14.

**Response (204):** No content.

**Errors:**
- `404`: `{ "error": "Archive record not found" }`
- `401`: Unauthenticated

### GET `/api/scraped-jobs/companies`

Returns enabled companies for the filter dropdown.

**Response (200):**

```json
{
  "companies": [
    { "id": "clxyz...", "name": "Acme Corporation", "jobCount": 152 },
    { "id": "clabc...", "name": "Globex Inc", "jobCount": 34 }
  ]
}
```

**Auth:** Requires authenticated session.

**Implementation notes:**
- Only return companies that have at least one `ScrapedJob` record (regardless of archive status)
- Include `jobCount` (count of non-archived ScrapedJobs) for display in the filter dropdown (e.g., "Stripe (152)")
- Sort alphabetically by `name`

---

## 7. Error Handling

| Scenario | Behavior |
|---|---|
| **API fetch fails (network error)** | Show toast: "Failed to load jobs. Please check your connection and try again." Retry button appears in the results area. |
| **API fetch fails (500)** | Show toast: "Something went wrong. Please try again." Retry button appears. |
| **Archive fails** | Optimistic update reverts. Show toast: "Failed to archive job. Please try again." |
| **Unarchive fails** | Optimistic update reverts. Show toast: "Failed to unarchive job. Please try again." |
| **Detail fetch fails** | Modal shows inline error: "Failed to load job details. Please try again." with a retry button inside the modal body. |
| **Invalid filter params in URL** | Silently ignore invalid params, apply defaults. Do not show an error. |
| **Job deleted between list and detail fetch** | Modal shows: "This job is no longer available." with only a Close button. |
| **User not authenticated** | API returns 401. Page redirects to `/signin` via existing auth middleware. |

---

## 8. Testing Strategy

### Build Verification

- [ ] `npm run build` passes with no type errors
- [ ] `npm run lint` passes with no new warnings

### Unit Tests (vitest)

**JobCard component (`src/components/find-jobs/__tests__/job-card.test.tsx`):**
- [ ] Renders job title, company name, locations, salary range, and posting date
- [ ] Renders "Salary not listed" when `salaryMin` and `salaryMax` are null
- [ ] Renders locations as comma-separated string
- [ ] Formats salary with dollar sign and comma separators (e.g., "$150,000")
- [ ] Shows "No longer available" badge when `removedAt !== null`
- [ ] Applies `opacity-60` class when `removedAt !== null`
- [ ] Shows "Archived" badge and "Unarchive" button when `isArchived === true`
- [ ] Archive button calls `onArchive` with the job ID
- [ ] Unarchive button calls `onUnarchive` with the job ID
- [ ] Click on card body (not archive button) calls `onSelect` with the job ID

**JobDetailModal component (`src/components/find-jobs/__tests__/job-detail-modal.test.tsx`):**
- [ ] Renders full job details including title, company, locations, salary, posted date, and external link
- [ ] Renders `jobDescriptionMd` as Markdown via `react-markdown`
- [ ] Shows removal warning banner when `removedAt !== null`
- [ ] Does not show removal warning banner when `removedAt === null`
- [ ] "Add to Board" button is present and disabled with "Coming soon" tooltip
- [ ] Archive/Unarchive button toggles based on `isArchived` state
- [ ] External link opens in new tab with `rel="noopener noreferrer"`
- [ ] Close button calls `onClose`

**JobFilterSidebar component (`src/components/find-jobs/__tests__/job-filter-sidebar.test.tsx`):**
- [ ] Renders all 5 filter controls (title, company, location, salary min/max, date range)
- [ ] "Clear All" button is visible when at least one filter is active
- [ ] "Clear All" button is hidden when no filters are active
- [ ] Changing title input calls `onFilterChange` with updated title value
- [ ] Company multi-select reflects selected companies
- [ ] "Show Archived" toggle calls `onToggleArchived`

**JobSortControl component (`src/components/find-jobs/__tests__/job-sort-control.test.tsx`):**
- [ ] Renders all 5 sort options (Newest First, Oldest First, Title A-Z, Title Z-A, Highest Salary)
- [ ] Selecting an option calls `onSortChange` with correct sort field and order
- [ ] Current sort is visually selected

### API Route Tests (vitest)

**GET `/api/scraped-jobs` (`src/app/api/scraped-jobs/__tests__/route.test.ts`):**
- [ ] Returns paginated results with correct `totalCount` and `totalPages`
- [ ] Filters by title substring (case-insensitive)
- [ ] Filters by companyIds (multiple)
- [ ] Filters by location substring
- [ ] Filters by salary range (overlap logic)
- [ ] Filters by posting date range
- [ ] Excludes archived jobs when `showArchived` is false
- [ ] Includes archived jobs (with `isArchived: true`) when `showArchived` is true
- [ ] Sorts by each supported field in both directions
- [ ] Returns 401 for unauthenticated requests
- [ ] Clamps `pageSize` to max 100
- [ ] Returns empty array with correct pagination for no-match filters

**POST/DELETE `/api/scraped-jobs/archive` (`src/app/api/scraped-jobs/archive/__tests__/route.test.ts`):**
- [ ] POST creates `UserJobArchive` record
- [ ] POST returns 409 if already archived
- [ ] POST returns 404 for non-existent job
- [ ] POST returns 400 if `scrapedJobId` is missing
- [ ] DELETE removes `UserJobArchive` record
- [ ] DELETE returns 404 if not archived
- [ ] Both return 401 for unauthenticated requests

### End-to-End Tests (Playwright)

**E2E-1: Browse and filter flow:**
1. Navigate to `/find-jobs`
2. Assert job cards are rendered
3. Type "Engineer" in the title filter
4. Assert results narrow to jobs containing "Engineer" in title
5. Clear the filter
6. Assert full results return
7. Select a company from the company filter
8. Assert only jobs from that company appear

**E2E-2: Sort flow:**
1. Navigate to `/find-jobs`
2. Change sort to "Title A-Z"
3. Assert first card title is alphabetically first
4. Change sort to "Highest Salary"
5. Assert first card shows highest salary

**E2E-3: Detail modal flow:**
1. Navigate to `/find-jobs`
2. Click a job card
3. Assert modal opens with job title, company, full description
4. Assert external link is present
5. Close modal via X button
6. Assert modal is closed

**E2E-4: Archive flow:**
1. Navigate to `/find-jobs`, note the title of the first job
2. Click archive on the first card
3. Assert the card disappears from results
4. Enable "Show Archived" toggle
5. Assert the archived job appears with "Archived" badge
6. Click "Unarchive"
7. Disable "Show Archived"
8. Assert the job reappears in normal results

**E2E-5: Removed job display:**
1. Seed a job with `removedAt` set to a recent timestamp
2. Navigate to `/find-jobs`
3. Assert the removed job card has reduced opacity and "No longer available" badge
4. Click the card
5. Assert the removal warning banner appears in the modal

### Manual Testing

- Verify filter state persists in URL (copy URL, open in new tab, confirm filters applied)
- Verify responsive layout: filters collapse to sheet on mobile, cards go single-column, modal becomes bottom sheet
- Verify pagination: navigate through multiple pages, confirm correct result counts
- Verify empty state displays when filters match no jobs
- Verify skeleton loaders appear during initial load and filter changes
- Verify keyboard navigation: Tab through cards, Enter opens modal, Escape closes modal

### Edge Cases

- [ ] Job with no salary data: card shows "Salary not listed", salary filter excludes it when a range is set
- [ ] Job with single location vs. multiple locations: both render correctly
- [ ] Job with extremely long title: truncated with ellipsis on card, full title in modal
- [ ] Job with extremely long description: modal scrolls internally
- [ ] User has no scraped jobs (zero `ScrapedJob` records in database with no filters active): empty state with message "No jobs found. Jobs will appear here once your job scraper is configured."
- [ ] All jobs are archived: default view shows empty state with hint "All jobs are archived. Toggle 'Show Archived' to review them."
- [ ] Concurrent archive from two tabs: second request returns 409, UI handles gracefully
- [ ] When archiving the last job on a page, the user is redirected to the previous page
- [ ] If the detail modal is open when a card-level archive occurs, the modal state is stale until reopened (no real-time sync required)

---

## 9. Scope / Out of Scope

### In Scope

- New `/find-jobs` route and page component
- Navigation bar update to include "Find Jobs"
- Filter sidebar with 5 filter types (title, company, location, salary, posting date)
- Sort control with 8 sort options
- Job card component with archive/removed states
- Job detail modal with markdown rendering
- Archive/unarchive per-user with optimistic updates
- "Show Archived" toggle
- Auto-archive of stale jobs handled by PRD-14 scraper cron (via `ScrapedJob.archivedAt`); UI excludes globally-archived jobs by default
- Responsive layout (sidebar collapse, mobile modal, single-column cards)
- Server-side filtering, sorting, and pagination
- URL-based filter persistence
- Skeleton loading states and empty states
- API routes: list, detail, archive, companies

### Out of Scope

- **"Add to Board" functionality:** The button is present but disabled. Full Kanban integration is deferred to PRD-16.
- **Saved searches / alerts:** Users cannot save filter presets or receive notifications for new matches.
- **Job recommendations:** No AI/ML-based job matching or relevance scoring.
- **Full-text search:** Title and location filters use simple substring matching, not PostgreSQL full-text search or trigram indexes. Can be upgraded later if performance requires it.
- **Infinite scroll:** The initial implementation uses traditional pagination. Infinite scroll can be added later if user feedback warrants it.
- **Bulk actions:** No multi-select or bulk archive. Single-job actions only.
- **Job notes / bookmarks:** Users cannot annotate or bookmark jobs (beyond archive). Deferred to a future PRD.
- **Email/push notifications:** No alerts when new jobs matching filters are scraped.
- **Scraper configuration UI:** Company and scraper setup is managed via admin panel (PRD-6) or database, not from the Find Jobs page.
- **Export:** No CSV/PDF export of job listings.
- **Analytics:** No tracking of job view counts, archive rates, or filter usage in this iteration.

---

## Clarifying Questions (Resolved)

**Q1: Should the salary filter inputs accept formatted values or plain numbers?**
Decision: Plain number inputs with dollar sign prefix (no input masking).

**Q2: Should "Show Archived" reveal both auto-archived and manually archived jobs?**
Decision: Yes, a single toggle reveals both. They are visually distinguished: auto-archived shows "No longer available. Will be removed in X days." and user-archived shows "You archived this role. Click here to see it again."

**Q3: Should the company dropdown show job counts?**
Decision: Yes. Companies with at least one ScrapedJob are shown with count, e.g., "Stripe (152)". Companies with zero jobs are excluded.
