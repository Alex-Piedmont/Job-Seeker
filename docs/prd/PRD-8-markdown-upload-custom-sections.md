# PRD: Markdown Upload & Custom Sections

**Version:** 1.1
**Date:** 2026-03-03
**Author:** Product Management
**Status:** Final
**Project:** Job Seeker -- Job Application Tracker

---

## 1. Introduction / Overview

Users who already have a resume in markdown (or any structured text) need a way to import it into the Resume Source Builder without manually re-entering every field. This PRD adds a markdown upload flow that parses known headings into structured data, creates editable custom section tabs for unrecognized headings, and collects truly unclassifiable content into a Miscellaneous tab.

Additionally, the preview panel gains a "Download Markdown" button so users can export the compiled output — including custom sections and miscellaneous content — as a `.md` file.

Without this feature, the only way to populate the Resume Source is field-by-field manual entry (PRD 2). This is a significant friction point for users who already maintain a markdown resume, and it means any non-standard section (Certifications, Awards, Volunteer Work, Languages, Projects) is simply lost.

---

## 2. Goals

- **One-click import:** A user with an existing markdown resume can upload it and have their Resume Source populated in under 5 seconds.
- **Zero data loss on import:** Every section of the uploaded markdown maps to either a built-in field, a custom section tab, or the miscellaneous catch-all. Nothing is silently dropped.
- **Custom sections as first-class tabs:** Unrecognized headings appear as editable tabs alongside the 5 built-in sections, with full markdown textarea editing.
- **Round-trip fidelity:** Uploading a markdown file and immediately downloading the compiled output produces a document that preserves all content from the original (structure may differ, content must not be lost).
- **Existing workflow untouched:** Users who prefer manual field-by-field entry see no changes to their current experience. The upload button is additive, not disruptive.

### What Success Looks Like

A user clicks "Upload Markdown" on the resume source page. They select their `resume.md` file. A confirmation dialog warns "This will replace all existing resume data. Continue?" They confirm. The parser extracts their name, contact info, summary, work experience, education, skills, and publications into the structured fields. Their "Certifications" and "Volunteer Work" headings appear as new custom section tabs. A stray paragraph before the first heading lands in the Miscellaneous tab. The preview panel shows the full compiled resume. They click "Download Markdown" and get a `.md` file they can share.

---

## 3. User Stories

### US-1: Markdown File Upload

**As a** user with an existing markdown resume, **I want to** upload the file and have my Resume Source automatically populated, **so that** I don't have to manually re-enter all my career data.

**Acceptance Criteria:**
- [ ] An "Upload Markdown" button appears at the top of the `/resume-source` page, next to the section tabs
- [ ] Clicking opens a file picker that accepts `.md` and `.txt` files
- [ ] Files up to 200KB are accepted; larger files show an error toast
- [ ] After file selection, a confirmation dialog appears: "This will replace all existing resume data for all sections. This cannot be undone. Continue?"
- [ ] On confirm, the file content is sent to `POST /api/resume-source/import`
- [ ] The server parses the markdown, replaces all existing data in a transaction, and returns the new `ResumeSourceData`
- [ ] The client updates its state with the response — no page reload needed
- [ ] A success toast confirms: "Resume imported successfully"
- [ ] If parsing fails, an error toast appears and no data is modified

### US-2: Markdown Parsing — Known Sections

**As a** user, **I want** the parser to intelligently map my markdown headings to the correct structured fields, **so that** my data is properly categorized without manual adjustment.

**Acceptance Criteria:**
- [ ] `# Heading` (H1) maps to `contact.fullName`
- [ ] Lines between the H1 and the first H2 containing email, phone, URL, or location patterns map to contact fields
- [ ] `## Summary` / `## Professional Summary` / `## Objective` / `## Profile` maps to `contact.summary` (entire content block is flattened into the single text field, including any H3 sub-headings as raw markdown)
- [ ] `## Work Experience` / `## Experience` / `## Professional Experience` / `## Employment` / `## Employment History` maps to experiences
- [ ] `## Education` / `## Academic Background` maps to education entries
- [ ] `## Skills` / `## Technical Skills` / `## Core Competencies` / `## Areas of Expertise` maps to skills
- [ ] `## Publications` / `## Papers` / `## Research` maps to publications
- [ ] Heading matching is case-insensitive
- [ ] Heading matching trims whitespace and ignores trailing colons (e.g., `## Skills:` matches `Skills`)
- [ ] If there is no H1 heading, `contact.fullName` defaults to empty string
- [ ] If no email pattern is found, `contact.email` defaults to empty string
- [ ] Multiple H1 headings: the first H1 is used for `fullName`, subsequent H1s are treated as H2 custom sections
- [ ] A file with zero headings puts all content into miscellaneous

