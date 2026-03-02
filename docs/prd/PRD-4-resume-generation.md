# PRD: Resume Generation

**Version:** 1.0
**Date:** 2026-02-27
**Author:** Product Management
**Status:** Draft
**Project:** Job Seeker -- Job Application Tracker

---

## 1. Introduction / Overview

Resume generation is the core value proposition of Job Seeker. It connects the user's structured career history (PRD 2's resume source) with a specific job description (PRD 3's application card) and uses the Anthropic Claude API to produce a tailored, impact-driven resume. The output is downloadable as a `.docx` file.

Without this feature, users must manually tailor resumes for each application — a tedious, error-prone process that typically takes 30-60 minutes per application. With this feature, a user clicks one button and receives a professionally tailored resume in under 30 seconds.

The feature includes monthly generation caps (5/month for regular users, unlimited for admins), a check-on-request reset mechanism (no cron jobs), generation history per application, token/cost tracking for admin visibility (PRD 6), and a preview + download flow within the application detail drawer.

---

## 2. Goals

- **One-click generation:** From the detail drawer, a user with a complete resume source and a pasted JD shall generate a tailored resume with a single button click.
- **Quality output:** Generated resumes shall lead with business impact, use quantified outcomes, and match the target role's terminology — consistent with the `/resume` skill's prompt engineering.
- **Under 30 seconds:** End-to-end generation (API call + response parsing) shall complete within 30 seconds for typical inputs.
- **Reliable cap enforcement:** The monthly cap shall reset on calendar-month boundaries via check-on-request. No user shall exceed their cap. Admins bypass all caps.
- **Downloadable .docx:** Every generated resume shall be downloadable as a properly formatted Word document with professional typography.
- **Full cost visibility:** Every generation shall log token counts and estimated cost for PRD 6's admin analytics.

### What Success Looks Like

A user opens a job application card, sees the pasted job description, and clicks "Generate Resume." A loading state shows for 15-20 seconds. The generated resume appears in a preview panel within the drawer — well-formatted markdown tailored to the JD, leading with business impact. The user clicks "Download .docx" and gets a clean Word document. The usage badge in the nav updates from "1/5" to "2/5." The generation is stored in history, downloadable again later. An admin can see the token count and cost in the admin panel.

---

## 3. User Stories

### US-1: Generate a Tailored Resume

**As a** user with a complete resume source and a job description on an application card, **I want to** click "Generate Resume" and receive a tailored resume, **so that** I can apply with a role-specific resume without manual editing.

**Acceptance Criteria:**
- [ ] "Generate Resume" button is visible in the application detail drawer
- [ ] Clicking it sends the compiled resume source markdown + job description to the Claude API
- [ ] The generated resume markdown appears in a preview panel within the drawer within 30 seconds
- [ ] The generation is saved to the database with token counts and estimated cost
- [ ] The user's `resumeGenerationsUsedThisMonth` counter increments by 1

### US-2: Download as .docx

**As a** user, **I want to** download my generated resume as a Word document, **so that** I can submit it in the format most employers expect.

**Acceptance Criteria:**
- [ ] A "Download .docx" button appears after a successful generation
- [ ] Clicking it downloads a `.docx` file named `Resume-{Company}-{Role}.docx` (non-alphanumeric chars replaced with hyphens, consecutive hyphens collapsed)
- [ ] The document uses professional formatting: Calibri font, consistent heading hierarchy, proper bullet indentation, clean spacing
- [ ] The document opens correctly in Microsoft Word, Google Docs, and LibreOffice
- [ ] After generation, the resume markdown is displayed in an editable textarea (not read-only rendered markdown)
- [ ] The user can modify the markdown before downloading
- [ ] "Download .docx" converts the current textarea content (which may have been edited by the user)
- [ ] Edits do NOT consume a generation credit
- [ ] Edits are NOT persisted to the database — the stored `markdownOutput` on ResumeGeneration remains the original AI output. If the user navigates away and returns, they see the original.
- [ ] A "Reset to original" button restores the AI-generated markdown

### US-3: Generation Cap Enforcement

**As the** platform operator, **I want** each user limited to their monthly resume generation cap, **so that** API costs are controlled.

**Acceptance Criteria:**
- [ ] Users with `role = USER` are limited to `resumeGenerationCap` generations per calendar month (default: 5)
- [ ] When the cap is reached, the "Generate Resume" button is disabled with a message: "Monthly limit reached (5/5). Resets {month} 1."
- [ ] The cap resets automatically on the first generation request of a new calendar month (check-on-request, no cron)
- [ ] Admin users (`role = ADMIN`) bypass the cap entirely — the button is always enabled
- [ ] The cap check and counter increment happen atomically to prevent race conditions

### US-4: Usage Visibility

**As a** user, **I want to** see how many resume generations I have remaining this month, **so that** I can plan my applications accordingly.

**Acceptance Criteria:**
- [ ] A usage badge in the navigation bar shows "{used}/{cap} resumes" (e.g., "3/5 resumes")
- [ ] The badge color changes: green (0-49% used), yellow (50-79% used), red (80-100% used)
- [ ] For admin users, the badge shows "Unlimited" instead of a count
- [ ] The badge updates immediately after a generation completes

### US-5: Generation History

**As a** user, **I want to** view and re-download past resume generations for an application, **so that** I can access previous versions without regenerating.

**Acceptance Criteria:**
- [ ] A "History" section in the detail drawer lists all past generations for that application
- [ ] Each history entry shows: timestamp, a "Preview" toggle to view the markdown, and a "Download .docx" button
- [ ] History entries are ordered newest-first
- [ ] Generating a new resume adds it to the top of the history

### US-6: Pre-Generation Validation

**As the** system, **I need to** validate that the user has a usable resume source and a job description before allowing generation, **so that** the AI has sufficient input to produce a quality result.

**Acceptance Criteria:**
- [ ] If the user has no resume source or the compiled markdown is empty, the button is disabled with tooltip: "Complete your resume source first"
- [ ] If the application's job description field is empty, the button is disabled with tooltip: "Add a job description first"
- [ ] If both conditions fail, the resume source message takes priority
- [ ] Clicking the disabled button does nothing (no API call)

---

## 4. Functional Requirements

### Database Schema

- **FR-1:** The following Prisma model shall be added in a migration named `add_resume_generation`.

**ResumeGeneration**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | Yes | `cuid()` | Primary key |
| `userId` | String | Yes | -- | FK to User |
| `jobApplicationId` | String | Yes | -- | FK to JobApplication |
| `promptTokens` | Int | Yes | -- | Input tokens consumed |
| `completionTokens` | Int | Yes | -- | Output tokens consumed |
| `totalTokens` | Int | Yes | -- | promptTokens + completionTokens |
| `estimatedCost` | Float | Yes | -- | In USD, computed from token counts |
| `markdownOutput` | String (Text) | Yes | -- | The generated resume markdown |
| `modelId` | String | Yes | -- | The Claude model used (e.g., "claude-sonnet-4-6") |
| `createdAt` | DateTime | Yes | `now()` | -- |

Relations: `user` (many:1 to User), `jobApplication` (many:1 to JobApplication)

- **FR-2:** Relations to add to existing models:
  - `User`: `resumeGenerations` (1:many)
  - `JobApplication`: `resumeGenerations` (1:many)
  - Both with `onDelete: Cascade`

### Monthly Cap Logic

- **FR-3:** The cap check, reset, and pre-increment shall be implemented in `src/lib/resume-cap.ts`. The counter is **atomically pre-incremented** using a single raw SQL `UPDATE ... WHERE` to prevent race conditions (two tabs clicking Generate simultaneously).

```typescript
export async function reserveGeneration(userId: string): Promise<{
  allowed: boolean;
  used: number;
  cap: number;
  resetsAt: Date;
}> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      role: true,
      resumeGenerationCap: true,
      resumeGenerationsUsedThisMonth: true,
      resumeCapResetAt: true,
    },
  });

  // Admin bypass
  if (user.role === "ADMIN") {
    return {
      allowed: true,
      used: user.resumeGenerationsUsedThisMonth,
      cap: Infinity,
      resetsAt: new Date(),
    };
  }

  const now = new Date();
  const resetAt = new Date(user.resumeCapResetAt);
  const monthChanged =
    now.getFullYear() !== resetAt.getFullYear() ||
    now.getMonth() !== resetAt.getMonth();

  if (monthChanged) {
    // Reset AND pre-increment atomically in one write
    await prisma.user.update({
      where: { id: userId },
      data: {
        resumeGenerationsUsedThisMonth: 1,
        resumeCapResetAt: new Date(now.getFullYear(), now.getMonth(), 1),
      },
    });
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { allowed: true, used: 1, cap: user.resumeGenerationCap, resetsAt: nextReset };
  }

  // Atomic conditional increment: only succeeds if under cap
  const result = await prisma.$executeRaw`
    UPDATE "User"
    SET "resumeGenerationsUsedThisMonth" = "resumeGenerationsUsedThisMonth" + 1
    WHERE id = ${userId}
      AND "resumeGenerationsUsedThisMonth" < "resumeGenerationCap"
  `;

  if (result === 0) {
    // No rows updated — cap reached
    const nextReset = new Date(resetAt.getFullYear(), resetAt.getMonth() + 1, 1);
    return {
      allowed: false,
      used: user.resumeGenerationsUsedThisMonth,
      cap: user.resumeGenerationCap,
      resetsAt: nextReset,
    };
  }

  const nextReset = new Date(resetAt.getFullYear(), resetAt.getMonth() + 1, 1);
  return {
    allowed: true,
    used: user.resumeGenerationsUsedThisMonth + 1,
    cap: user.resumeGenerationCap,
    resetsAt: nextReset,
  };
}

// Call this if generation fails AFTER pre-increment (Claude error, validation failure, etc.)
// Floor at 0 to prevent negative counts from concurrent failure + reset edge case.
export async function rollbackGeneration(userId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "User"
    SET "resumeGenerationsUsedThisMonth" = GREATEST("resumeGenerationsUsedThisMonth" - 1, 0)
    WHERE id = ${userId}
  `;
}
```

- **FR-4:** The generation flow is: validate inputs → atomic pre-increment (FR-3) → issue JWT → frontend calls Railway → Railway calls Claude → on success, create ResumeGeneration record; on ANY failure after pre-increment (validation, Claude error, Railway error), call `rollbackGeneration()`. The rollback uses `GREATEST(counter - 1, 0)` to prevent negative counts from concurrent failure + calendar reset edge cases.

### Claude API Integration

- **FR-5:** The Anthropic client shall be initialized in `src/lib/anthropic.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function generateResume(
  resumeMarkdown: string,
  jobDescription: string
): Promise<{
  text: string;
  promptTokens: number;
  completionTokens: number;
}> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: buildResumePrompt(resumeMarkdown, jobDescription),
      },
    ],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return {
    text,
    promptTokens: response.usage.input_tokens,
    completionTokens: response.usage.output_tokens,
  };
}
```

- **FR-6:** The model shall be configurable via environment variable `CLAUDE_MODEL` (default: `"claude-sonnet-4-6"`). This allows switching models without a code deploy.

### Prompt Engineering

- **FR-7:** The resume prompt shall be implemented in `src/lib/resume-prompt.ts`. This prompt is derived from the existing `/resume` skill (`~/.claude/skills/resume/SKILL.md`) to ensure consistency with tested prompt engineering. Key principles carried over:

  - **Impact-first philosophy:** Every bullet follows the pattern `[Business outcome / "so what"] + [by/through] + [what you did] + [with what scale/evidence]`
  - **Ruthless selectivity:** Most recent role gets 3-4 bullets, second-tier 2-3, older roles 1-2
  - **ATS alignment:** Surface keywords from the JD naturally, not as keyword stuffing
  - **Title selection:** If the source lists multiple titles for a role, pick the one mirroring the JD's language

```typescript
export function buildResumePrompt(
  resumeMarkdown: string,
  jobDescription: string
): string {
  return `You are an expert resume writer who creates impact-driven, executive-level resumes. Most people describe work as activities ("Led a team"). Hiring managers care about outcomes: what changed because you were there?

Your job: treat the candidate's source material as *ingredients*, not text to polish. Every bullet should answer "so what?" before describing "what I did."

## Impact-First Bullet Pattern:
[Business outcome / "so what"] + [by/through] + [what you actually did] + [with what scale/evidence]

Example — avoid: "Led enterprise BI transformation, migrating from legacy platforms to Snowflake/Sigma"
Example — goal: "Shaped how 3,500+ sellers made pipeline decisions by designing the enterprise BI strategy, owning the migration to Snowflake/Sigma and delivering 9 new dashboards within months"

## Instructions:
1. Analyze the job description to identify: exact job title, key responsibilities, required skills, preferred qualifications, industry context, and team structure.
2. Map the candidate's experience to the JD requirements. Select the most relevant roles, wins, and skills.
3. Write a Professional Summary: 3-4 sentences. Open with a positioning statement ("[Level] [function] who [core value proposition]"), add 1-2 proof points with specific numbers, close with credentials.
4. For each role included, use impact-first bullets:
   - Most recent / most relevant role: 3-4 bullets
   - Second tier roles: 2-3 bullets
   - Older or less relevant roles: 1-2 bullets
   - Roles 10+ years old: consolidate or omit
5. Quantify everything: revenue, team size, time saved, percentage improvement, budget, stakeholders affected.
6. Use active, specific verbs: "Reshaped," "Grew," "Drove," "Identified," "Built" — not "Responsible for," "Helped with," "Involved in."
7. Incorporate JD keywords naturally (ATS-friendly). Match the JD's terminology where the candidate has genuine experience.
8. Target one page of content — be ruthlessly selective. Fewer roles with strong bullets beats more roles with weak bullets.

## Candidate's Complete Career History:
<career_history>
${resumeMarkdown}
</career_history>

## Target Job Description:
<job_description>
${jobDescription}
</job_description>

## Output Format:
Return ONLY the tailored resume in clean markdown. No explanations, no commentary, no preamble, no closing remarks.

Use this exact structure:
# [Full Name]
[City, ST | Phone | Email | LinkedIn]

## Professional Summary
[3-4 sentence impact summary]

## Professional Experience
### [Title] — [Company]
*[Start Year] - [End Year or Present] | [Location]*
- [Impact-first bullet]
- [Impact-first bullet]

## Education
### [Degree], [Concentration] — [Institution]
*[Year]*

## Core Competencies
**[Category]:** [Skill] | [Skill] | [Skill]`;
}
```

The prompt uses XML-style delimiters (`<career_history>`, `<job_description>`) to clearly separate the candidate's data from the JD. The output structure matches the `/resume` skill's format: Professional Summary → Professional Experience → Education → Core Competencies.

### Cost Estimation

- **FR-8:** Token costs shall be estimated using configurable rates in `src/lib/anthropic.ts`:

```typescript
// Default rates for Claude Sonnet — update via env vars if pricing changes
const COST_PER_INPUT_TOKEN =
  parseFloat(process.env.COST_PER_INPUT_TOKEN ?? "0.000003");   // $3/1M
