# PRD: Polish, Donations & Deployment

**Version:** 1.0
**Date:** 2026-03-02
**Author:** Product Management
**Status:** Draft
**Project:** Job Seeker -- Job Application Tracker

---

## 1. Introduction / Overview

This is the final PRD in the Job Seeker series. It covers the cross-cutting concerns that span the entire application: loading states, error boundaries, toast notifications, empty states, mobile responsiveness, API rate limiting, the Ko-fi donation widget, and production deployment preparation.

These are not new features -- they are the polish layer that transforms a functional application into a production-ready product. Without this pass, users encounter blank screens during loads, cryptic errors on failures, no feedback after actions, broken mobile layouts, and no abuse protection on API routes.

This PRD is intentionally broad -- it touches every page and component built in PRDs 1-6. The implementation order prioritizes the highest-impact items first (error boundaries and loading states) and defers the lowest-risk items last (README, deployment checklist).

---

## 2. Goals

- **No blank screens:** Every page shows a skeleton or spinner during data fetching. No user ever sees a white screen while waiting.
- **Graceful errors:** Unhandled errors are caught by error boundaries with friendly messages and retry options. No raw stack traces in production.
- **Consistent feedback:** Every user action that modifies data produces a toast notification confirming success or explaining failure.
- **Empty states guide action:** Every list, table, and chart handles the zero-data case with helpful messaging and CTAs.
- **Mobile-first responsive:** All pages are usable on a 375px-width screen (iPhone SE) without horizontal overflow or unusable touch targets.
- **Abuse prevention:** API routes are rate-limited to prevent cost overruns and abuse, particularly the resume generation endpoint.
- **Donation support:** A non-intrusive Ko-fi widget enables voluntary financial support from users.
- **Deploy-ready:** A complete README, `.env.example`, and deployment checklist enable a fresh developer to set up the project in under 15 minutes.

### What Success Looks Like

A user signs in on their phone. The Kanban board loads with skeleton column placeholders, then populates smoothly. They drag a card to a new column -- a subtle toast confirms the move. They navigate to Analytics -- skeleton charts appear, then real data fills in. They try to generate a resume but the API errors -- a friendly toast says "Failed to generate resume. Please try again." with a retry option. A Ko-fi button floats in the bottom-right corner. The admin opens the admin panel on a tablet and sees properly laid-out tables. A new developer clones the repo, copies `.env.example`, runs three commands, and has the app running locally.

---

## 3. User Stories

### US-1: Loading States

**As a** user, **I want to** see visual feedback while pages load, **so that** I know the app is working and not broken.

**Acceptance Criteria:**
- [ ] Every page shows a skeleton placeholder during initial data fetch
- [ ] Skeletons match the general shape of the loaded content (cards, charts, tables, forms)
- [ ] Skeleton-to-content transition is smooth (no layout shift)
- [ ] Loading states appear within 100ms of navigation (no blank gap)

### US-2: Error Handling

**As a** user, **I want to** see a friendly error message when something goes wrong, **so that** I know what happened and what to do next.

**Acceptance Criteria:**
- [ ] A global error boundary (`src/app/error.tsx`) catches unhandled errors
- [ ] Each major page has its own error boundary with contextual messaging
- [ ] Error pages show: error description, "Try again" button (calls `reset()`), "Go to Board" fallback link
- [ ] A custom 404 page (`src/app/not-found.tsx`) shows app branding and a navigation link
- [ ] No raw stack traces or technical error messages are visible in production

### US-3: Toast Notifications

**As a** user, **I want to** receive confirmation after actions, **so that** I know my changes were saved.

**Acceptance Criteria:**
- [ ] All data-modifying actions produce a toast (see toast table in FR-5)
- [ ] Success toasts auto-dismiss after 3 seconds
- [ ] Error toasts persist until manually dismissed
- [ ] Toasts are positioned top-right on desktop, top-center on mobile
- [ ] Toast component is `sonner` via shadcn/ui -- consistent across the app

### US-4: Empty States

**As a** new user, **I want to** see helpful guidance when a page has no data, **so that** I know what to do next.

**Acceptance Criteria:**
- [ ] Every list, table, and chart handles the zero-data case
- [ ] Empty states include a description and a CTA button or link
- [ ] Empty states are visually distinct from loading states (no confusion between "loading" and "empty")

### US-5: Mobile Responsiveness

**As a** user on a phone, **I want to** use the app without horizontal scrolling or tiny touch targets, **so that** I can manage my job search on the go.

