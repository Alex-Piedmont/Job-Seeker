# PRD: Analytics Dashboard

**Version:** 1.0
**Date:** 2026-03-02
**Author:** Product Management
**Status:** Draft
**Project:** Job Seeker -- Job Application Tracker

---

## 1. Introduction / Overview

The analytics dashboard gives users a data-driven view of their job search. Job seekers often apply to dozens of positions without a clear picture of their pipeline health, conversion rates, or where their process stalls. This feature transforms the raw data accumulated across PRDs 2-4 (applications, status transitions, interviews, resume generations) into actionable charts and metrics.

The dashboard is read-only — it queries existing data using the `columnType` field on KanbanColumn (established in PRD 3) for reliable offer and closed-column detection. It answers the questions every active job seeker asks: "How many applications have I sent?", "Where am I getting stuck?", "How long does it typically take to hear back?", and "Am I using my resume generations wisely?"

---

## 2. Goals

- **Pipeline visibility:** Users shall see their application funnel by stage with a single glance — how many applications are in each column and where drop-off occurs.
- **Time intelligence:** Users shall see median and average time-to-first-response and time-in-stage metrics, helping them set realistic expectations.
- **Trend tracking:** Users shall see application submission volume over time (weekly buckets) to understand their effort trajectory.
- **Resume ROI:** Users shall see their resume generation usage vs. cap and generations-per-application to gauge how effectively they are using the feature.
- **Sub-second load:** All dashboard queries shall return within 500ms for users with up to 200 applications (the application cap).

### What Success Looks Like

A user navigates to the Analytics page from the nav bar. Within 500ms, they see a summary row of key numbers (total applications, active applications, interviews scheduled, offers received). Below that, a funnel chart shows their pipeline stages with counts and percentages. A line chart shows weekly application volume. A stats section shows median days to first contact and interview-to-offer conversion rate. A small card shows their resume generation usage (3/5 this month). All charts are responsive and readable on mobile.

---

## 3. User Stories

### US-1: View Pipeline Funnel

**As a** job seeker, **I want to** see how my applications are distributed across pipeline stages, **so that** I can identify bottlenecks and focus my effort.

**Acceptance Criteria:**
- [ ] A horizontal bar chart shows the count of applications in each KanbanColumn
- [ ] Columns are ordered by their `order` field (left to right = early to late stage)
- [ ] Each bar shows the count and percentage of total applications
- [ ] The chart updates when applications are moved between columns (on next page load or refetch)
- [ ] Empty columns (0 applications) are still shown with a zero bar

### US-2: Track Application Volume Over Time

**As a** job seeker, **I want to** see how many applications I have submitted per week, **so that** I can maintain consistent effort.

**Acceptance Criteria:**
- [ ] A line chart shows application count per week, bucketed by `dateApplied`
- [ ] The x-axis shows week labels (e.g., "Feb 3", "Feb 10")
- [ ] The y-axis shows application count
- [ ] Applications without a `dateApplied` (still in "Saved" column) are excluded from this chart
- [ ] The chart defaults to the last 12 weeks; if the user has fewer than 12 weeks of data, show all available weeks
- [ ] Weeks with zero applications show as zero (not gaps)

### US-3: View Key Summary Metrics

**As a** job seeker, **I want to** see headline numbers for my job search at a glance, **so that** I can assess overall progress.

**Acceptance Criteria:**
- [ ] A summary row displays these cards:
  - Total Applications (count of all JobApplications)
  - Active Applications (count of applications NOT in an `columnType === "CLOSED"` column)
  - Interviews Scheduled (count of InterviewRecords with `date` in the future or null)
  - Offers (count of applications in a column with `columnType === "OFFER" = true`)
- [ ] Each card shows the number prominently with a label below
- [ ] Cards are responsive: 4 across on desktop, 2x2 grid on mobile

### US-4: View Time-Based Analytics

**As a** job seeker, **I want to** see how long it takes to hear back and move through stages, **so that** I can set realistic expectations.

