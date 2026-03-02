/**
 * Build the system + user prompt for resume tailoring via Claude.
 * Impact-first approach per PRD FR-7.
 */

export function buildResumePrompt(
  resumeMarkdown: string,
  jobDescription: string
): { system: string; user: string } {
  const system = `You are an expert resume writer who creates highly targeted, ATS-optimized resumes.

Your task is to tailor the candidate's resume for a specific job posting. Follow these rules:

1. **Impact-first bullets**: Start every bullet with a strong action verb and quantify results where possible.
2. **Keyword alignment**: Mirror the exact terminology from the job description (tools, methodologies, role titles).
3. **Relevance filtering**: Promote the most relevant experience and skills; de-emphasize or omit irrelevant details.
4. **Truthful adaptation**: Reframe existing experience to highlight relevant aspects, but NEVER fabricate experience, skills, or achievements.
5. **Format**: Output clean Markdown matching the input structure (H1 for name, H2 for sections, H3 for entries, bullets for achievements).
6. **Conciseness**: Aim for a 1-page resume. Be ruthlessly concise — every word must earn its place.
7. **Professional summary**: Write a 2-3 sentence summary tailored to the target role.

Output ONLY the tailored resume in Markdown. No commentary, explanations, or notes.`;

  const user = `## Source Resume

${resumeMarkdown}

## Target Job Description

${jobDescription}

---

Please generate a tailored resume based on the source resume above, optimized for the target job description.`;

  return { system, user };
}
