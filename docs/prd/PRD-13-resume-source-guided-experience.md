# PRD: Resume Source Guided Experience

**Version:** 1.1
**Date:** 2026-03-06
**Author:** Product Management
**Status:** Draft
**Project:** Job Seeker

---

## 1. Introduction / Overview

The Resume Source is the foundation of the entire app -- every tailored resume is generated from the data users enter here. However, the current experience offers almost no guidance on how to structure work history effectively. New users land on an empty form with an "Add Experience" button and no explanation of subsections, bullet formatting, or the storytelling approach that produces the strongest AI-generated resumes.

The core insight is that subsections are not just an organizational convenience for the AI -- they are a **thinking tool** for the user. When users group their experience by theme (e.g., "Program Management", "Technical Leadership"), it triggers recall of additional accomplishments they would otherwise forget. Flat bullet lists lead to shallow, incomplete input. Structured narrative input leads to richer, more detailed resume source material.

This PRD defines three interconnected improvements: (1) an onboarding modal that teaches the subsection concept before users start entering work history, (2) thinking-prompt chips in the subsection empty state that lower the barrier to creating well-structured entries, and (3) contextual placeholder text in bullet textareas that coaches users toward strong content.

---

## 2. Goals

- **Increase subsection adoption:** New users who add work experience should create at least one subsection per role within their first session.
- **Improve bullet quality:** Users should write bullets that include context, action, and outcome rather than bare-bones statements like "Managed projects."
- **Reduce blank-page paralysis:** The empty state for work experience subsections should feel inviting and actionable, not intimidating.
- **Preserve flexibility:** The system suggests structure but never forces it. Users can rename, delete, or ignore all suggestions.

### What Success Looks Like

A new user arrives at Resume Source, sees a short walkthrough explaining how subsections help them tell their career story, then adds their first work experience. Instead of staring at an empty card, they see clickable thinking prompts like "Projects I Led" and "Problems I Solved." They click one, rename it to "Cloud Migration Program," and start adding bullets with placeholder guidance that coaches them toward impact-driven language. Within 15 minutes they have a well-structured first role that the AI can work with effectively.

### Success Metrics

Success for this iteration is measured qualitatively:
- Manual review of user resume sources shows increased subsection usage compared to baseline
- Direct user feedback indicates the onboarding was helpful and non-intrusive
- Users report that thinking prompts helped them recall accomplishments they would have otherwise missed

Quantitative tracking (event analytics, adoption funnels) is deferred to a future iteration.

---

## 3. User Stories

### US-1: First-time user learns the subsection concept

**As a** new user visiting Resume Source for the first time, **I want to** understand how subsections help me structure my work history, **so that** I can provide the AI with rich, well-organized input.

**Acceptance Criteria:**
- [ ] A multi-step modal appears on first visit to the Resume Source page, regardless of which tab is active
- [ ] The modal auto-opens even after a markdown import (imported content benefits from subsection guidance)
- [ ] The modal explains the subsection concept with a concrete before/after example
- [ ] The modal can be dismissed via X button and does not reappear on subsequent visits
- [ ] A persistent guide button (HelpCircle icon) is visible on the Resume Source page header on all tabs so users can reopen the modal at any time

### US-2: User gets thinking prompts when adding subsections

**As a** user who has added a work experience entry, **I want to** see suggested subsection themes when the entry has no subsections, **so that** I can quickly start organizing my experience without thinking up categories from scratch.

**Acceptance Criteria:**
- [ ] When a work experience card is expanded and has zero subsections, the subsection area shows clickable prompt chips
- [ ] Chips appear regardless of whether company/title fields are filled in
- [ ] Clicking a chip creates a subsection with that label pre-filled (editable) and auto-expands the new subsection
- [ ] All chips are disabled while a subsection creation request is in flight (prevents duplicates from rapid clicks)
- [ ] The prompt chips disappear once the experience has at least one subsection
- [ ] The "Add Subsection" button remains visible alongside the chips

### US-3: User gets bullet-writing guidance

**As a** user writing bullets within a subsection, **I want to** see placeholder text that coaches me toward impactful content, **so that** I write bullets the AI can turn into strong resume lines.

**Acceptance Criteria:**
- [ ] The next empty bullet textarea shows contextual placeholder text instead of the current generic "Bullet point..."
- [ ] The placeholder suggests a structure (context, action, outcome) without being prescriptive
- [ ] Only the next empty bullet shows the coaching placeholder; bullets with content show no placeholder

