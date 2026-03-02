# PRD: Project Scaffolding, Authentication & User Management

**Version:** 1.0
**Date:** 2026-02-27
**Author:** Product Management
**Status:** Draft
**Project:** Job Seeker -- Job Application Tracker

---

## 1. Introduction / Overview

Job Seeker is a greenfield web application that helps users track job applications, build structured resume source documents, and generate AI-tailored resumes. This foundational PRD establishes the project from scratch: Next.js application scaffolding, PostgreSQL database via Prisma, Google OAuth authentication via NextAuth.js, role-based access control, and the application shell.

Every subsequent feature (resume source builder, Kanban board, resume generation, analytics, admin panel) depends on the infrastructure laid here. Without this PRD, no authenticated user sessions exist, no database tables exist, and no pages render.

The admin user (`paul.alex.rudd@gmail.com`) shall be auto-detected on sign-in and granted elevated privileges. All other users default to the `USER` role with capped limits on applications (200) and resume generations (5/month).

---

## 2. Goals

- **Bootable project:** A single `npm install && npx prisma migrate dev && npm run dev` sequence shall produce a running application with zero manual configuration beyond `.env` values.
- **Working authentication:** Google OAuth sign-in shall complete end-to-end — from button click through Google consent screen to an authenticated session — in under 5 seconds on a typical connection.
- **Admin auto-detection:** The system shall assign `ADMIN` role to `paul.alex.rudd@gmail.com` on first sign-in with zero manual database intervention.
- **Protected routing:** Unauthenticated users shall see only the landing page. Authenticated non-admin users shall not access admin routes.
- **Deployment-ready:** The project shall deploy to Vercel on first push with environment variables configured. Railway PostgreSQL shall be the production database.

### What Success Looks Like

A new user visits the app, sees a clean landing page with a "Sign in with Google" button. They click it, authenticate via Google, and land on a nav shell with placeholder pages for Resume Source, Applications, Analytics, and (if admin) Admin. They can toggle dark/light mode, see their avatar in the nav, and sign out. The admin user sees all of the above plus the Admin nav link. The database contains their User, Account, and Session records. The app runs identically on localhost and Vercel.

---

## 3. User Stories

### US-1: Google Sign-In

**As a** job seeker, **I want to** sign in with my Google account, **so that** I have a persistent, secure session without creating a new username/password.

**Acceptance Criteria:**
- [ ] Clicking "Sign in with Google" initiates the Google OAuth 2.0 consent flow
- [ ] After consent, the user is redirected back to the app with an active session
- [ ] A `User`, `Account`, and `Session` record are created in the database on first sign-in
- [ ] Subsequent sign-ins reuse the existing `User` record (matched by email)
- [ ] The session persists across page refreshes until explicitly signed out or expired

### US-2: Sign Out

**As a** signed-in user, **I want to** sign out from the navigation menu, **so that** my session is terminated and my account is inaccessible to others on this device.

**Acceptance Criteria:**
- [ ] A "Sign out" option exists in the user avatar dropdown menu
- [ ] Clicking sign out clears the session and redirects to the landing page
- [ ] After sign out, visiting any protected route redirects to the landing page

### US-3: Admin Auto-Detection

**As the** platform administrator, **I want** my admin role assigned automatically when I sign in with `paul.alex.rudd@gmail.com`, **so that** I never need to manually edit the database to gain admin access.

**Acceptance Criteria:**
- [ ] On first sign-in, the `role` field is set to `ADMIN` for `paul.alex.rudd@gmail.com`
- [ ] On subsequent sign-ins, the admin role persists (not overwritten to `USER`)
- [ ] No other email address is auto-promoted to `ADMIN`

### US-4: Protected Route Access

**As an** unauthenticated visitor, **I should** only see the landing page, **so that** application data is not exposed to anonymous users.

**Acceptance Criteria:**
- [ ] Visiting `/applications`, `/resume-source`, `/analytics`, or `/admin` while unauthenticated redirects to the landing page
- [ ] Static assets and the NextAuth API routes remain accessible without authentication
- [ ] After signing in, the user can access all non-admin protected routes

### US-5: Admin Route Guard

**As a** non-admin user, **I should be** prevented from accessing the admin panel, **so that** platform management is restricted to authorized administrators.

