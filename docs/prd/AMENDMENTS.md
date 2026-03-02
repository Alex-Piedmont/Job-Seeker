# PRD Amendments — Post-Review Pass

**Date:** 2026-03-02
**Trigger:** Architectural review + user-perspective gap analysis before implementation

These amendments modify PRDs 1-7 based on two review passes: (1) missing user-facing features, (2) architectural improvements. Each amendment references the PRD it modifies and the section affected.

---

## User-Perspective Amendments

### A1: Application Duplication (PRD 3)

**Problem:** Users applying to similar roles re-enter the same data repeatedly. No way to clone a card.

**Amendment to PRD 3, Section 3 (User Stories):**

Add **US-10: Duplicate Application**

**As a** user, **I want to** duplicate an existing application card, **so that** I can reuse shared details (compensation, JD, referrals) when applying to a similar role at the same or different company.

**Acceptance Criteria:**
- [ ] A "Duplicate" option exists in the card's kebab menu (detail drawer or card context menu)
- [ ] Duplicating creates a new application with a new serial number in the same column
- [ ] Copied fields: company, role, locationType, primaryLocation, additionalLocations, salaryMin, salaryMax, bonusTargetPct, variableComp, hiringOrg, jobDescription, referrals
- [ ] NOT copied: serialNumber (new), hiringManager, postingNumber, postingUrl, datePosted, dateApplied, rejectionDate, comments, interviews, resume generations
- [ ] The duplicate opens in the detail drawer immediately for editing
- [ ] Toast: "Application duplicated as #{serial}"
- [ ] Subject to application cap enforcement

**Amendment to PRD 3, FR-8 (API Routes):**

Add: `POST /api/kanban/applications/[id]/duplicate` — Creates a duplicate of the specified application. Returns the new application with a fresh serial number.

---

### A2: Activity Timeline (PRD 3)

**Problem:** The `comments` field is a flat textarea. Job searches produce a stream of timestamped events. Users lose track of what happened when.

**Amendment to PRD 3, Section 4 (Functional Requirements):**

Add **ApplicationNote** model to the `add_kanban` migration:

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | Yes | `cuid()` | Primary key |
| `jobApplicationId` | String | Yes | -- | FK to JobApplication |
| `content` | String (Text) | Yes | -- | Note text |
| `createdAt` | DateTime | Yes | `now()` | -- |

Relations: `jobApplication` (many:1 to JobApplication). `onDelete: Cascade` (deleting the application deletes all notes).

Replace the `comments` field on `JobApplication` with a `notes` (1:many to ApplicationNote) relation. The flat `comments` textarea in the detail drawer is replaced by a timestamped note feed:
- "Add Note" text input at the top of the notes section
- Each note shows content + relative timestamp ("2 hours ago", "3 days ago")
- Notes are ordered newest-first
- Each note has a delete button (with confirmation)
- Notes are NOT editable after creation (append-only log)

**Amendment to PRD 3, FR-8 (API Routes):**