const COST_PER_OUTPUT_TOKEN =
  parseFloat(process.env.COST_PER_OUTPUT_TOKEN ?? "0.000015");  // $15/1M

export function estimateCost(inputTokens: number, outputTokens: number): number {
  return inputTokens * COST_PER_INPUT_TOKEN + outputTokens * COST_PER_OUTPUT_TOKEN;
}
```

### DOCX Generation

- **FR-9:** A utility in `src/lib/docx-generator.ts` shall convert the generated resume markdown into a professionally formatted `.docx` file. The formatting matches the project's established resume style (navy/blue color scheme, Calibri font, tight margins for single-page fit).

**Formatting constants:**

```typescript
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, ExternalHyperlink, BorderStyle, WidthType,
} from "docx";

// Typography
const FONT = "Calibri";
const SZ_NAME = 26;      // 13pt (half-points)
const SZ_CONTACT = 17;   // 8.5pt
const SZ_SECTION = 20;   // 10pt
const SZ_BODY = 19;      // 9.5pt
const SZ_SMALL = 17;     // 8.5pt

// Colors (hex without #)
const C1 = "1F3864";     // Navy — name, section headers, job titles
const C2 = "2E75B6";     // Medium blue — section underlines, hyperlinks
const CB = "333333";     // Dark gray — body text
const CL = "666666";     // Light gray — dates, locations, contact info