### US-3: Markdown Parsing — Experience Entries

**As a** user, **I want** my experience entries parsed into structured fields, **so that** job titles, companies, dates, and bullet points are properly separated.

**Acceptance Criteria:**
- [ ] `### Title -- Company` pattern extracts title and company
- [ ] `### Title at Company` pattern extracts title and company
- [ ] `### Title, Company` pattern extracts title and company
- [ ] Italic lines (`*...*`) immediately after H3 are parsed as date/location metadata
- [ ] Date patterns like `Jan 2020 - Present`, `2020 - 2022`, `Jan 2020 - Dec 2022` are extracted
- [ ] Location text in metadata line is extracted
- [ ] `#### Subsection Label` within an experience creates a subsection
- [ ] Bullet points (`- text` or `* text`) are assigned to the nearest subsection, or to a default subsection if none exists
- [ ] Paragraph text (non-bullet, non-heading) maps to the experience's `description` field
- [ ] Subsections within an experience are assigned `sortOrder` by their document order

### US-4: Markdown Parsing — Education Entries

**As a** user, **I want** my education entries parsed into structured fields, **so that** degrees, institutions, and dates are properly separated.

**Acceptance Criteria:**
- [ ] `### Degree -- Institution` pattern extracts degree and institution
- [ ] `### Degree, Field of Study -- Institution` pattern extracts all three fields
- [ ] Date lines are parsed the same way as experience entries
- [ ] Lines containing `GPA:` extract the GPA value
- [ ] Lines containing common honors patterns (`Magna Cum Laude`, `Summa Cum Laude`, `Dean's List`, `Honors`, `With Distinction`) extract to the honors field
- [ ] Remaining content maps to the `notes` field

### US-5: Markdown Parsing — Skills

**As a** user, **I want** my skills section parsed into categorized groups, **so that** the structured skills data matches my original formatting.

**Acceptance Criteria:**
- [ ] `**Category**: item1, item2, item3` pattern creates a skill category with items
- [ ] `**Category:** item1, item2, item3` (with colon inside bold) also works
- [ ] Bullet lists without bold categories create a single "General" category
- [ ] Comma-separated items are split into individual skill items
- [ ] Pipe-separated items (`item1 | item2 | item3`) are also split

### US-6: Markdown Parsing — Publications

**As a** user, **I want** my publications parsed into structured entries.

**Acceptance Criteria:**
- [ ] `- **Title** -- Publisher, Date. URL` pattern extracts all fields
- [ ] `- **Title**. Description text` extracts title and description
- [ ] Each bullet in the publications section becomes one publication entry
- [ ] URLs (http/https) anywhere in a publication line are extracted to the `url` field

### US-7: Custom Sections

**As a** user, **I want** unrecognized markdown headings to become editable custom section tabs, **so that** non-standard resume sections (Certifications, Awards, Volunteer Work, Languages, Projects) are preserved and editable.

**Acceptance Criteria:**
- [ ] Any `## Heading` not matched to a known section creates a `ResumeCustomSection` record
- [ ] Custom sections appear as tabs after the 5 built-in tabs, in the order they appeared in the markdown
- [ ] Each custom section tab shows a markdown textarea editor
- [ ] Custom section content is the raw markdown under that heading (excluding the heading itself), including any H3/H4 sub-headings within it
- [ ] Users can edit custom section content and it auto-saves on blur (same pattern as other sections)
- [ ] Users can rename custom section titles inline
- [ ] Users can reorder custom sections via drag-and-drop
- [ ] Users can delete custom sections with a confirmation dialog
- [ ] Users can add a new empty custom section via a "+" button at the end of the tab bar
- [ ] Custom section tab titles show a checkmark if content is non-empty (same indicator as built-in tabs)
- [ ] Custom sections are limited to 20 per resume source

