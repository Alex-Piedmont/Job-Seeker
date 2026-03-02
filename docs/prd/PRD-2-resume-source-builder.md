# PRD: Resume Source Builder

**Version:** 1.0
**Date:** 2026-02-27
**Author:** Product Management
**Status:** Draft
**Project:** Job Seeker -- Job Application Tracker

---

## 1. Introduction / Overview

The Resume Source Builder is the data foundation for AI-powered resume generation. It provides a wizard-style interface where users enter their complete career history — contact information, education, work experience (with custom subsections per role), skills, and publications. This structured data is stored in normalized Prisma tables and compiled on demand into a single markdown document that feeds the Claude API in PRD 4.

Without this feature, the resume generation pipeline has no input data. Users currently have no way to store their career history in the platform, meaning they would need to paste raw text for every resume generation — error-prone, inconsistent, and hostile to iteration.

The feature benefits every user of the platform. Once a user completes their resume source, every future resume generation pulls from this single source of truth, ensuring consistency and enabling the AI to select the most relevant experiences for each target role.

---

## 2. Goals

- **Complete career capture:** The wizard shall support all standard resume sections (contact, education, work experience with custom subsections, skills, publications) with zero data loss compared to a user's existing resume.
- **One source, many resumes:** A single ResumeSource record per user shall compile into a deterministic markdown document that PRD 4 uses as input.
- **Real-time feedback:** The live preview panel shall update within 2 seconds of any save, showing the user exactly what the AI will see.
- **Auto-save reliability:** Every field edit shall persist automatically. No user data shall be lost due to navigation, browser close, or refresh.
- **Sub-60-second orientation:** A new user landing on `/resume-source` for the first time shall understand what to do and begin entering data within 60 seconds.

### What Success Looks Like

A user navigates to `/resume-source`, sees a guided wizard starting with contact info. They fill in each section — education, work experience (adding custom subsections like "Key Accomplishments" or "Projects Led" within each role), skills (organized by category), and publications. As they type and blur fields, changes auto-save and the right-side preview panel updates to show compiled markdown. They can copy the full markdown with one click. Refreshing the page shows all persisted data. The entire experience feels like a polished form builder, not a database CRUD interface.

---

## 3. User Stories

### US-1: First-Time Resume Source Setup

**As a** new user, **I want** the system to create my resume source automatically when I first visit the page, **so that** I can start entering data immediately without an explicit "create" step.

**Acceptance Criteria:**
- [ ] Visiting `/resume-source` for the first time auto-creates a `ResumeSource` record for the user
- [ ] The page shows a welcome message: "Let's build your resume source. Start by adding your contact info."
- [ ] The Contact tab is pre-selected and ready for input
- [ ] No "Create Resume Source" button or modal is needed

### US-2: Contact Information

**As a** user, **I want to** enter my contact details (name, email, phone, location, LinkedIn, website, professional summary), **so that** every generated resume includes accurate contact information.

**Acceptance Criteria:**
- [ ] All contact fields render in a form: Full Name (required), Email (required), Phone, Location, LinkedIn URL, Website URL, Professional Summary (textarea)
- [ ] Fields auto-save on blur with a 1-second debounce
- [ ] A "Saving..." indicator appears during save; "Saved" appears on success
- [ ] Validation errors appear inline (not as toasts) for required fields left blank
- [ ] Refreshing the page shows all previously saved contact data

### US-3: Education Entries

**As a** user, **I want to** add, edit, reorder, and delete education entries, **so that** my academic history is complete and presented in my preferred order.

**Acceptance Criteria:**
- [ ] "Add Education" button creates a new expandable card
- [ ] Fields per entry: Institution (required at compile time), Degree (required at compile time), Field of Study, Start Date (two dropdowns: month + year), End Date (two dropdowns or "Present" toggle), GPA, Honors, Notes (textarea)
- [ ] Each card is collapsible (click header to expand/collapse)
- [ ] "Collapse All" / "Expand All" toggle button above the list (visible when 2+ entries exist)
- [ ] Drag handle on each card enables reorder via drag-and-drop
- [ ] Delete button with confirmation dialog ("Are you sure? This cannot be undone.")
- [ ] All fields auto-save on blur
- [ ] Reorder persists on refresh (via `sortOrder` field)

### US-4: Work Experience with Custom Subsections

**As a** user, **I want to** add work experiences with custom-labeled subsections (e.g., "Key Accomplishments", "Projects Led", "Technologies Used") containing bullet points, **so that** my career history captures the nuance of each role beyond a flat description.