// Page geometry (twips: 1 inch = 1440 twips)
const PW = 12240;        // 8.5" page width
const PH = 15840;        // 11" page height
const ML = 720, MR = 720;  // 0.5" left/right margins
const MT = 460, MB = 400;  // ~0.32" / ~0.28" top/bottom margins
const CW = PW - ML - MR;   // Content width
```

**Helper functions:**

| Function | Purpose | Output |
|---|---|---|
| `sh(text)` | Section header | Uppercase, letter-spaced, navy text with blue underline rule |
| `eh(title, company, location, dates)` | Experience entry header | Two-row borderless table: title + dates (row 1), company + location (row 2) |
| `b(text)` | Bullet point | Bulleted paragraph with `•` character, 9.5pt body text |

**Markdown-to-DOCX mapping:**

| Markdown Element | DOCX Rendering |
|---|---|
| `# Full Name` | Centered, 13pt, bold, navy (C1), letter-spacing 80 |
| Contact line (below H1) | Centered, 8.5pt, light gray (CL), LinkedIn as blue hyperlink |
| `## Section Header` | `sh()` — uppercase, 10pt, bold, navy, blue underline |
| `### Title — Company` | `eh()` — borderless table layout with dates right-aligned |
| `*dates \| location*` | Parsed into `eh()` parameters |
| `- Bullet text` | `b()` — bulleted paragraph, 9.5pt, dark gray |
| `**Category:** Skills` | Bold navy label + dark gray skill text (for Core Competencies) |
| Plain paragraph | 9.5pt, dark gray, normal spacing |