### US-8: Miscellaneous Content

**As a** user, **I want** any content that couldn't be classified into a section to be preserved in a Miscellaneous tab, **so that** nothing from my uploaded resume is lost.

**Acceptance Criteria:**
- [ ] Content before the first heading (excluding contact-line patterns already extracted) goes to miscellaneous
- [ ] Any other unclassifiable content goes to miscellaneous
- [ ] The Miscellaneous tab appears as the last tab, after all custom sections
- [ ] The Miscellaneous tab only appears if there is miscellaneous content (empty = hidden)
- [ ] Miscellaneous content is editable via a markdown textarea
- [ ] Miscellaneous content auto-saves on blur
- [ ] The Miscellaneous tab shows a checkmark indicator if non-empty

### US-9: Download Markdown

**As a** user, **I want to** download my compiled resume source as a `.md` file, **so that** I can share it or use it outside the platform.

**Acceptance Criteria:**
- [ ] A "Download" button appears in the preview panel header, next to "Copy Markdown"
- [ ] Clicking triggers a browser file download of `resume-source.md`
- [ ] The download includes all sections: built-in (Contact, Summary, Experience, Education, Skills, Publications), then custom sections in order, then miscellaneous
- [ ] The file content matches exactly what the preview panel displays
- [ ] The button is disabled when there is no content to download

---

## 4. Functional Requirements

### FR-1: Prisma Schema Changes

Add a new model and field to the existing schema:

```prisma
model ResumeCustomSection {
  id             String @id @default(cuid())
  resumeSourceId String
  title          String
  content        String @db.Text
  sortOrder      Int    @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  resumeSource ResumeSource @relation(fields: [resumeSourceId], references: [id], onDelete: Cascade)

  @@index([resumeSourceId])
  @@map("resume_custom_sections")
}
```

Add to `ResumeSource` model:
```prisma
miscellaneous    String?  @db.Text
customSections   ResumeCustomSection[]
```

### FR-2: Resume Parser (`src/lib/resume-parser.ts`)

A new pure function that takes a markdown string and returns a structured result:

```typescript
type ParsedResume = {
  contact: {
    fullName: string;
    email: string;
    phone: string | null;
    location: string | null;
    linkedIn: string | null;
    website: string | null;
    summary: string | null;
  };
  experiences: Array<{
    company: string;
    title: string;
    location: string | null;
    startDate: string | null;
    endDate: string | null;
    description: string | null;
    subsections: Array<{ label: string; bullets: string[] }>;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    fieldOfStudy: string | null;
    startDate: string | null;
    endDate: string | null;
    gpa: string | null;
    honors: string | null;
    notes: string | null;
  }>;
  skills: Array<{
    category: string;
    items: string[];
  }>;
  publications: Array<{
    title: string;
    publisher: string | null;
    date: string | null;
    url: string | null;
    description: string | null;
  }>;
  customSections: Array<{
    title: string;
    content: string;
  }>;
  miscellaneous: string | null;
};

function parseResumeMarkdown(markdown: string): ParsedResume;
```

**Section heading matching table:**

| Heading text (case-insensitive) | Maps to |
|---|---|
| Summary, Professional Summary, Objective, Profile, About, About Me | `contact.summary` |
| Work Experience, Experience, Professional Experience, Employment, Employment History, Career History | `experiences` |
| Education, Academic Background, Academic History | `education` |
| Skills, Technical Skills, Core Competencies, Areas of Expertise, Competencies | `skills` |
| Publications, Papers, Research, Research & Publications | `publications` |
| *anything else* | `customSections` entry |

**Contact line detection patterns** (applied to lines between H1 and first H2):
- Email: contains `@` and `.` (basic email pattern)
- Phone: matches common phone patterns (`(xxx) xxx-xxxx`, `xxx-xxx-xxxx`, `+x xxx xxx xxxx`, etc.)
- URL: starts with `http://` or `https://`, or contains `linkedin.com`
- Location: remaining non-empty lines that don't match other patterns (heuristic: short line, often contains `,` for "City, State")
- Pipe-delimited contact lines: split by `|` and process each segment individually
- Single lines with multiple patterns but no delimiters: extract patterns greedily (email first, then URLs, then phone, then treat remainder as location)

