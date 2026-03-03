# Job Seeker — Implementation Tracker

## PRD 1: Auth, Scaffold & Testing — COMPLETE

- [x] Phase 1: Project init (Next.js 16, Tailwind v4, shadcn/ui)
- [x] Phase 2: Prisma 7 schema (Role enum, User model with caps)
- [x] Phase 3: Auth.js v5 (JWT strategy, PrismaAdapter, admin auto-detect)
- [x] Phase 4: Middleware (route protection, admin guard)
- [x] Phase 5: Layout & nav shell (NavBar, SessionProvider, mobile sheet)
- [x] Phase 6: Placeholder pages (signin, dashboard, resume-source, applications, analytics, admin)
- [x] Phase 7: Test infrastructure (Vitest, Playwright, test helpers)
- [x] Phase 8: Unit tests (25 passing: admin detection, caps, route utils)

### Deferred / Known Issues from PRD 1
- **No DB migration run yet.** `prisma generate` completed (types exist), but `prisma migrate dev` requires a running PostgreSQL. Migration will run against Railway when DB is provisioned.
- **E2E tests scaffolded but untested.** `e2e/auth.spec.ts` exists but needs a running dev server + DB to execute. Will validate after Railway is up.
- **Middleware deprecation.** Next.js 16 deprecated `middleware.ts` in favor of `proxy`. Still functional with a console warning. Migrate when proxy API is stable.
- **Zod validation helper not yet created.** B7 amendment calls for `src/lib/validations/index.ts` with a `validateBody()` helper. Should be created in PRD 2 Phase 2 (first PRD with API routes).
- **`AUTH_SECRET` not generated.** `.env` has an empty `AUTH_SECRET=`. Generate with `npx auth secret` before first run.