**Acceptance Criteria:**
- [ ] All pages are usable on a 375px-width viewport (iPhone SE) without horizontal overflow
- [ ] Touch targets are minimum 44px height
- [ ] Navigation uses a mobile hamburger menu (already in PRD 1)
- [ ] Card detail drawer becomes full-screen on mobile
- [ ] Charts resize via recharts `<ResponsiveContainer>`
- [ ] No text is truncated to unreadability

### US-6: Rate Limiting

**As the** platform operator, **I want** API routes rate-limited, **so that** a single user or bot cannot exhaust API resources or rack up costs.

**Acceptance Criteria:**
- [ ] Resume generation endpoint limited to 3 requests per minute per user
- [ ] General API endpoints limited to 60 requests per minute per user
- [ ] Rate limit exceeded returns 429 with `{ error: "Too many requests", retryAfter: <seconds> }`
- [ ] Response headers include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- [ ] Rate limiter uses Upstash Redis (works across serverless instances)
- [ ] Admin routes are exempt from rate limiting

### US-7: Ko-fi Donation Widget

**As the** platform operator, **I want** a non-intrusive donation option, **so that** users can voluntarily support server costs.

**Acceptance Criteria:**
- [ ] A Ko-fi floating button appears in the bottom-right corner on all authenticated pages
- [ ] Button text: "Support Job Seeker"
- [ ] Button color matches the app's primary theme color
- [ ] Clicking opens the Ko-fi page in a new tab
- [ ] If `NEXT_PUBLIC_KOFI_ID` is not set, no widget renders and no errors occur
- [ ] Widget does not interfere with other UI elements (proper z-index, no overlap with drawer)
- [ ] Suggested donation: $2/month

### US-9: Export My Data

**As a** user, **I want to** download all my data as a JSON file, **so that** I have a personal backup and can leave the platform without data loss.

**Acceptance Criteria:**
- [ ] An "Export Data" button exists in the user menu dropdown (nav bar)
- [ ] Clicking it triggers a download of a JSON file containing: resume source (all sections), all job applications (all fields), all interview records, all application notes, all resume generations (markdown output only, not .docx), all kanban columns
- [ ] The file is named `job-seeker-export-{YYYY-MM-DD}.json`
- [ ] Export works for any data volume up to the application cap (200 apps)
- [ ] No generated .docx files are included (user can re-download those individually)
- [ ] The export contains no internal IDs, foreign keys, or system fields -- only user-meaningful data

### US-8: Production Deployment

**As a** developer setting up the project, **I want** clear documentation and configuration, **so that** I can deploy the app in under 15 minutes.

**Acceptance Criteria:**
- [ ] `README.md` at project root with: features, tech stack, prerequisites, setup steps, deployment notes
- [ ] `.env.example` lists every required and optional environment variable with descriptions
- [ ] `npm run build` completes without errors or warnings
- [ ] Browser console is clean on all pages in production mode (no warnings, no errors)

---

## 4. Functional Requirements

### Loading States

- **FR-1:** Each page shall have a loading skeleton that matches the general layout of the loaded content:

| Page | Skeleton Pattern |
|---|---|
| `/applications` (Kanban) | 6 column outlines (matching default column count) with 2-3 card placeholders each |
| `/resume-source` | Tabbed section skeleton with form field placeholders |
| `/analytics` | 4 card outlines + 2 chart rectangle placeholders |
| `/admin` | Tab bar + 4 card outlines + table row placeholders |
| Card detail drawer | Form field rows with shimmer |
| Resume generation in progress | Spinner with "Generating your resume..." and "This usually takes 15-20 seconds" |

For Client Components (analytics, admin): loading state is managed internally via `useState` with inline skeleton rendering.
For Server Components (if any): use Next.js `loading.tsx` convention.

### Error Boundaries

- **FR-2:** Error boundaries shall be implemented at two levels:

**Global (`src/app/error.tsx`):**
- Catches any unhandled error in the app
- Shows: "Something went wrong" heading, error description (generic in production, detailed in development), "Try again" button, "Go to Board" link
- Logs the error to `console.error` (production error tracking is out of scope)

**Page-level (`src/app/{page}/error.tsx`):**
- Each of `/applications`, `/resume-source`, `/analytics`, `/admin` gets its own error boundary
- Contextual messages: "Couldn't load your applications", "Couldn't load your resume source", etc.
- Same "Try again" + fallback link pattern

**Component-level (React ErrorBoundary wrapper):**
- A reusable `<ComponentErrorBoundary>` wrapper shall be added to key areas to prevent a single broken component from nuking an entire page:
  - Individual Kanban cards (a broken card shows a minimal error state; other cards render normally)
  - Individual analytics chart sections (a broken chart shows "Unable to load" inline; other charts render)
  - Resume preview panel (a broken preview shows error; the rest of the drawer works)