**Date parsing (best-effort + null fallback):**
- `Jan 2020`, `January 2020`, `01/2020` → `2020-01`
- `2020` → `2020`
- `Present`, `Current` → `null` (endDate)
- `Jan 2020 - Present` → startDate: `2020-01`, endDate: null
- `2020 - 2022` → startDate: `2020`, endDate: `2022`
- Unparsable date strings (e.g., `Summer 2019`, `Q3 2020`) → `null` (not stored as raw text, to avoid downstream validation conflicts with the strict YYYY-MM schema)

### FR-3: Import API Endpoint (`POST /api/resume-source/import`)

**Request:**
```json
{ "markdown": "<file content string>" }
```

**Validation:**
- `markdown` must be a non-empty string, max 200KB (204800 characters)
- User must be authenticated

**Processing (in a single Prisma transaction):**
1. Upsert `ResumeSource` for the user (handles users who haven't visited the page yet)
2. Parse markdown via `parseResumeMarkdown()`
3. Delete all existing child records: `ResumeContact`, `ResumeEducation`, `ResumeWorkExperience` (cascades to subsections), `ResumeSkill`, `ResumePublication`, `ResumeCustomSection`
4. Create new records from parsed data, assigning `sortOrder` based on source document order (including subsection `sortOrder` within experiences)
5. Update `ResumeSource.miscellaneous` with parsed miscellaneous content
6. Return the full `ResumeSourceData` (same shape as `GET /api/resume-source`, including `customSections` ordered by `sortOrder` ascending)

**Note:** The `GET /api/resume-source` route must be updated first (Phase 2, step 8) to include `customSections` and `miscellaneous` in its Prisma `include` and response shape. The import endpoint reuses this same query pattern for its response.

**Response:** `200` with full `ResumeSourceData` on success; `400` for validation errors; `500` for unexpected errors.

### FR-4: Custom Section CRUD API Endpoints

**`POST /api/resume-source/custom-sections`** — Create a new custom section
- Body: `{ title: string, content?: string }`
- Validates: title max 200 chars, content max 50000 chars, max 20 custom sections per resume source
- Returns created section

**`PATCH /api/resume-source/custom-sections/[id]`** — Update a custom section
- Body: `{ title?: string, content?: string }`
- Validates ownership (returns 404 if not found or not owned), same field limits
- Returns updated section

**`DELETE /api/resume-source/custom-sections/[id]`** — Delete a custom section
- Validates ownership (returns 404 if not found or not owned)
- Returns `204`

**`PUT /api/resume-source/custom-sections/reorder`** — Reorder custom sections
- Body: `{ ids: string[] }`
- Validates ownership and completeness (the `ids` array must contain ALL custom section IDs for the user — no partial reorders). Returns 400 if incomplete.
- Reuses the existing `reorderEntries` helper pattern from `resume-source-helpers.ts`, adding `"resumeCustomSection"` to the model union
- Returns `204`

### FR-5: Miscellaneous Field API

**`PATCH /api/resume-source/miscellaneous`** — Update miscellaneous content
- Body: `{ content: string | null }`
- Validates: content max 50000 chars
- Returns `200` with updated `ResumeSource`

### FR-6: Type and Validation Updates

**`src/types/resume-source.ts`** — Add:
```typescript
export type ResumeCustomSection = {
  id: string;
  resumeSourceId: string;
  title: string;
  content: string;
  sortOrder: number;
};

export type ResumeSourceData = {
  // ... existing fields ...
  customSections: ResumeCustomSection[];
  miscellaneous: string | null;
};
```

**`src/lib/validations/resume-source.ts`** — Add:
```typescript
export const importSchema = z.object({
  markdown: z.string().min(1).max(204800),
});

export const customSectionCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().max(50000).optional().default(""),
});

export const customSectionUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().max(50000).optional(),
});

export const miscellaneousUpdateSchema = z.object({
  content: z.string().max(50000).nullable(),
});

export const ENTRY_CAPS = {
  // ... existing caps ...
  customSections: 20,
};
```

### FR-7: Resume Compiler Updates (`src/lib/resume-compiler.ts`)

**Type unification:** Remove the local `ResumeSourceData` type from the compiler. Instead, import the canonical type from `src/types/resume-source.ts`. The compiler function should accept the canonical type (which has required `id`, `userId`, etc. fields that the compiler simply ignores). This eliminates the current type duplication.

**Function changes:**
- After Publications, append each custom section as `## {title}\n\n{content}`
- After all custom sections, if miscellaneous is non-empty, append `## Miscellaneous\n\n{miscellaneous}`
- Custom sections are appended in `sortOrder` order

**Preview panel fix:** The `PreviewPanel` component currently destructures only 5 fields when calling `compileResumeSource()`. After this change, it must also pass `customSections` and `miscellaneous` so the preview includes all content.

### FR-8: UI Components

**`src/components/resume-source/upload-dialog.tsx`**
- File input (hidden) triggered by button click
- Reads file as text client-side
- Shows confirmation `AlertDialog` with warning message
- On confirm, POSTs to `/api/resume-source/import`
- Shows loading state during upload
- Calls `refetch()` on success

**`src/components/resume-source/custom-section-editor.tsx`**
- Markdown textarea with auto-save on blur
- Inline-editable title (click to edit, blur to save)
- Delete button with confirmation
- Standard card layout matching other section editors

**`src/components/resume-source/miscellaneous-editor.tsx`**
- Simple markdown textarea with auto-save on blur
- Read-only title "Miscellaneous"
- Card layout matching other section editors

**Section Tabs updates (`section-tabs.tsx`):**
- Accept `customSections` and `miscellaneous` in props
- Render built-in tabs, then custom section tabs, then miscellaneous tab (if non-empty)
- Custom section tabs show checkmark if content is non-empty
- Tab overflow scrolls horizontally (already supported)

**Preview Panel updates (`preview-panel.tsx`):**
- Add "Download" button next to "Copy Markdown"
- Download triggers `Blob` creation and programmatic `<a>` click with `download="resume-source.md"`

**Page updates (`page.tsx`):**
- Add upload button in the header area
- Render custom section editors when a custom tab is active
- Render miscellaneous editor when misc tab is active
- Pass custom sections and miscellaneous to `SectionTabs`

### FR-9: Resume Prompt Integration

**Small prompt update to `src/lib/resume-prompt.ts`:** Add guidance for custom sections. The system prompt should include a line such as: "Custom sections (e.g., Certifications, Awards, Volunteer Work, Projects) should be included in the output if they are relevant to the target role. Omit them only if they add no value for the specific position."

This prevents the AI from silently dropping custom sections that users expect to see in their tailored resume. The existing "relevance filtering" instruction is scoped to "experience and skills" and may not cover custom sections without this explicit guidance.

### FR-10: Import Endpoint — ResumeSource Upsert

The import endpoint must handle users who have never visited the resume source page (no `ResumeSource` row exists). The endpoint should upsert the `ResumeSource` record before populating child records, matching the pattern used by `GET /api/resume-source`.

### FR-11: SectionTab Type Refactor

The current `SectionTab` type is a narrow union: `"contact" | "education" | "experience" | "skills" | "publications"`. With dynamic custom sections and miscellaneous, the active tab state must support arbitrary string values.

**Approach:** Widen the tab type to `string` and use a discriminated prefix convention:
- Built-in tabs: `"contact"`, `"education"`, `"experience"`, `"skills"`, `"publications"` (unchanged)
- Custom section tabs: `"custom:{id}"` where `{id}` is the `ResumeCustomSection.id`
- Miscellaneous tab: `"miscellaneous"`

The `page.tsx` uses the active tab value to determine which editor to render. The `section-tabs.tsx` component constructs tab values from the data.

---

## 5. Non-Functional Requirements

- **Parser performance:** Parsing a 200KB markdown file should complete in under 500ms on the server.
- **Transaction safety:** The import endpoint must use a Prisma transaction so that a failure mid-import leaves the database unchanged.
- **File size limit:** 200KB max upload. Client-side enforcement uses `file.size` (bytes). Server-side enforcement uses `markdown.length` (characters, max 204800). For `.md` files these are nearly identical; the slight divergence for multi-byte UTF-8 is acceptable.
- **No external dependencies:** The parser should be pure TypeScript with no external parsing libraries. Markdown is simple enough that regex-based parsing is appropriate for the heading-level structure we need.
- **Backward compatibility:** Existing API responses (`GET /api/resume-source`) must include the new `customSections` array and `miscellaneous` field. Clients that don't use these fields are unaffected (empty array and null).

---

## 6. Design Considerations

### Upload Button Placement
The "Upload Markdown" button sits in the page header area, above the section tabs, aligned right. It uses an `Upload` icon from Lucide and secondary/outline variant to avoid competing with the primary editing flow.

### Custom Section Tab Appearance
Custom section tabs are visually identical to built-in tabs — same size, same checkmark indicator, same hover state. The only distinction is their position (after built-in tabs) and the fact that they can be renamed, reordered, and deleted.

### Add Section Button
A small "+" icon button appears at the end of the tab bar, after the last custom/miscellaneous tab. It creates a new empty custom section with a default title "New Section" and switches to that tab for immediate editing. The button is disabled when the 20-section cap is reached.

### Confirmation Dialog
The import confirmation dialog uses `AlertDialog` from shadcn/ui with a destructive action variant. The confirm button says "Replace All Data" (not just "OK") to make the consequence explicit.

### Mobile Experience
On mobile, the upload button remains visible. The confirmation dialog is full-width. Custom section tabs scroll horizontally with the existing tab overflow behavior. The download button in the preview panel remains functional.

---

## 7. Technical Considerations

### Parser Architecture
The parser operates in two passes:
1. **Structure pass:** Split markdown by `## ` headings, building an array of `{ heading: string, content: string }` blocks. Content before the first heading is the "preamble."
2. **Mapping pass:** For each block, match the heading to a known section or create a custom section. Parse block content according to its type (experience blocks get sub-parsed for H3 entries, etc.).

This two-pass approach keeps the parser simple and testable — the structure pass is pure string splitting, and each section mapper can be tested independently.

### Date Parsing Strategy
Date parsing uses a best-effort approach with a null fallback:
1. Try to extract a valid `YYYY-MM` or `YYYY` string from the input using a lookup table for month names (full and abbreviated) and regex patterns.
2. If the date cannot be parsed into a valid format, store `null` rather than the raw string. This avoids conflicts with the existing strict `YYYY-MM` validation schema that is enforced when users later edit entries manually.
3. The raw date text is not preserved separately — if the parser cannot parse it, it is lost. This is acceptable because the parser handles all common date formats (`Jan 2020`, `January 2020`, `2020`, `01/2020`, `2020-01`), and truly unusual formats (e.g., `Summer 2019`) are rare edge cases.

### Transaction Scope
The import transaction deletes all existing child records and creates new ones. This is simpler and more reliable than attempting a diff/merge. The confirmation dialog makes this destructive nature clear to the user.

### Migration Strategy
The Prisma migration adds:
1. `ResumeCustomSection` table
2. `miscellaneous` nullable text column to `resume_sources`

Both are additive — no existing data is modified. The migration is safe to run on a production database with existing users.

---

## 8. Out of Scope

- **Merge mode:** This PRD implements replace-only import. A future PRD could add merge/append behavior.
- **PDF upload:** Only `.md` and `.txt` files are accepted. PDF parsing introduces OCR complexity that is out of scope.
- **DOCX upload:** Same rationale as PDF — the parsing complexity is not justified for v1.
- **AI-assisted parsing:** The parser uses regex/heuristic matching, not an LLM. AI-assisted parsing could improve accuracy but adds cost and latency.
- **Version history:** There is no undo for the import operation beyond the confirmation dialog. Version history could be a future enhancement.
- **Admin panel stats updates:** The admin panel (PRD-6) may eventually want to track custom section counts or import usage, but this is not part of this PRD.
- **Analytics event tracking:** Success metrics (Section 10) are tracked informally via server logs and manual review for now. A formal analytics event system is out of scope.
- **Token budget limits:** Custom sections increase the compiled markdown length fed to the AI, which increases token usage and cost. No cap on compiled output length is imposed in this PRD — the existing per-user monthly generation cap (PRD-4) provides sufficient cost control.

---

## 9. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Parser fails on unusual markdown formatting | User data is partially lost or misclassified | Catch-all miscellaneous section ensures nothing is silently dropped; parser is conservative (when in doubt, custom section) |
| Large files cause server timeouts | Import fails, user frustrated | 200KB file size limit; parser is synchronous and fast (regex-based, no I/O) |
| Users accidentally replace good data | Data loss | Explicit confirmation dialog with destructive action styling; clear warning text |
| Too many custom sections clutter the tab bar | Poor UX | Cap at 20 custom sections; horizontal scroll on tab bar |
| Parser date extraction produces invalid YYYY-MM | Downstream validation fails | Best-effort parsing handles common formats; unparsable dates stored as null to avoid validation conflicts |

---

## 10. Success Metrics

- **Upload completion rate:** >90% of users who click "Upload Markdown" successfully complete the import flow.
- **Parser accuracy:** Manual review of 10 diverse sample resumes shows >85% field-level accuracy for known sections.
- **Custom section usage:** Track how many users have 1+ custom sections to validate the feature's value.
- **Download usage:** Track download button clicks to validate the export feature.

---

## 11. Implementation Phases

### Phase 1: Schema & Parser (Foundation)
1. Prisma schema migration (new model + new field)
2. Resume parser implementation (`src/lib/resume-parser.ts`)
3. Parser unit tests with diverse sample inputs
4. Type and validation updates

### Phase 2: Import API & Data Flow
5. Import API endpoint (`POST /api/resume-source/import`)
6. Custom section CRUD endpoints
7. Miscellaneous field endpoint
8. Update `GET /api/resume-source` to include new fields
9. Resume compiler updates for custom sections and miscellaneous

### Phase 3: UI Components
10. Upload dialog component
11. Custom section editor component
12. Miscellaneous editor component
13. Section tabs updates (dynamic custom + misc tabs)
14. Page.tsx integration (upload button, custom section rendering)
15. Preview panel download button

### Phase 4: Testing & Polish
16. End-to-end upload flow testing
17. Edge case handling (empty files, huge files, no headings, all custom sections)
18. Mobile responsiveness verification

---

## 12. Files to Create

| File | Purpose |
|---|---|
| `src/lib/resume-parser.ts` | Pure function: markdown string → ParsedResume |
| `src/lib/__tests__/resume-parser.test.ts` | Unit tests for parser |
| `src/app/api/resume-source/import/route.ts` | POST endpoint for markdown import |
| `src/app/api/resume-source/custom-sections/route.ts` | POST (create) custom section |
| `src/app/api/resume-source/custom-sections/[id]/route.ts` | PATCH/DELETE custom section |
| `src/app/api/resume-source/custom-sections/reorder/route.ts` | PUT reorder custom sections |
| `src/app/api/resume-source/miscellaneous/route.ts` | PATCH miscellaneous content |
| `src/components/resume-source/upload-dialog.tsx` | Upload button + confirmation dialog |
| `src/components/resume-source/custom-section-editor.tsx` | Custom section markdown editor |
| `src/components/resume-source/miscellaneous-editor.tsx` | Miscellaneous markdown editor |

## 13. Files to Modify

| File | Changes |
|---|---|
| `prisma/schema.prisma` | Add `ResumeCustomSection` model, add `miscellaneous` + `customSections` to `ResumeSource` |
| `src/types/resume-source.ts` | Add `ResumeCustomSection` type, extend `ResumeSourceData` |
| `src/lib/validations/resume-source.ts` | Add import, custom section, miscellaneous schemas; update `ENTRY_CAPS` |
| `src/lib/resume-compiler.ts` | Extend type + function to include custom sections and miscellaneous |
| `src/lib/resume-source-helpers.ts` | Add ownership helpers for custom sections |
| `src/components/resume-source/section-tabs.tsx` | Dynamic tabs for custom sections + miscellaneous |
| `src/components/resume-source/preview-panel.tsx` | Add download button |
| `src/app/(authenticated)/resume-source/page.tsx` | Upload button, custom section/misc editor rendering |
| `src/hooks/use-resume-source.ts` | Ensure refetch works for import flow |
| `src/app/api/resume-source/route.ts` | Include `customSections` and `miscellaneous` in GET response |
| `src/lib/resume-prompt.ts` | Add custom section guidance to the system prompt |