**Acceptance Criteria:**
- [ ] Visiting `/admin` as a `USER` redirects to `/applications`
- [ ] Calling `/api/admin/*` as a `USER` returns HTTP 403
- [ ] The "Admin" nav link is not visible to non-admin users

### US-6: Navigation Shell

**As a** signed-in user, **I want to** see a consistent navigation bar on every page, **so that** I can move between features and manage my session.

**Acceptance Criteria:**
- [ ] A top navigation bar is visible on all authenticated pages
- [ ] Nav links: Resume Source, Applications, Analytics (visible to all authenticated users)
- [ ] Admin link visible only when `session.user.role === "ADMIN"`
- [ ] Right side: user avatar, name, and dropdown with sign-out option
- [ ] On mobile (below 768px): nav collapses into a hamburger menu

### US-7: Dark/Light Mode

**As a** user, **I want to** toggle between dark and light themes, **so that** the app is comfortable to use in different lighting conditions.

**Acceptance Criteria:**
- [ ] A theme toggle button exists in the navigation bar
- [ ] Clicking it toggles between dark and light mode (two states only, no "system" option)
- [ ] The preference persists across page loads (stored in localStorage)
- [ ] Default theme follows the user's system preference on first visit; once toggled, the manual choice overrides system preference

---

## 4. Functional Requirements

### Database Schema

- **FR-1:** The Prisma schema shall define the following models with the exact fields specified. All models use `cuid()` for primary keys.

**User**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | Yes | `cuid()` | Primary key |
| `name` | String | No | null | From Google profile |
| `email` | String | Yes | -- | Unique constraint |
| `emailVerified` | DateTime | No | null | NextAuth standard |
| `image` | String | No | null | Google avatar URL |
| `role` | Role enum | Yes | `USER` | `USER` or `ADMIN` |
| `applicationCap` | Int | Yes | `200` | Max job applications |
| `resumeGenerationCap` | Int | Yes | `5` | Max resumes per month |
| `resumeGenerationsUsedThisMonth` | Int | Yes | `0` | Counter, reset monthly |
| `resumeCapResetAt` | DateTime | Yes | `now()` | When counter was last reset |
| `lastActiveAt` | DateTime | Yes | `now()` | For DAU/MAU tracking |
| `createdAt` | DateTime | Yes | `now()` | Record creation |
| `updatedAt` | DateTime | Yes | `@updatedAt` | Auto-updated by Prisma |

**Account** (NextAuth standard)

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | Yes | `cuid()` | Primary key |
| `userId` | String | Yes | -- | FK to User |
| `type` | String | Yes | -- | "oauth" |
| `provider` | String | Yes | -- | "google" |
| `providerAccountId` | String | Yes | -- | Google's user ID |
| `refresh_token` | String (Text) | No | null | OAuth refresh token |
| `access_token` | String (Text) | No | null | OAuth access token |
| `expires_at` | Int | No | null | Token expiry |
| `token_type` | String | No | null | "Bearer" |
| `scope` | String | No | null | OAuth scopes |
| `id_token` | String (Text) | No | null | OIDC ID token |
| `session_state` | String | No | null | OAuth session state |

Unique constraint: `@@unique([provider, providerAccountId])`

**Session** (NextAuth standard)

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | Yes | `cuid()` | Primary key |
| `sessionToken` | String | Yes | -- | Unique |
| `userId` | String | Yes | -- | FK to User |
| `expires` | DateTime | Yes | -- | Session expiry |

**VerificationToken** (NextAuth standard)

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `identifier` | String | Yes | -- | -- |
| `token` | String | Yes | -- | Unique |
| `expires` | DateTime | Yes | -- | -- |

Unique constraint: `@@unique([identifier, token])`

- **FR-2:** The `Role` enum shall contain exactly two values: `USER` and `ADMIN`.

- **FR-3:** All foreign key relationships shall use `onDelete: Cascade` (deleting a User deletes their Accounts and Sessions).

### Authentication

- **FR-4:** Auth.js (NextAuth v5) shall be configured with the Google OAuth 2.0 provider and `@auth/prisma-adapter` for database-backed sessions. The project shall use Next.js 15 with the App Router.

- **FR-5:** Session strategy shall be `"database"` (not JWT), so sessions are stored in the Session table and revocable. Session `maxAge` shall be 30 days (2,592,000 seconds).

- **FR-6:** The NextAuth `session` callback shall attach `user.id`, `user.role`, and `user.image` to the session object, making them available via `useSession()` on the client.