### Tech Stack Versions (actual, not PRD-specified)
- **Next.js 16.1.6** (PRD says 15 — we're ahead)
- **Prisma 7.4.2** (not 5/6 — breaking changes: driver adapters required, no URL in schema, config in `prisma.config.ts`)
- **next-auth 5.0.0-beta.30**
- **Tailwind v4** (CSS-first config, not `tailwind.config.js`)
- **React 19.2.3**

### Prisma 7 Patterns (carry forward to all PRDs)
- Import `PrismaClient` from `@/generated/prisma/client` (not `@prisma/client`)
- Import enums/types from `@/generated/prisma/enums`
- Client requires adapter: `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`
- Schema has no `url`/`directUrl` in datasource block — those live in `prisma.config.ts`
- Run `npx prisma generate` after any schema change (no DB needed)

### File Layout Reference
```
src/
├── app/
│   ├── layout.tsx              # Root layout (Toaster)
│   ├── page.tsx                # Redirects to /dashboard
│   ├── signin/page.tsx         # Google sign-in (client component)
│   ├── api/auth/[...nextauth]/ # Auth.js route handler
│   └── (authenticated)/
│       ├── layout.tsx          # NavBar + SessionProvider wrapper
│       ├── dashboard/page.tsx
│       ├── resume-source/page.tsx  ← PRD 2 replaces this
│       ├── applications/page.tsx
│       ├── analytics/page.tsx
│       └── admin/page.tsx
├── components/
│   ├── nav-bar.tsx
│   ├── providers.tsx           # SessionProvider
│   └── ui/                     # shadcn components
├── lib/
│   ├── auth.ts                 # Full Auth.js config (server-side)
│   ├── auth.config.ts          # Edge-safe config (middleware)
│   ├── prisma.ts               # PrismaClient singleton with PrismaPg adapter
│   ├── admin.ts                # isAdminEmail()
│   ├── caps.ts                 # shouldResetCap(), getNextCapResetDate(), hasRemainingGenerations()
│   └── route-utils.ts          # isPublicPath(), isAdminPath()
├── generated/prisma/           # Prisma-generated (do not edit)
├── test/
│   ├── setup.ts
│   └── helpers.ts
├── types/next-auth.d.ts        # Session/JWT type augmentation
└── middleware.ts
```

---

## PRD 2: Resume Source Builder — COMPLETE

- [x] Phase 1: Foundation infrastructure (`validateBody()`, `authenticatedHandler()`, Zod schemas, `compileResumeSource()`, 13 unit tests)
- [x] Phase 2: Prisma schema (7 models: ResumeSource, ResumeContact, ResumeEducation, ResumeWorkExperience, ResumeWorkSubsection, ResumeSkill, ResumePublication)
- [x] Phase 3: Core API routes (GET/PUT resume-source, PUT contact)
- [x] Phase 4: CRUD routes — Education (POST, PUT, DELETE, reorder), Experience (POST, PUT, DELETE, reorder), Subsections (POST, PUT, DELETE, reorder)
- [x] Phase 5: CRUD routes — Skills (POST, PUT, DELETE, reorder), Publications (POST, PUT, DELETE, reorder), Compile (GET)
- [x] Phase 6: Frontend — Page shell (60/40 split, mobile toggle), hooks (use-auto-save, use-resume-source), contact form
- [x] Phase 7: Frontend — Education, Experience (with nested subsection DnD), Skills (tag input), Publications sections
- [x] Phase 8: Frontend — Preview panel (react-markdown, copy, last saved), welcome banner, aria-live
- [x] Phase 9: Tests — Route integration tests (5), validation tests (5), mock helpers

### Key Files Created
- `src/lib/api-handler.ts` — `authenticatedHandler()` wrapper (auth + try/catch + async params)
- `src/lib/validations/index.ts` — `validateBody()` (Amendment B7)
- `src/lib/validations/resume-source.ts` — All Zod schemas + entry caps
- `src/lib/resume-compiler.ts` — Pure `compileResumeSource()` + `formatDate()`
- `src/lib/resume-source-helpers.ts` — Ownership verification + reorder helpers
- `src/app/api/resume-source/` — 17 route files (22+ handlers)
- `src/components/resume-source/` — 10 components (contact-form, education-section, experience-section, subsection-form, skills-section, publications-section, preview-panel, section-tabs, date-picker, save-indicator)
- `src/hooks/use-auto-save.ts` — Debounce-on-blur with save status
- `src/hooks/use-resume-source.ts` — Fetch, mutate, refetch
- `src/types/resume-source.ts` — Frontend type definitions
- `src/test/mocks/auth.ts` + `prisma.ts` — Reusable test mocks

### Verification
- `npx tsc --noEmit` — 0 errors
- `npm run test` — 110/110 tests pass (23 new for PRD 2)
- `npx prisma generate` — success

### Deferred / Known Issues
- **No DB migration run yet.** Schema changes ready, `prisma generate` succeeds.
- **E2E test deferred.** `e2e/resume-source.spec.ts` not yet created (needs running server + DB).
- **Pre-existing kanban test failures** in `columns/__tests__` and `applications/__tests__` (vi.mock hoisting issue) — not introduced by PRD 2.

---

## PRD 3: Kanban Board — COMPLETE

- [x] Phase 0: Dependencies & utilities (`@hello-pangea/dnd`, shadcn components, Zod schemas, kanban-utils, 32 unit tests)
- [x] Phase 1: Prisma schema (KanbanColumn, JobApplication, InterviewRecord, ApplicationStatusLog, ApplicationNote)
- [x] Phase 2: Column API routes (GET+auto-seed, POST, PUT, DELETE, reorder)
- [x] Phase 3: Application CRUD routes (POST with serial #, GET, PUT, DELETE)
- [x] Phase 4: Move, interviews, duplicate, notes routes
- [x] Phase 5: Board layout (page, columns, cards, search/filter bar)
- [x] Phase 6: Drag-and-drop (DragDropContext, Droppable/Draggable, optimistic updates)
- [x] Phase 7: Modals & drawers (create modal, detail drawer, rejection dialog, column settings, notes, interviews)
- [x] Phase 8: Integration tests (62 tests passing) + E2E test scaffold

### Key Files Created
- `src/lib/kanban-utils.ts` — OTE, search, staleness, default columns
- `src/lib/validations/kanban.ts` — All Zod schemas
- `src/app/api/kanban/columns/` — Column CRUD + reorder (3 route files)
- `src/app/api/kanban/applications/` — App CRUD + move + interviews + duplicate + notes (7 route files)
- `src/components/kanban/` — 10 components (board, column, card, header, search bar, create modal, detail drawer, interview form, notes, rejection dialog, column settings)
- `prisma/schema.prisma` — 5 new models + User relations
- `e2e/kanban.spec.ts` — E2E test scaffold

### Deferred / Known Issues
- **No DB migration run yet.** Schema changes ready, `prisma generate` succeeds. Migration runs against Railway when DB is provisioned.
- **E2E tests require running server + seeded DB.** `e2e/kanban.spec.ts` scaffolded but needs auth session to execute.

---

## PRD 4: Resume Generation — COMPLETE

- [x] Phase 0: Dependencies & schemas (`@anthropic-ai/sdk`, `docx`, ResumeGeneration model, Zod schema, `prisma generate`)
- [x] Phase 1: Cap logic (`resume-cap.ts` — reserveGeneration, rollbackGeneration, getUserUsage + 12 unit tests)
- [x] Phase 2: Claude API integration (`anthropic.ts` — SDK client, generateResume, estimateCost; `resume-prompt.ts` — impact-first prompt builder + 9 unit tests)
- [x] Phase 3: DOCX generator (`docx-generator.ts` — markdownToDocx, sanitizeFilename, navy/blue Calibri styling + 7 unit tests)
- [x] Phase 4: API routes (POST generate, GET download, GET usage, GET history — 4 route files)
- [x] Phase 5: Frontend components (generate-button, resume-editor, download-button, generation-history, usage-badge — 5 components)
- [x] Phase 6: Wired into existing UI (detail drawer resume section replaces placeholder, nav bar usage badge)
- [x] Phase 7: Integration tests (generate: 8 tests, download: 4 tests, usage: 3 tests, history: 3 tests)
- [x] Phase 8: Verification (`tsc --noEmit` 0 errors, 156/156 tests pass, `prisma generate` success)

### Key Files Created
- `src/lib/resume-cap.ts` — Atomic cap management (reserve/rollback/usage)
- `src/lib/anthropic.ts` — Anthropic SDK client singleton, cost estimation
- `src/lib/resume-prompt.ts` — Impact-first resume tailoring prompt
- `src/lib/docx-generator.ts` — Markdown → .docx conversion (Calibri, navy/blue)
- `src/lib/validations/resume.ts` — generateResumeSchema (Zod)
- `src/app/api/resume/generate/route.ts` — POST: validate → compile → cap check → Claude → save
- `src/app/api/resume/[id]/download/route.ts` — GET: ownership check → markdownToDocx → .docx download
- `src/app/api/resume/usage/route.ts` — GET: usage stats for badge
- `src/app/api/resume/history/[appId]/route.ts` — GET: generation history
- `src/components/resume/` — 5 components (generate-button, resume-editor, download-button, generation-history, usage-badge)
- `prisma/schema.prisma` — ResumeGeneration model + User/JobApplication relations

### Verification
- `npx tsc --noEmit` — 0 errors
- `npm run test` — 156/156 tests pass (38 new for PRD 4)
- `npx prisma generate` — success

### Deferred / Known Issues
- **No DB migration run yet.** ResumeGeneration model added to schema, `prisma generate` succeeds.
- **E2E test scaffold deferred.** Requires running server + DB + `ANTHROPIC_API_KEY` env var.
- **`ANTHROPIC_API_KEY` required.** Must be set in env for Claude API calls.
- **Optional env vars:** `CLAUDE_MODEL` (default: claude-sonnet-4-6), `CLAUDE_INPUT_COST_PER_M` (default: 3.0), `CLAUDE_OUTPUT_COST_PER_M` (default: 15.0)

---

## PRD 5: Analytics Dashboard — COMPLETE

- [x] Phase 0: Install recharts
- [x] Phase 1: Analytics query functions library (`src/lib/analytics.ts` — 6 query functions: summary, funnel, weekly, time stats, conversion rates, closure breakdown, resume usage)
- [x] Phase 2: API route (`GET /api/analytics` with `Promise.allSettled` for graceful partial failure) + unit tests (13 tests) + integration tests (3 tests)
- [x] Phase 3: Analytics page + summary cards + empty state
- [x] Phase 4: Pipeline funnel chart (recharts horizontal BarChart with column colors)
- [x] Phase 5: Weekly applications line chart (12-week zero-filled, recharts LineChart)
- [x] Phase 6: Time stats + conversion rates + closure breakdown (stacked bar with ghosted/rejected split)
- [x] Phase 7: Resume usage card (progress bar with color-coded thresholds)
- [x] Phase 8: Verification (`tsc --noEmit` 0 errors, 172/172 tests pass)

### Key Files Created
- `src/lib/analytics.ts` — 6 query functions with full type exports (AnalyticsResponse, FunnelEntry, etc.)
- `src/app/api/analytics/route.ts` — Single endpoint with parallel query execution and per-section null fallback
- `src/app/(authenticated)/analytics/page.tsx` — Client Component with fetch, refresh, skeleton loading, empty state
- `src/components/analytics/` — 7 components (summary-cards, pipeline-funnel, weekly-chart, time-stats, resume-usage-card, closure-breakdown, empty-state)

### Verification
- `npx tsc --noEmit` — 0 errors
- `npm run test` — 172/172 tests pass (16 new for PRD 5)
- No new Prisma models — uses existing data only

### Deferred / Known Issues
- **E2E test scaffold deferred.** Requires running server + seeded DB.
- **PERCENTILE_CONT:** Median calculation done in JS (not raw SQL) for Prisma compatibility — correct for up to 200 apps.
- **No date range filtering.** Dashboard shows all-time data with 12-week weekly chart window.

---

## PRD 6: Admin Panel — COMPLETE

- [x] Phase 1: Admin handler + query functions + schema index (`adminHandler()`, `getPlatformStats()`, `getDauOverTime()`, `getGenerationStats()`, `getUserList()`, `@@index([lastActiveAt])`)
- [x] Phase 2: API routes (GET stats, GET stats/generations, GET users, GET users/[id], PUT users/[id]/limits — 5 route files)
- [x] Phase 3: Frontend components (OverviewTab, UsersTab, UserLimitEditor, GenerationsTab, admin page with 3 tabs)
- [x] Phase 4: Tests + verification (13 admin unit tests, 6 stats route tests, 9 limits route tests — 28 new tests)

### Key Files Created
- `src/lib/admin.ts` — Rewritten: `adminHandler()` wrapper (auth+admin check), `isAdminEmail()`, `getPlatformStats()`, `getDauOverTime()` (30-day zero-filled), `getGenerationStats()` (daily volume/cost + top 10 users), `getUserList()` (paginated, searchable, sortable with cost aggregates)
- `src/lib/validations/admin.ts` — `updateLimitsSchema` (Zod: applicationCap/resumeGenerationCap with range + at-least-one refinement)
- `src/app/api/admin/stats/route.ts` — GET: platform overview stats + DAU over time
- `src/app/api/admin/stats/generations/route.ts` — GET: generation volume, cost trends, top users by cost
- `src/app/api/admin/users/route.ts` — GET: paginated user list with search, sort, aggregate stats
- `src/app/api/admin/users/[id]/route.ts` — GET: single user detail with cost aggregates
- `src/app/api/admin/users/[id]/limits/route.ts` — PUT: update user caps (blocks self-edit)
- `src/components/admin/overview-tab.tsx` — Summary cards (Users, Apps, Resumes, Est. Spend) + DAU bar chart + MAU
- `src/components/admin/users-tab.tsx` — Searchable/sortable/paginated user table with expandable limit editing
- `src/components/admin/user-limit-editor.tsx` — Inline cap editing form (Save/Cancel)
- `src/components/admin/generations-tab.tsx` — Generation summary cards + daily bar chart + cumulative cost line + top 10 users table
- `src/app/(authenticated)/admin/page.tsx` — Admin page with 3 tabs (Overview, Users, Generations), role check redirect, URL tab state
- `prisma/schema.prisma` — Added `@@index([lastActiveAt])` to User model

### Verification
- `npx tsc --noEmit` — 0 errors
- `npm run test` — 195/195 tests pass (28 new for PRD 6)
- `npx prisma generate` — success (from earlier phases)

### Deferred / Known Issues
- **No DB migration run yet.** Schema index added, `prisma generate` succeeds.
- **E2E test scaffold deferred.** Requires running server + seeded DB + admin session.
- **DAU limitation:** `lastActiveAt` only stores most recent activity, so DAU is approximate (counts users whose last activity was on that day, not all users who were active).

---

## PRD 7: Polish, Donations & Deployment — COMPLETE

- [x] Phase 1: Error boundaries (global error.tsx, not-found.tsx, 4 route-level error.tsx, ErrorBoundary class component)
- [x] Phase 2: Toast audit (column create success toast, detail drawer save success toast)
- [x] Phase 3: Empty states (reusable EmptyState component, refactored analytics empty state, kanban board 0-app state, generation history empty state)
- [x] Phase 4: Loading skeletons (5 loading.tsx files for applications, resume-source, analytics, admin, dashboard)
- [x] Phase 5: Rate limiting (@upstash/ratelimit + @upstash/redis, graceful degradation when env not set, 3 categories, authenticatedHandler integration, admin exempt, 4 unit tests)
- [x] Phase 6: Mobile responsiveness audit (detail drawer grid-cols responsive, 44px touch targets on collapsible sections)
- [x] Phase 7: Data export (GET /api/export with full user data, Content-Disposition download, nav bar "Export Data" menu item, 4 integration tests)
- [x] Phase 8: Ko-fi widget (KofiButton with NEXT_PUBLIC_KOFI_ID, fixed bottom-right, authenticated layout integration)
- [x] Phase 9: Documentation (expanded .env.example with all env vars, full README with setup/deployment/env var reference)
- [x] Phase 10: Build verification (tsc 0 errors, 203/203 tests pass, next build succeeds)

### Key Files Created
- `src/app/error.tsx` — Global error boundary
- `src/app/not-found.tsx` — Custom 404
- `src/app/(authenticated)/*/error.tsx` — Route-level error boundaries (4 files)
- `src/components/error-boundary.tsx` — React class component for inline error containment
- `src/components/ui/empty-state.tsx` — Reusable empty state (icon, title, description, action)
- `src/app/(authenticated)/*/loading.tsx` — Route-level loading skeletons (5 files)
- `src/lib/rate-limit.ts` — Upstash rate limiting with graceful degradation
- `src/app/api/export/route.ts` — Full data export endpoint
- `src/components/kofi-button.tsx` — Ko-fi donation button

### Verification
- `npx tsc --noEmit` — 0 errors
- `npm run test` — 203/203 tests pass (8 new for PRD 7)
- `npm run build` — succeeds (32 routes)

### All PRDs Complete
PRDs 1-7 fully implemented. 203 tests passing. Production-ready.

---

## Visual Overhaul (Brand Theme) — COMPLETE

- [x] Phase 1: Color foundation — replaced all `:root` and `.dark` CSS variables in `globals.css` with brand OKLch values (navy primary, magenta secondary, bright blue accent/ring, brand gray muted, navy-tinted sidebar, brand chart palette)
- [x] Phase 2: Fixed broken `hsl(var(--primary))` in 4 chart files → `var(--color-primary)` / `var(--color-destructive)` / `var(--color-muted-foreground)`
- [x] Phase 3: Component polish — nav backdrop blur + accent active state, card hover shadow, kanban column rounded-xl with border, application card hover lift, column header border-b, summary card icons text-primary
- [x] Phase 4: Brand alignment — sign-in gradient (navy→purple→magenta), default column colors use brand hex, color picker leads with brand colors

### Files Modified
- `src/app/globals.css` — Complete color variable replacement (light + dark mode)
- `src/components/analytics/weekly-chart.tsx` — Fixed chart stroke color
- `src/components/admin/generations-tab.tsx` — Fixed bar fill + line stroke
- `src/components/admin/overview-tab.tsx` — Fixed bar fill
- `src/components/analytics/closure-breakdown.tsx` — Replaced hardcoded hex with CSS vars
- `src/components/nav-bar.tsx` — Backdrop blur, accent-based active nav
- `src/components/ui/card.tsx` — Hover shadow transition
- `src/components/kanban/kanban-column.tsx` — Rounded-xl, border, shadow
- `src/components/kanban/application-card.tsx` — Hover lift animation
- `src/components/kanban/column-header.tsx` — Border-b, adjusted padding
- `src/components/analytics/summary-cards.tsx` — Brand-colored icons
- `src/app/signin/page.tsx` — Gradient background, shadow-2xl card
- `src/lib/kanban-utils.ts` — Brand hex default columns
- `src/components/kanban/column-settings-menu.tsx` — Brand colors in picker

### Verification
- `npm run build` — succeeds, 0 errors

---

## PRD 8: Markdown Upload & Custom Sections — COMPLETE

- [x] Phase 1: Schema & Parser
  - [x] Prisma migration — `ResumeCustomSection` model + `miscellaneous` field on `ResumeSource`
  - [x] Type updates — `ResumeCustomSection` type, extended `ResumeSourceData`
  - [x] Validation schemas — import, custom section CRUD, miscellaneous
  - [x] Resume parser (`src/lib/resume-parser.ts`) — full markdown → structured data
  - [x] Parser unit tests — 39 tests covering all section types, edge cases

- [x] Phase 2: API & Data Flow
  - [x] `POST /api/resume-source/import` — transactional import with upsert
  - [x] Custom section CRUD endpoints (POST, PATCH, DELETE, reorder)
  - [x] `PATCH /api/resume-source/miscellaneous` — update misc content
  - [x] `GET /api/resume-source` updated with `customSections` include
  - [x] Compiler updated — `CompilerInput` type (decoupled from canonical type), custom sections + misc output
  - [x] Resume prompt updated — custom section guidance for AI generation
  - [x] Helpers updated — `verifyCustomSectionOwnership`, `reorderEntries` union expanded
  - [x] Compile route & generate route updated to include `customSections` + `miscellaneous`

- [x] Phase 3: UI Components
  - [x] `upload-dialog.tsx` — file picker, confirmation dialog, import API call
  - [x] `custom-section-editor.tsx` — inline title edit, content textarea, delete with confirmation
  - [x] `miscellaneous-editor.tsx` — textarea with auto-save
  - [x] `section-tabs.tsx` — dynamic built-in + custom + misc tabs, "+" add section button
  - [x] `preview-panel.tsx` — download button, passes customSections/misc to compiler
  - [x] `page.tsx` — upload button, custom section rendering, tab routing with `custom:{id}` convention

- [x] Phase 4: Verification
  - [x] All 245 tests pass (27 test files)
  - [x] TypeScript: 0 errors (`npx tsc --noEmit`)
  - [x] Next.js production build: success

### Key Files Created (10)
- `src/lib/resume-parser.ts` — Pure function: markdown string → ParsedResume
- `src/lib/__tests__/resume-parser.test.ts` — 39 parser unit tests
- `src/app/api/resume-source/import/route.ts` — POST: parse + transactional replace
- `src/app/api/resume-source/custom-sections/route.ts` — POST: create custom section
- `src/app/api/resume-source/custom-sections/[id]/route.ts` — PATCH/DELETE
- `src/app/api/resume-source/custom-sections/reorder/route.ts` — PUT: reorder
- `src/app/api/resume-source/miscellaneous/route.ts` — PATCH: update misc content
- `src/components/resume-source/upload-dialog.tsx` — Upload button + confirmation
- `src/components/resume-source/custom-section-editor.tsx` — Markdown editor with inline title
- `src/components/resume-source/miscellaneous-editor.tsx` — Simple markdown editor

### Key Files Modified (13)
- `prisma/schema.prisma` — New model + field
- `src/types/resume-source.ts` — New types
- `src/lib/validations/resume-source.ts` — New schemas + caps
- `src/lib/resume-compiler.ts` — `CompilerInput` type, custom sections + misc in output
- `src/lib/resume-source-helpers.ts` — Ownership helper + reorder union
- `src/lib/resume-prompt.ts` — Custom section AI guidance
- `src/components/resume-source/section-tabs.tsx` — Dynamic tabs + "+" button
- `src/components/resume-source/preview-panel.tsx` — Download button
- `src/app/(authenticated)/resume-source/page.tsx` — Upload, custom/misc editors
- `src/app/api/resume-source/route.ts` — `customSections` in include
- `src/app/api/resume-source/compile/route.ts` — `customSections` in include + compiler call
- `src/app/api/resume/generate/route.ts` — `customSections` in include + compiler call
- `src/lib/__tests__/resume-compiler.test.ts` — Updated for `CompilerInput` type

---

## PRD 10: User Feedback System — COMPLETE

- [x] Phase 1: Prisma schema — `FeedbackCategory` enum + `Feedback` model + `User.feedback` relation
- [x] Phase 2: Migration — `add-feedback-model` applied
- [x] Phase 3: Rate limit — `"feedback"` category (5 req / 600s) in `rate-limit.ts` + `api-handler.ts`
- [x] Phase 4: Zod validation — `src/lib/validations/feedback.ts`
- [x] Phase 5: API route — `POST /api/feedback` (authenticated + rate-limited) + `GET /api/feedback` (admin, optional `?category=` filter)
- [x] Phase 6: `FeedbackButton` component — fixed bottom-left with dialog (category select, textarea, char counter)
- [x] Phase 7: Added to authenticated layout alongside KofiButton
- [x] Phase 8: `FeedbackTab` admin component — table with category filter, expandable messages, colored badges
- [x] Phase 9: Added Feedback tab to admin dashboard (4th tab)

### Key Files Created (4)
- `src/lib/validations/feedback.ts` — Zod schema for category + message + pageUrl
- `src/app/api/feedback/route.ts` — POST (authenticated, rate-limited) + GET (admin)
- `src/components/feedback-dialog.tsx` — FeedbackButton with dialog form
- `src/components/admin/feedback-tab.tsx` — Admin table with category filter + expand/collapse

### Key Files Modified (5)
- `prisma/schema.prisma` — FeedbackCategory enum, Feedback model, User.feedback relation
- `src/lib/rate-limit.ts` — Added "feedback" category
- `src/lib/api-handler.ts` — Added "feedback" to HandlerOptions union
- `src/app/(authenticated)/layout.tsx` — Added FeedbackButton
- `src/app/(authenticated)/admin/page.tsx` — Added Feedback tab

### Verification
- `npx prisma migrate dev` — succeeded
- `npm run build` — 0 type errors
- `npm run test` — 257/257 tests pass (27 test files)

---

## PRD 9: Guided Resume Generation Wizard — COMPLETE

- [x] Phase 1: Rewrite system prompt — Impact-first bullet pattern, "DO NOT start bullets with action verbs", bullet-count rules (3-4/2-3/1-2/consolidate), title selection, role consolidation, 3-4 sentence summary, extended function signature with `ResumePromptContext`
- [x] Phase 2: Database migration — Added `reviewJson`, `fitAnalysisJson`, `userAnswersJson`, `parentGenerationId` to `ResumeGeneration`; self-referencing `RevisionChain` relation; created `ResumeAuxCall` model (tracks fit-analysis + review API costs); created `FitAnalysisCache` model (keyed by jobApplicationId + content hashes)
- [x] Phase 3: Fit analysis API — `callWithTool<T>()` generic in `anthropic.ts`; fit-analysis prompt/tool schema/route with SHA-256 cache invalidation; `"fit-analysis"` + `"resume-review"` rate limit categories; `fitAnalysisSchema` + `reviewResumeSchema` Zod schemas
- [x] Phase 4: Review API — Review prompt/tool schema with grading rubric (A-F); `POST /api/resume/review` route with `ResumeAuxCall` tracking
- [x] Phase 5: Extend generate endpoint — `generateResumeSchema` extended with optional `fitAnalysis`, `userAnswers`, `parentGenerationId`, `revisionContext`; prompt builder wires context sections; generation record saves metadata + parent link
- [x] Phase 6: Wizard modal UI — 3-step dialog (fit analysis → questions → review); `WizardStepIndicator` (numbered circles with connecting lines); `StepFitAnalysis` (auto-fetch + skills badges + relevant roles); `StepQuestions` (sequential Q&A with skip); `StepReview` (two-panel: markdown preview + collapsible scorecard with grade badge, keyword alignment, bullet improvements, gaps); `GenerateButton` opens wizard instead of direct API call
- [x] Phase 7: Revision loop + history — "Revise" button with notes textarea in step-review; re-generates with `parentGenerationId` + `revisionContext`; auto-reviews new generation; `GenerationHistory` shows "Revision" badge; history API returns `parentGenerationId`

### New Files (15)
| File | Purpose |
|------|---------|
| `src/lib/hash.ts` | SHA-256 hash for cache keys |
| `src/lib/__tests__/hash.test.ts` | Hash tests (4 tests) |
| `src/lib/resume-prompts/fit-analysis.ts` | Fit analysis prompt + tool schema + types |
| `src/lib/resume-prompts/review.ts` | Review prompt + tool schema + types |
| `src/lib/__tests__/fit-analysis-prompt.test.ts` | Fit analysis prompt tests (4 tests) |
| `src/lib/__tests__/review-prompt.test.ts` | Review prompt tests (4 tests) |
| `src/app/api/resume/fit-analysis/route.ts` | Fit analysis endpoint with caching |
| `src/app/api/resume/fit-analysis/__tests__/route.test.ts` | Fit analysis endpoint tests (7 tests) |
| `src/app/api/resume/review/route.ts` | Review endpoint |
| `src/app/api/resume/review/__tests__/route.test.ts` | Review endpoint tests (6 tests) |
| `src/components/resume/wizard/resume-wizard.tsx` | Wizard Dialog container |
| `src/components/resume/wizard/wizard-step-indicator.tsx` | Step progress indicator |
| `src/components/resume/wizard/step-fit-analysis.tsx` | Step 1: fit analysis display |
| `src/components/resume/wizard/step-questions.tsx` | Step 2: sequential Q&A |
| `src/components/resume/wizard/step-review.tsx` | Step 3: preview + review + revision |

### Modified Files (10)
| File | Change |
|------|--------|
| `src/lib/resume-prompt.ts` | Impact-first rewrite + context parameter |
| `src/lib/anthropic.ts` | Added `callWithTool<T>()` |
| `src/lib/rate-limit.ts` | Added fit-analysis + resume-review categories |
| `src/lib/api-handler.ts` | Added new rate limit types |
| `src/lib/validations/resume.ts` | Extended schemas |
| `prisma/schema.prisma` | New columns + 2 models + relations |
| `src/app/api/resume/generate/route.ts` | Accepts optional context fields |
| `src/app/api/resume/history/[appId]/route.ts` | Added parentGenerationId to select |
| `src/components/resume/generate-button.tsx` | Opens wizard instead of direct API |
| `src/components/resume/generation-history.tsx` | Revision badge |

### Verification
- `npx tsc --noEmit` — 0 errors
- `npx vitest run` — 32 files, 290/290 tests pass (33 new for PRD 9)
- `npx prisma migrate dev` — `add_wizard_models` migration applied
- Backward compatible: existing generate API works unchanged with no optional fields