Add:
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/kanban/applications/[id]/notes` | Add a note |
| `DELETE` | `/api/kanban/applications/[id]/notes/[noteId]` | Delete a note |

Remove the `comments` field from the JobApplication model.

**Amendment to PRD 3, Section 8 (Input Validation):**

| Field | Validation |
|---|---|
| Note `content` | Required, max 5,000 characters |

Max 500 notes per application.

---

### A3: Data Export (PRD 7)

**Problem:** No way to export or back up user data. If the service goes down or the user wants to leave, their data is trapped.

**Amendment to PRD 7, Section 3 (User Stories):**

Add **US-9: Export My Data**

**As a** user, **I want to** download all my data as a JSON file, **so that** I have a personal backup and can leave the platform without data loss.

**Acceptance Criteria:**
- [ ] An "Export Data" button exists in the user menu dropdown (nav bar)
- [ ] Clicking it triggers a download of a JSON file containing: resume source (all sections), all job applications (all fields), all interview records, all application notes, all resume generations (markdown output only, not .docx), all kanban columns
- [ ] The file is named `job-seeker-export-{YYYY-MM-DD}.json`
- [ ] Export works for any data volume up to the application cap (200 apps)
- [ ] No generated .docx files are included (user can re-download those individually)
- [ ] The export contains no internal IDs, foreign keys, or system fields — only user-meaningful data

**Amendment to PRD 7, Section 4 (Functional Requirements):**

Add **FR-13:** A `GET /api/export` endpoint shall return the user's complete data as JSON. The response is streamed (or assembled server-side) and returned with `Content-Disposition: attachment; filename="job-seeker-export-{date}.json"`. Rate limited to 1 request per 5 minutes per user (new rate limit category).

---

### A4: Stale Card Detection + Ghosting (PRD 3)

**Problem:** Job applications go stale when companies stop responding. Users have no visual cue that a card hasn't been touched in weeks, and no way to record that they were ghosted.

**Amendment to PRD 3, Section 3 (User Stories):**

Add **US-11: Stale Card Detection**

**As a** user, **I want** cards that haven't had activity to be visually flagged, **so that** I can identify applications that may have gone cold.

**Acceptance Criteria:**
- [ ] "Last activity" for a card is the most recent of: `updatedAt`, latest `ApplicationStatusLog.movedAt`, latest `InterviewRecord.createdAt`, or latest `ApplicationNote.createdAt`
- [ ] Cards inactive for 14+ days: subtle visual change — muted/desaturated card background, small clock icon
- [ ] Cards inactive for 30+ days: stronger visual change — distinct background tint (e.g., warm gray), warning icon with tooltip: "No activity for 30+ days. Consider closing this application."
- [ ] Stale indicators do NOT appear on cards in `isClosedColumn` or `isOfferColumn` columns (those are terminal/positive states)
- [ ] Staleness is computed client-side from loaded data (no additional API calls)

Add **US-12: Ghosted Status**

**As a** user, **I want to** mark a closed application as "ghosted", **so that** I can distinguish between explicit rejections and no-response outcomes.

**Acceptance Criteria:**
- [ ] When moving a card to the closed column, the rejection dialog includes a "Ghosted (no response)" checkbox
- [ ] If checked, `rejectionDate` is set to today and `closedReason` is set to `"ghosted"`
- [ ] If unchecked, the existing behavior applies (date picker for rejection date)
- [ ] The detail drawer shows "Ghosted" or "Rejected" label next to the rejection date
- [ ] Analytics (PRD 5) can distinguish ghosted from explicit rejections in the rejection breakdown

**Amendment to PRD 3, FR-1 (JobApplication schema):**

Add field:

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `closedReason` | String | No | null | "rejected" or "ghosted"; null if not closed |

**Amendment to PRD 5 (Analytics):**

Update rejection breakdown (FR-7) to split rejections into "Rejected" and "Ghosted" subcategories. The rejection-by-stage chart shows both, and a summary metric shows ghosted rate vs. explicit rejection rate.

---

### A5: Editable Resume Markdown (PRD 4)

**Problem:** Users can't tweak a generated resume without burning another generation credit. A 90% correct resume requires regeneration instead of a quick edit.

**Amendment to PRD 4, Section 3 (User Stories):**

Modify **US-2 (Download as .docx)** acceptance criteria to add:
- [ ] After generation, the resume markdown is displayed in an editable textarea (not read-only)
- [ ] The user can modify the markdown before downloading
- [ ] "Download .docx" converts the current textarea content (which may have been edited)
- [ ] Edits do NOT consume a generation credit
- [ ] Edits are NOT persisted to the database — the stored `markdownOutput` on ResumeGeneration remains the original AI output. If the user navigates away and returns, they see the original.
- [ ] A "Reset to original" button restores the AI-generated markdown

**Amendment to PRD 4, Section 5 (Non-Goals):**

Remove: "Editing the generated resume in-app: The output is read-only."
Replace with: "Rich text editing of the generated resume: Users edit the raw markdown. No WYSIWYG editor."

**Amendment to PRD 4, Section 6 (Design):**

Update the preview panel description: the preview uses a split view — editable markdown textarea on the left, rendered preview on the right (or a toggle between edit/preview on narrow screens). The "Download .docx" button converts the current textarea content.

---

## Architectural Amendments

### B1: Eliminate Railway Service — Use Vercel with Streaming (PRD 4)

**Problem:** Running a separate Express service on Railway for a single endpoint adds operational complexity: two deployments, JWT handshake, shared secrets, Dockerfile, duplicated code.

**Amendment to PRD 4, Section 7 (Architecture):**

Replace the Railway architecture with a Vercel-native approach:

**Option chosen: Vercel serverless function with extended timeout.**

Vercel hobby tier allows 60-second execution for serverless functions when using the `maxDuration` config (available since late 2024). The Claude API call typically completes in 15-25 seconds, well within this limit.

```typescript
// src/app/api/resume/generate/route.ts
export const maxDuration = 60; // seconds
```

The entire generation flow happens in a single `POST /api/resume/generate` endpoint on Vercel:
1. Verify session via `auth()`
2. Validate inputs (ownership, JD present, resume source compiled)
3. Atomically pre-increment cap via `reserveGeneration()`
4. Call Claude API directly (15-25s)
5. Compute cost, create ResumeGeneration record
6. Return result
7. On any failure after pre-increment, call `rollbackGeneration()`

**Removed:**
- `services/resume-generator/` directory (entire Railway service)
- `RESUME_JWT_SECRET` env var
- `NEXT_PUBLIC_RESUME_SERVICE_URL` env var
- `src/lib/resume-jwt.ts`
- `POST /api/resume/token` endpoint
- `POST /api/resume/rollback` endpoint (rollback happens server-side within the generate endpoint)
- `jsonwebtoken` dependency

**Added:**
- `POST /api/resume/generate` — single endpoint that does everything
- `export const maxDuration = 60` in the route file

This reduces from two deployments to one, eliminates the JWT handshake, removes a dependency, and simplifies the env var surface.

**Fallback:** If Vercel hobby tier does not support `maxDuration > 10` at the time of implementation, fall back to the Railway architecture as originally specified. Check Vercel docs during implementation.

---

### B2: UTC for All Date/Time Boundaries (PRD 1, PRD 4)

**Problem:** Cap reset uses "calendar month" but doesn't specify timezone. Users near month boundaries see unpredictable reset behavior.

**Amendment to PRD 1, FR-7a and PRD 4, FR-3:**

All calendar-month boundary checks shall use **UTC**. The `resumeCapResetAt` field stores a UTC date. The comparison logic uses `Date.getUTCFullYear()` and `Date.getUTCMonth()`. The "Resets {Month} 1" display in the UI converts to the user's local timezone for display, but the underlying logic is UTC.

Add to PRD 1, Section 7 (Technical Considerations): "All server-side date/time operations use UTC. No timezone conversion happens on the server. The client converts UTC timestamps to local time for display."

---

### B3: Replace Boolean Flags with `columnType` Enum (PRD 3, PRD 5)

**Problem:** `isClosedColumn` and `isOfferColumn` are separate booleans. Each new special column requires a migration and uniqueness enforcement. This doesn't scale.

**Amendment to PRD 3, FR-1 (KanbanColumn schema):**

Remove `isClosedColumn` field. Remove `isOfferColumn` from PRD 5 FR-0.

Add `columnType` field:

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `columnType` | String | No | null | One of: "CLOSED", "OFFER", or null for user-defined columns. At most one of each type per user. |

Default column seeding sets `columnType: "CLOSED"` on "Closed" and `columnType: "OFFER"` on "Offer". Other columns have `columnType: null`.

Enforcement: when setting a `columnType`, clear that type from any existing column for the user first (in a transaction). This replaces the "only one isClosedColumn per user" invariant with a single UPDATE + UPDATE pattern.

All references to `isClosedColumn` in PRDs 3, 5, and 7 become `columnType === "CLOSED"`. All references to `isOfferColumn` become `columnType === "OFFER"`.

The `isOfferColumn` migration (PRD 5 FR-0) is folded into the original `add_kanban` migration. No separate migration needed.

---

### B4: Replace Per-User Sequences with MAX+1 in Transaction (PRD 3)

**Problem:** `CREATE SEQUENCE user_serial_{userId}` creates unbounded PostgreSQL objects outside Prisma's management. They're invisible to schema tooling, survive migrations awkwardly, and clutter the database at scale.

**Amendment to PRD 3, FR-4:**

Replace the per-user sequence approach with:

```typescript
const serial = await prisma.$transaction(async (tx) => {
  const max = await tx.jobApplication.aggregate({
    where: { userId },
    _max: { serialNumber: true },
  });
  const next = (max._max.serialNumber ?? 0) + 1;
  // The @@unique([userId, serialNumber]) constraint prevents duplicates.
  // If a concurrent insert races, the constraint violation triggers a retry.
  return next;
}, {
  isolationLevel: 'Serializable',
});
```

With a retry loop (max 3 attempts) on unique constraint violation. In a single-user-per-session app, the race condition is nearly impossible, but the retry loop provides safety.

Remove all references to `CREATE SEQUENCE` and `nextval()`.

---

### B5: Add Index on ApplicationStatusLog.movedAt (PRD 3)

**Problem:** Analytics queries (PRD 5) do correlated subqueries with `ORDER BY movedAt ASC LIMIT 1` on ApplicationStatusLog. Without an index on `movedAt`, these are sequential scans.

**Amendment to PRD 3, FR-1 (ApplicationStatusLog):**

Add to the model: `@@index([jobApplicationId, movedAt])` — a compound index that covers the most common query pattern (find the first/last log entry for a given application, ordered by time).

---

### B6: Acknowledge Client-Side Search Constraint (PRD 3)

**Problem:** The 200-application cap exists partially to keep client-side filtering performant. This is the tail wagging the dog.

**Amendment to PRD 3, Section 10 (Known Constraints):**

Add: "The 200-application cap is a product decision (controlling platform scope for hobby tier), not solely a technical limitation. If the cap is raised in the future, client-side search should be replaced with server-side search + pagination via a `GET /api/kanban/applications?q=&column=&page=` endpoint. The current client-side approach is intentionally simple for the R1 scope."

No code change — this is documentation of the tradeoff.

---

### B7: Add Zod for Input Validation (PRD 1)

**Problem:** 30+ API route handlers each need input validation. Without a shared validation library, patterns will be inconsistent and error-prone.

**Amendment to PRD 1, Section 10 (Dependencies):**

Add `zod` to the dependencies table:

| Package | Purpose | Why This Library |
|---|---|---|
| `zod` | Runtime input validation for API routes | Type-safe schema validation that infers TypeScript types. ~12KB. Eliminates manual validation code in route handlers. |

**Amendment to PRD 1, Section 7 (Technical Considerations):**

Add: "All API route handlers shall validate request bodies using Zod schemas defined in `src/lib/validations/`. Each route imports its schema, parses the body, and returns 400 with Zod's error messages on failure. This is a cross-cutting convention — PRDs 2-7 inherit it."

Add file: `src/lib/validations/index.ts` — exports a `validateBody()` helper that parses a request body against a Zod schema and returns a typed result or a 400 Response.

---

### B8: Decouple apiFetch from Toasts (PRD 7)

**Problem:** `apiFetch()` directly triggers toast side effects, making it untestable and preventing suppression for background operations (e.g., auto-save).

**Amendment to PRD 7, FR-8a:**

`apiFetch()` shall return a structured result object, not trigger toasts directly:

```typescript
type ApiResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status: number; retryAfter?: number };
```

A separate `useApiCall()` hook (or wrapper) handles the toast logic:

```typescript
// Used by components that want automatic toast feedback
const { data, loading } = useApiCall(() => apiFetch('/api/...'));