- The component-level boundary renders a compact inline error (not a full-page error UI), with an optional "Retry" button

**Not Found (`src/app/not-found.tsx`):**
- Custom 404 with app branding
- "The page you're looking for doesn't exist."
- "Go to Board" button

### Toast Audit

- **FR-3:** All user-facing toasts shall use the `sonner` component (via shadcn/ui). Toast behavior:
  - Success: green accent, auto-dismiss after 3 seconds
  - Error: red accent, persists until dismissed
  - Info: neutral accent, auto-dismiss after 3 seconds
  - Warning: yellow accent, auto-dismiss after 5 seconds
  - Position: top-right on desktop (lg+), top-center on mobile

- **FR-4:** The following toasts shall be verified or added across the application. This is an audit -- some may already exist from PRDs 2-6; missing ones shall be added.

| Action | Toast | Type |
|---|---|---|
| Application created | "Application #{serial} created" | Success |
| Application deleted | "Application deleted" | Info |
| Application moved (drag) | No toast (visual feedback is sufficient) | -- |
| Column created | "Column created" | Success |
| Column deleted | "Column deleted" | Info |
| Resume source section saved | "Changes saved" | Info |
| Resume generation started | No toast (in-drawer loading state is sufficient) | -- |
| Resume generation complete | "Resume ready!" | Success |
| Resume generation failed | "Failed to generate resume. Please try again." | Error |
| Resume downloaded | No toast (browser download indicator is sufficient) | -- |
| Cap reached (generation attempt) | "Monthly limit reached ({used}/{cap}). Resets {date}." | Warning |
| Admin limit updated | "Limits updated for {name}" | Success |
| Admin limit update failed | "Failed to update limits. Please try again." | Error |
| Network error (any API call) | "Connection error. Check your internet and try again." | Error |
| Interview added | "Interview added" | Success |
| Interview deleted | "Interview deleted" | Info |

### Empty States

- **FR-5:** The following empty states shall be verified or added:

| Location | Empty State Content | CTA |
|---|---|---|
| Kanban board (no applications) | "No applications yet. Start tracking your job search." | "Add Application" button |
| Kanban column (empty) | Subtle dashed border with "Drag cards here" | -- |
| Resume source (new user) | "Build your resume source to unlock AI-powered resume generation." | "Get Started" button (navigates to contact section) |
| Analytics (no applications) | "Start tracking applications to see your analytics." | "Go to Board" link |
| Analytics (< 3 apps for time stats) | Per-metric "Not enough data" (each stat card independently shows the message if its data is null; charts with data still render) | -- |
| Interview list (no interviews) | "No interviews recorded yet." | "Add Interview" button |
| Generation history (no generations) | "No resumes generated for this application." | -- |
| Admin users (no users) | "No users have signed up yet." | -- |
| Admin generations (no generations) | "No resumes have been generated yet." | -- |

### Mobile Responsiveness

- **FR-6:** Mobile responsiveness audit shall cover all pages against these criteria:

| Component | Mobile Behavior (< 768px) |
|---|---|
| Top navigation | Hamburger menu with left slide-out (PRD 1) |
| Kanban board | Horizontal scroll with CSS snap-to-column (PRD 3) |
| Card detail drawer | Full-screen overlay instead of side panel |
| Resume source wizard | Single column; preview behind a toggle button |
| Analytics charts | `ResponsiveContainer` + truncated labels (PRD 5) |
| Analytics summary cards | 2x2 grid |
| Admin tabs | Horizontally scrollable tab bar |
| Admin user table | Horizontal scroll with sticky first column (Name) |
| Ko-fi widget | Bottom-right, does not overlap with mobile nav or drawer |

Touch targets: all interactive elements (buttons, links, form fields, table rows) shall be minimum 44px in height.

### Rate Limiting

- **FR-7:** Rate limiting shall be implemented using `@upstash/ratelimit` with Upstash Redis. This works correctly across Vercel's serverless instances (unlike in-memory approaches). Upstash free tier provides 10K commands/day, well within a hobby app's needs.

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv(); // reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN

const limiters = {
  "resume-generate": new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "60 s"),
    prefix: "rl:resume",
  }),
  "export": new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1, "300 s"),
    prefix: "rl:export",
  }),
  "api-default": new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "60 s"),
    prefix: "rl:api",
  }),
};