### US-4: Returning user can reopen the guide

**As a** returning user who has forgotten the recommended approach, **I want to** reopen the onboarding walkthrough, **so that** I can refresh my understanding without starting over.

**Acceptance Criteria:**
- [ ] A guide button is always visible on the Resume Source page header, on all tabs
- [ ] The button sits left of the Upload Markdown button
- [ ] Clicking it opens the same onboarding modal
- [ ] The button uses the HelpCircle icon from lucide-react

### US-5: User with flat existing content gets a nudge

**As a** user who has work experience entries without subsections, **I want to** be prompted to organize my content into subsections, **so that** I can improve the quality of my resume source.

**Acceptance Criteria:**
- [ ] When at least one experience entry has zero subsections, a dismissible banner appears on the Work Experience tab
- [ ] The banner explains why subsections improve resume generation and includes a "Learn more" link that opens the onboarding modal
- [ ] Dismissing the banner persists via `localStorage` (does not reappear after dismissal, even across sessions)
- [ ] The banner does not appear for users who have subsections on all their experience entries

---

## 4. Functional Requirements

### Onboarding Modal

- **FR-1:** Create a multi-step dialog component (`ResumeSourceGuide`) with 3 steps:
  1. **Why structure matters** -- Explain that grouping experience by theme helps users recall more accomplishments and gives the AI better material. One paragraph, no jargon. Engineer drafts final copy.
  2. **Before / After example** -- Show a sequential comparison:
     - **Before:** A flat list of 4-5 generic bullets under "Senior Product Manager at Acme Corp"
     - **After:** The same content reorganized into 2-3 subsections ("Product Strategy", "Cross-functional Programs") with richer, more specific bullets
  3. **How to get started** -- Explain that thinking prompts will appear when they add a work experience, and they can rename or replace any suggestion. Mention the guide button for future reference. Engineer drafts final copy.

- **FR-2:** The modal shall use the existing `Dialog`/`DialogContent` components from `@/components/ui/dialog`. Step navigation via Next/Back buttons and a step indicator (dots or "Step 1 of 3"). The final step shows a "Got it" button instead of "Next". The X close button is sufficient for dismissal -- no separate "Skip" option needed.

- **FR-3:** First-visit detection shall use `localStorage` key `resume-source-guide-seen`. If the key exists, the modal does not auto-open. Clicking the guide button always opens it regardless of the key.

- **FR-3a:** The modal auto-opens on first visit to the Resume Source page regardless of which tab is active, including after a markdown import.

- **FR-4:** On modal close (either via dismiss or completing all steps), set `localStorage` key `resume-source-guide-seen` to `"true"`.

### Guide Button

- **FR-4a:** Add a guide button (HelpCircle icon) to the Resume Source page header, positioned left of the Upload Markdown button. The button is visible on all tabs, for both new and returning users.

- **FR-4b:** Clicking the guide button opens the onboarding modal regardless of localStorage state.

### Thinking Prompt Chips

- **FR-5:** Define a constant array of thinking prompts:

```typescript
const THINKING_PROMPTS = [
  { label: "Projects I Led", icon: Rocket },
  { label: "Problems I Solved", icon: Lightbulb },
  { label: "Growth & Impact", icon: TrendingUp },
  { label: "Collaboration & Leadership", icon: Users },
] as const;
```

These labels are final for v1. Structure the code so the array is a single constant that is trivial to update in future iterations.

- **FR-6:** When a work experience card is expanded and `fields.subsections.length === 0`, render the thinking prompts as clickable chips/badges in the subsection area (between the "Subsections" heading and the "Add Subsection" button). Chips appear regardless of whether company/title fields are filled in.

- **FR-7:** Clicking a chip shall call the existing `handleAddSubsection` logic but with the chip's label instead of `"New Subsection"`. This requires modifying `handleAddSubsection` to accept an optional `label` parameter.

- **FR-7a:** All chips shall be disabled (visually muted, click handlers suppressed) while a subsection creation POST is in flight. This prevents rapid double-clicks from creating duplicate subsections.

- **FR-7b:** A subsection created via chip click shall auto-expand (i.e., `isCollapsed` starts as `false`) so the user can immediately start adding bullets.