**Document settings:**
- Bullet numbering config: `•` character, indent left 340 twips, hanging 170 twips
- Page size: US Letter (8.5" × 11")
- Margins: 0.5" L/R, ~0.32" top, ~0.28" bottom (tight for single-page fit)

The parser shall handle the exact output structure from FR-7's prompt: `# Name` → contact line → `## Professional Summary` → `## Professional Experience` (with `### Title — Company` entries) → `## Education` → `## Core Competencies`.

- **FR-10:** The markdown parser for DOCX conversion does not need to handle the full CommonMark spec. It shall support: H1 (name), H2 (section headers), H3 (experience/education entries), bold, italic, bullet lists, and plain paragraphs. The parser shall recognize the `### Title — Company` pattern to extract title and company for `eh()` layout, and the `*dates | location*` pattern for the second row. Links, images, tables, and code blocks are not expected in resume output. **Graceful fallback:** If Claude produces unexpected elements (H4, code blocks, unknown markdown), the parser shall render them as plain body text rather than failing. The markdown preview is always available as a backup if DOCX formatting is imperfect.

- **FR-10a:** DOCX files are regenerated from stored markdown on each download request (no caching). At <500ms per conversion, this is fast enough and avoids storage overhead or cache invalidation complexity.

### API Routes

- **FR-11:** The following API routes shall be created. All routes verify the session via `auth()`.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/resume/generate` | Full generation flow: validate, pre-increment cap, call Claude, save result. Uses `maxDuration = 60`. |
| `GET` | `/api/resume/[id]/download` | Download a generation as .docx; accepts optional `markdown` query param for user-edited content. Returns `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| `GET` | `/api/resume/usage` | Current user's usage: `{ used, cap, resetsAt }` |
| `GET` | `/api/resume/history/[appId]` | List all generations for a job application |

**Generation flow (`POST /api/resume/generate`):**
1. Authenticate user via `auth()`
2. Fetch the JobApplication by `jobApplicationId` — verify ownership, verify `jobDescription` is not empty
3. Fetch the user's ResumeSource — compile to markdown via `compileResumeSource()`
4. If compiled markdown is empty, return 400: `{ error: "Resume source is incomplete" }`
5. Call `reserveGeneration(userId)` (FR-3) — atomic pre-increment. If not allowed, return 403 with usage info
6. Call Claude API with `buildResumePrompt(compiledMarkdown, jobDescription)`
7. Compute estimated cost via `estimateCost()`
8. Create `ResumeGeneration` record in database
9. Return `{ id, markdownOutput, promptTokens, completionTokens, estimatedCost, createdAt }`
10. On ANY failure after pre-increment (steps 6-8), call `rollbackGeneration(userId)` server-side before returning the error

**Download endpoint (`GET /api/resume/[id]/download`):**
- If the request includes a `markdown` body (POST override or query param with base64-encoded content), convert that markdown to .docx (user-edited version)
- Otherwise, convert the stored `markdownOutput` from the ResumeGeneration record
- This allows the frontend to send edited markdown for download without persisting edits

**Example response — generation:**
```json
{
  "id": "clx3abc...",
  "markdownOutput": "# Alex Rudd\nalex@example.com | San Francisco, CA\n\n## Professional Summary\n...",
  "promptTokens": 2450,
  "completionTokens": 1200,
  "totalTokens": 3650,
  "estimatedCost": 0.0254,
  "createdAt": "2026-02-27T15:30:00Z"
}
```

