export const GRADE_COLORS: Record<string, string> = {
  A: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  B: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  C: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  D: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  F: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export interface ReviewScorecardResult {
  keywordAlignment: {
    matched: string[];
    missing: string[];
  };
  narrativeCoherence: string;
  gapsAndRisks: string[];
  overallGrade: "A" | "B" | "C" | "D" | "F";
  gradeJustification: string;
}

export interface ReviewBulletsResult {
  bulletImprovements: Array<{
    original: string;
    suggested: string;
    reason: string;
  }>;
}

export interface ReviewResult extends ReviewScorecardResult, ReviewBulletsResult {}

const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

export const REVIEW_SCORECARD_SYSTEM = `You are an expert resume reviewer and hiring consultant. Today's date is ${today}. Use this to determine whether degrees, certifications, or roles are completed or in-progress — if an end date is in the past, treat it as completed.

Evaluate the tailored resume against the target job description for keyword alignment, narrative coherence, and gaps.

If the target company is well-known (e.g., FAANG, major consultancies, Fortune 500), evaluate whether the resume signals the right cultural values. For example, Amazon resumes should reflect leadership principles like Customer Obsession and Ownership; Google resumes should demonstrate impact at scale and collaboration. Flag missing cultural signals.

Be specific and actionable in your feedback. Grade honestly — an "A" means the resume would likely pass ATS screening AND impress a hiring manager for this specific role.

Keep all text fields concise (1-3 sentences). For keywords, list only the most relevant terms (up to 10 matched, up to 8 missing).

Grading rubric:
- A: Strong keyword alignment, impact-first bullets with quantified results, clear narrative arc, no significant gaps
- B: Good alignment with minor keyword gaps, mostly impact-first bullets, coherent narrative
- C: Moderate alignment, some activity-first bullets, narrative could be stronger, notable gaps
- D: Weak alignment, mostly activity-first bullets, unclear narrative, significant gaps
- F: Poor alignment, generic bullets, no clear connection to the target role`;

export const REVIEW_BULLETS_SYSTEM = `You are an expert resume reviewer and hiring consultant. Today's date is ${today}. Your task is to suggest the most impactful bullet improvements for the tailored resume based on the target job description.

Focus on bullets that could be rewritten to better demonstrate impact, quantify results, align with the JD's key requirements, or reflect the target company's culture and values.

For each improvement, provide the exact original bullet text, a rewritten version leading with business impact, and a brief reason explaining why the change matters.

Limit to exactly 5 bullet improvements — pick the ones that would make the biggest difference.`;

export const REVIEW_SCORECARD_TOOL = {
  name: "resume_scorecard",
  description: "Structured scoring and assessment of a tailored resume against a job description",
  input_schema: {
    type: "object" as const,
    properties: {
      keywordAlignment: {
        type: "object",
        description: "Keywords from the JD that appear or are missing in the resume",
        properties: {
          matched: { type: "array", items: { type: "string" }, maxItems: 10 },
          missing: { type: "array", items: { type: "string" }, maxItems: 8 },
        },
        required: ["matched", "missing"],
      },
      narrativeCoherence: {
        type: "string",
        description: "Assessment of how well the resume tells a coherent story aligned with the target role",
      },
      gapsAndRisks: {
        type: "array",
        description: "Gaps between the resume and JD that a hiring manager would notice",
        items: { type: "string" },
      },
      overallGrade: {
        type: "string",
        enum: ["A", "B", "C", "D", "F"],
        description: "Overall grade for the resume's fit to the job description",
      },
      gradeJustification: {
        type: "string",
        description: "Brief justification for the grade",
      },
    },
    required: ["keywordAlignment", "narrativeCoherence", "gapsAndRisks", "overallGrade", "gradeJustification"],
  },
};

export const REVIEW_BULLETS_TOOL = {
  name: "resume_bullet_improvements",
  description: "Top 5 most impactful bullet improvements for a tailored resume",
  input_schema: {
    type: "object" as const,
    properties: {
      bulletImprovements: {
        type: "array",
        description: "Top 5 most impactful bullet improvements",
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            original: { type: "string" },
            suggested: { type: "string" },
            reason: { type: "string" },
          },
          required: ["original", "suggested", "reason"],
        },
      },
    },
    required: ["bulletImprovements"],
  },
};

export function buildReviewUserMessage(
  resumeMarkdown: string,
  jobDescription: string
): string {
  return `## Tailored Resume

${resumeMarkdown}

## Target Job Description

${jobDescription}

---

Review this tailored resume against the job description.`;
}