- **FR-8:** The chip UI shall use muted background styling (e.g., `bg-muted hover:bg-muted/80`) with the icon and label. Icons shall have `aria-hidden="true"` since the labels are fully descriptive. Chips should wrap on narrow viewports.

### Bullet Placeholder Enhancement

- **FR-9:** Replace the current bullet textarea placeholder `"Bullet point..."` in `SubsectionForm` with a contextual placeholder on the next empty bullet only:

```
"What did you do, why did it matter, and what was the result?"
```

- **FR-10:** The placeholder shall only appear on the first empty bullet in the list. Bullets that already contain text show no placeholder. If all bullets have content, new bullets added via "Add Bullet" show the placeholder until the user types.

### Flat Content Nudge Banner

- **FR-11:** In `ExperienceSection`, when at least one experience has `subsections.length === 0`, show a dismissible banner above the experience list.

- **FR-12:** Banner text: "Organize your experience into subsections (like 'Key Projects' or 'Leadership') to help the AI generate more targeted resumes." Include a "Learn more" link that opens the onboarding modal and a dismiss (X) button.

- **FR-13:** Dismissal state shall be stored in `localStorage` (key: `resume-source-nudge-dismissed`). Once dismissed, the banner does not reappear, even across sessions. This respects the user's choice -- the guide button remains available if they change their mind.

- **FR-14:** The guide open state shall be passed from the page component to `ExperienceSection` via a callback prop (`onOpenGuide`). This allows the banner's "Learn more" link to trigger the modal.

---

## 5. Non-Goals (Out of Scope)

- **AI-powered reorganization:** Automatically grouping flat bullets into subsections using AI. This is a potential future feature but not part of this PRD.
- **Role-based template suggestions:** Detecting job titles and suggesting role-specific subsections (e.g., "Engineering Management" templates). The thinking prompts are intentionally universal.
- **Mandatory structure:** The system shall never prevent users from having flat bullets or empty subsections. All guidance is optional.
- **Changes to the import flow:** The markdown import pipeline is unchanged. Imported content that lacks subsections will trigger the nudge banner naturally.
- **Changes to other Resume Source tabs:** Only the Work Experience tab and subsection form are modified. Contact, Education, Skills, and Publications are untouched.
- **Analytics or tracking:** No telemetry for subsection adoption rates in this iteration.
- **Mobile-specific layouts:** The changes should be responsive but no dedicated mobile design is required.

---

## 6. Design Considerations

### User Interface

**Resume Source page header (modified):**

```
+----------------------------------------------------------+
| Let's build your resume source          [?] [Upload MD]  |
| Start by adding your contact info...                      |
+----------------------------------------------------------+
```

The `[?]` button (HelpCircle icon) opens the onboarding modal. It is always visible on all tabs, not just for new users. It sits immediately left of the Upload Markdown button.

**Onboarding modal -- Step 2 (Before/After):**

```
+----------------------------------------------------+
|  How to structure your experience     [X]          |
|                                                     |
|  BEFORE:                                           |
|  Senior PM at Acme Corp                            |
|  * Managed cross-functional teams                  |
|  * Launched new product features                   |
|  * Improved team processes                         |
|  * Worked with engineering on delivery             |
|                                                     |
|  AFTER:                                            |
|  Senior PM at Acme Corp                            |
|                                                     |
|  Product Strategy                                  |
|  * Led 0-to-1 launch of analytics dashboard,       |
|    driving 40% increase in enterprise adoption     |
|  * Defined 3-year product roadmap aligned with     |
|    $50M revenue target                             |
|                                                     |
|  Cross-functional Programs                         |
|  * Coordinated 4 engineering teams across a        |
|    platform migration serving 2M users             |
|                                                     |
|               [Back]  Step 2 of 3  [Next]          |
+----------------------------------------------------+
```

**Subsection empty state with thinking prompts:**

```
+--------------------------------------------------+
|  Subsections                                      |
|                                                    |
|  [Rocket] Projects I Led                          |
|  [Lightbulb] Problems I Solved                    |
|  [TrendingUp] Growth & Impact                     |
|  [Users] Collaboration & Leadership               |
|                                                    |
|  + Add Subsection                                 |
+--------------------------------------------------+
```

Chips should be displayed as a horizontal flex-wrap row of styled buttons/badges.

### User Experience