**Acceptance Criteria:**
- [ ] A stats section displays:
  - Median days from Applied to first status change (using ApplicationStatusLog)
  - Average days from Applied to first status change
  - App-to-interview conversion rate: (applications with at least 1 InterviewRecord) / (applications that have been in "Applied" or later)
  - Interview-to-offer conversion rate: (applications in "Offer" column) / (applications with at least 1 InterviewRecord)
- [ ] If insufficient data (fewer than 3 applications past "Applied"), show "Not enough data" instead of misleading stats
- [ ] Time calculations exclude applications still in their current stage (only completed transitions count)

### US-5: View Resume Generation Usage

**As a** job seeker, **I want to** see my resume generation usage and history, **so that** I can plan remaining generations for the month.

**Acceptance Criteria:**
- [ ] A card shows: "{used}/{cap} resumes generated this month" with a progress bar
- [ ] Progress bar color matches the usage badge logic: green (0-49%), yellow (50-79%), red (80-100%)
- [ ] Below the progress bar: "Resets {Month} 1" (next calendar month)
- [ ] For admin users: "Unlimited" with no progress bar
- [ ] A small stat shows total generations all-time

### US-6: View Closure and Ghosting Rate

**As a** job seeker, **I want to** see my closure rate, ghosting rate, and where closures happen in the pipeline, **so that** I can identify weak points and distinguish between explicit rejections and no-response outcomes.

**Acceptance Criteria:**
- [ ] A metric shows overall closure rate: (applications in `columnType="CLOSED"` columns) / (total applications). All closed applications count — if `rejectionDate` is null, the `movedAt` timestamp from the ApplicationStatusLog entry that moved the card to the closed column is used as the effective closure date.
- [ ] A secondary metric shows ghosted rate: (closed applications with `closedReason="ghosted"`) / (total closed applications)
- [ ] A breakdown shows closure count by the column the application was in BEFORE being moved to closed (using the last ApplicationStatusLog entry where `toColumnId` is a `columnType="CLOSED"` column)
- [ ] Within each stage, the breakdown shows a ghosted vs. rejected split (e.g., stacked or segmented bar)
- [ ] If the source column has been deleted, show "Deleted Column" as the stage name
- [ ] If no closures, show "No closures recorded"

---

## 4. Functional Requirements

### Data Queries

All analytics are computed from existing data. No new models or migrations — the `columnType` field on KanbanColumn (established in PRD 3) provides reliable offer and closed-column detection.

- **FR-1:** All analytics queries shall be scoped to the authenticated user's data (`WHERE userId = ?`). No user shall see another user's analytics.

- **FR-2:** The analytics API shall return all dashboard data in a single endpoint (`GET /api/analytics`) to minimize round-trips. The response shape:

```typescript
interface AnalyticsResponse {
  // Summary cards
  totalApplications: number;
  activeApplications: number;
  interviewsScheduled: number;
  offers: number;

  // Pipeline funnel
  funnel: Array<{
    columnId: string;
    columnName: string;
    columnColor: string;
    count: number;
    percentage: number;
  }>;

  // Applications over time (weekly buckets)
  weeklyApplications: Array<{
    weekStart: string; // ISO date of Monday
    count: number;
  }>;

  // Time-based stats
  medianDaysToFirstResponse: number | null; // null if insufficient data
  avgDaysToFirstResponse: number | null;
  appToInterviewRate: number | null; // 0-1 decimal
  interviewToOfferRate: number | null;

  // Closure breakdown (rejections + ghosted)
  closureRate: number | null;
  ghostedRate: number | null; // closedReason="ghosted" / total closed
  closuresByStage: Array<{
    columnName: string;
    count: number;
    rejectedCount: number;
    ghostedCount: number;
  }>;

  // Resume generation usage
  resumeUsage: {
    used: number;
    cap: number;
    resetsAt: string; // ISO date
    isAdmin: boolean;
    totalAllTime: number;
  };
}
```

- **FR-3:** Pipeline funnel counts shall be computed by grouping `JobApplication` records by `columnId` and LEFT JOINing with `KanbanColumn` for name and order. Percentages are computed as `count / totalApplications * 100`. If `totalApplications` is 0, all columns return with `count: 0` and `percentage: 0` (no division by zero).

