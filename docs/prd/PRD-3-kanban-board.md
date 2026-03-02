# PRD: Kanban Board

**Version:** 1.0
**Date:** 2026-02-27
**Author:** Product Management
**Status:** Draft
**Project:** Job Seeker -- Job Application Tracker

---

## 1. Introduction / Overview

The Kanban board is the primary interface for tracking job applications through the hiring pipeline. Each card represents a single job application with comprehensive metadata: company, role, compensation details, hiring contacts, dates, the full job description (critical input for PRD 4's resume generation), and interview records.

Users drag cards between columns (Saved, Applied, Screening, Interview, Offer, Closed) to reflect their application's current stage. Each user gets auto-incrementing serial numbers for their applications (starting at 1), a card detail drawer for deep editing, and interview sub-tracking within each application.

This is the most data-dense and interaction-heavy feature in the application. It touches every downstream PRD: resume generation (PRD 4) reads the job description from here, analytics (PRD 5) aggregates this data, and admin (PRD 6) monitors it at the platform level.

---

## 2. Goals

- **Full-fidelity tracking:** Every field specified in the original requirements (serial #, company, role, location, salary, bonus, variable comp, OTE, posting #, hiring manager, org, referrals, dates, URL, comments, JD, rejection date, interviews) shall be captured with zero data loss.
- **Drag-and-drop fluency:** Moving a card between columns shall feel instant (optimistic update, under 100ms visual response) and persist reliably.
- **Under-200-application performance:** The board shall render within 2 seconds for a user with 200 applications (the default cap) spread across 6 columns.
- **Serial number integrity:** Per-user serial numbers shall be unique, monotonically increasing, and never reused (even after deletion).
- **Zero-click board setup:** A new user visiting `/applications` for the first time shall see the default 6 columns with no manual setup required.

### What Success Looks Like

A user visits `/applications` and sees a clean Kanban board with 6 default columns. They click "Add Application", fill in company and role, and a card appears in the Saved column with serial #1. They click the card to open a detail drawer, fill in compensation, paste the job description, and add interview records. They drag the card from Saved to Applied. They add 10 more applications and filter by company name. The board feels fast, the data is complete, and every field persists.

---

## 3. User Stories

### US-1: Default Board Setup

**As a** new user, **I want** the Kanban board to appear pre-configured with default columns on my first visit, **so that** I can start adding applications immediately.

**Acceptance Criteria:**
- [ ] First visit to `/applications` auto-creates 6 columns: Saved, Applied, Screening, Interview, Offer, Closed (in that order)
- [ ] Each column has a distinct default color
- [ ] Subsequent visits load the existing columns (no duplication)

### US-2: Create Application

**As a** user, **I want to** create a new job application via a modal, **so that** I can start tracking a role I am interested in.

**Acceptance Criteria:**
- [ ] "Add Application" button opens a modal dialog
- [ ] Required fields: Company, Role
- [ ] Optional fields visible in the modal: Column (dropdown, defaults to "Saved"), Location Type, Primary Location, Posting URL
- [ ] On save, a card appears in the selected column with an auto-assigned serial number
- [ ] Serial numbers are per-user, start at 1, and increment monotonically
- [ ] All remaining fields are accessible in the detail drawer after creation
- [ ] If the user has reached their application cap, the button is disabled with a tooltip: "Application limit reached ({count}/{cap})"

### US-3: Drag-and-Drop Between Columns

**As a** user, **I want to** drag application cards between columns and reorder them within a column, **so that** my board reflects the current state of each application.

**Acceptance Criteria:**
- [ ] Cards are draggable via a visible drag handle
- [ ] Cards can be dropped into any column, at any position
- [ ] Cards can be reordered within the same column
- [ ] The drop target column highlights during drag-over
- [ ] The move persists on page refresh
- [ ] Optimistic update: the card moves visually before the API call completes
- [ ] On API error, the card reverts to its original position with a toast: "Failed to move application. Please try again."

### US-4: Card Detail Drawer

**As a** user, **I want to** click a card to open a detail drawer with all application fields, **so that** I can view and edit comprehensive details.

**Acceptance Criteria:**
- [ ] Clicking a card opens a slide-in drawer from the right (60% width on desktop, full-width on mobile)
- [ ] A "Status" dropdown at the top of the drawer shows the current column and allows moving to any other column (triggers the same rejection dialog logic as drag-and-drop, and logs to ApplicationStatusLog)
- [ ] All fields are editable inline with auto-save on blur (debounced 1s, scoped per-record; multiple fields changed within 1s batch into one PUT)
- [ ] Fields are organized into collapsible sections: Info, Location, Compensation, People, Dates, Job Description, Comments
- [ ] Computed OTE displays read-only when compensation fields are populated
- [ ] Serial number displays prominently but is not editable
- [ ] "Delete Application" button with confirmation dialog at the bottom
- [ ] "Generate Resume" button present but disabled (enabled in PRD 4)
- [ ] Drawer can be closed via X button, clicking outside, or pressing Escape

### US-5: Compensation and OTE

**As a** user, **I want to** enter salary range, bonus target, and variable comp, and see the computed OTE, **so that** I can compare total compensation across opportunities.

**Acceptance Criteria:**
- [ ] Fields: Salary Min (dollars), Salary Max (dollars), Bonus Target (percentage), Variable Comp (dollars, e.g., RSUs or quota)
- [ ] OTE computed on read: `salaryMax + (salaryMax * bonusTargetPct / 100) + variableComp`
- [ ] OTE displays as formatted currency (e.g., "$222,500") in the detail drawer and on the card
- [ ] If salary max is not set, OTE displays as "--"
- [ ] OTE is never stored in the database

### US-6: Interview Tracking

**As a** user, **I want to** record interviews within each application, **so that** I can track my interview progression and recall details.

**Acceptance Criteria:**
- [ ] "Add Interview" button within the detail drawer's interview section
- [ ] Fields per interview: Type (dropdown: Screening, Hiring Manager, Panel, Technical, Final, Other), Format (dropdown: Virtual, On-site, Phone), People (text, names/roles of interviewers), Date (date picker), Notes (textarea)
- [ ] Interview records display sorted by date ascending (nulls last), then by sortOrder for dateless interviews
- [ ] Each interview can be edited inline and deleted with confirmation
- [ ] Interview count badge visible on the card in the Kanban board

### US-7: Rejection Flow

**As a** user, **I want to** be prompted for a rejection date when moving an application to Closed, **so that** I consistently capture when I was notified of rejection.

**Acceptance Criteria:**
- [ ] Dragging a card to the column with `columnType === "CLOSED"` opens a small dialog: "When were you notified?" with a date picker defaulting to today
- [ ] The same dialog triggers when changing the column via the detail drawer's status dropdown
- [ ] User can confirm (sets rejectionDate) or dismiss (moves card without setting date)
- [ ] Rejection date is also editable in the detail drawer's Dates section
- [ ] If rejectionDate is already set, the dialog does not appear on subsequent moves to the closed column
- [ ] The `columnType === "CLOSED"` flag survives column renames — the dialog is tied to the flag, not the name

### US-8: Search and Filter

**As a** user, **I want to** search and filter my applications, **so that** I can find specific cards on a large board.

**Acceptance Criteria:**
- [ ] Search bar above the board filters cards client-side (all apps loaded in memory on board mount) by company, role, comments, and hiring manager (case-insensitive substring match)
- [ ] Column filter dropdown (multi-select) shows/hides entire columns
- [ ] When filters are active, non-matching cards are hidden (not dimmed)
- [ ] A "Clear filters" button resets all filters
- [ ] Filter state does not persist across page loads
- [ ] No server-side search endpoint needed — the 200-application cap keeps client-side filtering performant

### US-9: Column Management

**As a** user, **I want to** rename, recolor, reorder, and delete columns, **so that** I can customize my workflow.

**Acceptance Criteria:**
- [ ] Each column header has a settings dropdown (kebab menu): Rename, Change Color, Delete
- [ ] Rename: inline text edit in the header
- [ ] Change Color: color picker popover with preset swatches
- [ ] Delete: confirmation dialog; blocked if column contains applications ("Move or delete all applications first"); blocked if it is the last remaining column ("Cannot delete the last column")
- [ ] "Add Column" button at the end of the board creates a new column
- [ ] Columns can be reordered via drag-and-drop of the column header
- [ ] Max 12 columns per user
- [ ] Minimum 1 column enforced — delete is disabled on the last column

### US-10: Duplicate Application

**As a** user, **I want to** duplicate an existing application card, **so that** I can reuse shared details when applying to a similar role.

**Acceptance Criteria:**
- [ ] A "Duplicate" option exists in the card detail drawer's action menu
- [ ] Duplicating creates a new application with a new serial number in the same column
- [ ] Copied fields: company, role, locationType, primaryLocation, additionalLocations, salaryMin, salaryMax, bonusTargetPct, variableComp, hiringOrg, jobDescription, referrals
- [ ] NOT copied: serialNumber (new), hiringManager, postingNumber, postingUrl, datePosted, dateApplied, rejectionDate, closedReason, interviews, notes, resume generations
- [ ] The duplicate opens in the detail drawer immediately for editing
- [ ] Toast: "Application duplicated as #{serial}"
- [ ] Subject to application cap enforcement

### US-11: Stale Card Detection

**As a** user, **I want** cards that haven't had activity to be visually flagged, **so that** I can identify applications that may have gone cold.

**Acceptance Criteria:**
- [ ] "Last activity" for a card is the most recent of: `updatedAt`, latest `ApplicationStatusLog.movedAt`, latest `InterviewRecord.createdAt`, or latest `ApplicationNote.createdAt`
- [ ] Cards inactive for 14+ days: muted/desaturated card background, small clock icon
- [ ] Cards inactive for 30+ days: distinct warm gray background tint, warning icon with tooltip: "No activity for 30+ days. Consider closing this application."
- [ ] Stale indicators do NOT appear on cards in `columnType === "CLOSED"` or `columnType === "OFFER"` columns
- [ ] Staleness is computed client-side from loaded data (no additional API calls)

### US-12: Ghosted Status

**As a** user, **I want to** mark a closed application as "ghosted", **so that** I can distinguish between explicit rejections and no-response outcomes.

**Acceptance Criteria:**
- [ ] When moving a card to the closed column, the rejection dialog includes a "Ghosted (no response)" checkbox
- [ ] If checked, `rejectionDate` is set to today and `closedReason` is set to `"ghosted"`
- [ ] If unchecked, `closedReason` is set to `"rejected"` and the existing date picker behavior applies
- [ ] The detail drawer shows "Ghosted" or "Rejected" label next to the rejection date in the Dates section
- [ ] Analytics (PRD 5) can distinguish ghosted from explicit rejections in the rejection breakdown

---

## 4. Functional Requirements

### Database Schema

- **FR-1:** The following Prisma models shall be added in a migration named `add_kanban`.

**KanbanColumn**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | Yes | `cuid()` | Primary key |
| `userId` | String | Yes | -- | FK to User |
| `name` | String | Yes | -- | Column display name |
| `order` | Int | Yes | -- | Sort position |
| `color` | String | Yes | `"#6366f1"` | Hex color for column indicator |
| `columnType` | String | No | null | One of: `"CLOSED"`, `"OFFER"`, or `null` for user-defined columns. At most one of each type per user. When setting a columnType, clear that type from any existing column for the user first (in a transaction). |
| `createdAt` | DateTime | Yes | `now()` | -- |

Unique constraint: `@@unique([userId, name])` — column names are unique per user.

Relations: `applications` (1:many to JobApplication)

**JobApplication**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | Yes | `cuid()` | Primary key |
| `userId` | String | Yes | -- | FK to User |
| `serialNumber` | Int | Yes | -- | Auto-incremented per user |
| `columnId` | String | Yes | -- | FK to KanbanColumn |
| `columnOrder` | Int | Yes | `0` | Position within column |
| `company` | String | Yes | -- | -- |
| `role` | String | Yes | -- | -- |
| `hiringManager` | String | No | null | -- |
| `hiringOrg` | String | No | null | Hiring organization/department |
| `postingNumber` | String | No | null | Corporate job posting # |
| `postingUrl` | String | No | null | External posting link |
| `locationType` | String | No | null | "Remote", "Hybrid", "On-site" |
| `primaryLocation` | String | No | null | -- |
| `additionalLocations` | String | No | null | Comma-separated |
| `salaryMin` | Int | No | null | In dollars |
| `salaryMax` | Int | No | null | In dollars |
| `bonusTargetPct` | Float | No | null | e.g., 15.0 for 15% |
| `variableComp` | Int | No | null | RSUs, quota, etc. in dollars |
| `referrals` | String (Text) | No | null | Free-text referral names/notes |
| `datePosted` | DateTime | No | null | When the role was posted |
| `dateApplied` | DateTime | No | null | When the user applied |
| `rejectionDate` | DateTime | No | null | When the user was notified of rejection |
| `jobDescription` | String (Text) | No | null | Full JD text for resume generation |
| `closedReason` | String | No | null | `"rejected"` or `"ghosted"`; null if not closed |
| `createdAt` | DateTime | Yes | `now()` | -- |
| `updatedAt` | DateTime | Yes | `@updatedAt` | -- |

Unique constraint: `@@unique([userId, serialNumber])` — serial numbers are unique per user.

Relations: `interviews` (1:many to InterviewRecord), `column` (many:1 to KanbanColumn)

**InterviewRecord**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | Yes | `cuid()` | Primary key |
| `jobApplicationId` | String | Yes | -- | FK to JobApplication |
| `type` | String | Yes | -- | "Screening", "Hiring Manager", "Panel", "Technical", "Final", "Other" |
| `format` | String | Yes | -- | "Virtual", "On-site", "Phone" |
| `people` | String (Text) | No | null | Names/roles of interviewers |
| `date` | DateTime | No | null | Interview date/time |
| `notes` | String (Text) | No | null | -- |
| `sortOrder` | Int | Yes | `0` | -- |
| `createdAt` | DateTime | Yes | `now()` | -- |

**ApplicationStatusLog**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | Yes | `cuid()` | Primary key |
| `jobApplicationId` | String | Yes | -- | FK to JobApplication |
| `fromColumnId` | String | No | null | FK to KanbanColumn; null on initial creation |
| `toColumnId` | String | Yes | -- | FK to KanbanColumn |
| `movedAt` | DateTime | Yes | `now()` | Timestamp of the move |

Relations: `jobApplication` (many:1 to JobApplication)

This log powers PRD 5 analytics (time-in-stage, conversion rates). Every column change — whether via drag-and-drop or the detail drawer's status dropdown — shall append a log entry. The log is append-only (no updates, no deletes).

Index: `@@index([jobApplicationId, movedAt])` — compound index covering the most common query pattern (find the first/last log entry for a given application, ordered by time).

**ApplicationNote**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | Yes | `cuid()` | Primary key |
| `jobApplicationId` | String | Yes | -- | FK to JobApplication |
| `content` | String (Text) | Yes | -- | Note text (max 5,000 chars) |
| `createdAt` | DateTime | Yes | `now()` | -- |

Relations: `jobApplication` (many:1 to JobApplication). `onDelete: Cascade`.

Notes replace the flat `comments` textarea. They form a timestamped activity feed in the detail drawer: newest-first, append-only (notes cannot be edited after creation, only deleted). Max 500 notes per application.

- **FR-2:** Relations to add to the existing `User` model: `kanbanColumns` (1:many) and `jobApplications` (1:many). Add `statusLogs` (1:many) and `notes` (1:many) to the `JobApplication` model.

- **FR-3:** Foreign key cascade rules:
  - User → KanbanColumn: `onDelete: Cascade`
  - User → JobApplication: `onDelete: Cascade`
  - KanbanColumn → JobApplication: `onDelete: Restrict` (column cannot be deleted while it has applications; business logic enforces this before the DB constraint is hit)
  - JobApplication → InterviewRecord: `onDelete: Cascade`
  - JobApplication → ApplicationStatusLog: `onDelete: Cascade`

  Note: When a User is deleted, PostgreSQL cascades to both JobApplication and KanbanColumn. Since JobApplications are deleted first (via direct User cascade), the Restrict on KanbanColumn → JobApplication does not fire.

### Serial Number Assignment

- **FR-4:** Serial number assignment shall use a `MAX(serialNumber) + 1` approach within a serializable transaction, with a retry loop (max 3 attempts) on unique constraint violation:

```typescript
const serial = await prisma.$transaction(async (tx) => {
  const max = await tx.jobApplication.aggregate({
    where: { userId },
    _max: { serialNumber: true },
  });
  return (max._max.serialNumber ?? 0) + 1;
}, {
  isolationLevel: 'Serializable',
});
```

The `@@unique([userId, serialNumber])` constraint prevents duplicates. If a concurrent insert races (nearly impossible in a single-user-per-session app), the constraint violation triggers a retry. Serial numbers shall never be reused. If application #3 is deleted, the next application is still #4.

### Application Cap Enforcement

- **FR-5:** Before creating an application, the system shall check:

```typescript
const count = await prisma.jobApplication.count({ where: { userId } });
if (count >= user.applicationCap && user.role !== "ADMIN") {
  return Response.json({ error: "Application limit reached" }, { status: 403 });
}
```

Admin users bypass this check (per PRD 1 FR-7 — caps bypassed at logic layer).

- **FR-5a:** When creating or moving an application, the API shall validate that the provided `columnId` belongs to the current user. This prevents associating an application with another user's column via a guessed CUID.

### Default Column Seeding

- **FR-6:** When `GET /api/kanban/columns` returns zero columns for a user, the system shall auto-create the 6 default columns in a single transaction. The seeding shall use `createMany` with `skipDuplicates: true` (or equivalent) to handle the edge case of two concurrent requests both detecting zero columns:

| Name | Order | Color |
|---|---|---|
| Name | Order | Color | columnType |
|---|---|---|---|
| Saved | 0 | `#6366f1` (Indigo) | null |
| Applied | 1 | `#3b82f6` (Blue) | null |
| Screening | 2 | `#f59e0b` (Amber) | null |
| Interview | 3 | `#8b5cf6` (Violet) | null |
| Offer | 4 | `#22c55e` (Green) | `"OFFER"` |
| Closed | 5 | `#ef4444` (Red) | `"CLOSED"` |

### OTE Computation

- **FR-7:** OTE shall be computed on read, never stored:

```typescript
export function computeOTE(app: {
  salaryMax: number | null;
  bonusTargetPct: number | null;
  variableComp: number | null;
}): number | null {
  if (app.salaryMax == null) return null;
  const bonus = app.bonusTargetPct ? app.salaryMax * (app.bonusTargetPct / 100) : 0;
  const variable = app.variableComp ?? 0;
  return app.salaryMax + bonus + variable;
}
```

### API Routes

- **FR-8:** The following API routes shall be created. All routes verify the session via `auth()` (defense in depth, per PRD 2 FR-5) and scope queries to the current user.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/kanban/columns` | Fetch all columns with nested applications (ordered by `order` and `columnOrder`) |
| `POST` | `/api/kanban/columns` | Create a new column |
| `PUT` | `/api/kanban/columns/[id]` | Update column (name, color) |
| `DELETE` | `/api/kanban/columns/[id]` | Delete column (fails with 409 if column has applications) |
| `PUT` | `/api/kanban/columns/reorder` | Reorder columns; body: `{ ids: string[] }` |
| `POST` | `/api/kanban/applications` | Create application (auto-assigns serial #, enforces cap) |
| `GET` | `/api/kanban/applications/[id]` | Fetch single application with interviews |
| `PUT` | `/api/kanban/applications/[id]` | Update application fields |
| `DELETE` | `/api/kanban/applications/[id]` | Delete application (cascades to interviews) |
| `PUT` | `/api/kanban/applications/move` | Move card; body: `{ id, columnId, newOrder }` |
| `POST` | `/api/kanban/applications/[id]/interviews` | Add interview record |
| `PUT` | `/api/kanban/applications/[id]/interviews/[intId]` | Update interview |
| `DELETE` | `/api/kanban/applications/[id]/interviews/[intId]` | Delete interview |
| `POST` | `/api/kanban/applications/[id]/duplicate` | Duplicate application (new serial #, copied fields) |
| `POST` | `/api/kanban/applications/[id]/notes` | Add a note |
| `DELETE` | `/api/kanban/applications/[id]/notes/[noteId]` | Delete a note |

**Example request — create application:**
```json
POST /api/kanban/applications
{
  "company": "Acme Corp",
  "role": "Senior PM",
  "columnId": "clx1abc...",
  "locationType": "Remote",
  "primaryLocation": "San Francisco, CA",
  "postingUrl": "https://acme.com/jobs/123"
}
```

**Example response:**
```json
{
  "id": "clx2def...",
  "serialNumber": 1,
  "company": "Acme Corp",
  "role": "Senior PM",
  "columnId": "clx1abc...",
  "columnOrder": 0,
  ...
}
```

**Example request — move card:**
```json
PUT /api/kanban/applications/move
{
  "id": "clx2def...",
  "columnId": "clx1ghi...",
  "newOrder": 2
}
```

The move endpoint shall update the target card's `columnId` and `columnOrder`, recompute `columnOrder` for affected cards in both columns, and append an `ApplicationStatusLog` entry — all in a single transaction.

**Search:** Performed client-side by filtering the already-loaded application data. No server-side search endpoint. The search function in `kanban-utils.ts` filters applications where company, role, comments, or hiringManager contain the query string (case-insensitive substring match).

### Drag-and-Drop

- **FR-9:** The board shall use `@hello-pangea/dnd` with a `DragDropContext` wrapping the entire board. Each column is a `Droppable`, each card is a `Draggable`. Column headers are also draggable for reordering columns.

- **FR-10:** On drop, the frontend shall:
  1. Optimistically update local state (move card in the UI immediately)
  2. Call `PUT /api/kanban/applications/move` with the new `columnId` and `newOrder`
  3. On success: no further action
  4. On failure: revert local state to pre-drop position, show error toast

- **FR-11:** Touch support: `@hello-pangea/dnd` supports touch events natively. No additional configuration required.

### Auto-Date Population

- **FR-12:** When an application is moved to the column named "Applied" (case-insensitive match) — via drag-and-drop or the detail drawer's status dropdown — and `dateApplied` is null, the system shall auto-set `dateApplied` to the current date. No prompt is shown; the date is set silently. The user can edit it in the detail drawer.

- **FR-13:** Similarly, when the initial column selection during creation is "Applied", `dateApplied` shall be set to the creation date.

---

## 5. Non-Goals (Out of Scope)

- **Resume generation from JD:** The "Generate Resume" button is present but disabled. Enabled in PRD 4.
- **Analytics derived from this data:** PRD 5 reads from these tables but no analytics UI here.
- **Admin viewing other users' applications:** PRD 6.
- **Email/push notifications for application status changes**
- **Bulk import of applications from CSV or other sources**
- **Bulk actions (e.g., move all cards in a column, delete multiple)**
- **Application archiving (soft delete):** Delete is permanent.
- **Custom field definitions:** The field set is fixed per the requirements.
- **Calendar integration for interview dates**
- **Attachment/file upload on applications**
- **Kanban swimlanes or grouping beyond columns**

---

## 6. Design Considerations

### User Interface

**Kanban Board (desktop):**
```
+----------------------------------------------------------+
| [Nav Bar]                                                |
+----------------------------------------------------------+
| [Search...        ] [Columns v] [Clear]  [+ Application] |
+----------------------------------------------------------+
| Saved (3)  | Applied (5)| Screening | Interview | Offer  |
| #6366f1    | #3b82f6    | #f59e0b   | #8b5cf6   | ...    |
+------------+------------+-----------+-----------+--------+
| +--------+ | +--------+ |           | +--------+|        |
| |#1 Acme | | |#2 Beta | |           | |#4 Delta||        |
| |Snr PM  | | |Eng Mgr | |           | |Analyst ||        |
| |Remote  | | |$180-220k| |           | |2 intv  ||        |
| |$222.5k | | |         | |           | |        ||        |
| +--------+ | +--------+ |           | +--------+|        |
| +--------+ | +--------+ |           |           |        |
| |#3 Gamma| | |#5 Epsilon|           |           |        |
| |Dir Ops | | |...      | |           |           |        |
| +--------+ | +--------+ |           |           |        |
+------------+------------+-----------+-----------+--------+
```

Board scrolls horizontally when columns exceed viewport width.

**Mobile Layout (below 768px):**
- Columns scroll horizontally with CSS scroll-snap (snap to column start)
- Each column is full viewport width minus padding
- Swipe left/right to navigate between columns
- Current column indicator dots below the board
- Drag-and-drop works via touch (long-press to lift); `@hello-pangea/dnd` handles the touch/scroll distinction natively

**Application Card:**
```
+-------------------------------+
| [drag] #1                     |
| Acme Corp                     |
| Senior Product Manager        |
| Remote | $222,500 OTE         |
| [2 interviews]                |
+-------------------------------+
```

Card shows: serial # badge (top-right), company (bold), role, location type, compensation, interview count badge. Left border colored to match column.

**Compensation display priority on card:**
1. If OTE is computable (salaryMax exists): show OTE (e.g., "$222,500 OTE")
2. Else if salary range exists: show range (e.g., "$180k-$220k")
3. Else: show nothing for compensation

**Card Detail Drawer:**
```
+------------------------------------------+
| Application #1                     [X]   |
+------------------------------------------+
| Status: [Applied        v]              |
| Company: [Acme Corp              ]       |
| Role:    [Senior Product Manager ]       |
+------------------------------------------+
| > Info                                   |
|   Posting #: [JP-2026-123       ]        |
|   Posting URL: [https://...     ]        |
|   Hiring Manager: [Jane Smith   ]        |
|   Hiring Org: [Product          ]        |
|   Referrals: [John Doe - VP Eng ]        |
+------------------------------------------+
| > Location                               |
|   Type: (Remote) (Hybrid) (On-site)      |
|   Primary: [San Francisco, CA   ]        |
|   Additional: [New York, Austin ]        |
+------------------------------------------+
| > Compensation                           |
|   Salary: [$180,000] - [$220,000]        |
|   Bonus Target: [15] %                   |
|   Variable Comp: [$50,000]               |
|   OTE: $222,500                          |
+------------------------------------------+
| > Dates                                  |
|   Posted: [2026-01-15]                   |
|   Applied: [2026-02-01]                  |
|   Rejected: [--]                         |
+------------------------------------------+
| > Job Description                        |
|   [Large textarea...                ]    |
+------------------------------------------+
| > Comments                               |
|   [Textarea...                      ]    |
+------------------------------------------+
| > Interviews (2)                         |
|   +------------------------------------+ |
|   | Screening | Virtual | 2026-02-10   | |
|   | Jane Smith, HR                     | |
|   +------------------------------------+ |
|   | HM Interview | On-site | 2026-02-20| |
|   | Bob Lee, VP Product                | |
|   +------------------------------------+ |
|   [+ Add Interview]                     |
+------------------------------------------+
| [Generate Resume (disabled)]             |
| [Delete Application]                     |
+------------------------------------------+
```

**Components to create:**

| Component | Purpose |
|---|---|
| `src/components/kanban/kanban-board.tsx` | Board layout with DragDropContext |
| `src/components/kanban/kanban-column.tsx` | Single column with Droppable zone |
| `src/components/kanban/column-header.tsx` | Column name, count, color, settings menu |
| `src/components/kanban/application-card.tsx` | Compact card with key fields |
| `src/components/kanban/create-application-modal.tsx` | Modal for new application |
| `src/components/kanban/application-detail-drawer.tsx` | Full detail slide-in drawer |
| `src/components/kanban/interview-form.tsx` | Interview CRUD within the drawer |
| `src/components/kanban/search-filter-bar.tsx` | Search input + column filter |
| `src/components/kanban/rejection-dialog.tsx` | Date prompt on move to Closed |
| `src/components/kanban/column-settings-menu.tsx` | Rename, recolor, delete menu |

### User Experience

**Journey 1: Create First Application**
1. User visits `/applications`; default columns are auto-created
2. User clicks "Add Application"; modal opens
3. User enters "Acme Corp" and "Senior PM", selects "Saved" column, clicks Save
4. Card appears in Saved column with serial #1
5. User clicks the card; detail drawer opens
6. User fills in salary, bonus, JD, and other fields; each saves on blur

**Journey 2: Move Application Through Pipeline**
1. User drags card #1 from Saved to Applied
2. Card snaps into Applied column instantly (optimistic update)
3. Later, user drags from Applied to Screening, then to Interview
4. User drags from Interview to Closed; rejection dialog appears
5. User enters rejection date; card lands in Closed

**Journey 3: Search for an Application**
1. User types "acme" in the search bar
2. Only cards matching "acme" remain visible
3. User clicks "Clear" to restore all cards

**Loading States:**
- Board initial load: skeleton columns (3 column outlines with 2-3 card placeholder rectangles each)
- Card detail drawer: skeleton field rows until data loads
- Application creation: "Creating..." button state, card appears on success

**Error States:**
- Move failure: card reverts to original position, toast "Failed to move. Please try again."
- Save failure in drawer: field reverts, toast "Failed to save."
- Application cap reached: "Add Application" button disabled with tooltip
- Column delete blocked: toast "Move or delete all applications in this column first."
- Network error: persistent banner "You appear to be offline. Changes may not save."

### Accessibility

- All interactive elements keyboard-navigable
- Drag-and-drop: `@hello-pangea/dnd` provides keyboard mode (Space to lift, arrows to move, Space to drop)
- Card detail drawer: focus trapped while open; focus returns to card on close
- Column settings menu: `aria-haspopup="menu"`, keyboard-navigable menu items
- Search input: `role="search"`, `aria-label="Search applications"`
- Card interview count: `aria-label="2 interviews recorded"`
- WCAG 2.1 AA contrast for all text and interactive elements
- Column colors are supplementary — column names provide the primary identification

---

## 7. Technical Considerations

### Architecture

This feature adds 3 Prisma models and the most API routes of any PRD. The drag-and-drop library (`@hello-pangea/dnd`) manages all interaction; the backend is a straightforward CRUD API with a move endpoint that handles cross-column reordering in a transaction.

**New backend files:**

| File | Purpose |
|---|---|
| `src/app/api/kanban/columns/route.ts` | GET (list + auto-seed), POST (create) |
| `src/app/api/kanban/columns/[id]/route.ts` | PUT (update), DELETE (restricted) |
| `src/app/api/kanban/columns/reorder/route.ts` | PUT (reorder) |
| `src/app/api/kanban/applications/route.ts` | POST (create with serial #) |
| `src/app/api/kanban/applications/[id]/route.ts` | GET, PUT, DELETE |
| `src/app/api/kanban/applications/move/route.ts` | PUT (move card) |
| `src/app/api/kanban/applications/[id]/interviews/route.ts` | POST |
| `src/app/api/kanban/applications/[id]/interviews/[intId]/route.ts` | PUT, DELETE |
| `src/lib/kanban-utils.ts` | OTE computation, serial # logic, client-side search filter |

**New frontend files:**

| File | Purpose |
|---|---|
| `src/app/applications/page.tsx` | Kanban board page (replaces placeholder) |
| `src/components/kanban/kanban-board.tsx` | Board with DragDropContext |
| `src/components/kanban/kanban-column.tsx` | Column with Droppable |
| `src/components/kanban/column-header.tsx` | Header with settings |
| `src/components/kanban/application-card.tsx` | Compact card |
| `src/components/kanban/create-application-modal.tsx` | Create modal |
| `src/components/kanban/application-detail-drawer.tsx` | Detail drawer |
| `src/components/kanban/interview-form.tsx` | Interview CRUD |
| `src/components/kanban/search-filter-bar.tsx` | Search + filter |
| `src/components/kanban/rejection-dialog.tsx` | Rejection date prompt |
| `src/components/kanban/column-settings-menu.tsx` | Column management |

**Modified files:**

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add KanbanColumn, JobApplication, InterviewRecord models + User relations |
| `src/app/applications/page.tsx` | Replace placeholder with Kanban board |

### Data

Migration name: `add_kanban`

Key indexes:
- `KanbanColumn.[userId, name]` — unique compound (auto from `@@unique`)
- `JobApplication.[userId, serialNumber]` — unique compound (auto from `@@unique`)
- `JobApplication.columnId` — for efficient column-based queries
- `JobApplication.userId` — for user-scoped queries and aggregations
- `InterviewRecord.jobApplicationId` — for nested queries

**Example query — fetch board:**
```typescript
const columns = await prisma.kanbanColumn.findMany({
  where: { userId },
  orderBy: { order: "asc" },
  include: {
    applications: {
      orderBy: { columnOrder: "asc" },
      include: { _count: { select: { interviews: true } } },
    },
  },
});
```

### APIs

See FR-8 for the complete endpoint table.

Response conventions:
- Success: HTTP 200 (GET/PUT), 201 (POST), 204 (DELETE)
- Not found: HTTP 404
- Forbidden (wrong user): HTTP 403
- Validation error: HTTP 400 with `{ error: "description" }`
- Conflict (column has apps): HTTP 409 with `{ error: "Column is not empty" }`
- Cap exceeded: HTTP 403 with `{ error: "Application limit reached", count, cap }`

### Performance

- Board load (GET columns + apps): under 2 seconds for 200 applications across 6 columns
- Drag-and-drop visual response: under 100ms (optimistic, no API wait)
- Move API round-trip: under 300ms
- Client-side search filter: under 50ms for 200 applications
- Card detail load (GET single app + interviews): under 200ms
- Database: add index on `JobApplication.columnId` for the column-grouped query
- Board data fetched once on page load; no polling. Stale data is acceptable (single-user app per session).

---

## 8. Security and Privacy

### Authentication & Authorization

- All routes verify session via `auth()` (defense in depth)
- All queries filter by `userId = session.user.id`
- Column uniqueness scoped to user (`@@unique([userId, name])`)
- Serial numbers scoped to user (`@@unique([userId, serialNumber])`)
- Application cap enforced at creation time, admin bypass in business logic

### Input Validation

| Field | Validation |
|---|---|
| `company` | Required, max 200 chars |
| `role` | Required, max 200 chars |
| `hiringManager`, `hiringOrg`, `postingNumber` | Optional, max 200 chars |
| `postingUrl` | Optional; if provided, must start with `http://` or `https://` |
| `locationType` | Optional; if provided, must be one of: "Remote", "Hybrid", "On-site" |
| `primaryLocation`, `additionalLocations` | Optional, max 500 chars |
| `salaryMin`, `salaryMax` | Optional; if provided, must be non-negative integers; salaryMax >= salaryMin if both set. Input accepts digits only with live currency formatting (e.g., typing "150000" displays as "$150,000"). Stored as integer. |
| `bonusTargetPct` | Optional; if provided, must be 0-100 |
| `variableComp` | Optional; if provided, must be non-negative integer |
| `jobDescription`, `referrals` | Optional, max 50,000 chars |
| Note `content` | Required, max 5,000 chars. Max 500 notes per application. |
| `closedReason` | Optional; if provided, must be `"rejected"` or `"ghosted"` |
| `datePosted`, `dateApplied`, `rejectionDate` | Optional, valid ISO 8601 date |
| Interview `type` | Required; must be one of: Screening, Hiring Manager, Panel, Technical, Final, Other |
| Interview `format` | Required; must be one of: Virtual, On-site, Phone |
| Interview `people`, `notes` | Optional, max 2,000 chars |
| Column `name` | Required, max 50 chars |
| Column `color` | Required, valid hex color (`/^#[0-9a-fA-F]{6}$/`) |

### Sensitive Data

- Job descriptions may contain proprietary company information. They shall not be exposed to other users.
- All data is user-scoped — no cross-user access paths exist in the API.

---

## 9. Testing Strategy

### Unit Tests (vitest)

**OTE Computation (`src/lib/__tests__/kanban-utils.test.ts`):**
- salaryMax=150000, bonusTargetPct=15, variableComp=50000 → OTE=222500
- salaryMax=200000, bonusTargetPct=null, variableComp=null → OTE=200000
- salaryMax=null → OTE=null
- salaryMax=100000, bonusTargetPct=0, variableComp=0 → OTE=100000

**Serial Number Logic:**
- First application for a user → serial #1
- Third application (after #1 and #2 exist) → serial #3
- After deleting #2, next application → serial #4 (not #2)

### Integration Tests (vitest)

**Application CRUD (`src/app/api/kanban/applications/__tests__/route.test.ts`):**
- Create application → returns record with auto-assigned serial number
- Create 3 applications → serial #1, #2, #3 (monotonically increasing)
- Delete #2, create another → serial #4 (not #2)
- Create application at cap → 403
- Admin at cap → allowed (bypass)
- Unauthenticated → 401
- User cannot access another user's applications → 403

**Move API (`src/app/api/kanban/applications/[id]/move/__tests__/route.test.ts`):**
- Move card to different column → columnId and order updated, ApplicationStatusLog created
- Move card to closed column → rejection dialog data captured (rejectionDate, closedReason)
- Move card to same position → no-op, no status log created
- Move non-existent card → 404

**Duplicate API (`src/app/api/kanban/applications/[id]/duplicate/__tests__/route.test.ts`):**
- Duplicate application → new serial number, copied fields match, excluded fields are null/empty
- Duplicate at cap → 403

**Notes API (`src/app/api/kanban/applications/[id]/notes/__tests__/route.test.ts`):**
- Add note → returns note with timestamp
- Add note exceeding 5,000 chars → 400
- Delete note → removed from list
- Delete note belonging to another user → 403

**Interview CRUD (`src/app/api/kanban/interviews/__tests__/route.test.ts`):**
- Add interview to application → returned in application detail
- Delete interview → removed, application unaffected
- Add interview to another user's application → 403

**Column CRUD (`src/app/api/kanban/columns/__tests__/route.test.ts`):**
- Create column → correct order
- Reorder columns → new order persists
- Delete column with applications → applications reassigned or blocked (per business rules)
- Default column seeding on first visit → 6 columns with correct columnType values

### E2E Tests (Playwright)

**Kanban Board (`e2e/kanban.spec.ts`):**
- Navigate to `/applications` → 6 default columns render
- Create application → card appears in column with serial #1, toast confirms
- Open card detail → drawer shows all fields, editable
- Edit fields in detail drawer → changes persist on refresh
- Delete application → card removed, toast confirms
- Drag card from "Saved" to "Applied" → card moves, persists on refresh
- Drag card to "Closed" → closure dialog appears with rejection/ghosted options
- Select "Ghosted" → closedReason set, card shows "Ghosted" label
- Search "acme" → only matching cards visible
- Clear search → all cards visible
- Add interview from detail drawer → interview appears in list
- Add note from detail drawer → note appears with timestamp
- Duplicate application → new card appears with new serial number, toast confirms
- Stale card detection → card inactive for 14+ days shows muted styling (seeded test data)

### Manual Verification

**Drag-and-Drop Edge Cases (visual verification):**
- Reorder cards within a column → new order persists
- Reorder columns → new column order persists
- Simulate API failure (disconnect network) → card reverts, toast shows

**Cap Enforcement:**
- Set applicationCap to 3 → after 3 apps, "Add Application" button is disabled with tooltip

### Edge Cases

- User has 200 applications (max cap) spread across 6 columns — board renders within 2 seconds
- User drags a card but drops it in the same position — no API call made
- Two rapid successive drags — each resolves correctly (no race condition due to optimistic update + sequential API calls)
- Column with 0 applications — renders as empty droppable area with "Drag cards here" hint
- Application with no optional fields — card shows only company, role, and serial #
- Very long company/role names (200 chars) — card truncates with ellipsis
- User deletes all columns — this is allowed; board shows "Add Column" prompt. (Default columns are only seeded on first visit when 0 columns exist.)

---

## 10. Dependencies and Assumptions

### Dependencies

**New libraries to install:**

None new. `@hello-pangea/dnd` is installed from PRD 2.

**Existing dependencies (from PRDs 1-2):**
- Next.js 15, React, TypeScript, Tailwind CSS, shadcn/ui, Prisma, Auth.js v5, `@hello-pangea/dnd`, vitest

**shadcn/ui components to add:**
`sheet` (drawer), `dialog`, `select`, `calendar`, `popover`, `badge`, `input`, `textarea`, `label`, `tooltip`

### Assumptions

- PRD 1 and PRD 2 are fully implemented (auth, middleware, Prisma client, `@hello-pangea/dnd` installed)
- The Prisma schema can be extended additively (new models + User relations) without breaking existing PRD 2 tables
- `@hello-pangea/dnd` supports both card-level and column-level drag-and-drop in the same `DragDropContext` (using `type` prop to differentiate)

### Known Constraints

- `@hello-pangea/dnd` does not support nested drag contexts in the same tree. Column reorder and card reorder use different `type` values within a single `DragDropContext`, which is supported.
- The `columnOrder` recomputation on move requires updating multiple records per move. For a column with 200 cards, this means 200 UPDATEs in the worst case. In practice, the implementer should use a gap-based ordering strategy (e.g., order values 0, 1024, 2048...) to minimize recomputation to only the moved card in most cases.
- PostgreSQL advisory locks or serializable transactions may be needed if concurrent moves cause order conflicts. Given this is a single-user-per-session app, this is unlikely but worth noting.
- The 200-application cap is a product decision (controlling platform scope for hobby tier), not solely a technical limitation. If the cap is raised in the future, client-side search should be replaced with server-side search + pagination via a `GET /api/kanban/applications?q=&column=&page=` endpoint. The current client-side approach is intentionally simple for the R1 scope.

---

## 11. Success Metrics

### Quantitative Metrics

| Metric | Target | How to Measure |
|---|---|---|
| Board render time (200 apps) | Under 2 seconds | Browser devtools performance tab |
| Drag-and-drop visual response | Under 100ms | Visual observation / devtools |
| Move API round-trip | Under 300ms | Network tab |
| Card detail load | Under 200ms | Network tab |
| Serial number correctness | 100% unique per user | Query `SELECT userId, serialNumber, COUNT(*) ... GROUP BY ... HAVING COUNT(*) > 1` returns 0 rows |
| Application cap enforcement | 100% enforced for USER role | Attempt create at cap → 403 |

### Qualitative Metrics

| Metric | How to Assess |
|---|---|
| Drag-and-drop feels natural | No jank, no unexpected snapping, touch works on mobile |
| Detail drawer is comprehensive | All fields from requirements are present and editable |
| Board is scannable | User can identify an application's status at a glance from the card |
| OTE display is useful | Users can compare compensation across cards without opening drawers |

---

## 12. Implementation Order

| Phase | Scope | Risk Level | Verification |
|---|---|---|---|
| **Phase 1** | Prisma schema: KanbanColumn, JobApplication, InterviewRecord + migration | Low | `npx prisma migrate dev` succeeds; `prisma studio` shows new tables |
| **Phase 2** | API: columns CRUD + default seeding | Low | cURL: GET returns 6 default columns; POST/PUT/DELETE work |
| **Phase 3** | API: application CRUD + serial # + cap enforcement | Medium | cURL: create apps, verify serial #s, hit cap |
| **Phase 4** | API: move endpoint + interview CRUD + search | Medium | cURL: move cards, add interviews, search by query |
| **Phase 5** | Frontend: board layout with columns + cards (static, no drag) | Medium | Board renders with data from API |
| **Phase 6** | Frontend: drag-and-drop (card move, column reorder) | High | Drag works, optimistic update + revert on failure |
| **Phase 7** | Frontend: create modal, detail drawer, interview form | Medium | All CRUD works from the UI |
| **Phase 8** | Frontend: search/filter bar, rejection dialog, column settings | Low | Search filters cards, rejection dialog fires, columns manageable |

---

## Clarifying Questions

*All questions from the review cycle have been resolved. Decisions are incorporated into the PRD above:*

- **Serial number safety:** Database-level per-user sequence (FR-4)
- **Closed column identity:** `columnType === "CLOSED"` boolean flag on KanbanColumn schema, survives renames (FR-1, US-7)
- **Status transition log:** ApplicationStatusLog model added now for PRD 5 analytics (FR-2)
- **Drawer status dropdown:** Included — users can change column from the drawer (US-4)
- **Search mode:** Client-side filtering only; no server-side search endpoint (US-8)
- **Mobile layout:** Horizontal scroll with CSS snap-to-column (Section 6)
- **Auto-date on Applied:** dateApplied auto-set to today when moved to Applied (FR-12)
- **Card compensation display:** OTE if computable, else salary range, else nothing (Section 6)
- **Interview sort:** By date ascending (nulls last), then sortOrder (US-6)
- **Minimum columns:** Enforced — cannot delete the last column (US-9)
- **Salary input:** Raw digits with live currency formatting (Section 8)

**Remaining open (implementer's discretion):**
- Q2: Column pinning — suggest fully flexible (no pinning)
- Q3: Activity log in drawer — suggest deferring; the ApplicationStatusLog table stores the data but no UI for it in this PRD
- Q5: Compact card view — suggest deferring to a later polish pass