**Journey 1: New user first visit**
1. User navigates to Resume Source
2. Onboarding modal auto-opens (3 steps), regardless of active tab
3. User reads through, clicks "Got it" on final step
4. Modal closes, localStorage flag set
5. User clicks Work Experience tab, adds an experience
6. Expanded card shows thinking prompt chips in subsection area (even before filling company/title)
7. User clicks "Projects I Led" -- chips disable during POST -- subsection created and auto-expanded
8. User renames it to "Platform Migration", starts adding bullets
9. First empty bullet placeholder guides them: "What did you do, why did it matter..."

**Journey 2: Returning user with flat content**
1. User visits Work Experience tab
2. Banner appears: "Organize your experience into subsections..."
3. User clicks "Learn more" to reopen the guide modal
4. User adds subsections to existing experiences
5. Banner no longer shows (all experiences now have subsections)

**Journey 3: User dismisses nudge permanently**
1. User sees the nudge banner, clicks X to dismiss
2. Banner disappears and does not return (localStorage persisted)
3. Guide button remains available in header if they change their mind later

**Loading States:**
- Thinking prompt chips show a disabled/muted state while a subsection creation POST is in flight.
- No other new loading states required. The modal renders client-side from static content.

**Error States:**
- If subsection creation fails (from clicking a chip), show the existing toast error. Chips re-enable for retry.

---

## 7. Technical Considerations

### Architecture

**New frontend files:**
- `src/components/resume-source/resume-source-guide.tsx` -- Onboarding modal component (3-step dialog)

**Modified frontend files:**
- `src/app/(authenticated)/resume-source/page.tsx` (179 lines) -- Add guide button to header, manage guide open state, pass `onOpenGuide` callback prop to ExperienceSection
- `src/components/resume-source/experience-section.tsx` (615 lines) -- Add thinking prompt chips in subsection empty state, add nudge banner, accept optional `label` parameter in `handleAddSubsection`, accept `onOpenGuide` prop
- `src/components/resume-source/subsection-form.tsx` (215 lines) -- Update bullet placeholder text

**No backend changes required.** The existing POST endpoint for subsections already accepts a `label` field.

### Key Implementation Details

1. The `handleAddSubsection` function in `ExperienceCard` (line 110 of `experience-section.tsx`) currently hardcodes `label: "New Subsection"`. Modify to accept an optional `label` parameter:

```typescript
const handleAddSubsection = async (label = "New Subsection") => {
  const res = await fetch(
    `/api/resume-source/experience/${entry.id}/subsection`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, bullets: [] }),
    }
  );
  // ... rest unchanged
};
```

2. The thinking prompt chips render conditionally when `fields.subsections.length === 0` inside the `ExperienceCard` expanded content, between the "Subsections" h4 heading (line 411) and the "Add Subsection" button (line 452).

3. The guide modal open state is managed via `useState<boolean>` in the page component. The `onOpenGuide` callback is passed as a prop to `ExperienceSection`, which passes it to the nudge banner's "Learn more" link. This is one level of prop drilling -- no context/store needed.

4. Chip labels originate from hardcoded constants, not user input, so no additional input sanitization is needed for the subsection POST body.

### Performance

- No API calls added beyond the existing subsection creation POST (triggered by chip clicks).
- localStorage reads happen once on mount -- negligible performance impact.
- Modal content is simple text and styled divs -- no heavy rendering.

---

## 8. Testing Strategy

### Build Verification

- [ ] `npm run build` passes with no type errors
- [ ] `npm run lint` passes with no new warnings

### Unit Tests (vitest)

- **ResumeSourceGuide component:**
  - [ ] Renders 3 steps with correct content
  - [ ] Next/Back buttons navigate between steps correctly
  - [ ] Step indicator reflects current step
  - [ ] "Got it" button on final step calls onClose
  - [ ] X button calls onClose

- **Thinking prompt chips:**
  - [ ] Chips render when `subsections.length === 0`
  - [ ] Chips do not render when `subsections.length > 0`
  - [ ] Clicking a chip calls `handleAddSubsection` with the correct label
  - [ ] Chips are disabled during pending POST (loading state)

- **Bullet placeholder:**
  - [ ] First empty bullet shows the coaching placeholder
  - [ ] Bullets with content show no placeholder
  - [ ] New bullet added via "Add Bullet" shows placeholder

### End-to-End Tests (Playwright)

