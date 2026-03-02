# PRD: Admin Panel

**Version:** 1.0
**Date:** 2026-03-02
**Author:** Product Management
**Status:** Draft
**Project:** Job Seeker -- Job Application Tracker

---

## 1. Introduction / Overview

The admin panel gives the platform operator (`paul.alex.rudd@gmail.com` and any future admins) visibility into platform health, user activity, and API costs. As users sign up and generate resumes, the operator needs to monitor utilization, adjust per-user caps, and track estimated Anthropic API spend -- all without direct database access.

This feature is admin-only. It reuses the charting patterns established in PRD 5 (recharts, shadcn/ui cards) and queries existing data models -- no new tables are needed. The panel has three tabs: Overview (platform stats + DAU/MAU), Users (user management table with inline limit editing), and Generations (resume generation volume + cost tracking).

---

## 2. Goals

- **Platform visibility:** Admin shall see total users, applications, generations, and estimated API spend at a glance.
- **User management:** Admin shall view all users with their usage stats and adjust per-user caps (application cap, resume generation cap) inline.
- **Cost tracking:** Admin shall see daily generation volume, cumulative cost, and top users by cost -- enabling budget decisions.
- **Activity monitoring:** Admin shall see DAU/MAU trends to understand engagement.
- **Access control:** All admin routes and pages shall be inaccessible to non-admin users, returning 403 or redirecting.

### What Success Looks Like

The admin navigates to `/admin`. A tab bar shows Overview, Users, and Generations. The Overview tab shows four summary cards (total users, total applications, total generations, estimated spend) and a DAU/MAU chart for the last 30 days. The Users tab shows a searchable, paginated table of all users with their caps, usage, cost, and last active date. The admin clicks a user row to expand inline limit editing, changes the resume generation cap from 5 to 10, and saves. The Generations tab shows a daily generation bar chart, a cumulative cost line, and a top-10 users table ranked by cost.

---

## 3. User Stories

### US-1: View Platform Overview

**As an** admin, **I want to** see headline platform metrics, **so that** I can assess overall health at a glance.

**Acceptance Criteria:**
- [ ] Overview tab shows four summary cards: Total Users, Total Applications, Total Generations, Est. Total Spend (USD)
- [ ] All cost figures throughout the admin panel are prefixed with "Est." (e.g., "Est. $43.28")
- [ ] A DAU/MAU chart shows daily active users over the last 30 days
- [ ] A separate MAU number shows monthly active users for the current month
- [ ] All numbers match database aggregates exactly

### US-2: View and Search Users

**As an** admin, **I want to** see all registered users with their usage stats, **so that** I can identify heavy users and manage limits.

**Acceptance Criteria:**
- [ ] Users tab shows a data table with columns: Name, Email, Role, Apps (used/cap), Resumes This Month (used/cap), All-Time Resumes, Est. Cost, Last Active, Joined
- [ ] A search bar filters users by name or email (case-insensitive, partial match)
- [ ] The table is paginated at 20 rows per page
- [ ] Clicking a row expands inline to show the limit editor
- [ ] Admin's own row shows "Unlimited" for caps

### US-3: Adjust User Limits

**As an** admin, **I want to** change a user's application cap or resume generation cap, **so that** I can grant more access to power users or restrict abusive accounts.

**Acceptance Criteria:**
- [ ] Clicking a user row reveals an inline form with Application Cap and Resume Generation Cap number inputs
- [ ] Inputs show the current cap value as default
- [ ] Next to each input, the current usage is displayed for context (e.g., "142 / 200 used")
- [ ] Save validates: caps must be positive integers >= 1 and <= 10,000
- [ ] Setting a cap below current usage is allowed -- the user keeps existing data but cannot create new items until they are under the cap
- [ ] Save updates the user record immediately and the table row refreshes
- [ ] Cancel closes the editor without changes
- [ ] Success toast: "Limits updated for {name}"
- [ ] The admin cannot edit their own caps (self-edit returns error)
- [ ] Editing another admin's caps is allowed (values stored but have no effect on admin users)