**Example response — usage:**
```json
{
  "used": 3,
  "cap": 5,
  "resetsAt": "2026-03-01T00:00:00Z",
  "isAdmin": false
}
```

**Example response — history:**
```json
[
  {
    "id": "clx3abc...",
    "markdownOutput": "# Alex Rudd\n...",
    "promptTokens": 2450,
    "completionTokens": 1200,
    "estimatedCost": 0.0254,
    "createdAt": "2026-02-27T15:30:00Z"
  },
  {
    "id": "clx3def...",
    "markdownOutput": "# Alex Rudd\n...",
    "promptTokens": 2500,
    "completionTokens": 1150,
    "estimatedCost": 0.0248,
    "createdAt": "2026-02-25T10:00:00Z"
  }
]
```

**Download endpoint (`GET /api/resume/[id]/download`):**
1. Fetch the ResumeGeneration by `id` — verify it belongs to the current user
2. Call `markdownToDocx(generation.markdownOutput)`
3. Return the Buffer with headers:
   - `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`
   - `Content-Disposition: attachment; filename="Resume_{Company}_{Role}.docx"`

---

## 5. Non-Goals (Out of Scope)

- **Customizing the prompt or generation parameters:** The prompt is fixed. No user-facing prompt editing.
- **Multiple resume templates or styles:** One output format. Template customization is a future feature.
- **PDF export:** Only .docx. Users can export to PDF from Word/Google Docs.
- **Rich text editing of the generated resume:** Users edit the raw markdown in a textarea. No WYSIWYG editor.
- **Batch generation across multiple applications:** One generation per request.
- **Streaming the response:** The full response is waited for, then displayed. Streaming adds complexity for minimal UX gain at ~15-20s generation time.
- **Regeneration with feedback loops:** No "make it more technical" follow-up prompts. Users regenerate from scratch (counts against cap).
- **Caching or deduplication of identical inputs:** Each generation is independent, even if the same JD and resume source are used.
- **Custom model selection by the user:** The model is set via environment variable by the operator.

---

## 6. Design Considerations

### User Interface

**Generate Button States (in detail drawer):**
```
State 1 - Ready:
[Generate Resume]                      (primary button, enabled)

State 2 - Missing Resume Source:
[Generate Resume]  (disabled, tooltip)
  "Complete your resume source first"

State 3 - Missing JD:
[Generate Resume]  (disabled, tooltip)
  "Add a job description first"

State 4 - Cap Reached:
[Generate Resume]  (disabled, tooltip)
  "Monthly limit reached (5/5). Resets Mar 1."

State 5 - Generating:
[Generating resume... ████░░░░]        (spinner + progress feel)
  "This usually takes 15-20 seconds"
```

**Preview Panel (appears in drawer after generation):**
```
+------------------------------------------+
| Generated Resume             [Download]  |
+------------------------------------------+
|                                          |
| # Alex Rudd                             |
| alex@example.com | SF, CA               |
|                                          |
| ## Professional Summary                  |
| Senior product manager with 10+ years... |
|                                          |
| ## Experience                            |
| ### Senior PM -- Acme Corp              |
| *Jan 2020 - Present | San Francisco*    |
| - Led migration of 2M-user platform...  |
| - Grew team from 3 to 12 engineers...   |
|                                          |
+------------------------------------------+
| [Regenerate]  2/5 remaining this month  |
+------------------------------------------+
```

**Generation History (below preview in drawer):**
```
+------------------------------------------+
| History                                  |
+------------------------------------------+
| Feb 27, 2026 at 3:30 PM                 |
|   [Preview v] [Download .docx]           |
+------------------------------------------+
| Feb 25, 2026 at 10:00 AM                |
|   [Preview v] [Download .docx]           |
+------------------------------------------+
```

**Usage Badge (in nav bar):**
```
Desktop:  [3/5 resumes]    (badge next to avatar or in nav)
Mobile:   [3/5]            (compact)
Admin:    [Unlimited]
```

**Components to create:**

| Component | Purpose |
|---|---|
| `src/components/resume/generate-button.tsx` | Button with state management (ready, disabled states, loading) |
| `src/components/resume/resume-preview.tsx` | Rendered markdown of generated resume |
| `src/components/resume/download-button.tsx` | .docx download trigger |
| `src/components/resume/generation-history.tsx` | List of past generations with preview/download |
| `src/components/resume/usage-badge.tsx` | Nav bar usage indicator |

### User Experience

**Journey 1: First Resume Generation**
1. User opens a job application card with a pasted JD
2. User has already completed their resume source (PRD 2)
3. User clicks "Generate Resume" — button shows loading with "This usually takes 15-20 seconds"
4. After ~15-20 seconds, the generated resume appears in a preview panel within the drawer
5. User reviews the preview, clicks "Download .docx"
6. Browser downloads `Resume_AcmeCorp_SeniorPM.docx`
7. Usage badge updates from "0/5" to "1/5"

**Journey 2: Cap Reached**
1. User has used 5/5 generations this month
2. User opens a card and sees "Generate Resume" is disabled
3. Tooltip reads: "Monthly limit reached (5/5). Resets Mar 1."
4. On March 1, the user generates a resume — cap resets to 0/5, then increments to 1/5

**Journey 3: Re-download Past Generation**
1. User opens a card where they previously generated a resume
2. The most recent generation **auto-displays** in the preview panel when the drawer opens
3. Below the preview, the history section shows all past generations
4. User clicks "Download .docx" on an older generation