**Acceptance Criteria:**
- [ ] "Add Experience" button creates a new expandable card
- [ ] Fields per experience: Company (required at compile time), Title (required at compile time), Location, Start Date (two dropdowns: month + year), End Date (two dropdowns or "Present" toggle), Description (textarea)
- [ ] "Collapse All" / "Expand All" toggle button above the list (visible when 2+ entries exist)
- [ ] Within each experience, an "Add Subsection" button creates a new subsection
- [ ] Each subsection has: Label (text input, e.g., "Key Accomplishments") and a dynamic list of bullet text inputs
- [ ] "Add Bullet" button within each subsection appends a new text input
- [ ] Bullets can be removed individually (X button on each)
- [ ] Subsections can be reordered via drag-and-drop within the experience
- [ ] Subsections can be deleted with confirmation
- [ ] Experiences can be reordered via drag-and-drop at the top level
- [ ] All fields auto-save on blur; bullets save on blur of each input

### US-5: Skills by Category

**As a** user, **I want to** organize my skills into named categories with tag-style entry, **so that** my skills section is structured and scannable.

**Acceptance Criteria:**
- [ ] "Add Skill Category" button creates a new card
- [ ] Fields per category: Category Name (text input, e.g., "Programming Languages"), Items (comma-separated input that renders as tag chips)
- [ ] Typing a comma or pressing Enter in the items input creates a new tag
- [ ] Each tag chip has a delete-on-click (X) button
- [ ] Categories can be reordered via drag-and-drop
- [ ] Categories can be deleted with confirmation
- [ ] All changes auto-save on blur

### US-6: Publications

**As a** user, **I want to** list my publications, **so that** my academic or professional publications appear in generated resumes when relevant.

**Acceptance Criteria:**
- [ ] "Add Publication" button creates a new expandable card
- [ ] Fields per entry: Title (required), Publisher, Date (month/year or year-only), URL, Description (textarea)
- [ ] Publications can be reordered via drag-and-drop
- [ ] Publications can be deleted with confirmation
- [ ] All fields auto-save on blur

### US-7: Live Markdown Preview

**As a** user, **I want to** see a live preview of my compiled resume source markdown as I edit, **so that** I can verify the output before using it for resume generation.

**Acceptance Criteria:**
- [ ] A preview panel occupies the right 40% of the screen on desktop (1024px+)
- [ ] The preview renders the compiled markdown using a markdown renderer
- [ ] The preview updates within 2 seconds of any successful save
- [ ] A "Copy Markdown" button copies the full compiled markdown to the clipboard with a toast confirmation
- [ ] A "Last saved" timestamp displays at the top of the preview
- [ ] On mobile, the preview is hidden by default; a "Preview" toggle button switches between edit and preview modes

### US-8: Section Navigation

**As a** user, **I want to** navigate between resume sections via tabs, **so that** I can focus on one section at a time without scrolling through the entire form.