- **FR-4:** Weekly application volume shall be computed by bucketing `JobApplication.dateApplied` into ISO weeks (Monday-Sunday). The chart always shows the last 12 calendar weeks from today, regardless of whether the user has data in those weeks. Weeks with no applications return `count: 0`. This clearly shows gaps in activity.

- **FR-5:** Time-to-first-response shall be computed from `ApplicationStatusLog`. For each application with at least one status log entry:
  1. Find the earliest `ApplicationStatusLog` entry for the application (ordered by `movedAt ASC`) -- uses the first-ever log entry regardless of which column it transitions from
  2. Compute the difference in days between `movedAt` and the application's `dateApplied`
  3. Only include applications where `dateApplied` is not null
  4. Return median and average across all qualifying applications
  5. Require at least 3 data points to display stats; otherwise return `null`

- **FR-6:** Conversion rates:
  - App-to-interview: `count(applications with >= 1 InterviewRecord AND dateApplied IS NOT NULL) / count(applications with dateApplied IS NOT NULL)`
  - Interview-to-offer: `count(applications in columnType="OFFER" column AND >= 1 InterviewRecord) / count(applications with >= 1 InterviewRecord)`
  - Return `null` if denominator is 0

- **FR-7:** Rejection breakdown uses `ApplicationStatusLog`:
  1. Find all applications currently in a `columnType="CLOSED"` column (ALL closed applications count as closures)
  2. For each, find the last `ApplicationStatusLog` entry where `toColumnId` is the closed column
  3. If the application's `rejectionDate` is null, use the `movedAt` from that status log entry as the effective closure date (for time-based calculations)
  4. Group by the `fromColumnId` (the stage they were in before closure)
  5. LEFT JOIN to `KanbanColumn` for the column name -- if the column was deleted, display "Deleted Column"
  6. Return column name and count, ordered by count descending
  7. Within each stage grouping, split by `closedReason`: "rejected" (explicit rejection or null closedReason) vs. "ghosted" (`closedReason = "ghosted"`). The response includes both the total count per stage and the ghosted/rejected subcounts.

- **FR-8:** Resume generation usage reads from `User.resumeGenerationsUsedThisMonth`, `User.resumeGenerationCap`, `User.resumeCapResetAt`, and `count(ResumeGeneration WHERE userId = ?)` for all-time total.

### API Route

- **FR-9:** A single API route `GET /api/analytics` shall return the `AnalyticsResponse`. The route:
  1. Verifies the session via `auth()`
  2. Runs all queries in parallel via `Promise.allSettled()`
  3. For each fulfilled query, includes the result; for each rejected query, returns `null` for that section
  4. Returns the aggregated response (never a 500 due to a single query failure)
  5. Target response time: under 500ms for 200 applications

### Computation Location

- **FR-10:** All computations happen server-side in the API route. The frontend receives pre-computed data and renders it -- no client-side aggregation of raw records. This keeps the client lightweight and avoids sending potentially large datasets over the wire.

- **FR-11:** The analytics page (`src/app/analytics/page.tsx`) shall be a **Client Component** using `useState` + `fetch` (or a lightweight wrapper). This enables:
  - The Refresh button to re-fetch data without a full page reload (spinner on button, data updates in place)
  - Skeleton placeholders on initial load, subtle loading indicator on refresh
  - No `loading.tsx` needed (Client Component manages its own loading state)

---

## 5. Non-Goals (Out of Scope)