- **E2E-1: First visit onboarding flow:**
  1. Clear localStorage
  2. Navigate to /resume-source
  3. Assert modal is visible
  4. Click Next through all 3 steps
  5. Click "Got it"
  6. Assert modal is closed
  7. Refresh page -- assert modal does not reappear
  8. Click guide button -- assert modal reopens

- **E2E-2: Thinking prompt chip flow:**
  1. Navigate to Work Experience tab
  2. Click "Add Experience"
  3. Assert thinking prompt chips are visible in expanded card
  4. Click "Projects I Led" chip
  5. Assert subsection is created with label "Projects I Led"
  6. Assert subsection is auto-expanded
  7. Assert thinking prompt chips are no longer visible

- **E2E-3: Nudge banner flow:**
  1. Create an experience with no subsections
  2. Assert nudge banner is visible
  3. Click dismiss (X)
  4. Assert banner is hidden
  5. Refresh page -- assert banner remains hidden (localStorage)
  6. Add a subsection to the experience
  7. Clear localStorage nudge key, refresh -- assert banner does not appear (condition no longer met)

### Manual Testing

- **Onboarding modal:**
  - Clears localStorage, visits Resume Source -- modal auto-opens
  - Steps through all 3 steps with Next/Back navigation
  - Closes modal, refreshes page -- modal does not reappear
  - Clicks guide button -- modal reopens

- **Thinking prompt chips:**
  - Adds a new work experience, expands it -- chips visible before filling company/title
  - Clicks a chip -- subsection created with that label and auto-expanded
  - Chips disappear after first subsection added
  - Rapid double-click on chip -- only one subsection created (chips disable during POST)

- **Bullet placeholders:**
  - Adds first bullet to a subsection -- shows coaching placeholder
  - Types in the bullet -- placeholder disappears
  - Adds second bullet -- only empty bullet shows placeholder

- **Nudge banner:**
  - Has experience with no subsections -- banner visible
  - Clicks dismiss -- banner gone permanently (survives page reload)
  - Clicks "Learn more" -- guide modal opens
  - Adds subsection to all experiences -- banner condition no longer met

### Edge Cases

- User has localStorage disabled -- modal shows every visit, banner shows every visit (acceptable degradation)
- User has 30 experiences (cap) -- prompt chips still work per-card
- Mobile viewport -- chips wrap to multiple lines
- User opens Resume Source in two tabs -- localStorage sync means dismissal in one tab is reflected on refresh of the other

---

## 9. Dependencies and Assumptions

### Dependencies

**No new libraries required.** All UI is built with existing components:
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` from `@/components/ui/dialog`
- `Button` from `@/components/ui/button`
- `Badge` from `@/components/ui/badge`
- Icons from `lucide-react` (HelpCircle, Rocket, Lightbulb, TrendingUp, Users, ArrowRight, ArrowLeft, X)

### Assumptions

- The existing subsection POST endpoint (`/api/resume-source/experience/[id]/subsection`) accepts any string for `label` -- confirmed by reading the API route.
- `localStorage` is available in the target browsers (all modern browsers).

---

## 10. Implementation Order

| Phase | Scope | Risk Level | Verification |
|---|---|---|---|
| **Phase 1** | Create `ResumeSourceGuide` modal component with 3 steps, static content | Low | Component renders, steps navigate, unit tests pass |
| **Phase 2** | Wire guide into Resume Source page header (button + auto-open logic + localStorage) | Low | Guide opens on first visit, button always works, E2E-1 passes |
| **Phase 3** | Add thinking prompt chips to `ExperienceCard` subsection empty state with disable-during-POST and auto-expand | Low | Chips appear, clicking creates subsection with label, E2E-2 passes |
| **Phase 4** | Update bullet placeholder in `SubsectionForm` | Low | First empty bullet shows coaching placeholder |
| **Phase 5** | Add nudge banner to `ExperienceSection` for flat content with localStorage dismiss | Low | Banner appears/dismisses correctly, E2E-3 passes |

---

## Clarifying Questions

**Q1: [OPTIONAL] For the before/after example in the modal, should the example role/bullets be customizable per industry, or is a single universal example (PM-flavored) acceptable for v1?**

**Q2: [OPTIONAL] Should the thinking prompt labels be user-configurable or admin-configurable in the future, or are they fine as hardcoded constants?**

**Q3: [OPTIONAL] Should the guide button have a tooltip on hover (e.g., "How to structure your experience") for discoverability?**