// Used by auto-save and other silent operations
const result = await apiFetch('/api/...');
if (!result.ok) { /* handle silently or show custom feedback */ }
```

This keeps the fetch layer pure and testable. Toast behavior is the caller's responsibility.

---

### B9: Add Connection Pooling Note (PRD 1)

**Problem:** Vercel serverless functions can exhaust Railway's ~5 connection limit under even modest concurrent load.

**Amendment to PRD 1, Section 10 (Known Constraints):**

Update the Railway connection limit note: "Railway hobby tier has connection limits (~5 concurrent connections). For R1, use Prisma's built-in connection pool with `connection_limit=3` in the DATABASE_URL query string: `?connection_limit=3&pool_timeout=10`. This leaves headroom for Prisma Studio and migrations. If concurrent users exceed 3-4, add PgBouncer (Railway one-click addon) or Prisma Accelerate. The Prisma singleton pattern prevents multiple clients in development."

**Amendment to PRD 1, `.env.example`:**

Update the DATABASE_URL example to include the connection limit:
```
DATABASE_URL="postgresql://jobseeker:jobseeker@localhost:5432/jobseeker?connection_limit=3&pool_timeout=10"
```

---

### B10: Label Cost Estimates Prominently (PRD 4, PRD 6)

**Problem:** `estimatedCost` is treated as authoritative in the admin panel. Token pricing changes will cause drift from reality.

**Amendment to PRD 6, Section 6 (Design):**

All cost displays in the admin panel shall be prefixed with "Est." or "Estimated" (e.g., "Est. $43.28", "Estimated Total Spend"). The Generations tab shall include a small info tooltip: "Costs are estimated from token counts and configured rates. Compare against your Anthropic invoice for actual billing."

**Amendment to PRD 4, FR-8:**

Add a comment in the cost estimation code: estimated costs are approximations. The admin panel (PRD 6) labels them accordingly. No code change to the estimation logic itself.

---

### B11: Robust Test Infrastructure (PRDs 1-3, 7)

**Problem:** PRD 1 deferred all automated testing. PRDs 2-3 had only unit tests and manual verification. With anticipated substantial user uptake, the app needs robust automated test coverage across all layers.

**Amendment to PRD 1:**
- Remove "Automated testing setup is deferred" from Non-Goals
- Add vitest + Playwright to dependencies
- Add test infrastructure setup: `vitest.config.ts`, `playwright.config.ts`, `src/test/` utilities (setup, db helpers, fixtures, auth mocks), `e2e/helpers/auth.ts`
- Add unit tests for middleware and admin detection
- Add integration tests for auth session callback and lastActiveAt throttling
- Add E2E tests for auth flow and navigation
- Add Phases 7-8 to implementation order

**Amendment to PRD 2:**
- Add integration tests for all resume source API routes (CRUD, validation, compile)
- Add E2E test for resume source wizard (contact → education → experience → skills → preview)
- Remove vitest from dependencies (now in PRD 1)

**Amendment to PRD 3:**
- Add integration tests for application CRUD, move, duplicate, notes, interviews, and column APIs
- Add E2E test for full Kanban board flow (create, edit, drag, close, search, duplicate, notes, stale detection)

**Amendment to PRD 7:**
- Add E2E tests for data export, error boundaries, and toast notifications

---

## Summary of Cross-PRD Changes

| PRD | Amendments |
|---|---|
| PRD 1 | B2 (UTC dates), B7 (Zod), B9 (connection pooling), B11 (test infrastructure) |
| PRD 2 | B11 (integration + E2E tests) |
| PRD 3 | A1 (duplication), A2 (activity timeline), A4 (stale cards + ghosting), B3 (columnType enum), B4 (MAX+1 serial), B5 (movedAt index), B6 (search constraint note), B11 (integration + E2E tests) |
| PRD 4 | A5 (editable markdown), B1 (eliminate Railway), B2 (UTC dates), B10 (cost labels) |
| PRD 5 | A4 (ghosted analytics), B3 (columnType enum references) |
| PRD 6 | B10 (cost labels) |
| PRD 7 | A3 (data export), B8 (apiFetch decoupling), B11 (E2E tests) |