- **Date range filtering:** The dashboard shows all-time data (with weekly chart defaulting to 12 weeks). Custom date range selection is a future enhancement.
- **Exportable reports:** No CSV/PDF export of analytics data.
- **Comparison benchmarks:** No comparison against "average" job seekers or industry benchmarks.
- **Real-time updates:** Analytics refresh on page load (or manual refresh). No WebSocket push updates when data changes.
- **Drill-down to individual applications:** Clicking a funnel bar does not navigate to filtered applications. Users use the Kanban board for that.
- **Compensation analytics:** Salary distribution, OTE analysis, and compensation trends are deferred. The data exists but the dashboard scope is pipeline health, not compensation intelligence.
- **Interview-specific analytics:** Detailed interview type/format breakdowns, interviewer tracking, and interview cadence analysis are deferred.
- **Admin aggregate analytics:** This dashboard is user-facing only. Platform-wide analytics are in PRD 6 (Admin Panel).
- **Goal setting or targets:** No "apply to 10 jobs this week" goal-tracking feature.

---

## 6. Design Considerations

### User Interface

**Dashboard Layout:**
```
+----------------------------------------------------------+
| Analytics                                     [Refresh]  |
+----------------------------------------------------------+
|                                                          |
| +----------+ +----------+ +----------+ +----------+     |
| |   142    | |    87    | |    12    | |     3    |     |
| |  Total   | |  Active  | | Interviews|  Offers  |     |
| +----------+ +----------+ +----------+ +----------+     |
|                                                          |
| Pipeline                                                 |
| +------------------------------------------------------+ |
| | Saved    ████████████████████  42 (30%)              | |
| | Applied  ████████████████  38 (27%)                  | |
| | Screening ████████  18 (13%)                         | |
| | Interview ██████████  22 (15%)                       | |
| | Offer    ███  3 (2%)                                 | |
| | Closed   ████████████████████  19 (13%)              | |
| +------------------------------------------------------+ |
|                                                          |
| Applications Per Week                                    |
| +------------------------------------------------------+ |
| |    *                                                 | |
| |   / \    *                                           | |
| |  /   \  / \        *                                 | |
| | /     \/   \  *   / \   *                            | |
| |/            \/  \/   \ / \                           | |
| | Feb 3  Feb 10 Feb 17 Feb 24 Mar 3                   | |
| +------------------------------------------------------+ |
|                                                          |
| +----------------+ +----------------+ +----------------+ |
| | Median Days to | | App-to-Interview| | Resume Usage  | |
| | First Response | | Conversion     | |               | |
| |     8 days     | |     32%        | | 3/5 this month| |
| | (avg: 11 days) | | (Int-to-Offer: | | ████░ (60%)   | |
| |                | |    14%)        | | Resets Apr 1  | |
| +----------------+ +----------------+ +----------------+ |
|                                                          |
| Closures by Stage                    Ghosted Rate: 42%   |
| +------------------------------------------------------+ |
| | Applied      ████████████  8  (3 rejected, 5 ghosted)| |
| | Screening    ██████  4  (3 rejected, 1 ghosted)      | |
| | Interview    ████████████████  7  (5 rejected, 2 ghosted)| |
| +------------------------------------------------------+ |
|                                                          |
+----------------------------------------------------------+
```

**Mobile Layout (single column):**
```
+------------------------+
| Analytics    [Refresh] |
+------------------------+
| +--------+ +--------+  |
| |  142   | |   87   |  |
| | Total  | | Active |  |
| +--------+ +--------+  |
| +--------+ +--------+  |
| |   12   | |    3   |  |
| | Ints   | | Offers |  |
| +--------+ +--------+  |
|                        |
| Pipeline               |
| [horizontal bar chart] |
|                        |
| Weekly Applications    |
| [line chart]           |
|                        |
| [Stats cards stacked]  |
|                        |
| Rejections by Stage    |
| [horizontal bar chart] |
+------------------------+
```

**Components to create:**

| Component | Purpose |
|---|---|
| `src/app/analytics/page.tsx` | Analytics page with data fetching |
| `src/components/analytics/summary-cards.tsx` | Four headline metric cards |
| `src/components/analytics/pipeline-funnel.tsx` | Horizontal bar chart of pipeline stages |
| `src/components/analytics/weekly-chart.tsx` | Line chart of weekly application volume |
| `src/components/analytics/time-stats.tsx` | Median/avg response time + conversion rates |
| `src/components/analytics/resume-usage-card.tsx` | Resume generation usage with progress bar |
| `src/components/analytics/closure-breakdown.tsx` | Closure count by pre-closure stage with ghosted/rejected split |

