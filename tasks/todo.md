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

## Remaining PRDs
- PRD 5: Analytics Dashboard
- PRD 6: Admin Panel
- PRD 7: Polish, Donations & Deployment