**Acceptance Criteria:**
- [ ] Tab bar at the top of the wizard: Contact | Education | Work Experience | Skills | Publications
- [ ] On mobile (below 640px), the tab bar is horizontally scrollable with the active tab scrolled into view
- [ ] Clicking a tab shows only that section's content
- [ ] The active tab is visually highlighted
- [ ] Tab state does not persist across page loads (always starts on Contact, or the last-edited section — implementer's discretion)
- [ ] Each tab shows a completion indicator (e.g., checkmark if the section has data, empty circle if not)

---

## 4. Functional Requirements

### Database Schema

- **FR-1:** The following Prisma models shall be added in a migration named `add_resume_source`.

**ResumeSource**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | Yes | `cuid()` | Primary key |
| `userId` | String | Yes | -- | Unique; FK to User; one ResumeSource per user |
| `createdAt` | DateTime | Yes | `now()` | -- |
| `updatedAt` | DateTime | Yes | `@updatedAt` | -- |

Relations: `contact` (1:1 optional), `education` (1:many), `experiences` (1:many), `skills` (1:many), `publications` (1:many)

**ResumeContact**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | Yes | `cuid()` | Primary key |
| `resumeSourceId` | String | Yes | -- | Unique; FK to ResumeSource |
| `fullName` | String | Yes | -- | -- |
| `email` | String | Yes | -- | -- |
| `phone` | String | No | null | -- |
| `location` | String | No | null | -- |
| `linkedIn` | String | No | null | URL |
| `website` | String | No | null | URL |
| `summary` | String (Text) | No | null | Professional summary paragraph |

**ResumeEducation**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | Yes | `cuid()` | Primary key |
| `resumeSourceId` | String | Yes | -- | FK to ResumeSource |
| `institution` | String | No | `""` | Required at compile time; empty string on initial creation |
| `degree` | String | No | `""` | Required at compile time; empty string on initial creation |
| `fieldOfStudy` | String | No | null | -- |
| `startDate` | String | No | null | "YYYY-MM" format; null on initial creation |
| `endDate` | String | No | null | "YYYY-MM" or null for "Present" |
| `gpa` | String | No | null | Free text (e.g., "3.8/4.0") |
| `honors` | String | No | null | e.g., "magna cum laude" |
| `notes` | String (Text) | No | null | Additional notes |
| `sortOrder` | Int | Yes | `0` | For drag-and-drop ordering |

**ResumeWorkExperience**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | Yes | `cuid()` | Primary key |
| `resumeSourceId` | String | Yes | -- | FK to ResumeSource |
| `company` | String | No | `""` | Required at compile time; empty string on initial creation |
| `title` | String | No | `""` | Required at compile time; empty string on initial creation |
| `location` | String | No | null | -- |
| `startDate` | String | No | null | "YYYY-MM" format; null on initial creation |
| `endDate` | String | No | null | "YYYY-MM" or null for "Present" |
| `description` | String (Text) | No | null | Role overview paragraph |
| `sortOrder` | Int | Yes | `0` | For drag-and-drop ordering |

Relations: `subsections` (1:many to ResumeWorkSubsection)

**ResumeWorkSubsection**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | Yes | `cuid()` | Primary key |
| `workExperienceId` | String | Yes | -- | FK to ResumeWorkExperience |
| `label` | String | Yes | -- | User-defined (e.g., "Key Accomplishments") |
| `bullets` | String[] | Yes | `[]` | Array of bullet point strings |
| `sortOrder` | Int | Yes | `0` | For ordering within the experience |

**ResumeSkill**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | Yes | `cuid()` | Primary key |
| `resumeSourceId` | String | Yes | -- | FK to ResumeSource |
| `category` | String | Yes | -- | e.g., "Programming Languages" |
| `items` | String[] | Yes | `[]` | e.g., ["Python", "TypeScript"] |
| `sortOrder` | Int | Yes | `0` | For drag-and-drop ordering |

**ResumePublication**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | Yes | `cuid()` | Primary key |
| `resumeSourceId` | String | Yes | -- | FK to ResumeSource |
| `title` | String | Yes | -- | -- |
| `publisher` | String | No | null | -- |
| `date` | String | No | null | "YYYY-MM" or "YYYY" |
| `url` | String | No | null | -- |
| `description` | String (Text) | No | null | -- |
| `sortOrder` | Int | Yes | `0` | For drag-and-drop ordering |

- **FR-2:** A `resumeSource` relation (1:1 optional) shall be added to the existing `User` model.

- **FR-3:** All foreign keys shall use `onDelete: Cascade`. Deleting a ResumeSource deletes all child records. Deleting a ResumeWorkExperience deletes its subsections.

### API Routes

- **FR-4:** The following API routes shall be created. All routes require authentication and scope queries to the current user's data.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/resume-source` | Fetch the user's full ResumeSource with all relations |
| `PUT` | `/api/resume-source` | Upsert the user's ResumeSource record |
| `PUT` | `/api/resume-source/contact` | Upsert contact info |
| `POST` | `/api/resume-source/education` | Add education entry |
| `PUT` | `/api/resume-source/education/[id]` | Update education entry |
| `DELETE` | `/api/resume-source/education/[id]` | Delete education entry |
| `PUT` | `/api/resume-source/education/reorder` | Reorder education entries; body: `{ ids: string[] }` |
| `POST` | `/api/resume-source/experience` | Add work experience |
| `PUT` | `/api/resume-source/experience/[id]` | Update work experience |
| `DELETE` | `/api/resume-source/experience/[id]` | Delete work experience (cascades to subsections) |
| `PUT` | `/api/resume-source/experience/reorder` | Reorder experiences; body: `{ ids: string[] }` |
| `POST` | `/api/resume-source/experience/[id]/subsection` | Add subsection to experience |
| `PUT` | `/api/resume-source/experience/[id]/subsection/[subId]` | Update subsection (label, bullets) |
| `DELETE` | `/api/resume-source/experience/[id]/subsection/[subId]` | Delete subsection |
| `PUT` | `/api/resume-source/experience/[id]/subsection/reorder` | Reorder subsections; body: `{ ids: string[] }` |
| `POST` | `/api/resume-source/skills` | Add skill category |
| `PUT` | `/api/resume-source/skills/[id]` | Update skill category |
| `DELETE` | `/api/resume-source/skills/[id]` | Delete skill category |
| `POST` | `/api/resume-source/publications` | Add publication |
| `PUT` | `/api/resume-source/publications/[id]` | Update publication |
| `DELETE` | `/api/resume-source/publications/[id]` | Delete publication |
| `PUT` | `/api/resume-source/publications/reorder` | Reorder publications; body: `{ ids: string[] }` |
| `GET` | `/api/resume-source/compile` | Return compiled markdown string |

**Example request — update contact:**
```json
PUT /api/resume-source/contact
{
  "fullName": "Alex Rudd",
  "email": "paul.alex.rudd@gmail.com",
  "phone": "+1-555-0100",
  "location": "San Francisco, CA",
  "linkedIn": "https://linkedin.com/in/alexrudd",
  "website": null,
  "summary": "Senior product manager with 10+ years of experience..."
}
```

**Example request — add subsection:**
```json
POST /api/resume-source/experience/clx1abc.../subsection
{
  "label": "Key Accomplishments",
  "bullets": [
    "Led migration of 2M-user platform to microservices, reducing deploy time by 80%",
    "Grew team from 3 to 12 engineers across 2 time zones"
  ]
}
```

**Example response — compiled markdown:**
```json
GET /api/resume-source/compile
{
  "markdown": "# Alex Rudd\nalex@example.com | +1-555-0100 | San Francisco, CA\n...",
  "updatedAt": "2026-02-27T15:30:00Z"
}
```

- **FR-5:** All route handlers shall independently verify the session by calling `auth()` from `src/lib/auth.ts` (defense in depth, not relying solely on middleware). The `auth()` call also provides `session.user.id` needed to scope all queries. Attempting to access or modify another user's data shall return HTTP 403.

- **FR-5a:** The `GET /api/resume-source` endpoint shall auto-create a `ResumeSource` record if none exists for the current user. This is a deliberate side-effect on GET for simplicity — the frontend does not need to issue a separate create request.

- **FR-6:** The reorder endpoints shall accept an array of IDs representing the desired order and update the `sortOrder` field of each record in a single transaction. The array must contain all IDs for that entity type within the scope (e.g., all education entries for the user's ResumeSource). Missing IDs are appended at the end; extra IDs are ignored.

### Markdown Compilation

- **FR-7:** A utility function `compileResumeSource()` in `src/lib/resume-compiler.ts` shall compile the structured data into markdown following this exact format:

```markdown
# {Full Name}
{email} | {phone} | {location}
{LinkedIn} | {Website}

## Summary
{summary}

## Work Experience

### {Title} -- {Company}
*{Start Date} - {End Date} | {Location}*

{Description}

#### {Subsection Label}
- {bullet 1}
- {bullet 2}

## Education

### {Degree}, {Field of Study} -- {Institution}
*{Start Date} - {End Date}*
GPA: {gpa} | {honors}
{notes}

## Skills
**{Category}**: {item1}, {item2}, {item3}

## Publications
- **{Title}** -- {Publisher}, {Date}. {URL}
  {Description}
```

- **FR-8:** Sections with no data shall be omitted entirely from the compiled output (no empty headings). Entries with empty required fields (e.g., an education entry with no institution) shall also be omitted from compilation. Within a section, null fields shall be silently omitted — no dangling pipe separators or placeholders. For example, if phone is null, the contact line renders as `{email} | {location}` (not `{email} | | {location}`).

- **FR-9:** Date strings in "YYYY-MM" format shall be displayed as "Mon YYYY" (e.g., "2024-03" becomes "Mar 2024"). Null end dates shall display as "Present".

### Auto-Save

- **FR-10:** Each form field shall trigger a save API call on blur, debounced by 1 second. The debounce timer is scoped per API endpoint (e.g., contact fields share one timer, each education entry has its own timer). If the user blurs two fields on the same record within 1 second, only one API call shall be made containing both changes. Fields on different records/endpoints debounce independently.

- **FR-10a:** When the user clicks "Add Education", "Add Experience", "Add Skill Category", or "Add Publication", a POST request shall immediately create a database record with default/empty values. The new card appears in the UI populated with empty fields. Subsequent edits save via PUT on blur. This avoids tracking "unsaved new entry" state in the frontend.

- **FR-10b:** The ResumeContact record shall be created on the first blur of any contact field (via the upsert endpoint). Required field validation (fullName, email) is not enforced on save — it is enforced only at compile time (FR-8 handles omission of incomplete sections). This allows users to fill contact fields in any order and return later to complete required fields.

- **FR-11:** The UI shall use optimistic updates: local state updates immediately on change, reverts on API error.

- **FR-12:** A save indicator near each section header shall show three states:
  - Idle (no indicator)
  - "Saving..." (during API call)
  - "Saved" (for 3 seconds after success, then fades to idle)
  - On error: toast notification with "Failed to save. Please try again." and the field reverts to its last saved value.

---

## 5. Non-Goals (Out of Scope)

- **Resume generation from this data:** Compilation to markdown is in scope; sending it to the Claude API is PRD 4.
- **Import from LinkedIn:** No automated import from external services.
- **Import from existing resume files:** No PDF/DOCX parsing.
- **Multiple resume source profiles:** Each user has exactly one ResumeSource. No variants or versions.
- **PDF or DOCX export of the source document:** Only markdown copy is supported. DOCX export of generated resumes is PRD 4.
- **Collaboration or sharing:** Users cannot share their resume source with others.
- **Rich text editing:** All text inputs are plain text. No WYSIWYG editor.
- **Spell check or grammar suggestions:** Browser-native spell check only.
- **Undo/redo beyond browser native:** No custom undo stack.
- **Offline support:** Auto-save requires an active network connection.

---

## 6. Design Considerations

### User Interface

**Desktop Layout (1024px+):**
```
+----------------------------------------------------------+
| [Nav Bar]                                                |
+----------------------------------------------------------+
| Contact | Education | Work Exp | Skills | Pubs           |
+------------------------------------+---------------------+
|                                    |                     |
|  [Section Form]                    |  [Preview Panel]    |
|                                    |                     |
|  +------------------------------+ |  # Alex Rudd        |
|  | Full Name: [Alex Rudd      ] | |  alex@example.com   |
|  | Email:     [alex@example...] | |  ...                 |
|  | Phone:     [+1-555-0100    ] | |                     |
|  | ...                          | |  ## Work Experience  |
|  +------------------------------+ |  ### PM -- Acme Corp |
|                                    |  ...                 |
|  [Saving... / Saved]              |                     |
|                                    |  [Copy Markdown]    |
|                                    |  Last saved: 2:30pm |
+------------------------------------+---------------------+
```
Left panel: 60% width. Right panel: 40% width. Preview panel is sticky (scrolls independently).

**Mobile Layout (below 1024px):**
```
+---------------------------+
| [Nav Bar]                 |
+---------------------------+
| Contact | Edu | Work | .. |
+---------------------------+
| [Edit] / [Preview] toggle |
+---------------------------+
|                           |
| [Section Form]            |
|  OR                       |
| [Preview Panel]           |
|                           |
+---------------------------+
```
Single column. Toggle button switches between edit and preview mode.

**Work Experience Card (expanded):**
```
+----------------------------------------------+
| [drag] Senior PM -- Acme Corp        [v][X]  |
+----------------------------------------------+
| Company:    [Acme Corp            ]           |
| Title:      [Senior PM            ]           |
| Location:   [San Francisco, CA    ]           |
| Start:      [2020-01] End: [Present]         |
| Description: [Led product strategy...]        |
|                                               |
| Subsections:                                  |
| +------------------------------------------+ |
| | [drag] Key Accomplishments          [X]  | |
| | - [Led migration of 2M-user platform...] | |
| | - [Grew team from 3 to 12 engineers...]  | |
| | [+ Add Bullet]                           | |
| +------------------------------------------+ |
| [+ Add Subsection]                           |
+----------------------------------------------+
```

**Components to create:**

| Component | Purpose |
|---|---|
| `src/components/resume-source/contact-form.tsx` | Contact info form with auto-save |
| `src/components/resume-source/education-section.tsx` | Education list with CRUD and reorder |
| `src/components/resume-source/experience-section.tsx` | Experience list with subsection support |
| `src/components/resume-source/subsection-form.tsx` | Subsection with label + dynamic bullets |
| `src/components/resume-source/skills-section.tsx` | Skill categories with tag input |
| `src/components/resume-source/publications-section.tsx` | Publication list with CRUD |
| `src/components/resume-source/preview-panel.tsx` | Live markdown preview with copy button |
| `src/components/resume-source/section-tabs.tsx` | Tab navigation with completion indicators |
| `src/components/resume-source/save-indicator.tsx` | Shared "Saving.../Saved" indicator |

### User Experience

**Journey 1: First-Time Setup**
1. User clicks "Resume Source" in the nav
2. System auto-creates a ResumeSource record; page shows welcome message with Contact tab selected
3. User fills in name, email, and other contact fields; each saves on blur
4. User clicks "Education" tab and adds their degree(s)
5. User clicks "Work Experience" tab; adds roles with subsections and bullets
6. User clicks "Skills" tab; adds categories and tag items
7. User clicks "Publications" tab (if applicable)
8. Throughout: the preview panel on the right updates after each save

**Journey 2: Returning to Edit**
1. User visits `/resume-source`; all previously saved data loads
2. User edits a bullet point in a work experience subsection
3. On blur, the field saves and the preview updates
4. User drags an experience card to a new position; reorder saves immediately

**Loading States:**
- Initial page load: skeleton form fields with shimmer effect until data loads
- Individual saves: "Saving..." text near the section header (not a full-page loader)
- Preview update: no loading state — markdown re-renders synchronously from client-side data

**Error States:**
- Save failure: toast notification "Failed to save. Please try again." Field reverts to last saved value.
- Network disconnection: saves queue locally and retry on reconnect (or show persistent warning banner: "You're offline. Changes will save when you reconnect.") — implementer may simplify to just showing the error toast without queuing.
- Empty ResumeSource on compile: the compile endpoint returns an empty markdown string (not an error).

### Accessibility

- All form fields shall have associated `<label>` elements
- The tab bar shall use `role="tablist"` with `role="tab"` on each tab and `role="tabpanel"` on the content area
- Drag-and-drop shall have keyboard alternatives: select item with Enter/Space, move with arrow keys, confirm with Enter
- Delete confirmation dialogs shall trap focus and return focus to the trigger element on dismiss
- The "Copy Markdown" button shall announce "Copied to clipboard" to screen readers via an `aria-live` region
- Tag chips in the skills section shall be focusable and removable via keyboard (Backspace or Delete key)

---

## 7. Technical Considerations

### Architecture

This feature adds 6 new Prisma models and a set of CRUD API routes following the same patterns established in PRD 1 (auth check, user scoping, JSON responses). The markdown compiler is a pure function with no side effects — it takes a data object and returns a string.

**New backend files:**

| File | Purpose |
|---|---|
| `src/app/api/resume-source/route.ts` | GET (fetch full source), PUT (upsert) |
| `src/app/api/resume-source/contact/route.ts` | PUT (upsert contact) |
| `src/app/api/resume-source/education/route.ts` | POST (add entry) |
| `src/app/api/resume-source/education/[id]/route.ts` | PUT, DELETE |
| `src/app/api/resume-source/education/reorder/route.ts` | PUT (reorder) |
| `src/app/api/resume-source/experience/route.ts` | POST (add entry) |
| `src/app/api/resume-source/experience/[id]/route.ts` | PUT, DELETE |
| `src/app/api/resume-source/experience/[id]/subsection/route.ts` | POST (add subsection) |
| `src/app/api/resume-source/experience/[id]/subsection/[subId]/route.ts` | PUT, DELETE |
| `src/app/api/resume-source/experience/[id]/subsection/reorder/route.ts` | PUT (reorder subsections) |
| `src/app/api/resume-source/experience/reorder/route.ts` | PUT (reorder) |
| `src/app/api/resume-source/skills/route.ts` | POST |
| `src/app/api/resume-source/skills/[id]/route.ts` | PUT, DELETE |
| `src/app/api/resume-source/publications/route.ts` | POST |
| `src/app/api/resume-source/publications/[id]/route.ts` | PUT, DELETE |
| `src/app/api/resume-source/publications/reorder/route.ts` | PUT (reorder) |
| `src/app/api/resume-source/compile/route.ts` | GET (return markdown) |
| `src/lib/resume-compiler.ts` | `compileResumeSource()` pure function |

**New frontend files:**

| File | Purpose |
|---|---|
| `src/app/resume-source/page.tsx` | Page component with two-column layout |
| `src/components/resume-source/contact-form.tsx` | Contact form |
| `src/components/resume-source/education-section.tsx` | Education CRUD |
| `src/components/resume-source/experience-section.tsx` | Experience CRUD |
| `src/components/resume-source/subsection-form.tsx` | Subsection with bullets |
| `src/components/resume-source/skills-section.tsx` | Skills with tags |
| `src/components/resume-source/publications-section.tsx` | Publications CRUD |
| `src/components/resume-source/preview-panel.tsx` | Markdown preview |
| `src/components/resume-source/section-tabs.tsx` | Tab navigation |
| `src/components/resume-source/save-indicator.tsx` | Save status display |

**Modified files:**

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add 6 new models + User relation |

### Data

Migration name: `add_resume_source`

Key indexes (auto-created by Prisma):
- `ResumeSource.userId` — unique index (one per user)
- `ResumeContact.resumeSourceId` — unique index (one per source)

No additional manual indexes needed. Query patterns are always filtered by `resumeSourceId` (which cascades from `userId`), and result sets per user are small (typically under 20 records per table).

### APIs

See FR-4 for the complete endpoint table. All endpoints follow these conventions:
- Authentication via Auth.js session (same pattern as PRD 1)
- Request/response bodies are JSON
- Success: HTTP 200 (GET/PUT) or 201 (POST)
- Not found: HTTP 404
- Forbidden (wrong user): HTTP 403
- Validation error: HTTP 400 with `{ error: "description" }`

### Performance

- Initial data load (GET `/api/resume-source`): under 200ms for a user with 10 experiences, 5 education entries, 10 skill categories (single Prisma query with nested includes)
- Individual save (PUT): under 100ms (single-record update)
- Reorder (PUT): under 200ms (batch update in transaction, typically 5-15 records)
- Markdown compilation: under 50ms (pure string concatenation, no I/O)
- No caching needed — data is user-specific and changes frequently

---

## 8. Security and Privacy

### Authentication & Authorization

- All API routes require an authenticated session (enforced by middleware from PRD 1)
- Every query filters by `userId = session.user.id` to ensure data isolation
- The ResumeSource `userId` unique constraint prevents creating duplicate sources

### Input Validation

| Field | Validation |
|---|---|
| `fullName` | Required at compile time, max 200 characters. Allowed to be empty/null during save. |
| `email` | Required at compile time, valid email format if provided. Allowed to be empty/null during save. |
| `phone` | Optional, max 30 characters |
| `linkedIn`, `website`, `url` | Optional; if provided, must start with `http://` or `https://` |
| `summary`, `description`, `notes` | Optional, max 10,000 characters |
| `startDate`, `endDate` | Must match `YYYY-MM` format via regex `^\d{4}-(0[1-9]|1[0-2])$` |
| `bullets` | Array of strings, each max 1,000 characters, max 50 bullets per subsection |
| `items` (skills) | Array of strings, each max 100 characters, max 50 items per category |
| `category`, `label` | Max 200 characters |
| All string fields | Trimmed of leading/trailing whitespace before storage |

**Per-section entry caps (enforced on POST):**

| Section | Max Entries | Scope |
|---|---|---|
| Education | 30 | Per ResumeSource |
| Work Experience | 30 | Per ResumeSource |
| Subsections | 20 | Per Work Experience |
| Skill Categories | 30 | Per ResumeSource |
| Publications | 30 | Per ResumeSource |

Exceeding these caps returns HTTP 400 with `{ error: "Maximum of {N} {section} entries reached" }`.

- All inputs shall be sanitized for the markdown preview to prevent XSS (the markdown renderer shall not allow raw HTML).

### Sensitive Data

- Resume source data is personal (career history, contact info). It shall never be exposed to other users.
- The compile endpoint returns the user's own data only — no cross-user access.
- No data is sent to external services in this PRD (Claude API integration is PRD 4).

---

## 9. Testing Strategy

### Unit Tests (vitest)

**Markdown Compiler (`src/lib/__tests__/resume-compiler.test.ts`):**
- Full source with all sections populated: output matches expected markdown
- Source with only contact info: output contains only header and contact line, no empty section headings
- Source with null optional fields (no phone, no website): no dangling pipe separators
- Source with entry missing required fields (e.g., education with no institution): entry is omitted from output
- Date formatting: "2024-03" renders as "Mar 2024"; null endDate renders as "Present"
- Empty subsection (label but no bullets): label renders with no bullet list
- Multiple experiences with subsections: correct heading hierarchy (H2 → H3 → H4)
- Empty source (no data at all): returns empty string

### Integration Tests (vitest)

**Resume Source API Routes (`src/app/api/resume-source/__tests__/route.test.ts`):**
- Authenticated user creates resume source → returns created record
- Authenticated user updates contact info → persists on re-fetch
- Unauthenticated request to any resume-source endpoint → 401
- User cannot access another user's resume source → 403 or empty result
- Add education entry → included in GET response
- Delete education entry → cascades correctly (no orphaned records)
- Add work experience with subsections and bullets → full hierarchy persists
- Delete work experience → subsections and bullets cascade-deleted
- Reorder education entries → new order persists on re-fetch
- Compile endpoint → returns markdown string matching expected format

**Validation (`src/app/api/resume-source/__tests__/validation.test.ts`):**
- Invalid email in contact → 400 with Zod error
- Missing required fields (institution on education, company on experience) → 400
- Excessively long text fields (>10,000 chars) → 400

### E2E Tests (Playwright)

**Resume Source Wizard (`e2e/resume-source.spec.ts`):**
- Navigate to Resume Source → empty state shows "Build your resume source..."
- Fill in contact info → save indicator appears, data persists on page refresh
- Add 2 education entries → both appear in list, correct order
- Add a work experience with 2 subsections and 3 bullets each → hierarchy renders correctly
- Add a skill category with tags → tags display correctly
- Preview panel shows compiled markdown → contains all entered data
- "Copy Markdown" button → clipboard contains expected content
- Delete an education entry → removed from list, not in preview

### Manual Verification

**Drag-and-Drop Reorder (visual verification):**
- Reorder education entries via drag → new order persists on refresh
- Reorder subsections within an experience → correct persistence
- Reorder skill categories → correct persistence

### Edge Cases

- User has no data in any section — compile returns empty string, preview shows empty state message
- User adds an experience with zero subsections — experience renders in markdown with just the header and description
- User adds a subsection with zero bullets — subsection label renders but no bullet list
- User adds 50 bullets to a single subsection — verify no UI performance degradation
- Two browser tabs editing the same resume source — last save wins, no conflict resolution
- User rapidly creates and deletes entries — verify no orphaned records
- Very long text in description fields (10,000 characters) — verify no truncation in save or preview

---

## 10. Dependencies and Assumptions

### Dependencies

**New libraries to install:**

| Package | Purpose | Why This Library |
|---|---|---|
| `react-markdown` | Render markdown in the preview panel | Lightweight, supports GFM, widely used with React. No raw HTML passthrough by default (XSS safe). |
| `@hello-pangea/dnd` | Drag-and-drop for reordering | Fork of react-beautiful-dnd, actively maintained, supports React 18+, touch-friendly. Shared with PRD 3 (Kanban). Includes keyboard support for accessibility. |
| -- | -- | vitest and Playwright are already installed from PRD 1. No test framework dependencies needed. |

**Existing dependencies (from PRD 1):**
- Next.js 15, React, TypeScript, Tailwind CSS, shadcn/ui, Prisma, Auth.js v5

### Assumptions

- PRD 1 is fully implemented (auth, middleware, Prisma client, User model, nav shell)
- Users will have typical resume-length data: 1-10 education entries, 1-15 work experiences, 1-10 skill categories, 0-20 publications
- The `@hello-pangea/dnd` library supports nested drag contexts (drag experiences at the top level, drag subsections within each experience)

### Known Constraints

- PostgreSQL's `String[]` type (used for `bullets` and `items`) stores arrays natively. Prisma supports this on PostgreSQL but not all databases — this ties the project to PostgreSQL.
- `@hello-pangea/dnd` does not support nested drag-and-drop out of the box. Subsection reorder and experience reorder shall use separate `DragDropContext` instances (one per level). Cross-level dragging is not supported and not needed.

---

## 11. Success Metrics

### Quantitative Metrics

| Metric | Target | How to Measure |
|---|---|---|
| Initial page load (with data) | Under 1 second | Browser devtools network tab |
| Auto-save round-trip | Under 500ms (p95) | Network tab on blur |
| Preview update after save | Under 2 seconds | Visual observation |
| Markdown compile time | Under 50ms | `console.time` in compile function |
| Maximum entries without UI lag | 15 experiences with 5 subsections each | Manual test with large dataset |
| Data persistence rate | 100% — zero data loss across saves | Refresh page after every operation |

### Qualitative Metrics

| Metric | How to Assess |
|---|---|
| Wizard feels intuitive | A new user can complete all sections without documentation |
| Preview matches expectations | Compiled markdown is well-formatted and readable |
| Auto-save feels invisible | Users never think about saving — it just works |
| Drag-and-drop is responsive | No visible lag or jank during reorder operations |

---

## 12. Implementation Order

| Phase | Scope | Risk Level | Verification |
|---|---|---|---|
| **Phase 1** | Prisma schema: add 6 models, run migration | Low | `npx prisma migrate dev` succeeds; `prisma studio` shows new tables |
| **Phase 2** | API routes: ResumeSource CRUD, Contact upsert | Low | cURL/Postman tests return correct data |
| **Phase 3** | API routes: Education, Experience, Subsection CRUD + reorder | Medium | Create, edit, reorder, delete all work via API |
| **Phase 4** | API routes: Skills, Publications CRUD | Low | Same verification as Phase 3 |
| **Phase 5** | Markdown compiler (`compileResumeSource`) | Low | Unit test with fixture data produces expected markdown |
| **Phase 6** | Frontend: page layout, section tabs, contact form with auto-save | Medium | Form renders, saves on blur, data persists |
| **Phase 7** | Frontend: education, experience (with subsections), skills, publications sections | High | All CRUD and drag-and-drop works in the UI |
| **Phase 8** | Frontend: preview panel, copy markdown, mobile toggle | Low | Preview renders, copy works, mobile layout correct |

---

## Clarifying Questions

*All questions from the review cycle have been resolved. Decisions are incorporated into the PRD above:*

- **Bullet storage:** Keep String[] array; race risk accepted as low (FR-10)
- **Record creation timing:** Immediate POST on "Add" click with defaults (FR-10a)
- **Contact initialization:** Create on first blur, allow partial saves; required fields enforced at compile time only (FR-10b)
- **Null field rendering in markdown:** Omit null fields, no dangling pipes (FR-8)
- **Missing reorder endpoints:** Added for subsections and publications (FR-4 table)
- **Auto-creation:** GET /api/resume-source auto-creates if missing (FR-5a)
- **Route auth:** Each handler independently verifies session via auth() (FR-5)
- **Mobile tabs:** Horizontally scrollable (US-8)
- **Date picker:** Two dropdowns — month + year (US-3, US-4)
- **Collapse all/expand all:** Added for education and experience sections (US-3, US-4)
- **Unit tests:** vitest tests for compileResumeSource() (Section 9)
- **Entry caps:** 30 per section, 20 subsections per experience (Section 8)

**Remaining open (implementer's discretion):**
- Q1: Tab completion indicators — suggest "has any data" (checkmark if section has 1+ entries)
- Q2: Copy Markdown — suggest copying exactly what the preview shows, no added header
- Q5: Bullet/tag add/remove — suggest immediate save on action (not debounced to blur)
