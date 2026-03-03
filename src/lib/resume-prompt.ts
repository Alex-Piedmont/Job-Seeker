/**
 * Build the system + user prompt for resume tailoring via Claude.
 * Impact-first approach per PRD FR-7.
 */

export interface ResumePromptContext {
  fitAnalysis?: string;
  userAnswers?: Array<{ question: string; answer: string }>;
  revisionContext?: {
    previousMarkdown: string;
    reviewFeedback: string;
    userNotes?: string;
  };
}

export function buildResumePrompt(
  resumeMarkdown: string,
  jobDescription: string,
  context?: ResumePromptContext
): { system: string; user: string } {
  const system = `You are an expert resume writer who creates highly targeted, ATS-optimized resumes.

Your task is to tailor the candidate's resume for a specific job posting. Follow these rules:

1. **Impact-first bullets**: Write every bullet using the pattern: [Business outcome] + [by/through] + [what you did] + [scale/evidence]. Lead with the result, not the activity.
   - DO NOT start bullets with action verbs like Led, Managed, Developed, Implemented, Created, Built, Designed, Spearheaded, Orchestrated.
   - Good: "Reduced deployment failures 40% by designing a CI/CD pipeline serving 12 microservices"
   - Bad: "Led the design of a CI/CD pipeline that reduced deployment failures"

2. **Bullet count per role**:
   - Most recent / most relevant roles: 3-4 bullets
   - Second-tier roles: 2-3 bullets
   - Older or less relevant roles: 1-2 bullets
   - Roles older than 10 years: consolidate into a brief summary line unless highly relevant

3. **Title selection**: When the candidate has alternate titles for a role, pick the title that best mirrors the target posting's role title. Only use titles the candidate has actually held.

4. **Role consolidation**: When a candidate held multiple roles at the same company, group them under one company header with sub-entries for each role, ordered chronologically.

5. **Keyword integration**: Surface phrases from the job description naturally within bullet context. Weave them into accomplishment statements rather than listing them verbatim or mirroring exact terminology.

6. **Relevance filtering**: Promote the most relevant experience and skills; de-emphasize or omit irrelevant details.

7. **Truthful adaptation**: Reframe existing experience to highlight relevant aspects, but NEVER fabricate experience, skills, or achievements.

8. **Professional summary**: Write 3-4 sentences: a positioning statement that aligns with the target role, 1-2 proof points with specific numbers or outcomes, and relevant credentials or domain expertise.

9. **Format**: Output clean Markdown matching the input structure (H1 for name, H2 for sections, H3 for entries, bullets for achievements).

10. **Conciseness**: Aim for a 1-page resume. Be ruthlessly concise — every word must earn its place.

11. **Custom sections**: Include custom sections (e.g., Certifications, Awards, Volunteer Work, Projects) if they are relevant to the target role. Omit them only if they add no value for the specific position.

Output ONLY the tailored resume in Markdown. No commentary, explanations, or notes.`;

  let user = `## Source Resume

${resumeMarkdown}

## Target Job Description

${jobDescription}`;

  if (context?.fitAnalysis) {
    user += `

## Fit Analysis

${context.fitAnalysis}`;
  }

  if (context?.userAnswers && context.userAnswers.length > 0) {
    const qaBlock = context.userAnswers
      .map((qa) => `**Q:** ${qa.question}\n**A:** ${qa.answer}`)
      .join("\n\n");
    user += `

## Candidate Context

${qaBlock}`;
  }

  if (context?.revisionContext) {
    user += `

## Revision Request

### Previous Resume Draft
${context.revisionContext.previousMarkdown}

### Review Feedback
${context.revisionContext.reviewFeedback}`;

    if (context.revisionContext.userNotes) {
      user += `

### Additional Notes from Candidate
${context.revisionContext.userNotes}`;
    }
  }

  user += `

---

Please generate a tailored resume based on the source resume above, optimized for the target job description.`;

  return { system, user };
}