### User Experience

**Journey 1: First Visit (New User, Minimal Data)**
1. User navigates to Analytics from the nav bar
2. Summary cards show small numbers (e.g., 3 total, 3 active, 0 interviews, 0 offers)
3. Pipeline funnel shows a few bars (most in "Saved" or "Applied")
4. Weekly chart shows 1-2 data points
5. Time stats show "Not enough data" (fewer than 3 qualifying transitions)
6. Resume usage shows "0/5 this month"
7. Rejection breakdown shows "No rejections recorded"

**Journey 2: Active User**
1. User navigates to Analytics
2. Dashboard loads in under 500ms with full data
3. Summary cards show meaningful numbers
4. Pipeline funnel reveals a bottleneck (e.g., many in "Applied" but few in "Screening")
5. Weekly chart shows consistent application effort with some peaks
6. Time stats show median 8 days to first response, 32% app-to-interview conversion
7. Rejection breakdown shows most rejections happen at "Interview" stage

**Journey 3: Refresh**
1. User has the dashboard open, switches to Kanban, moves some applications
2. User returns to Analytics and clicks "Refresh" (or navigates away and back)
3. All metrics update to reflect the changes

**Loading States:**
- Initial page load: skeleton cards and chart placeholders with shimmer animation
- Refresh: subtle spinner on the Refresh button, data updates in place (no full-page skeleton)

**Error States:**
- Full API error (network failure, auth error): toast "Failed to load analytics. Please try again." Stale data (if any) remains visible.
- Partial query failure (one section returns null): the affected section shows a subtle "Unable to load this metric" message with muted styling. All other sections render normally.
- No applications at all: empty state with illustration and "Start tracking applications to see your analytics here. Go to Board ->"

### Accessibility

- All charts include `aria-label` descriptions summarizing the data (e.g., "Pipeline funnel: 42 Saved, 38 Applied, 18 Screening, 22 Interview, 3 Offer, 19 Closed")
- Chart colors meet WCAG 2.1 AA contrast ratios against the background
- Summary cards use semantic HTML (`<dl>` for label-value pairs)
- Screen readers announce the data values, not just the visual chart
- Keyboard: Tab navigates between cards and chart sections. No interactive chart elements requiring keyboard navigation (charts are read-only).
- Mobile charts: column names in the funnel bar chart truncated beyond ~10 characters with ellipsis. Tooltip on tap shows the full name. All charts use `ResponsiveContainer` from recharts to adapt to viewport width.

---

## 7. Technical Considerations

### Architecture

The analytics dashboard is a read-only page with a single API endpoint. All computation happens server-side. The frontend renders pre-computed data using recharts for the two chart types (bar chart, line chart) and shadcn/ui cards for metrics.

**New files:**

| File | Purpose |
|---|---|
| `src/app/analytics/page.tsx` | Client Component with useState + fetch, layout, and inline skeleton loading |
| `src/app/api/analytics/route.ts` | GET handler -- runs all queries, returns AnalyticsResponse |
| `src/lib/analytics.ts` | Query functions for each metric (funnel, weekly, time stats, etc.) |
| `src/components/analytics/summary-cards.tsx` | Four headline cards |
| `src/components/analytics/pipeline-funnel.tsx` | Recharts horizontal BarChart |
| `src/components/analytics/weekly-chart.tsx` | Recharts LineChart |
| `src/components/analytics/time-stats.tsx` | Stat cards with median/avg/conversion rates |
| `src/components/analytics/resume-usage-card.tsx` | Progress bar usage card |
| `src/components/analytics/closure-breakdown.tsx` | Recharts horizontal BarChart for rejections |
| `src/components/analytics/empty-state.tsx` | Illustration + CTA when no applications exist |

**Modified files:**

| File | Change |
|---|---|
| `src/components/nav/top-nav.tsx` | Add "Analytics" link to navigation |

### Data

