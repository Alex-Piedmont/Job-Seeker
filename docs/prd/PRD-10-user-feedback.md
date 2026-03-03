# PRD: User Feedback System

**Project:** Job Seeker
**Date:** 2026-03-03
**Status:** Draft

---

## 1. Brief Overview

The platform currently has no mechanism for users to report bugs, request features, or share general feedback. The only external link is a Ko-fi donation button (`src/components/kofi-button.tsx`). When users encounter issues or have ideas, there is no in-app channel to communicate them.

This feature adds a one-way feedback submission system. Authenticated users can submit categorized feedback from anywhere in the app via a fixed-position trigger button. Submissions are stored in the database with the submitter's identity resolved via the User relation at read time, and surfaced to the admin via a new "Feedback" tab on the existing admin dashboard (`src/app/(authenticated)/admin/page.tsx`). The current page URL is auto-captured with each submission to aid bug diagnosis. No in-app reply mechanism is included.

---

## 2. Key Requirements

- **Feedback submission form:** Authenticated users can submit feedback with a category (Bug, Suggestion, Praise, Other), a free-text message, and an auto-captured page URL.
- **Auto-attached identity:** The submitter's `userId` is stored on the record. Name and email are resolved by joining through the User relation at read time (not denormalized).
- **Page context:** The current page URL (`window.location.pathname`) is automatically captured and stored with the submission to help diagnose bug reports.
- **Admin visibility:** A new "Feedback" tab on the admin dashboard displays all submissions in reverse-chronological order with submitter name, email, category, page URL, message, and timestamp.
- **One-way communication:** Feedback flows from user to admin only. No reply, threading, or notification system.
- **Rate limiting:** Feedback submissions are rate-limited to prevent abuse (5 submissions per 10 minutes per user).

---

## 3. Acceptance Criteria

### Submission

- [ ] A `Feedback` model exists in the Prisma schema with fields: `id`, `userId`, `category` (enum: BUG, SUGGESTION, PRAISE, OTHER), `message` (text), `pageUrl` (string, optional), `createdAt`. Relation to User with `onDelete: Cascade`.
- [ ] `POST /api/feedback` accepts `{ category, message, pageUrl }`, validates via Zod, attaches `userId` from session, and creates the record. Returns 201 on success.
- [ ] Feedback message is required and between 10 and 2000 characters.
- [ ] Category is required and must be one of the four enum values.
- [ ] `pageUrl` is optional, max 500 characters.
- [ ] Users with null `name` or `email` can still submit feedback (Google OAuth means these are almost always present, but do not reject if null).
- [ ] The submission endpoint is rate-limited (5 requests per 10 minutes per user). Rate limit config uses `"600 s"` window format consistent with existing `CATEGORY_CONFIG` entries. The `RateLimitCategory` union type in `api-handler.ts` is updated to include `"feedback"`.
- [ ] When rate-limited, the user sees a toast error indicating they should try again later.

### User-Facing UI

- [ ] A fixed-position "Feedback" button is visible to all authenticated users, positioned in the main layout (similar approach to the Ko-fi button).
- [ ] Clicking the trigger opens a dialog with a category selector (dropdown/select) and a textarea for the message. The current page URL is captured automatically (not shown to the user).
- [ ] On successful submission, the user sees a toast confirmation and the dialog auto-closes.
- [ ] If the user closes the dialog without submitting, the draft is discarded (no persistence of unsent form state).

### Admin Dashboard

- [ ] `GET /api/feedback` is protected by `adminHandler` (from `src/lib/admin.ts`). Non-admin users receive a 403.
- [ ] `GET /api/feedback` returns `{ feedback: [...], total: N }` with each item containing `id`, `userName`, `userEmail`, `category`, `message`, `pageUrl`, `createdAt`. Supports optional `?category=` query parameter for server-side filtering.
- [ ] The admin dashboard has a "Feedback" tab showing all submissions in a table, sorted newest-first.
- [ ] The admin feedback table displays: submitter name, submitter email, category, page URL, message (truncated to ~150 characters with inline expand/collapse toggle), and submission date.
- [ ] A category filter dropdown is shown above the table. "All" is the default state showing all feedback. Selecting a category re-fetches from the API with `?category=` filter.
- [ ] The API enforces a hard maximum of 500 rows per response to prevent unbounded queries before pagination is implemented.
- [ ] Existing admin dashboard tabs (Overview, Users, Generations) continue to work unchanged.

### Testing & Quality

- [ ] All existing tests pass.
- [ ] New Zod validation schema has unit test coverage.
- [ ] Database index on `Feedback.createdAt` for efficient reverse-chronological queries (consistent with `ResumeGeneration` model pattern).

---

## 4. Out of Scope

- Admin replying to feedback through the app
- Email notifications to admin on new feedback
- Anonymous (unauthenticated) feedback
- File/screenshot attachments on feedback
- Feedback editing or deletion by the submitter
- Feedback status tracking (open/closed/resolved)
- Pagination on the admin feedback table (defer until volume exceeds 500; hard cap enforced at API level)
- Denormalized name/email on the Feedback record (join through User relation instead)
- Admin bulk actions (select, delete) on feedback

---

## 5. Technical Notes

| Area | Detail |
|---|---|
| **Database** | New `Feedback` model + `FeedbackCategory` enum in `prisma/schema.prisma` (339 lines). `onDelete: Cascade` on User relation. `@@index([createdAt])` for sort performance. New migration required. |
| **Validation** | New `src/lib/validations/feedback.ts` with Zod schema: `{ category: enum, message: string.min(10).max(2000), pageUrl: string.max(500).optional() }` |
| **API route** | `src/app/api/feedback/route.ts` -- `POST` via `authenticatedHandler` with `{ rateLimit: "feedback" }`. `GET` via `adminHandler` with optional `?category=` filter, hard limit of 500 rows, returns `{ feedback: [...], total }`. |
| **Rate limiting** | Add `feedback` to `CATEGORY_CONFIG` in `src/lib/rate-limit.ts`: `{ requests: 5, window: "600 s" }`. Update `RateLimitCategory` type in `src/lib/api-handler.ts` to include `"feedback"`. |
| **User-facing component** | `src/components/feedback-dialog.tsx` -- Dialog with `Select` for category, `Textarea` for message, auto-captures `window.location.pathname`. Fixed-position trigger button in main layout. |
| **Admin component** | `src/components/admin/feedback-tab.tsx` -- Table with category filter dropdown, inline expand/collapse for long messages (~150 char truncation). |
| **Admin page** | Modify `src/app/(authenticated)/admin/page.tsx` (56 lines) to add fourth tab. |
| **Key files to modify** | `prisma/schema.prisma`, `src/lib/rate-limit.ts`, `src/lib/api-handler.ts` (type update), `src/app/(authenticated)/admin/page.tsx`, main layout file (add trigger button) |
| **Key files to create** | `src/lib/validations/feedback.ts`, `src/app/api/feedback/route.ts`, `src/components/feedback-dialog.tsx`, `src/components/admin/feedback-tab.tsx` |