**Loading States:**
- Generation in progress: button shows spinner + "Generating resume..." + estimated time message. The drawer remains open and interactive (user can scroll other fields).
- Download: brief browser download indicator (no custom loading state needed)

**Error States:**
- Claude API error (500, rate limit, timeout): toast "Failed to generate resume. Please try again." Button returns to ready state. Frontend calls `/api/resume/rollback` to restore the cap counter.
- Claude API response is empty or malformed: toast "Generation returned an unexpected result. Please try again."
- Claude response truncated (`stop_reason === "max_tokens"`): save the truncated output and show warning toast: "Resume may be incomplete. Consider regenerating." User can still preview and download.
- Network error during download: toast "Download failed. Please try again."
- Resume source incomplete: button disabled with tooltip (not an error, just a prerequisite)

### Accessibility

- "Generate Resume" button states communicated via `aria-disabled` and `aria-describedby` for tooltip content
- Loading state: `aria-busy="true"` on the drawer content area, `aria-live="polite"` region announces "Resume generation complete" on success
- Preview panel: rendered as semantic HTML from markdown (headings, lists, paragraphs)
- Download button: `aria-label="Download resume as Word document"`
- Usage badge: `aria-label="3 of 5 resume generations used this month"`

---

## 7. Technical Considerations

### Architecture

The generation flow requires 15-25 seconds for the Claude API call. Vercel serverless functions support `maxDuration` up to 60 seconds (available since late 2024), which comfortably accommodates this. The entire generation flow runs in a single Vercel API route.

```typescript
// src/app/api/resume/generate/route.ts
export const maxDuration = 60; // seconds
```

**Generation flow (`POST /api/resume/generate`):**
1. Verify session via `auth()`
2. Validate inputs (ownership, JD present, resume source compiled to non-empty markdown)
3. Atomically pre-increment cap via `reserveGeneration()` — if not allowed, return 403
4. Call Claude API directly (15-25s)
5. Compute estimated cost, create `ResumeGeneration` record
6. Return `{ id, markdownOutput, promptTokens, completionTokens, estimatedCost, createdAt }`
7. On ANY failure after pre-increment (Claude error, validation, etc.), call `rollbackGeneration()` server-side before returning error

This eliminates the need for a separate Railway service, JWT handshake, shared secrets, and duplicated code. Single deployment, single codebase.

**Fallback:** If Vercel hobby tier does not support `maxDuration > 10` at the time of implementation, fall back to a Railway Express service architecture: issue a short-lived JWT from Vercel, have the frontend call Railway directly for generation. This fallback is documented but not the primary approach.

**New backend files:**

| File | Purpose |
|---|---|
| `src/app/api/resume/generate/route.ts` | POST — full generation flow (validate, cap, Claude call, save) |
| `src/app/api/resume/[id]/download/route.ts` | GET — generates and returns .docx |
| `src/app/api/resume/usage/route.ts` | GET — returns current usage |
| `src/app/api/resume/history/[appId]/route.ts` | GET — lists generations for an app |
| `src/lib/resume-cap.ts` | Atomic cap check/reset/increment logic |
| `src/lib/resume-prompt.ts` | Prompt builder |
| `src/lib/docx-generator.ts` | Markdown → .docx conversion |
| `src/lib/anthropic.ts` | Anthropic SDK client + generateResume function + cost estimation |

**New frontend files:**

| File | Purpose |
|---|---|
| `src/components/resume/generate-button.tsx` | Generation trigger with state management |
| `src/components/resume/resume-editor.tsx` | Editable markdown textarea with rendered preview toggle |
| `src/components/resume/download-button.tsx` | .docx download (converts current textarea content) |
| `src/components/resume/generation-history.tsx` | Past generations list |
| `src/components/resume/usage-badge.tsx` | Nav usage indicator |

**Modified files:**

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add ResumeGeneration model + relations on User and JobApplication |
| `src/components/kanban/application-detail-drawer.tsx` | Enable "Generate Resume" button, add editor + history sections, add cascade-delete confirmation for applications with generations |
| `src/components/nav/top-nav.tsx` | Add usage badge |

### Data

Migration name: `add_resume_generation`

Key indexes:
- `ResumeGeneration.userId` — for user-scoped queries and admin aggregation
- `ResumeGeneration.jobApplicationId` — for per-application history
- `ResumeGeneration.createdAt` — for time-series admin analytics

### APIs

See FR-11 for the complete endpoint table and example payloads.

### Performance

- Claude API call: 10-25 seconds typical (depends on input length and model load)
- DOCX generation: under 500ms (in-memory document assembly)
- Usage check: under 50ms (single User lookup by ID, indexed)
- History fetch: under 100ms (query by jobApplicationId, indexed)
- Total generation round-trip (API call + DB write + response): under 30 seconds target

**Vercel timeout:** Resolved via Railway proxy architecture (see Architecture section). The Vercel route is a thin proxy that completes within 10 seconds; the long-running Claude call happens on Railway.

---

## 8. Security and Privacy

### Authentication & Authorization

- All routes verify session via `auth()` (defense in depth)
- Generation endpoint verifies the JobApplication belongs to the current user
- Download endpoint verifies the ResumeGeneration belongs to the current user
- History endpoint scopes to applications owned by the current user

### Input Validation

| Field | Validation |
|---|---|
| `jobApplicationId` | Required, must be a valid CUID, must belong to the current user |
| Resume source | Must exist and compile to non-empty markdown |
| Job description | Must be non-empty (checked on the JobApplication record) |