- **FR-7:** On user creation (via Auth.js `events.createUser` or equivalent), if `user.email` matches any entry in the `ADMIN_EMAILS` list, set `role = ADMIN` on the User record. `ADMIN_EMAILS` shall be read from the `ADMIN_EMAILS` environment variable as a comma-separated string (e.g., `ADMIN_EMAILS="paul.alex.rudd@gmail.com,other@example.com"`). If the env var is unset, the list defaults to `["paul.alex.rudd@gmail.com"]`. Admin users retain the same default cap values in the database (applicationCap=200, resumeGenerationCap=5), but all cap-enforcement functions in the business logic layer shall return "allowed" when `role === ADMIN` — caps are bypassed at the logic layer, not the data layer.

- **FR-7a:** The resume generation cap shall reset on a calendar-month basis using **UTC**. When any cap-checking function runs, it shall compare `resumeCapResetAt` to the current UTC calendar month using `Date.getUTCFullYear()` and `Date.getUTCMonth()`. If the current UTC month differs, the counter resets to 0 and `resumeCapResetAt` updates to the 1st of the current UTC month. No cron job is needed — this is a check-on-request pattern. The UI displays "Resets {Month} 1" converted to the user's local timezone, but the underlying logic is always UTC.

### Middleware

- **FR-8:** A Next.js middleware (`src/middleware.ts`) shall protect all routes except:
  - `/` (landing page)
  - `/api/auth/*` (Auth.js endpoints)
  - `/_next/*` (static assets)
  - `/favicon.ico`

  This includes all `/api/*` routes (not just pages). Unauthenticated requests to `/api/kanban/*`, `/api/resume-source/*`, etc. shall receive HTTP 401.

- **FR-9:** The middleware shall redirect unauthenticated requests to `/`. The original destination URL shall be preserved as a `callbackUrl` query parameter (e.g., `/?callbackUrl=/analytics`). After successful sign-in, NextAuth shall redirect the user to the preserved URL instead of the default `/applications`.

- **FR-10:** The middleware shall redirect non-admin users accessing `/admin*` or `/api/admin/*` to `/applications`. Admin API routes shall return HTTP 403 instead of redirecting.

### Activity Tracking

- **FR-11:** The `lastActiveAt` field on User shall be updated during the session callback, throttled to at most once per 5 minutes per user to avoid excessive database writes. Throttling shall use a comparison of `lastActiveAt` vs. current time (no external cache needed).

### Prisma Client

- **FR-12:** A singleton Prisma client shall be exported from `src/lib/prisma.ts`, using the standard `globalThis` pattern to prevent multiple instances in development hot-reload.

---

## 5. Non-Goals (Out of Scope)

- **Resume source data entry:** No resume-related UI or data models beyond the User cap fields (PRD 2)
- **Job application CRUD:** No Kanban board or application tracking (PRD 3)
- **Resume generation:** No Claude API integration (PRD 4)
- **Analytics charts:** No data visualization (PRD 5)
- **Admin user management:** No admin table or limit-editing UI (PRD 6)
- **Ko-fi donations:** No donation widget (PRD 7)
- **Email/password auth:** Only Google OAuth is supported. No magic links, no credentials provider.
- **Multi-tenant organization support:** Users are individuals, not members of organizations.
- **Internationalization (i18n):** English only.
- **CI/CD pipeline:** Vercel auto-deploys from Git. No GitHub Actions or custom pipelines.

---

## 6. Design Considerations

### User Interface

**Landing Page (unauthenticated):**
```
+----------------------------------------------------------+
|                                                          |
|                       JOB SEEKER                         |
|              Track your job search journey               |
|                                                          |
|              +---------------------------+               |
|              |  Sign in with Google   G  |               |
|              +---------------------------+               |
|                                                          |
|  +-----------------+ +----------------+ +-------------+  |
|  | Kanban Tracking | | AI Resumes     | | Analytics   |  |
|  | Track apps with | | Generate       | | Visualize   |  |
|  | drag-and-drop   | | tailored       | | your search |  |
|  | Kanban board    | | resumes w/ AI  | | progress    |  |
|  +-----------------+ +----------------+ +-------------+  |
|                                                          |
+----------------------------------------------------------+
```

The landing page shall include three feature highlight cards below the sign-in button, briefly describing the core capabilities (Kanban board, AI resume generation, analytics). Cards are static — no interactivity, purely informational.