### US-4: View Generation Analytics

**As an** admin, **I want to** see resume generation volume and cost trends, **so that** I can forecast API spend and identify cost anomalies.

**Acceptance Criteria:**
- [ ] Generations tab shows:
  - Summary cards: Total Generations (all-time), Total Tokens (all-time), Est. Total Cost (all-time)
  - Generations per day bar chart (last 30 days trend)
  - Cumulative cost line chart (last 30 days trend)
  - Top 10 users by total cost (all-time) table: Name, Email, Generations, Total Tokens, Est. Cost
- [ ] Charts use the same recharts patterns as PRD 5
- [ ] Cost is displayed as USD with 2 decimal places, prefixed with "Est." (e.g., "Est. $5.43")
- [ ] The Generations tab includes a small info tooltip next to the cost summary: "Costs are estimated from token counts and configured rates. Compare against your Anthropic invoice for actual billing."

### US-5: Admin Access Control

**As the** system, **I need to** restrict the admin panel to admin users only, **so that** regular users cannot access sensitive platform data.

**Acceptance Criteria:**
- [ ] Navigating to `/admin` as a non-admin user redirects to `/applications` (the Kanban board)
- [ ] Calling any `/api/admin/*` endpoint as a non-admin returns 403
- [ ] The "Admin" nav link is only visible to admin users
- [ ] Admin middleware checks `session.user.role === "ADMIN"` on every request

---

## 4. Functional Requirements

### Database

No new models or migrations. All data comes from existing tables:

- **FR-0:** Add `@@index([lastActiveAt])` to the User model for efficient DAU/MAU queries. Migration name: `add_last_active_at_index`. (This is the only schema change in this PRD.)

- **FR-1:** Platform stats are derived from `User`, `JobApplication`, and `ResumeGeneration` tables via aggregate queries. All queries are unscoped (global, not per-user) since the admin sees platform-wide data.

### API Routes

- **FR-2:** All admin API routes shall check `session.user.role === "ADMIN"` after `auth()`. Non-admin users receive `403 { error: "Forbidden" }`.