export async function checkRateLimit(
  category: keyof typeof limiters,
  identifier: string
): Promise<{ allowed: boolean; remaining: number; limit: number; resetAt: Date }>;
```

Rate limit categories:

| Category | Window | Max Requests | Applied To |
|---|---|---|---|
| `resume-generate` | 60 seconds | 3 | `POST /api/resume/generate` |
| `export` | 5 minutes | 1 | `GET /api/export` |
| `api-default` | 60 seconds | 60 | All other `/api/*` routes (except admin) |
| `api-admin` | -- | No limit | `/api/admin/*` (admin-only, already gated) |

- **FR-8:** Rate limit response headers shall be set on ALL API responses (not just 429s):
  - `X-RateLimit-Limit: {max}`
  - `X-RateLimit-Remaining: {remaining}`
  - `X-RateLimit-Reset: {unix timestamp}`

When the limit is exceeded, return 429:
```json
{ "error": "Too many requests", "retryAfter": 42 }
```

The frontend shall show a toast on 429: "Too many requests. Please wait a moment and try again."

### Global Fetch Wrapper

- **FR-8a:** A shared `apiFetch()` utility in `src/lib/api-fetch.ts` shall wrap all frontend API calls and return a structured result object (not trigger toasts directly):

```typescript
type ApiResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status: number; retryAfter?: number };
```

  - Wraps `fetch()` with consistent error handling
  - On network error: returns `{ ok: false, error: "Connection error...", status: 0 }`
  - On 429: returns `{ ok: false, error: "Too many requests...", status: 429, retryAfter }`
  - On 401: redirects to sign-in page
  - On other errors (4xx, 5xx): returns the error for the component to handle
  - Does NOT trigger toasts directly — toasts are the caller's responsibility
  - A separate `useApiCall()` hook handles automatic toast feedback for components that want it:
    ```typescript
    // Components that want automatic toast feedback
    const { data, loading } = useApiCall(() => apiFetch('/api/...'));
    // Silent operations (auto-save, background refresh)
    const result = await apiFetch('/api/...');
    if (!result.ok) { /* handle silently */ }
    ```
  - All API calls across the app shall use `apiFetch()` instead of raw `fetch()`

### Data Export

- **FR-13:** A `GET /api/export` endpoint shall return the user's complete data as JSON. The response assembles all user data server-side and returns it with `Content-Disposition: attachment; filename="job-seeker-export-{YYYY-MM-DD}.json"`. Rate limited to 1 request per 5 minutes per user (new rate limit category: `export`).

The export JSON structure:
```typescript
interface ExportData {
  exportedAt: string; // ISO datetime
  resumeSource: { /* all sections with user-meaningful fields */ } | null;
  kanbanColumns: Array<{ name: string; order: number; columnType: string | null }>;
  applications: Array<{
    serialNumber: number;
    company: string;
    role: string;
    // ... all user-meaningful fields
    notes: Array<{ content: string; createdAt: string }>;
    interviews: Array<{ type: string; format: string; date: string | null; people: string | null }>;
    resumeGenerations: Array<{ markdownOutput: string; createdAt: string }>;
  }>;
}
```

### Ko-fi Widget

- **FR-9:** The Ko-fi donation button shall be a **custom-built floating button** (not Ko-fi's embedded script) in `src/components/donations/kofi-widget.tsx`:
  - Built as a simple `<a>` tag styled as a floating button -- no third-party script injection, no DOM manipulation conflicts with React
  - Renders only when `NEXT_PUBLIC_KOFI_ID` is set (graceful degradation)
  - Renders only for authenticated users (not on the landing/sign-in page)
  - Position: bottom-right, `z-index` below modals/drawers but above page content
  - Button color: matches the app's primary color, works in both light and dark mode
  - Button text: "Support Job Seeker" with a heart or coffee icon
  - Opens `https://ko-fi.com/{NEXT_PUBLIC_KOFI_ID}` in a new tab (`target="_blank" rel="noopener"`)
  - The $2/month suggestion is configured on the Ko-fi page itself, not in the app

### Production Deployment

- **FR-10:** A complete `.env.example` shall list all environment variables:

```env
# Database (Railway PostgreSQL)
DATABASE_URL="postgresql://user:password@host:port/dbname?sslmode=require"

# Auth.js (v5)
AUTH_SECRET="<run: npx auth secret>"
AUTH_URL="https://your-domain.vercel.app"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Admin
ADMIN_EMAILS="paul.alex.rudd@gmail.com"

# Anthropic Claude API
ANTHROPIC_API_KEY=""
CLAUDE_MODEL="claude-sonnet-4-6"
COST_PER_INPUT_TOKEN="0.000003"
COST_PER_OUTPUT_TOKEN="0.000015"

# Upstash Redis (rate limiting)
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""

# Ko-fi (optional)
NEXT_PUBLIC_KOFI_ID=""
```