**Navigation Bar (authenticated):**
```
+----------------------------------------------------------+
| Job Seeker   Resume Source | Applications | Analytics     |
|            [Admin]                        [avatar v]      |
+----------------------------------------------------------+
| [Page Content]                                           |
|                                                          |
+----------------------------------------------------------+
```

**Navigation Bar (mobile, collapsed):**
```
+---------------------------+
| [=]  Job Seeker  [avatar] |
+---------------------------+
```

**Components to create:**
- `src/components/nav/top-nav.tsx` -- Horizontal nav bar with responsive hamburger
- `src/components/nav/mobile-nav.tsx` -- Left slide-out mobile menu (includes all nav links + sign-out)
- `src/components/nav/user-menu.tsx` -- Avatar dropdown with sign-out
- `src/components/theme/theme-toggle.tsx` -- Dark/light mode toggle button
- `src/components/providers/session-provider.tsx` -- NextAuth SessionProvider wrapper
- `src/components/providers/theme-provider.tsx` -- next-themes ThemeProvider wrapper

### User Experience

**Journey 1: First-Time Sign-In**
1. User visits the app URL and sees the landing page with "Sign in with Google"
2. User clicks the button; browser redirects to Google's consent screen
3. User grants consent; Google redirects back to the app
4. NextAuth creates User, Account, and Session records
5. If the email is `paul.alex.rudd@gmail.com`, the User's role is set to `ADMIN`
6. User lands on `/applications` (placeholder page) and sees the nav shell
7. Nav shows their Google avatar, name, and links to all sections

**Journey 2: Returning Sign-In**
1. User visits the app with an existing session cookie
2. Middleware verifies the session; user sees the nav shell immediately
3. `lastActiveAt` is updated (if >5 minutes since last update)

**Journey 3: Sign Out**
1. User clicks their avatar in the nav bar
2. Dropdown shows their name, email, and "Sign out" button
3. User clicks "Sign out"; NextAuth destroys the session
4. User is redirected to the landing page

**Loading States:**
- Landing page: static, no loading state needed
- Protected pages: show a centered spinner while the session is being verified via middleware
- Placeholder pages: immediate render (static content)

**Error States:**
- Google OAuth failure: custom styled error page at `src/app/api/auth/error/page.tsx` matching the app's branding (dark/light mode aware), with a friendly message and "Try again" button that re-initiates sign-in
- Database connection failure: Next.js error boundary with "Something went wrong. Please try again later."
- Session expired: middleware redirects to landing page (user re-authenticates)

**Mobile Navigation:**
- Hamburger icon on the left of the top bar
- Tapping it opens a Sheet (shadcn/ui) sliding in from the left
- The slide-out contains all nav links (Resume Source, Applications, Analytics, Admin if applicable) and the user's name/email with a "Sign out" button at the bottom
- No separate avatar dropdown on mobile — the slide-out menu is the single access point for all navigation and account actions

### Accessibility

- All interactive elements shall be keyboard-navigable (tab order follows visual order)
- The "Sign in with Google" button shall have an `aria-label` of "Sign in with your Google account"
- The mobile hamburger menu shall use `aria-expanded` and `aria-controls`
- Nav links shall use semantic `<nav>` element with `aria-label="Main navigation"`
- Theme toggle shall announce the current mode to screen readers
- Color contrast shall meet WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text) in both themes

---

## 7. Technical Considerations

### Architecture

This is a Next.js 15 App Router application with server-side rendering, API routes, and a PostgreSQL database via Prisma. Authentication uses Auth.js v5 (NextAuth v5), which has a different configuration pattern than v4: auth config lives in `src/lib/auth.ts` exporting `handlers`, `auth`, `signIn`, `signOut` via `NextAuth()`, and the route handler at `src/app/api/auth/[...nextauth]/route.ts` re-exports `handlers.GET` and `handlers.POST`.

**Cross-cutting conventions established in this PRD:**
- All server-side date/time operations use UTC. No timezone conversion happens on the server. The client converts UTC timestamps to local time for display.
- All API route handlers validate request bodies using Zod schemas defined in `src/lib/validations/`. Each route imports its schema, parses the body, and returns 400 with Zod's error messages on failure. PRDs 2-7 inherit this convention.