No new models or migrations. The `columnType` field on KanbanColumn and `closedReason` field on JobApplication (both from PRD 3) provide the data needed for offer detection and ghosted/rejected distinction. All queries use existing tables:

**Key queries:**

```sql
-- Pipeline funnel
SELECT kc.id, kc.name, kc.color, kc."order", COUNT(ja.id) as count
FROM "KanbanColumn" kc
LEFT JOIN "JobApplication" ja ON ja."columnId" = kc.id
WHERE kc."userId" = $1
GROUP BY kc.id
ORDER BY kc."order";

-- Weekly applications (last 12 weeks)
SELECT date_trunc('week', ja."dateApplied") as week_start, COUNT(*) as count
FROM "JobApplication" ja
WHERE ja."userId" = $1
  AND ja."dateApplied" IS NOT NULL
  AND ja."dateApplied" >= NOW() - INTERVAL '12 weeks'
GROUP BY week_start
ORDER BY week_start;

-- Median days to first response
SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (
  ORDER BY EXTRACT(EPOCH FROM (asl."movedAt" - ja."dateApplied")) / 86400
) as median_days
FROM "ApplicationStatusLog" asl
JOIN "JobApplication" ja ON ja.id = asl."jobApplicationId"
WHERE ja."userId" = $1
  AND ja."dateApplied" IS NOT NULL
  AND asl.id = (
    SELECT id FROM "ApplicationStatusLog"
    WHERE "jobApplicationId" = ja.id
    ORDER BY "movedAt" ASC
    LIMIT 1
  );
```

**Indexes relied upon (already created in PRDs 1-3):**
- `JobApplication.userId` -- scoped queries
- `JobApplication.columnId` -- funnel grouping
- `JobApplication.dateApplied` -- weekly bucketing
- `ApplicationStatusLog.jobApplicationId` -- time-in-stage lookups
- `KanbanColumn.userId` -- column lookup
- `ResumeGeneration.userId` -- usage count