- The job description is sent to the Claude API as-is. No sanitization is needed since the Claude API does not execute code. The JD is wrapped in XML delimiters to prevent prompt confusion.

### Sensitive Data

- Resume source data and job descriptions are sent to the Anthropic Claude API. Users should be aware their career data is processed by a third-party AI service.
- Generated resume content is stored in the database. It contains personal career information scoped to the user.
- The `ANTHROPIC_API_KEY` is a server-side secret. It shall never be exposed to the client.
- Estimated costs are stored per generation. These are not sensitive but are only visible to the user (their own) and admins (all users).

### API Key Protection

- The Anthropic SDK client is initialized server-side only (in API routes, not in client components)
- The API key is read from `process.env.ANTHROPIC_API_KEY` — never imported or bundled client-side
- No client-side code references the Anthropic SDK

---

## 9. Testing Strategy

### Unit Tests (vitest)

**Cost Estimation (`src/lib/__tests__/anthropic.test.ts`):**
- 1000 input + 500 output tokens → expected cost at default rates
- 0 tokens → $0
- Custom rates via env override → correct cost

**Prompt Builder (`src/lib/__tests__/resume-prompt.test.ts`):**
- Output contains the resume markdown within `<career_history>` tags
- Output contains the job description within `<job_description>` tags
- Output contains all instruction sections
- Empty resume markdown → still produces a valid prompt (AI will note insufficient data)

**Cap Logic (`src/lib/__tests__/resume-cap.test.ts`):**
- User with 3/5 used → atomic increment succeeds, returns allowed: true, used: 4
- User with 5/5 used → atomic increment returns 0 rows, allowed: false
- User with 5/5 used but resetAt is last month → reset to 0 + increment to 1, allowed: true
- Admin user with 100/5 used → allowed: true (bypass)
- Cap reset updates resumeCapResetAt to 1st of current month
- Rollback floors at 0 (never negative)

**DOCX Generator (`src/lib/__tests__/docx-generator.test.ts`):**
- H1 renders as centered, 13pt, bold, navy text
- H2 renders as uppercase section header with blue underline
- H3 with `Title — Company` pattern renders as experience entry table
- Bullet list items render as bulleted paragraphs
- Unknown markdown elements (H4, code blocks) render as plain body text (graceful fallback)
- Empty markdown → produces valid empty document (no crash)

### Integration Tests (vitest + mocks)

**Generate Endpoint (`src/app/api/resume/generate/__tests__/route.test.ts`):**
- Authenticated user with valid app + JD + resume source → returns generated markdown
- Unauthenticated request → 401
- App not owned by user → 403 + no cap increment
- Empty JD → 400 + no cap increment
- Cap reached → 403 with usage info
- Mock Claude error → returns error, cap rolled back
- Truncated Claude response (stop_reason: max_tokens) → saves with truncation flag
- Mock Prisma for DB calls

### E2E Test (Playwright)

**Full Generation Flow (`e2e/resume-generation.spec.ts`):**
- Sign in → complete resume source → create application with JD → click Generate → verify preview appears → click Download → verify .docx downloads
- Note: requires valid `ANTHROPIC_API_KEY` (or Claude mock)

### Manual Verification

**Generation Flow:**
- Complete resume source → paste JD → click Generate → verify resume appears in preview
- Verify generated resume is tailored to the JD (mentions relevant keywords, excludes irrelevant experience)
- Verify token counts and cost are saved to ResumeGeneration record

**DOCX Download:**
- Download .docx → open in Word → verify formatting (fonts, headings, bullets)
- Open same .docx in Google Docs → verify compatibility
- Verify filename follows pattern `Resume-{Company}-{Role}.docx` (non-alphanumeric chars replaced with hyphens, consecutive hyphens collapsed)

**Cap Enforcement:**
- Generate 5 resumes → verify 6th attempt is blocked
- Verify admin can generate unlimited
- Wait for calendar month to turn → verify reset

**Error Handling:**
- Disconnect network during generation → verify error toast, cap not incremented
- Remove ANTHROPIC_API_KEY → verify clear error on generation attempt

### Edge Cases

- Resume source with maximum data (30 experiences, all subsections filled) — verify Claude handles large input without error
- Very short JD (one paragraph) — verify generation still produces reasonable output
- Very long JD (10,000+ characters) — verify no timeout or truncation
- User generates, then deletes the application — confirmation dialog warns: "Deleting this application will also remove N generated resume(s). This cannot be undone." ResumeGeneration records cascade-delete
- Two rapid generation clicks — button should disable after first click, preventing double-generation
- Cap at exactly 0 remaining — verify button disabled, correct message
- Generation succeeds but DOCX conversion fails — generation record exists, download returns error, user can retry download

---

## 10. Dependencies and Assumptions

### Dependencies

**New libraries to install:**

| Package | Purpose | Why This Library |
|---|---|---|
| `@anthropic-ai/sdk` | Claude API client | Official Anthropic SDK. Type-safe, handles auth, retries, and streaming. |
| `docx` | Word document generation | Most popular Node.js .docx library. Programmatic document creation with full formatting control. No external dependencies. |

**Existing dependencies (from PRDs 1-3):**
- Next.js 15, React, TypeScript, Tailwind CSS, shadcn/ui, Prisma, Auth.js v5, react-markdown, vitest

### Assumptions