**New files:**

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | Database schema (User, Account, Session, VerificationToken) |
| `src/app/layout.tsx` | Root layout with providers, Inter font, Tailwind globals |
| `src/app/page.tsx` | Landing page / sign-in |
| `src/app/applications/page.tsx` | Placeholder page |
| `src/app/resume-source/page.tsx` | Placeholder page |
| `src/app/analytics/page.tsx` | Placeholder page |
| `src/app/admin/page.tsx` | Placeholder page (admin-only) |
| `src/app/api/auth/[...nextauth]/route.ts` | Auth.js catch-all route handler (re-exports `handlers.GET` and `handlers.POST`) |
| `src/app/auth/error/page.tsx` | Custom styled OAuth error page with "Try again" button |
| `src/middleware.ts` | Route protection and admin guard |
| `src/lib/prisma.ts` | Singleton Prisma client |
| `src/lib/auth.ts` | NextAuth configuration, admin email list, session helpers |
| `src/lib/utils.ts` | shadcn `cn()` utility |
| `src/components/nav/top-nav.tsx` | Navigation bar |
| `src/components/nav/mobile-nav.tsx` | Mobile slide-out menu |
| `src/components/nav/user-menu.tsx` | Avatar dropdown |
| `src/components/theme/theme-toggle.tsx` | Dark/light toggle |
| `src/components/providers/session-provider.tsx` | NextAuth SessionProvider |
| `src/components/providers/theme-provider.tsx` | next-themes ThemeProvider |
| `.env.example` | Documented environment variables |
| `docker-compose.yml` | Local PostgreSQL for development (port 5432, db: `jobseeker`) |
| `next.config.ts` | Next.js configuration |
| `tailwind.config.ts` | Tailwind with shadcn/ui theme |
| `postcss.config.mjs` | PostCSS configuration |
| `tsconfig.json` | TypeScript configuration |
| `src/lib/validations/index.ts` | Shared `validateBody()` helper for Zod-based API input validation |
| `vitest.config.ts` | Vitest configuration with path aliases, coverage thresholds, environment settings |
| `playwright.config.ts` | Playwright configuration with webServer, baseURL, storageState |
| `src/test/setup.ts` | Global test setup: mock next-auth, reset mocks between tests |
| `src/test/db.ts` | Test database helpers: seed/teardown, transactional isolation |
| `src/test/fixtures.ts` | Factory functions for all models (User, Account, Session, etc.) |
| `src/test/auth-mock.ts` | Mock `auth()` helper for integration tests |
| `e2e/helpers/auth.ts` | Playwright auth helper: sign-in + storageState reuse |
| `e2e/auth.spec.ts` | E2E: sign-in, sign-out, route protection |
| `e2e/navigation.spec.ts` | E2E: nav links, admin visibility, mobile hamburger |
| `.env.test` | Test environment variables (test database URL) |

### Data

Full Prisma schema is specified in FR-1 through FR-3. The initial migration shall be named `init_auth`.

Key indexes (auto-created by Prisma from schema constraints):
- `User.email` — unique index
- `Account.[provider, providerAccountId]` — unique compound index
- `Session.sessionToken` — unique index
- `VerificationToken.[identifier, token]` — unique compound index

### APIs

| Method | Endpoint | Description |
|---|---|---|
| `GET/POST` | `/api/auth/[...nextauth]` | NextAuth catch-all (sign-in, sign-out, session, CSRF) |

No custom API routes are introduced in this PRD. All data operations happen through NextAuth's built-in adapter flows.

**Example session response (`GET /api/auth/session`):**
```json
{
  "user": {
    "id": "clx1abc...",
    "name": "Alex Rudd",
    "email": "paul.alex.rudd@gmail.com",
    "image": "https://lh3.googleusercontent.com/...",
    "role": "ADMIN"
  },
  "expires": "2026-03-29T12:00:00.000Z"
}
```

### Performance