### APIs

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/analytics` | Returns full AnalyticsResponse for the authenticated user |

**Example response:**
```json
{
  "totalApplications": 142,
  "activeApplications": 87,
  "interviewsScheduled": 12,
  "offers": 3,
  "funnel": [
    { "columnId": "cl1...", "columnName": "Saved", "columnColor": "#6B7280", "count": 42, "percentage": 29.6 },
    { "columnId": "cl2...", "columnName": "Applied", "columnColor": "#3B82F6", "count": 38, "percentage": 26.8 },
    { "columnId": "cl3...", "columnName": "Screening", "columnColor": "#F59E0B", "count": 18, "percentage": 12.7 },
    { "columnId": "cl4...", "columnName": "Interview", "columnColor": "#8B5CF6", "count": 22, "percentage": 15.5 },
    { "columnId": "cl5...", "columnName": "Offer", "columnColor": "#10B981", "count": 3, "percentage": 2.1 },
    { "columnId": "cl6...", "columnName": "Closed", "columnColor": "#EF4444", "count": 19, "percentage": 13.4 }
  ],
  "weeklyApplications": [
    { "weekStart": "2026-01-05", "count": 8 },
    { "weekStart": "2026-01-12", "count": 12 },
    { "weekStart": "2026-01-19", "count": 6 }
  ],
  "medianDaysToFirstResponse": 8,
  "avgDaysToFirstResponse": 11.3,
  "appToInterviewRate": 0.32,
  "interviewToOfferRate": 0.14,
  "closureRate": 0.13,
  "ghostedRate": 0.42,
  "closuresByStage": [
    { "columnName": "Interview", "count": 7, "rejectedCount": 5, "ghostedCount": 2 },
    { "columnName": "Applied", "count": 8, "rejectedCount": 3, "ghostedCount": 5 },
    { "columnName": "Screening", "count": 4, "rejectedCount": 3, "ghostedCount": 1 }
  ],
  "resumeUsage": {
    "used": 3,
    "cap": 5,
    "resetsAt": "2026-04-01T00:00:00Z",
    "isAdmin": false,
    "totalAllTime": 14
  }
}
```

### Performance

- All queries scoped by userId (indexed) -- each query is a single-user scan, not a table scan
- Parallel execution via `Promise.all()` -- 6 queries run concurrently
- With 200 applications (cap), 200 status logs, and 50 interview records, each query touches <500 rows
- Target: full API response under 500ms (p95)
- No caching needed at this scale -- fresh data on every load
- Recharts renders client-side in <100ms for datasets of this size

---

## 8. Security and Privacy

### Authentication & Authorization

- `GET /api/analytics` verifies the session via `auth()`
- All queries are scoped to the authenticated user's ID -- no cross-user data leakage
- No admin-specific behavior on this endpoint (admin analytics are in PRD 6)

### Input Validation

- No user input on this endpoint -- it is a parameterless GET scoped to the session user
- No query parameters to validate

### Sensitive Data

- The response contains aggregate counts and rates -- no raw application details, company names, or personal information
- Resume usage data is non-sensitive (counts only)

---

## 9. Testing Strategy

### Unit Tests (vitest)

**Analytics Query Functions (`src/lib/__tests__/analytics.test.ts`):**
- Funnel with 6 columns, various counts -> correct percentages (sum to 100%)
- Funnel with empty columns -> 0 count, 0% (not omitted)
- Weekly applications with gaps -> zero-filled weeks in output
- Weekly applications with no `dateApplied` -> excluded from chart
- Median days with 3+ data points -> correct median
- Median days with <3 data points -> returns null
- Conversion rate with 0 denominator -> returns null
- Closure breakdown with no closures -> empty array
- Closure breakdown with mixed ghosted/rejected -> correct subcounts per stage
- Ghosted rate with 0 closed applications -> returns null
- Resume usage for admin -> isAdmin: true, cap not shown

### Integration Tests

**Analytics API Route (`src/app/api/analytics/__tests__/route.test.ts`):**
- Authenticated user with applications -> full AnalyticsResponse with all fields
- Authenticated user with no applications -> zeros and nulls, no error
- Unauthenticated request -> 401
- Verify all queries are user-scoped (seed data for two users, verify isolation)

### E2E Test (Playwright)

**Dashboard Load (`e2e/analytics.spec.ts`):**
- Sign in -> create 5 applications -> move 2 to "Applied" -> navigate to Analytics -> verify summary cards show correct counts -> verify funnel shows correct distribution

### Edge Cases

- User with exactly 1 application -- all metrics should work without division-by-zero
- User with 200 applications (cap) -- verify performance stays under 500ms
- User with applications but no `dateApplied` on any -- weekly chart shows "No data", other metrics still work
- User with custom KanbanColumns (non-default names) -- funnel uses actual column names
- User with no `columnType="OFFER"` column (renamed or deleted) -- offers count is 0
- All applications in one column -- funnel shows 100% in one bar, 0% elsewhere
- ApplicationStatusLog with rapid back-and-forth moves -- time calculations use first transition only
- Deleted KanbanColumn referenced in ApplicationStatusLog -- rejection breakdown shows "Deleted Column" as stage name
- Closed application without rejectionDate -- uses ApplicationStatusLog movedAt as effective closure date
- Ghosted application (closedReason="ghosted") -- correctly categorized in closure breakdown

---

## 10. Dependencies and Assumptions

### Dependencies

**New libraries to install:**

| Package | Purpose | Why This Library |
|---|---|---|
| `recharts` | Chart rendering (bar charts, line charts) | Most popular React charting library. Composable, responsive, good accessibility defaults. Built on D3 but with a declarative React API. ~45KB gzipped. |

**Existing dependencies (no changes):**
- Next.js 15, React, TypeScript, Tailwind CSS, shadcn/ui, Prisma, Auth.js v5

### Assumptions

- PRDs 1-4 are fully implemented
- `ApplicationStatusLog` is populated on every column transition (PRD 3)
- Default KanbanColumns exist for each user (created on first sign-in, PRD 3)
- PostgreSQL supports `PERCENTILE_CONT` (standard SQL, available in all PostgreSQL versions)
- User's application count is capped at 200 (PRD 1), bounding query performance

### Known Constraints

- **No historical data on first deploy:** Users who have been using the app before the analytics feature launches will have `ApplicationStatusLog` entries only for moves made after PRD 3 was deployed. Time-based metrics will be incomplete for pre-existing applications.
- **"Offer" column detection:** Uses `columnType="OFFER"` on KanbanColumn (established in PRD 3). If a user creates a new column and wants it to be the offer column, they would need to set the columnType (UI for this is in column settings, PRD 3). Default seeding sets columnType on the "Offer" column.
- **Week boundary:** ISO weeks start on Monday. Applications submitted on Sunday are bucketed into the following week.

---

## 11. Success Metrics

### Quantitative Metrics

| Metric | Target | How to Measure |
|---|---|---|
| API response time | Under 500ms (p95) | Server-side timing in the API route |
| Page load (LCP) | Under 1.5 seconds | Lighthouse audit |
| Chart render time | Under 100ms | `performance.mark()` around recharts render |
| Query correctness | 100% -- metrics match manual count | Automated tests comparing query output to seeded data |
| Zero division errors | 0 in production | Error tracking (no 500s from the analytics endpoint) |

### Qualitative Metrics

| Metric | How to Assess |
|---|---|
| Dashboard is useful | User can identify their pipeline bottleneck within 10 seconds |
| Charts are readable | Visual review on desktop and mobile -- labels are legible, colors are distinguishable |
| Empty states are helpful | New users understand what data will appear as they add applications |
| Accessibility | Screen reader can announce all key metrics without seeing the charts |

---

## 12. Implementation Order

| Phase | Scope | Risk Level | Verification |
|---|---|---|---|
| **Phase 1** | `src/lib/analytics.ts`: query functions for all 7 metric groups (including ghosted split) | Medium | Unit tests pass for all query functions with seeded test data |
| **Phase 2** | `GET /api/analytics` route: auth + parallel query execution | Low | API returns correct AnalyticsResponse for test user |
| **Phase 3** | `src/app/analytics/page.tsx` + summary cards + empty state | Low | Page renders, cards show correct numbers |
| **Phase 4** | Pipeline funnel chart (recharts BarChart) | Low | Funnel renders with correct bars and labels |
| **Phase 5** | Weekly applications line chart (recharts LineChart) | Low | Line chart renders with weekly data points |
| **Phase 6** | Time stats + conversion rates + rejection breakdown | Medium | Stats display correctly, null states handled |
| **Phase 7** | Resume usage card + progress bar | Low | Usage matches user's actual count |
| **Phase 8** | Mobile responsive layout + loading skeleton | Low | Dashboard is usable on mobile, skeleton shows during load |

---

## Clarifying Questions

All review questions have been resolved. Key decisions documented inline:

- **Offer detection:** `columnType="OFFER"` on KanbanColumn (PRD 3), not name matching
- **Column identity:** Column `order` used (order=0 is Saved, order=1 is Applied) for time calculations
- **Time-to-first-response:** Uses first-ever ApplicationStatusLog entry, not filtered by column (FR-5)
- **Partial failure:** `Promise.allSettled()` with per-section null handling (FR-9)
- **Rendering:** Client Component with fetch for interactive refresh (FR-11)
- **Rejections:** ALL closed applications count. Missing rejectionDate defaults to movedAt from status log (FR-7)
- **Deleted columns:** Show as "Deleted Column" in rejection breakdown
- **Weekly chart:** Always 12 weeks from today, zero-filled (FR-4)
- **Zero apps funnel:** All columns with count: 0 and percentage: 0 (FR-3)
- **Mobile charts:** Truncate labels at ~10 chars with ellipsis + tooltip

**Q1: [OPTIONAL] Should the weekly application chart support toggling between "applications submitted" and "applications created" (some users track saved jobs before applying)?**

**Q2: [OPTIONAL] Should the dashboard auto-refresh on an interval (e.g., every 60 seconds) or only on manual navigation/refresh?**