- **FR-3:** The following API routes shall be created:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/stats` | Platform summary: total users, apps, generations, spend, DAU, MAU |
| `GET` | `/api/admin/stats/generations` | Generation volume + cost over last 30 days, top users |
| `GET` | `/api/admin/users` | Paginated user list with usage stats; query params: `?page=1&limit=20&search=&sort=createdAt&order=desc` |
| `GET` | `/api/admin/users/[id]` | Single user detail with full stats |
| `PUT` | `/api/admin/users/[id]/limits` | Update user caps; body: `{ applicationCap?, resumeGenerationCap? }` |

### Platform Stats Endpoint

- **FR-4:** `GET /api/admin/stats` returns:

```typescript
interface AdminStatsResponse {
  totalUsers: number;
  totalApplications: number;
  totalGenerations: number;
  estimatedTotalSpend: number; // USD, sum of ResumeGeneration.estimatedCost
  dauToday: number; // Users with lastActiveAt >= start of today (UTC)
  mauThisMonth: number; // Users with lastActiveAt >= start of current month (UTC)
  dauOverTime: Array<{
    date: string; // ISO date
    count: number;
  }>; // Last 30 days
}
```

DAU is computed from `User.lastActiveAt`. This field is updated on each authenticated request (throttled to once per hour to avoid excessive writes -- implemented in PRD 1's middleware).

The `dauOverTime` array shall be **zero-filled by the backend**: all 30 days are returned, including days with `count: 0`. The frontend renders directly without gap-filling logic. Similarly, the `generationsByDay` array in FR-5 shall be zero-filled for the 30-day range.

Cost values (`estimatedTotalSpend`, per-user `estimatedTotalCost`) are computed from the stored `estimatedCost` field on ResumeGeneration, which is immutable once saved. Historical costs are not retroactively recalculated if token pricing changes.

### Generation Stats Endpoint

- **FR-5:** `GET /api/admin/stats/generations` returns:

```typescript
interface AdminGenerationStatsResponse {
  totalGenerations: number;
  totalTokens: number; // sum of totalTokens
  estimatedTotalCost: number; // USD
  generationsByDay: Array<{
    date: string; // ISO date
    count: number;
    cost: number;
  }>; // Last 30 days
  topUsersByCost: Array<{
    userId: string;
    name: string;
    email: string;
    generationCount: number;
    totalTokens: number;
    estimatedCost: number;
  }>; // Top 10, ordered by cost descending
}
```

### User List Endpoint

- **FR-6:** `GET /api/admin/users` returns a paginated list:

```typescript
interface AdminUsersResponse {
  users: Array<{
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: "USER" | "ADMIN";
    applicationCap: number;
    applicationCount: number; // COUNT of their JobApplications
    resumeGenerationCap: number;
    resumeGenerationsUsedThisMonth: number;
    totalResumeGenerations: number; // all-time COUNT
    estimatedTotalCost: number; // all-time SUM of their ResumeGeneration.estimatedCost
    lastActiveAt: string; // ISO datetime
    createdAt: string; // ISO datetime
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

The `search` query parameter filters by `name ILIKE %search%` OR `email ILIKE %search%` (empty string returns all users). Default pagination: page 1, limit 20.

**Sorting:** The endpoint accepts `?sort=field&order=asc|desc` query parameters. Sortable fields: `name`, `email`, `applicationCount`, `resumeGenerationsUsedThisMonth`, `totalResumeGenerations`, `estimatedTotalCost`, `lastActiveAt`, `createdAt`. Default: `createdAt` DESC. Column headers in the UI are clickable to toggle sort.

### Limit Update Endpoint

- **FR-7:** `PUT /api/admin/users/[id]/limits` accepts:

```typescript
interface UpdateLimitsRequest {
  applicationCap?: number; // positive integer >= 1
  resumeGenerationCap?: number; // positive integer >= 1
}
```

Validation:
- At least one field must be provided
- Values must be positive integers >= 1 and <= 10,000
- The target user must exist
- The admin cannot edit their own limits (return 400: "You cannot edit your own limits")
- Editing another admin's caps is allowed (caps have no effect on admins but the values are stored)
- Setting a cap below current usage is allowed -- the user keeps existing data but cannot create new items until below the cap

On success: update the User record, return the updated user object. On validation failure: return 400 with specific error message.

### lastActiveAt Tracking

- **FR-8:** The `User.lastActiveAt` field shall be updated in PRD 1's auth middleware on each authenticated request, throttled to once per hour (only update if `lastActiveAt` is more than 1 hour old). This provides DAU/MAU data without excessive database writes.

---

## 5. Non-Goals (Out of Scope)

- **Viewing individual users' applications or resume sources:** Admin sees aggregate stats, not individual application details.
- **Suspending or deleting user accounts:** Account management is deferred. Admin can set caps to 0 to effectively restrict usage (note: cap minimum is 1 per FR-7, so full lockout is not possible via caps alone).
- **Email notifications to admins:** No alerts on thresholds, new signups, or cost spikes.
- **Audit logging of admin actions:** Limit changes are not logged. A future enhancement could add an AdminAuditLog model.
- **Exporting admin data as CSV/PDF:** All data is viewed in-app only.
- **Impersonating users:** Admin cannot sign in as another user.
- **Bulk limit changes:** Limits are edited one user at a time.
- **Real-time updates:** Admin page refreshes on navigation or manual reload; no WebSocket push.
- **Mobile optimization:** Admin panel is designed for desktop/tablet. Mobile layout is functional but not a priority.

---

## 6. Design Considerations

### User Interface

**Admin Page Layout (3-tab structure):**
```
+----------------------------------------------------------+
| Admin Panel                                              |
| [Overview] [Users] [Generations]                         |
+----------------------------------------------------------+
```

**Overview Tab:**
```
+----------------------------------------------------------+
| +----------+ +----------+ +----------+ +----------+     |
| |   247    | |  12,340  | |   892    | |Est.$43.28|     |
| |  Users   | |   Apps   | |  Resumes | |  Spend   |     |
| +----------+ +----------+ +----------+ +----------+     |
|                                                          |
| Daily Active Users (Last 30 Days)              MAU: 142 |
| +------------------------------------------------------+ |
| |    *                                                 | |
| |   / \    *          *                                | |
| |  /   \  / \   *    / \                               | |
| | /     \/   \ / \  /   \                              | |
| |/            V    \/     \                             | |
| | Feb 1    Feb 8   Feb 15  Feb 22  Mar 1               | |
| +------------------------------------------------------+ |
+----------------------------------------------------------+
```

**Users Tab:**
```
+----------------------------------------------------------+
| Search: [_________________________]                      |
+----------------------------------------------------------+
| Name       | Email        | Role | Apps    | Resumes/Mo | |
|            |              |      | (used/  | (used/cap) | |
|            |              |      |  cap)   |            | |
+----------------------------------------------------------+
| Alex Rudd  | paul.alex... | ADMIN| Unlimited| Unlimited | |
+----------------------------------------------------------+
| Jane Doe   | jane@...     | USER | 142/200 | 3/5       | |
|  +------------------------------------------------------+|
|  | Application Cap: [200____] (142 used)                ||
|  | Resume Gen Cap:  [5______] (3 used this month)       ||
|  |                           [Save] [Cancel]            ||
|  +------------------------------------------------------+|
+----------------------------------------------------------+
| John Smith | john@...     | USER | 87/200  | 5/5       | |
+----------------------------------------------------------+
| ... more rows ...                                        |
+----------------------------------------------------------+
| < 1 2 3 ... 13 >                     Showing 1-20 of 247|
+----------------------------------------------------------+
```

**Generations Tab:**
```
+----------------------------------------------------------+
| +----------+ +----------+ +----------+                   |
| |   892    | | 2.1M     | |Est.$43.28|                  |
| |  Total   | |  Tokens  | | Est.Cost |                  |
| +----------+ +----------+ +----------+                   |
|                                                          |
| Generations Per Day (Last 30 Days)                       |
| +------------------------------------------------------+ |
| | ▌  ▌    ▌▌  ▌ ▌▌▌  ▌    ▌▌▌ ▌▌  ▌▌                  | |
| +------------------------------------------------------+ |
|                                                          |
| Cumulative Cost (Last 30 Days)                           |
| +------------------------------------------------------+ |
| |                                          ___/         | |
| |                               ____------              | |
| |                    ___-------                         | |
| |        ___--------                                    | |
| | ------                                                | |
| +------------------------------------------------------+ |
|                                                          |
| Top Users by Cost                                        |
| +------------------------------------------------------+ |
| | #  | Name       | Email     | Gens | Tokens | Est.Cost| |
| | 1  | Jane Doe   | jane@...  | 45   | 112K   | $5.43  | |
| | 2  | John Smith | john@...  | 38   | 98K    | $4.82  | |
| | ...                                                   | |
| +------------------------------------------------------+ |
+----------------------------------------------------------+
```

**Components to create:**

| Component | Purpose |
|---|---|
| `src/app/admin/page.tsx` | Admin page with tab layout |
| `src/components/admin/overview-tab.tsx` | Summary cards + DAU chart |
| `src/components/admin/users-tab.tsx` | Searchable, paginated user table |
| `src/components/admin/user-limit-editor.tsx` | Inline cap editing form |
| `src/components/admin/generations-tab.tsx` | Generation charts + top users table |

### User Experience

**Journey 1: Check Platform Health**
1. Admin clicks "Admin" in the nav bar
2. Overview tab loads with summary cards and DAU chart
3. Admin sees 247 users, 12,340 applications, Est. $43.28 total spend
4. DAU chart shows a dip last week -- admin makes a mental note

**Journey 2: Adjust a User's Limits**
1. Admin clicks the "Users" tab
2. Admin searches for "jane" in the search bar
3. Table filters to show Jane Doe's row
4. Admin clicks the row -- inline editor expands
5. Admin changes Resume Generation Cap from 5 to 10
6. Admin clicks "Save" -- toast confirms "Limits updated for Jane Doe"
7. The row updates to show "3/10" for Resumes This Month

**Journey 3: Monitor API Costs**
1. Admin clicks the "Generations" tab
2. Sees cumulative cost trending upward -- Est. $43.28 total
3. Daily bar chart shows a spike on Feb 20 (8 generations)
4. Top users table shows Jane Doe is the heaviest user at $5.43

**Loading States:**
- Tab switch: each tab fetches data independently. Skeleton placeholders while loading.
- User table: skeleton rows while fetching. Search triggers a debounced re-fetch (300ms debounce).
- Limit save: "Save" button shows spinner, disabled during save.

**Error States:**
- API error on stats: toast "Failed to load admin stats." Retry on next navigation.
- Limit save fails: toast "Failed to update limits. Please try again." Form remains open with entered values.
- User not found (deleted between list and detail): toast "User not found."

### Accessibility

- Tab navigation: shadcn/ui Tabs component provides keyboard navigation (arrow keys between tabs, Enter to activate)
- Data table: proper `<table>` semantics with `<th>` headers. Sortable column headers use `<button>` with `aria-sort="ascending|descending|none"` to announce current sort state.
- Inline editor: focus trapped within the editor when expanded. Escape closes the editor.
- Search: `aria-label="Search users by name or email"`, results announced via `aria-live="polite"` region.
- Charts: `aria-label` summaries as in PRD 5.

---

## 7. Technical Considerations

### Architecture

The admin panel is a Client Component with tab state reflected in the URL query parameter (`/admin?tab=overview|users|generations`). This makes tabs bookmarkable and preserves state on refresh. Each tab fetches its data from a dedicated API endpoint on mount. The Users tab manages its own pagination, search, and sort state (also reflected in URL params).

All admin API routes share a common pattern: verify session via `auth()`, check `role === "ADMIN"`, then execute queries. This check is extracted to a shared `requireAdmin()` utility.

**New files:**

| File | Purpose |
|---|---|
| `src/app/admin/page.tsx` | Admin page with tab layout |
| `src/app/api/admin/stats/route.ts` | GET -- platform overview stats + DAU over time |
| `src/app/api/admin/stats/generations/route.ts` | GET -- generation volume, cost, top users |
| `src/app/api/admin/users/route.ts` | GET -- paginated user list with stats |
| `src/app/api/admin/users/[id]/route.ts` | GET -- single user detail |
| `src/app/api/admin/users/[id]/limits/route.ts` | PUT -- update user caps |
| `src/lib/admin.ts` | Shared `requireAdmin()` helper, query functions |
| `src/components/admin/overview-tab.tsx` | Summary cards + DAU chart |
| `src/components/admin/users-tab.tsx` | User table with search + pagination |
| `src/components/admin/user-limit-editor.tsx` | Inline cap editor |
| `src/components/admin/generations-tab.tsx` | Generation charts + top users |

**Modified files:**

| File | Change |
|---|---|
| `src/components/nav/top-nav.tsx` | Add "Admin" link visible only when `session.user.role === "ADMIN"` |
| `src/middleware.ts` | Add admin route protection (redirect non-admins from `/admin/*`) |

### Data

No new models. Key queries:

```sql
-- Platform stats
SELECT COUNT(*) FROM "User";
SELECT COUNT(*) FROM "JobApplication";
SELECT COUNT(*), SUM("estimatedCost") FROM "ResumeGeneration";
SELECT COUNT(*) FROM "User" WHERE "lastActiveAt" >= $todayStart;
SELECT COUNT(*) FROM "User" WHERE "lastActiveAt" >= $monthStart;

-- DAU over time (last 30 days)
SELECT DATE("lastActiveAt") as date, COUNT(DISTINCT id) as count
FROM "User"
WHERE "lastActiveAt" >= NOW() - INTERVAL '30 days'
GROUP BY DATE("lastActiveAt")
ORDER BY date;

-- User list with aggregates
SELECT u.*,
  (SELECT COUNT(*) FROM "JobApplication" WHERE "userId" = u.id) as "applicationCount",
  (SELECT COUNT(*) FROM "ResumeGeneration" WHERE "userId" = u.id) as "totalResumeGenerations",
  (SELECT COALESCE(SUM("estimatedCost"), 0) FROM "ResumeGeneration" WHERE "userId" = u.id) as "estimatedTotalCost"
FROM "User" u
WHERE u.name ILIKE $search OR u.email ILIKE $search
ORDER BY u."createdAt" DESC
LIMIT $limit OFFSET $offset;

-- Generation stats (last 30 days)
SELECT DATE("createdAt") as date, COUNT(*) as count, SUM("estimatedCost") as cost
FROM "ResumeGeneration"
WHERE "createdAt" >= NOW() - INTERVAL '30 days'
GROUP BY DATE("createdAt")
ORDER BY date;

-- Top users by cost
SELECT "userId", SUM("estimatedCost") as cost, COUNT(*) as count, SUM("totalTokens") as tokens
FROM "ResumeGeneration"
GROUP BY "userId"
ORDER BY cost DESC
LIMIT 10;
```

**Indexes relied upon:**
- `User.lastActiveAt` -- DAU/MAU queries (new index needed)
- `ResumeGeneration.userId` -- per-user aggregation
- `ResumeGeneration.createdAt` -- daily bucketing
- `JobApplication.userId` -- per-user counts

**New index:** `User.lastActiveAt` shall be indexed for efficient DAU/MAU queries. Add to the Prisma schema: `@@index([lastActiveAt])`.

### APIs

See FR-3 for the complete endpoint table. Example payloads in FR-4 through FR-7.

### Performance

- Platform stats: 5 simple COUNT/SUM queries, each under 50ms for < 1,000 users
- DAU over time: single GROUP BY query over 30 days, under 100ms
- User list: paginated query with subquery aggregates. For 250 users, under 200ms per page. The correlated subqueries for applicationCount and totalResumeGenerations may be slow at scale; acceptable for < 1,000 users.
- Generation stats: GROUP BY date over 30 days, under 100ms for < 10,000 generations
- Top users: GROUP BY userId with ORDER BY, under 100ms for < 10,000 generations
- Total target: each tab loads in under 500ms

---

## 8. Security and Privacy

### Authentication & Authorization

- All `/api/admin/*` routes verify `auth()` then check `session.user.role === "ADMIN"`
- Non-admin users receive `403 { error: "Forbidden" }` -- no data leakage
- The `/admin` page route is also protected in `middleware.ts` -- non-admins are redirected to `/applications`
- The "Admin" nav link is conditionally rendered only for admin users

### Input Validation

| Field | Validation |
|---|---|
| `page` query param | Positive integer >= 1, default 1 |
| `limit` query param | Positive integer, 1-100, default 20 |
| `search` query param | String, max 100 chars, sanitized for SQL (parameterized queries prevent injection). Empty string returns all users. |
| `sort` query param | Must be one of: `name`, `email`, `applicationCount`, `resumeGenerationsUsedThisMonth`, `totalResumeGenerations`, `estimatedTotalCost`, `lastActiveAt`, `createdAt`. Default: `createdAt` |
| `order` query param | Must be `asc` or `desc`. Default: `desc` |
| `applicationCap` body | Positive integer >= 1 and <= 10,000 |
| `resumeGenerationCap` body | Positive integer >= 1 and <= 10,000 |
| `[id]` path param | Valid CUID format |

### Sensitive Data

- Admin can see all users' email addresses, names, and usage stats. This is necessary for platform management but should be treated as sensitive.
- Estimated costs are visible to admin. These are derived from token counts and configurable rates, not actual billing data.
- No passwords or OAuth tokens are exposed via admin endpoints.

---

## 9. Testing Strategy

### Unit Tests (vitest)

**Admin Query Functions (`src/lib/__tests__/admin.test.ts`):**
- Platform stats with seeded data -> correct counts and sums
- DAU query with users active on different days -> correct daily counts
- User list with search -> filters correctly (partial match, case-insensitive)
- User list pagination -> correct offset/limit, correct totalPages
- Generation stats with 30 days of data -> correct daily bucketing
- Top users -> ordered by cost descending, limited to 10
- `requireAdmin()` with admin session -> passes
- `requireAdmin()` with user session -> throws 403

**Limit Validation (`src/lib/__tests__/admin.test.ts`):**
- Valid caps (1, 100, 999) -> accepted
- Invalid caps (0, -1, 1.5, "abc") -> rejected with error message
- Missing both fields -> rejected
- Admin editing own limits -> rejected with specific message

### Integration Tests

**Admin Stats API (`src/app/api/admin/stats/__tests__/route.test.ts`):**
- Admin session -> returns full stats
- Non-admin session -> 403
- Unauthenticated -> 401
- No users/data -> returns zeros

**User Limit Update (`src/app/api/admin/users/[id]/limits/__tests__/route.test.ts`):**
- Admin updates user cap -> persists in database
- Admin updates own cap -> 400
- Non-admin attempts update -> 403
- Invalid cap value -> 400 with message

### E2E Test (Playwright)

**Admin Flow (`e2e/admin.spec.ts`):**
- Sign in as admin -> navigate to `/admin` -> verify Overview tab loads with stats -> switch to Users tab -> search for a user -> expand row -> change cap -> save -> verify toast and updated value

### Edge Cases

- Admin is the only user -> user table shows 1 row
- User with 0 applications and 0 generations -> all derived stats are 0
- Search with special characters (`%`, `_`) -> no SQL injection, returns empty results
- Limit update to same value as current -> succeeds silently (no-op update)
- Concurrent limit updates for the same user -> last write wins (acceptable)
- User deleted between list fetch and detail fetch -> 404 on detail endpoint

---

## 10. Dependencies and Assumptions

### Dependencies

**New libraries to install:**

None. Reuses `recharts` from PRD 5 and existing shadcn/ui components.

**shadcn/ui components to add (if not already present):**
- `table` -- data table for user list and top users
- `pagination` -- user list pagination controls

**Existing dependencies:**
- Next.js 15, React, TypeScript, Tailwind CSS, shadcn/ui, Prisma, Auth.js v5, recharts

### Assumptions

- PRDs 1-5 are fully implemented
- `User.lastActiveAt` exists and is updated on authenticated requests (PRD 1 + FR-8 here)
- `User.role` enum with `ADMIN` value exists (PRD 1)
- `ADMIN_EMAILS` env var correctly identifies admin users on sign-up (PRD 1)
- The platform has fewer than 1,000 users (correlated subqueries in user list are acceptable at this scale)

### Known Constraints

- **DAU accuracy:** `lastActiveAt` is updated once per hour (throttled). DAU counts may undercount users who visit briefly within the same hour as their last visit on a prior day. This is acceptable for a hobby-tier analytics tool.
- **Cost estimation vs. actual billing:** Estimated costs are computed from static per-token rates (`COST_PER_INPUT_TOKEN`, `COST_PER_OUTPUT_TOKEN`). Actual Anthropic billing may differ. The admin should compare estimates against real invoices monthly.
- **User list performance:** Correlated subqueries for applicationCount and totalResumeGenerations in the user list query will degrade beyond ~1,000 users. At that scale, these should be materialized as cached fields on the User model. For the current hobby-tier scope, this is not a concern.
- **No audit log:** Admin limit changes are not logged. If accountability is needed later, an AdminAuditLog model should be added.

---

## 11. Success Metrics

### Quantitative Metrics

| Metric | Target | How to Measure |
|---|---|---|
| Overview tab load time | Under 500ms | Server-side timing |
| User list load time | Under 500ms (20 users per page) | Server-side timing |
| Generation stats load time | Under 500ms | Server-side timing |
| Limit update round-trip | Under 300ms | Server-side timing on PUT |
| Stats accuracy | 100% match to database | Automated tests comparing query output to seeded data |
| Access control | 0 unauthorized accesses | Integration tests for all endpoints with non-admin sessions |

### Qualitative Metrics

| Metric | How to Assess |
|---|---|
| Admin can find a user quickly | Search returns results within 300ms, correct filtering |
| Cost trends are understandable | Cumulative cost chart has clear labels and axis |
| Limit editing is intuitive | Admin can change a cap without confusion about the flow |

---

## 12. Implementation Order

| Phase | Scope | Risk Level | Verification |
|---|---|---|---|
| **Phase 1** | `src/lib/admin.ts`: `requireAdmin()` helper + query functions | Low | Unit tests pass for all queries |
| **Phase 2** | Add `@@index([lastActiveAt])` to User model + migration | Low | `prisma migrate dev` succeeds |
| **Phase 3** | `GET /api/admin/stats` + `GET /api/admin/stats/generations` endpoints | Low | API returns correct stats for seeded data |
| **Phase 4** | `GET /api/admin/users` + `GET /api/admin/users/[id]` endpoints | Medium | Paginated user list returns correct data |
| **Phase 5** | `PUT /api/admin/users/[id]/limits` endpoint with validation | Low | Limit updates persist, validation rejects bad input |
| **Phase 6** | `src/middleware.ts` update: admin route protection | Low | Non-admin redirected from `/admin`, gets 403 from API |
| **Phase 7** | Admin page: Overview tab with summary cards + DAU chart | Medium | Overview loads with correct data |
| **Phase 8** | Admin page: Users tab with search, pagination, inline editor | Medium | Full user management flow works |
| **Phase 9** | Admin page: Generations tab with charts + top users table | Low | Charts render with correct data |

---

## Clarifying Questions

All review questions have been resolved. Key decisions documented inline:

- **Cap below usage:** Allowed -- user keeps existing data, blocked from creating new items (FR-7, US-3)
- **Generations tab scope:** Summary cards are all-time; charts are 30-day trend (US-4)
- **URL tab state:** Tabs reflected in query param `/admin?tab=` for bookmarkability
- **Sortable columns:** User table supports click-to-sort on all columns (FR-6)
- **Zero-fill:** Backend zero-fills DAU and generation charts for full 30-day range (FR-4)
- **Historical cost:** Immutable, stored at generation time (FR-4)
- **Admin-to-admin editing:** Allowed (only self-editing blocked) (FR-7)
- **Max cap value:** 10,000 (prevents accidental large inputs) (FR-7)

**Q1: [OPTIONAL] Should the admin be able to reset a user's monthly resume generation counter (set `resumeGenerationsUsedThisMonth` back to 0) without waiting for the calendar month to reset?**

**Q2: [OPTIONAL] Should there be an admin notification or visual indicator when a user is at or near their cap (e.g., highlight rows where usage >= 80% of cap)?**