- Page load (landing page): under 1 second on 4G connection (static page, minimal JS)
- OAuth round-trip: under 5 seconds (dominated by Google's consent screen, not app code)
- Session check in middleware: under 50ms (single database lookup by session token, indexed)
- `lastActiveAt` throttle: reduces writes from every request to at most once per 5 minutes per user

### Environment Variables

```env
# Database — local Docker default shown; replace with Railway URL for production
DATABASE_URL="postgresql://jobseeker:jobseeker@localhost:5432/jobseeker?connection_limit=3&pool_timeout=10"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET=""

# Google OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Admin (comma-separated emails; defaults to paul.alex.rudd@gmail.com if unset)
ADMIN_EMAILS="paul.alex.rudd@gmail.com"
```

---

## 8. Security and Privacy

### Authentication & Authorization

- Google OAuth 2.0 via NextAuth.js handles all authentication. No custom password storage, no credential management.
- Sessions are database-backed (not JWT), making them server-revocable.
- CSRF protection is built into NextAuth's API routes.
- The `NEXTAUTH_SECRET` must be a cryptographically random string (minimum 32 bytes).

### Input Validation

- No user-submitted form inputs exist in this PRD (Google provides all profile data).
- The admin email check uses a strict `===` comparison against a hardcoded allow-list. No regex, no partial matching.

### Sensitive Data

- OAuth tokens (`access_token`, `refresh_token`, `id_token`) are stored in the Account table. These shall never be exposed to the client via the session callback.
- The session callback shall only expose: `user.id`, `user.name`, `user.email`, `user.image`, `user.role`.
- `DATABASE_URL` and `NEXTAUTH_SECRET` shall be stored exclusively in environment variables, never committed to source control.

---

## 9. Testing Strategy

This PRD establishes the test infrastructure used by all subsequent PRDs. Both vitest (unit/integration) and Playwright (E2E) are configured here so later PRDs can focus on writing tests, not setting up tooling.

### Test Infrastructure Setup

**vitest configuration (`vitest.config.ts`):**
- Configured with `@vitejs/plugin-react` for JSX support
- Path aliases matching `tsconfig.json` (e.g., `@/` → `src/`)
- Environment: `node` for API route tests, `jsdom` for component tests (configurable per-file via `// @vitest-environment jsdom` directive)
- Coverage via `@vitest/coverage-v8` with thresholds: 80% line coverage for `src/lib/` files
- Setup file: `src/test/setup.ts` — global mocks and test utilities

**Playwright configuration (`playwright.config.ts`):**
- Base URL: `http://localhost:3000`
- Test directory: `e2e/`
- `webServer` config to auto-start `npm run dev` before tests
- Browser: Chromium only for R1 (cross-browser testing is deferred)
- Auth state reuse: `storageState` pattern for authenticated tests (avoids re-signing-in for every test)

**Test utilities (`src/test/`):**

| File | Purpose |
|---|---|
| `src/test/setup.ts` | Global setup: mock `next-auth`, reset mocks between tests |
| `src/test/db.ts` | Test database helpers: seed/teardown functions, isolated test transactions |
| `src/test/fixtures.ts` | Factory functions for User, Account, Session, and all models from PRDs 2-7. Each factory returns realistic defaults with overrides. |
| `src/test/auth-mock.ts` | Mock `auth()` helper: returns a configurable session for integration tests without hitting OAuth |
| `e2e/helpers/auth.ts` | Playwright auth helper: signs in via Google OAuth test account (or mock) and saves `storageState` for reuse |

**Test database strategy:**
- Integration tests use the same PostgreSQL schema but within a transaction that is rolled back after each test (no persistent side effects).
- The `DATABASE_URL` for tests can point to a separate test database (configured via `.env.test`) or the dev database with transactional isolation.
- E2E tests use a seeded test database that is reset before each test suite via `prisma migrate reset --force` + seed script.

### Unit Tests (vitest)

**Middleware (`src/middleware.test.ts`):**
- Unauthenticated request to `/applications` → redirect to `/?callbackUrl=/applications`
- Authenticated non-admin request to `/admin` → redirect to `/applications`
- Authenticated admin request to `/admin` → passes through
- Request to `/api/auth/*` → passes through (no auth check)
- Request to `/api/admin/*` as non-admin → 403
- `callbackUrl` is preserved through the redirect chain

**Admin Detection (`src/lib/__tests__/auth.test.ts`):**
- Email in `ADMIN_EMAILS` → role set to ADMIN
- Email not in `ADMIN_EMAILS` → role set to USER
- Multiple emails in comma-separated `ADMIN_EMAILS` → all detected correctly
- Case-insensitive matching → `Paul.Alex.Rudd@Gmail.com` still matches

**Cap Utilities (`src/lib/__tests__/caps.test.ts`):**
- User with usage below cap → returns allowed
- User with usage at cap → returns blocked
- Admin user → always returns allowed (bypass)
- Monthly reset logic: user with stale `resumeCapResetAt` → counter resets to 0

### Integration Tests (vitest)

**Auth Session Callback:**
- Sign-in event with new Google account → User created with role USER
- Sign-in event with admin email → User created with role ADMIN
- Sign-in event with existing account → User record not duplicated
- Session callback returns `user.id`, `user.name`, `user.email`, `user.image`, `user.role`
- Session callback does NOT expose OAuth tokens

**lastActiveAt Throttling:**
- First request → `lastActiveAt` updated
- Request within 5 minutes → `lastActiveAt` NOT updated
- Request after 5 minutes → `lastActiveAt` updated

### E2E Tests (Playwright)

**Auth Flow (`e2e/auth.spec.ts`):**
- Visit `/applications` while unauthenticated → redirected to landing page
- Sign in via Google OAuth → redirected to `/applications`
- Nav bar shows user name and avatar
- Sign out → redirected to landing page
- After sign out, visit `/applications` → redirected to landing page

**Navigation (`e2e/navigation.spec.ts`):**
- Authenticated user → all nav links work (Applications, Resume Source, Analytics)
- Admin user → "Admin" link visible in nav, navigates to `/admin`
- Non-admin user → "Admin" link not visible
- Mobile: hamburger menu opens and closes, contains all links

### Edge Cases

- User signs in from two browsers simultaneously — both sessions shall work independently
- User revokes Google OAuth access from Google's security settings — next session check shall fail gracefully (redirect to sign-in)
- `DATABASE_URL` is invalid — app shall fail to start with a clear Prisma connection error, not a cryptic runtime crash
- `NEXTAUTH_SECRET` is missing — NextAuth shall throw a clear error on startup

---

## 10. Dependencies and Assumptions

### Dependencies

**New libraries to install:**

| Package | Purpose | Why This Library |
|---|---|---|
| `next` | React framework | Project requirement |
| `react`, `react-dom` | UI library | Required by Next.js |
| `typescript`, `@types/node`, `@types/react`, `@types/react-dom` | Type safety | Project standard |
| `tailwindcss`, `postcss`, `autoprefixer` | Styling | Project requirement |
| `next-auth@beta` | Authentication (Auth.js v5) | Latest version with native App Router support, exports `NextAuth()` config pattern |
| `@auth/prisma-adapter` | Database adapter for NextAuth | Stores sessions in PostgreSQL instead of cookies |
| `@prisma/client` | Database ORM client | Project requirement (Railway PostgreSQL) |
| `prisma` (dev) | Schema management and migrations | Required by @prisma/client |
| `next-themes` | Dark/light mode | 2KB, handles SSR hydration mismatch, localStorage persistence, system preference detection |
| `class-variance-authority` | Component variant styling | Required by shadcn/ui |
| `clsx` | Conditional class names | Required by shadcn/ui |
| `tailwind-merge` | Tailwind class deduplication | Required by shadcn/ui |
| `lucide-react` | Icon library | Required by shadcn/ui |
| `zod` | Runtime input validation for API routes | Type-safe schema validation that infers TypeScript types. ~12KB. Eliminates manual validation code in route handlers. |
| `vitest` (dev) | Unit and integration test framework | Fast, Vite-native, compatible with Next.js. Supports both node and jsdom environments. |
| `@vitejs/plugin-react` (dev) | JSX support in vitest | Required for testing React components in vitest. |
| `@vitest/coverage-v8` (dev) | Code coverage | V8-based coverage, fast and accurate. |
| `@playwright/test` (dev) | End-to-end testing | Browser automation for critical user flows. Maintained by Microsoft, excellent Next.js support. |

**shadcn/ui components to install via CLI:**
`button`, `card`, `dropdown-menu`, `avatar`, `separator`, `sheet` (for mobile nav)

> **Traceability note:** The original requirements document states "recommend a MCP or library that we should load to provide a specialist output" for UI quality. This project adopts **shadcn/ui** (copy-paste component library built on Radix UI primitives) + **Tailwind CSS** as the specialist UI stack. shadcn/ui provides accessible, composable components with built-in dark mode support, animation, and consistent design tokens — satisfying the requirement for shading, color-coding, and aesthetic polish without a heavy design system dependency.

### Assumptions

- The user has a Google Cloud project with OAuth 2.0 credentials configured (consent screen, redirect URIs)
- For local development: Docker is installed (a `docker-compose.yml` with PostgreSQL shall be included in the project root)
- For production: Railway PostgreSQL instance is provisioned and the connection string is available
- Vercel project is created and linked to the Git repository
- Node.js 20+ is the runtime environment
- The app will be the only consumer of this PostgreSQL database (no shared schemas)

### Known Constraints

- Railway hobby tier has connection limits (~5 concurrent connections). For R1, use Prisma's built-in connection pool with `connection_limit=3` in the DATABASE_URL query string: `?connection_limit=3&pool_timeout=10`. This leaves headroom for Prisma Studio and migrations. If concurrent users exceed 3-4, add PgBouncer (Railway one-click addon) or Prisma Accelerate. The Prisma singleton pattern prevents multiple clients in development.
- Vercel serverless functions have a 10-second timeout on hobby tier. This is sufficient for all operations in this PRD.
- NextAuth's Prisma adapter requires specific field names on Account/Session models — the schema must match exactly.

---

## 11. Success Metrics

### Quantitative Metrics

| Metric | Target | How to Measure |
|---|---|---|
| Time from `npm install` to running app | Under 2 minutes | Manual test on a fresh clone |
| Google OAuth round-trip | Under 5 seconds | Manual test with browser devtools |
| Landing page load (Lighthouse) | Performance score > 90 | Lighthouse audit |
| Protected route redirect latency | Under 100ms | Browser devtools network tab |
| Database tables created by migration | 4 (User, Account, Session, VerificationToken) | `npx prisma studio` |
| Build errors on Vercel | 0 | Vercel deployment log |

### Qualitative Metrics

| Metric | How to Assess |
|---|---|
| Sign-in flow feels frictionless | Manual walkthrough — no unexpected prompts, errors, or delays |
| Nav shell looks polished | Visual review in both dark and light mode on desktop and mobile |
| Code organization is clear | A new developer can find auth config, middleware, and components within 30 seconds |

---

## 12. Implementation Order

| Phase | Scope | Risk Level | Verification |
|---|---|---|---|
| **Phase 1** | Project init: `create-next-app`, Tailwind, shadcn/ui, TypeScript config, `.env.example` | Low | `npm run dev` starts without errors |
| **Phase 2** | Prisma schema, Railway connection, initial migration | Low | `npx prisma migrate dev` succeeds; `prisma studio` shows 4 tables |
| **Phase 3** | NextAuth config: Google provider, Prisma adapter, session callback, admin detection | Medium | Sign in with Google works; session includes `user.id` and `user.role` |
| **Phase 4** | Middleware: route protection, admin guard | Low | Unauthenticated redirect works; non-admin cannot access `/admin` |
| **Phase 5** | Nav shell: top nav, mobile nav, user menu, theme toggle | Low | All nav elements render; hamburger works on mobile; theme toggle persists |
| **Phase 6** | Placeholder pages, landing page, Vercel deployment config | Low | All routes render; Vercel build succeeds |
| **Phase 7** | Test infrastructure: vitest config, Playwright config, test utilities, fixtures, auth mocks | Medium | `npm test` runs, `npx playwright test` runs, sample tests pass |
| **Phase 8** | Automated tests: middleware unit tests, admin detection tests, auth E2E, navigation E2E | Medium | All tests pass, coverage thresholds met for `src/lib/` |

---

## Clarifying Questions

*All questions from the review cycle have been resolved. Decisions are incorporated into the PRD above:*

- **Session expiration:** 30 days (FR-5)
- **Framework versions:** Next.js 15 + Auth.js v5 (FR-4, Section 7)
- **Return-to URL:** Preserved via callbackUrl (FR-9)
- **Admin cap bypass:** Business logic layer, not data layer (FR-7)
- **Cap reset period:** Calendar month, check-on-request (FR-7a)
- **Local dev database:** Docker Compose with PostgreSQL (Section 10)
- **Theme toggle:** Two states only — light and dark (US-7)
- **Landing page:** Feature highlight cards below sign-in (Section 6)
- **OAuth error page:** Custom styled, matches app branding (Section 6)
- **Mobile nav:** Left slide-out with all links + sign-out (Section 6)
- **API route auth:** All /api/* protected except /api/auth/* (FR-8)
- **Admin emails:** Environment variable, comma-separated (FR-7)
- **UI library traceability:** shadcn/ui noted as fulfilling original requirement (Section 10)