- **FR-11:** A `README.md` shall be created at the project root with:
  - Project description (1-2 sentences)
  - Feature list (bulleted)
  - Tech stack
  - Prerequisites (Node.js 20+, PostgreSQL, Google OAuth creds, Anthropic API key)
  - Local setup steps (clone, copy `.env.example`, install, migrate, seed, run)
  - Deployment notes (Vercel for app, Railway for PostgreSQL, Upstash for Redis)
  - Ko-fi support link

- **FR-12:** A pre-deployment verification checklist:
  - [ ] All environment variables set in Vercel dashboard
  - [ ] `prisma migrate deploy` runs cleanly against production Railway DB
  - [ ] Google OAuth redirect URIs include production URL
  - [ ] Upstash Redis instance created and env vars set (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`)
  - [ ] `ANTHROPIC_API_KEY` set in Vercel
  - [ ] `npm run build` succeeds locally
  - [ ] Browser console clean in production mode
  - [ ] Ko-fi widget appears (if `NEXT_PUBLIC_KOFI_ID` is set)
  - [ ] Admin auto-detection works for the configured email

---

## 5. Non-Goals (Out of Scope)

- **Custom domain setup:** Handled by the user in Vercel and DNS settings.
- **CI/CD pipeline:** Vercel handles deploys on push to main. No GitHub Actions or custom pipelines.
- **Performance optimization:** No bundle analysis, code splitting optimization, or CDN configuration beyond Next.js defaults.
- **SEO:** App is behind authentication. No meta tags, sitemap, or robots.txt needed.
- **Comprehensive accessibility audit:** Semantic HTML and keyboard navigation are maintained from PRDs 1-6. A dedicated WCAG 2.1 AA audit is deferred.
- **Internationalization (i18n):** English only.
- **Dark mode toggle:** Theme toggle was established in PRD 1 (light/dark). This PRD does not add new theme features, just ensures polish works in both modes.
- **Production error tracking (Sentry, etc.):** Errors are logged to console. External error tracking is deferred.
- **Automated test suite:** Tests were defined per-PRD. This PRD does not add a CI test runner or coverage requirements.
- **Advanced rate limiting (per-route granularity, IP-based limiting):** Rate limiting uses two broad categories. Per-endpoint tuning is deferred.

---

## 6. Design Considerations

### User Interface

**Error Boundary Layout:**
```
+------------------------------------------+
|                                          |
|         [!] Something went wrong         |
|                                          |
|   Couldn't load your applications.       |
|   This might be a temporary issue.       |
|                                          |
|   [Try Again]    [Go to Board]           |
|                                          |
+------------------------------------------+
```

**404 Page Layout:**
```
+------------------------------------------+
|                                          |
|              404                         |
|                                          |
|   The page you're looking for            |
|   doesn't exist.                         |
|                                          |
|         [Go to Board]                    |
|                                          |
+------------------------------------------+
```

**Empty State Pattern (reusable):**
```
+------------------------------------------+
|                                          |
|         [illustration/icon]              |
|                                          |
|   {Descriptive message}                  |
|                                          |
|         [{CTA button}]                   |
|                                          |
+------------------------------------------+
```

**Ko-fi Widget Position:**
```
+------------------------------------------+
|                                          |
|          [page content]                  |
|                                          |
|                                          |
|                      [Support Job Seeker]|  <- bottom-right, floating
+------------------------------------------+
```

**Components to create:**

| Component | Purpose |
|---|---|
| `src/app/error.tsx` | Global error boundary |
| `src/app/not-found.tsx` | Custom 404 page |
| `src/app/applications/error.tsx` | Kanban error boundary |
| `src/app/resume-source/error.tsx` | Resume source error boundary |
| `src/app/analytics/error.tsx` | Analytics error boundary |
| `src/app/admin/error.tsx` | Admin error boundary |
| `src/components/ui/empty-state.tsx` | Reusable empty state component (icon, message, CTA) |
| `src/components/ui/component-error-boundary.tsx` | Reusable inline error boundary for individual components |
| `src/components/donations/kofi-widget.tsx` | Ko-fi custom floating button |
| `src/lib/rate-limit.ts` | Upstash Redis rate limiter |
| `src/lib/api-fetch.ts` | Global fetch wrapper with error handling + toast integration |

### User Experience

**Journey 1: New User First Session**
1. User signs in via Google OAuth
2. Lands on Kanban board -- empty state: "No applications yet. Start tracking your job search." with "Add Application" button
3. Ko-fi widget floats in bottom-right
4. User clicks "Add Application" -- creates first card, toast: "Application #1 created"
5. User navigates to Resume Source -- empty state: "Build your resume source..."
6. User navigates to Analytics -- empty state: "Start tracking applications..."

**Journey 2: Error Recovery**
1. User navigates to Analytics but the API is down
2. Error boundary shows: "Couldn't load your analytics. This might be a temporary issue."
3. User clicks "Try Again" -- page re-fetches
4. If still failing, user clicks "Go to Board" to navigate away

**Journey 3: Rate Limited**
1. User rapidly clicks "Generate Resume" 4 times in a minute
2. First 3 succeed (or are in progress)
3. 4th request returns 429 -- toast: "Too many requests. Please wait a moment and try again."

**Loading States:** See FR-1 table for per-page skeleton patterns.

**Error States:** See FR-2 for error boundary behavior, FR-4 for toast messages on failures.

### Accessibility

- Error boundaries: error message uses `role="alert"` for screen reader announcement
- Toasts: `sonner` component provides `aria-live="polite"` announcements
- Empty states: CTA buttons are focusable, descriptive text is in semantic paragraphs
- Ko-fi widget: `aria-label="Support Job Seeker on Ko-fi"`, does not trap focus
- 404 page: heading hierarchy maintained, navigation link is focusable
- Rate limit toast: announced via `aria-live`

---

## 7. Technical Considerations

### Architecture

This PRD is cross-cutting -- it adds files to every section of the app rather than introducing a new feature module. The rate limiter is the only new library-level utility. Error boundaries and loading states use Next.js conventions. Toasts use the existing `sonner` integration.

**New files:**

| File | Purpose |
|---|---|
| `src/app/error.tsx` | Global error boundary |
| `src/app/not-found.tsx` | Custom 404 |
| `src/app/applications/error.tsx` | Kanban error boundary |
| `src/app/resume-source/error.tsx` | Resume source error boundary |
| `src/app/analytics/error.tsx` | Analytics error boundary |
| `src/app/admin/error.tsx` | Admin error boundary |
| `src/components/ui/empty-state.tsx` | Reusable empty state (icon slot, message, optional CTA) |
| `src/components/donations/kofi-widget.tsx` | Ko-fi floating widget |
| `src/lib/rate-limit.ts` | Upstash Redis rate limiter |
| `src/app/api/export/route.ts` | GET -- user data export as JSON download |
| `.env.example` | Complete environment variable template |
| `README.md` | Project documentation |

**Modified files:**

| File | Change |
|---|---|
| `src/app/layout.tsx` | Add `<KofiWidget />` and `<Toaster />` (if not already present) |
| `src/components/nav/top-nav.tsx` | Add "Export Data" button to user menu dropdown |
| `src/app/applications/page.tsx` | Add loading skeleton, empty state |
| `src/app/resume-source/page.tsx` | Add loading skeleton, empty state |
| `src/app/analytics/page.tsx` | Verify loading skeleton (already Client Component from PRD 5) |
| `src/app/admin/page.tsx` | Verify loading skeleton |
| `src/components/kanban/board.tsx` | Add empty column state ("Drag cards here") |
| `src/components/kanban/application-detail-drawer.tsx` | Add loading skeleton for drawer content |
| `src/components/resume/generation-history.tsx` | Add empty state |
| All API route handlers | Add rate limiting via `checkRateLimit()` + response headers |

### Data

No new models or migrations.

### APIs

No new endpoints. All existing API routes are modified to include:
1. Rate limit check at the top of each handler (after auth)
2. Rate limit response headers on all responses
3. 429 response when limit exceeded

### Performance

- Rate limiter: O(1) per check (Map lookup + token calculation). Memory: ~100 bytes per user per category. For 250 users and 2 categories, ~50KB total.
- Loading skeletons: render instantly from static React components. No data fetching.
- Error boundaries: zero overhead when no errors occur (React's standard error boundary mechanism).
- Ko-fi widget: external script loaded asynchronously, does not block page render.
- Toast component: `sonner` is ~4KB gzipped, renders outside the main content tree.

---

## 8. Security and Privacy

### Authentication & Authorization

- Ko-fi widget only renders for authenticated users (prevents anonymous visitors from seeing the app structure)
- Rate limiting uses `userId` as the identifier (requires authentication). Unauthenticated requests are rejected by auth middleware before reaching the rate limiter.
- Error boundaries do not expose sensitive data (no stack traces, no database details in production)

### Input Validation

- Rate limiter category and identifier are derived server-side (not from user input)
- No new user-facing inputs are introduced in this PRD

### Sensitive Data

- `.env.example` contains placeholder values only -- no real secrets
- Error messages in production are generic ("Something went wrong") -- no internal details leaked

---

## 9. Testing Strategy

### Unit Tests (vitest)

**Rate Limiter (`src/lib/__tests__/rate-limit.test.ts`):**
- 3 requests within 60s on `resume-generate` -> all allowed
- 4th request within 60s -> blocked (allowed: false)
- Wait 60s (or simulate time) -> next request allowed again
- Different users have independent limits
- Unknown category -> uses `api-default` rates
- Returns correct `remaining` and `resetAt` values

**Data Export (`src/app/api/export/__tests__/route.test.ts`):**
- Authenticated user with data -> JSON contains all applications, resume source, notes, interviews, generations
- Authenticated user with no data -> JSON with empty arrays and null resumeSource
- Unauthenticated request -> 401
- Export contains no internal IDs or foreign keys
- Rate limited to 1 per 5 minutes

### Integration Tests

**Rate Limit Headers (`src/app/api/**/__tests__/rate-limit.test.ts`):**
- Any API response includes `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers
- 429 response includes `retryAfter` in body

### E2E Tests (Playwright)

**Data Export (`e2e/export.spec.ts`):**
- Click "Export Data" in user menu → JSON file downloads
- File name matches `job-seeker-export-{YYYY-MM-DD}.json` pattern
- JSON contains expected structure (resumeSource, kanbanColumns, applications array)
- Exported application data matches what's visible on the board
- Export with no data → JSON with empty arrays and null resumeSource

**Error Boundaries (`e2e/error-handling.spec.ts`):**
- Break an API endpoint (mock 500 response) → error boundary renders with "Try Again" and "Go to Board"
- Click "Try Again" → page re-fetches
- Navigate to non-existent route → custom 404 page renders

**Toast Notifications (`e2e/toasts.spec.ts`):**
- Create application → success toast appears and auto-dismisses
- Trigger a known error (e.g., create at cap) → error toast persists until dismissed

### Manual Verification

**Loading States:**
- Throttle network in DevTools -> navigate to each page -> verify skeleton appears before content
- Verify no layout shift when content replaces skeleton

**Error Boundaries:**
- Temporarily break an API endpoint -> navigate to the page -> verify error boundary renders
- Click "Try Again" -> verify page re-fetches
- Click "Go to Board" -> verify navigation

**Mobile:**
- Open each page at 375px width in DevTools -> verify no horizontal overflow
- Verify all touch targets are >= 44px
- Verify card detail drawer is full-screen on mobile
- Verify Ko-fi widget doesn't overlap with mobile nav

**Toasts:**
- Perform each action in the toast table -> verify correct toast appears
- Verify success toasts auto-dismiss after ~3s
- Verify error toasts persist until dismissed

**Ko-fi:**
- Set `NEXT_PUBLIC_KOFI_ID` -> verify widget appears on all authenticated pages
- Unset `NEXT_PUBLIC_KOFI_ID` -> verify no widget, no console errors
- Click widget -> verify Ko-fi page opens in new tab

**Rate Limiting:**
- Use `curl` to send 4 rapid requests to `/api/resume/token` -> verify 4th returns 429
- Verify response headers on all requests

**Deployment:**
- Run `npm run build` -> verify zero errors and zero warnings
- Check browser console on all pages in production mode -> verify clean

### Edge Cases

- Error boundary inside error boundary (nested error) -> global boundary catches it
- Rate limiter with server restart (Map cleared) -> limits reset, no crash
- Ko-fi widget with slow/blocked external script -> page loads normally, widget appears later or not at all
- Toast queue overflow (10+ toasts rapidly) -> `sonner` handles queue, shows most recent
- Mobile user rotates device -> layout reflows correctly
- Empty state on a page that previously had data (user deletes all applications) -> empty state appears

---

## 10. Dependencies and Assumptions

### Dependencies

**New libraries to install:**

| Package | Purpose | Why This Library |
|---|---|---|
| `sonner` | Toast notifications | Recommended by shadcn/ui. Lightweight (~4KB), accessible, composable with shadcn themes. Likely already installed via `npx shadcn@latest add sonner`. |
| `@upstash/ratelimit` | Rate limiting | Works across Vercel serverless instances via Redis. Sliding window algorithm. ~3KB. |
| `@upstash/redis` | Redis client for Upstash | HTTP-based Redis client optimized for serverless. Required by @upstash/ratelimit. |

No other new dependencies. All other functionality uses existing libraries (Next.js, React, Tailwind, shadcn/ui, recharts).

**Existing dependencies:**
- Next.js 15, React, TypeScript, Tailwind CSS, shadcn/ui, Prisma, Auth.js v5, recharts, docx, @anthropic-ai/sdk

### Assumptions

- PRDs 1-6 are fully implemented and functional
- shadcn/ui `sonner` component is available (or can be added via `npx shadcn@latest add sonner`)
- The Ko-fi page has been created at `ko-fi.com/{NEXT_PUBLIC_KOFI_ID}`
- Next.js error boundary conventions (`error.tsx`, `not-found.tsx`) are stable in v15
- Vercel and Railway accounts are provisioned and accessible

### Known Constraints

- **Upstash Redis free tier limits:** Upstash free tier allows 10K commands/day. With ~2 rate limit checks per API call and a small user base, this is well within limits. If traffic grows significantly, upgrade to the Upstash pay-as-you-go tier ($0.2/100K commands).
- **Ko-fi widget is a custom link:** The widget is a simple styled `<a>` tag pointing to the Ko-fi page. No third-party scripts are loaded.
- **Dark mode compatibility:** All new UI elements (error boundaries, empty states, Ko-fi widget) must work in both light and dark modes. The Ko-fi widget color may need manual CSS override in dark mode.
- **Upstash latency:** Upstash Redis adds ~1-5ms per rate limit check (HTTP-based). Negligible for API response times.

---

## 11. Success Metrics

### Quantitative Metrics

| Metric | Target | How to Measure |
|---|---|---|
| Pages with loading states | 100% (all 5 main pages + drawer) | Manual audit |
| Pages with error boundaries | 100% (global + 4 page-level) | Manual audit |
| Actions with toast feedback | 100% of data-modifying actions (per FR-4 table) | Manual audit |
| Empty states implemented | 100% (per FR-5 table) | Manual audit |
| Mobile viewport (375px) | 0 horizontal overflow on any page | DevTools responsive mode |
| Touch target size | 100% of interactive elements >= 44px | DevTools measurement |
| Build warnings | 0 | `npm run build` output |
| Console errors (production) | 0 | Browser DevTools on all pages |
| Rate limit correctness | 429 returned after exceeding limit | `curl` test |

### Qualitative Metrics

| Metric | How to Assess |
|---|---|
| Loading feels fast | Skeleton appears within 100ms, content fills in smoothly |
| Errors are helpful | User knows what went wrong and what to do next |
| Empty states guide action | New user understands what to do on first visit |
| Mobile is usable | All flows completable on a phone without frustration |
| Ko-fi is non-intrusive | Widget is visible but does not interfere with workflows |

---

## 12. Implementation Order

| Phase | Scope | Risk Level | Verification |
|---|---|---|---|
| **Phase 1** | Error boundaries: global + page-level + 404 | Low | Navigate to each page, trigger error, verify boundary renders |
| **Phase 2** | Toast audit: verify/add toasts for all actions in FR-4 | Low | Perform each action, verify correct toast |
| **Phase 3** | Empty states: implement/verify all empty states in FR-5 | Low | Delete all data for a test user, verify each page |
| **Phase 4** | Loading skeletons: add skeletons for each page (FR-1) | Low | Throttle network, verify skeletons appear |
| **Phase 5** | Rate limiter: `src/lib/rate-limit.ts` + apply to all API routes | Medium | Unit tests pass, `curl` test returns 429 after limit |
| **Phase 6** | Mobile responsiveness audit: fix all issues per FR-6 | Medium | DevTools at 375px, verify all pages |
| **Phase 7** | Data export: `GET /api/export` + nav button + rate limiting | Low | Export downloads correct JSON with all user data |
| **Phase 8** | Ko-fi widget: `kofi-widget.tsx` + layout integration | Low | Widget appears on authenticated pages, graceful degradation |
| **Phase 9** | `.env.example` + `README.md` + deployment checklist | Low | New developer can set up from README in < 15 minutes |
| **Phase 10** | Final build verification: `npm run build`, console audit | Low | Zero warnings, zero console errors |

---

## Clarifying Questions

All review questions have been resolved. Key decisions documented inline:

- **Rate limiter:** Upstash Redis (`@upstash/ratelimit`) — works across serverless instances (FR-7)
- **Network errors:** Global `apiFetch()` wrapper with consistent toast handling and deduplication (FR-8a)
- **Ko-fi widget:** Custom-built floating button, no third-party script (FR-9)
- **Error boundaries:** Page-level + component-level for Kanban cards, analytics charts, resume preview (FR-2)
- **Kanban skeleton:** 6 columns matching default column count (FR-1)
- **Analytics empty states:** Per-metric "Not enough data" — each stat independent (FR-5)

**Q1: [OPTIONAL] Should the Ko-fi widget be dismissible (user can close it for the session), or always visible?**

**Q2: [OPTIONAL] Should the mobile card detail drawer include a swipe-down-to-close gesture, or just a close button?**