- PRDs 1-3 are fully implemented
- The user's resume source (PRD 2) compiles to markdown via `compileResumeSource()`
- The Anthropic API key is provisioned and has sufficient quota
- Claude Sonnet 4.6 is available and responds within 30 seconds for typical inputs (2,000-5,000 input tokens)
- Vercel hobby tier supports `maxDuration = 60` for serverless functions

### Known Constraints

- **Vercel function timeout:** Resolved via `export const maxDuration = 60` on the generate route. Vercel hobby tier supports up to 60-second serverless functions. If this changes or is unavailable, the fallback is a Railway Express service with JWT-based auth (see AMENDMENTS.md B1 fallback).

**Environment variables required:**

| Variable | Where | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | Vercel | Claude API authentication |
| `DATABASE_URL` | Vercel | PostgreSQL connection (Railway-hosted) |
| `CLAUDE_MODEL` | Vercel | Model ID (default: `claude-sonnet-4-6`) |
| `COST_PER_INPUT_TOKEN` | Vercel | Token cost rate (default: `0.000003`) |
| `COST_PER_OUTPUT_TOKEN` | Vercel | Token cost rate (default: `0.000015`) |
- **Claude API rate limits:** Anthropic imposes rate limits by tier. On the free/build tier, limits may be as low as 5 RPM. This is acceptable for a small user base but may need upgrading for growth.
- **DOCX fidelity:** The `docx` library produces structurally correct documents but complex formatting (multi-column layouts, tables within bullets) is not supported. Resume output should be simple headings + bullets.
- **Token estimation accuracy:** Cost estimates use static per-token rates. Actual billing may differ slightly due to Anthropic pricing changes. The `COST_PER_INPUT_TOKEN` and `COST_PER_OUTPUT_TOKEN` env vars allow runtime adjustment.

---

## 11. Success Metrics

### Quantitative Metrics

| Metric | Target | How to Measure |
|---|---|---|
| Generation round-trip time | Under 30 seconds (p95) | Timestamp diff between request and response |
| DOCX generation time | Under 500ms | `console.time` in docx-generator |
| Cap enforcement accuracy | 100% — no user exceeds cap | Database query: users where used > cap AND role != ADMIN |
| Generation success rate | > 95% | ResumeGeneration records created / generation API calls |
| DOCX opens correctly | 100% in Word, Google Docs, LibreOffice | Manual test with each application |
| Cost tracking accuracy | Within 10% of actual Anthropic invoice | Compare estimated vs. billed (monthly) |

### Qualitative Metrics

| Metric | How to Assess |
|---|---|
| Generated resume quality | Manual review: does it lead with impact? Is it tailored to the JD? |
| DOCX formatting | Visual review: professional appearance, clean typography |
| Loading UX | User is not confused during the 15-20s wait — progress indicator is clear |
| Error messages are actionable | Each error tells the user what to do next |

---

## 12. Implementation Order

| Phase | Scope | Risk Level | Verification |
|---|---|---|---|
| **Phase 1** | Prisma schema: ResumeGeneration model + migration | Low | `prisma migrate dev` succeeds |
| **Phase 2** | `resume-cap.ts`: cap check/reset logic + unit tests | Low | Unit tests pass for all cap scenarios |
| **Phase 3** | `anthropic.ts` + `resume-prompt.ts`: Claude API integration + prompt | High | Call Claude API with test data, verify response |
| **Phase 4** | `POST /api/resume/generate`: single endpoint with cap check, Claude call, cost tracking, rollback on failure | High | Generate endpoint returns tailored resume markdown |
| **Phase 5** | `docx-generator.ts`: markdown → .docx with navy/blue formatting | Medium | Generated .docx opens correctly in Word with correct colors/fonts |
| **Phase 6** | `GET /api/resume/[id]/download` + usage + history endpoints | Low | Download works, usage returns correct data |
| **Phase 7** | Frontend: generate button, editable markdown preview, download, history | Medium | Full flow works from the UI including markdown editing |
| **Phase 8** | Frontend: usage badge in nav | Low | Badge shows correct count, updates after generation |

---

## Clarifying Questions

All review questions have been resolved. Key decisions documented inline:

- **Architecture:** Single Vercel serverless function with `maxDuration = 60`. No separate service. (Section 7)
- **Cap enforcement:** Atomic SQL `UPDATE ... WHERE used < cap` prevents race conditions. Rollback on ALL failures after pre-increment with `GREATEST(counter - 1, 0)` floor. (FR-3, FR-4)
- **Prompt:** Derived from `/resume` skill with impact-first bullet pattern. (FR-7)
- **DOCX:** Navy/blue color scheme (#1F3864/#2E75B6), Calibri, tight margins. Graceful fallback for unexpected markdown. Regenerated on each download (no cache). (FR-9, FR-10)
- **Filenames:** Non-alphanumeric chars replaced with hyphens. (US-2)
- **Truncation:** Warn user, save anyway. (Error States)
- **Auto-preview:** Most recent generation auto-displays when drawer opens. (Journey 3)
- **Editable markdown:** User can edit the markdown textarea before download. Edits are not persisted. (US-2)
- **Cascade delete:** Confirmation dialog warns about N generated resumes being removed. (Edge Cases)
- **Testing:** Unit + integration + one E2E test. (Section 9)

**Q1: [OPTIONAL] Should the system store the input (compiled resume markdown + JD) alongside the output in ResumeGeneration, for debugging and reproducibility? This increases storage but allows re-examining what the AI saw.**

**Q2: [OPTIONAL] Should the usage badge be visible on all pages or only on the applications page?**
