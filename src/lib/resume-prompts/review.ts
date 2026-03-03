export interface ReviewResult {
  keywordAlignment: {
    matched: string[];
    missing: string[];
  };
  narrativeCoherence: string;
  bulletImprovements: Array<{
    original: string;
    suggested: string;
    reason: string;
  }>;
  gapsAndRisks: string[];
  overallGrade: "A" | "B" | "C" | "D" | "F";
  gradeJustification: string;
}

export const REVIEW_SYSTEM = `You are an expert resume reviewer and hiring consultant. Evaluate the tailored resume against the target job description for keyword alignment, narrative coherence, bullet quality, and gaps.

Be specific and actionable in your feedback. Reference exact bullets and phrases. Grade honestly — an "A" means the resume would likely pass ATS screening AND impress a hiring manager for this specific role.

Grading rubric:
- A: Strong keyword alignment, impact-first bullets with quantified results, clear narrative arc, no significant gaps
- B: Good alignment with minor keyword gaps, mostly impact-first bullets, coherent narrative
- C: Moderate alignment, some activity-first bullets, narrative could be stronger, notable gaps
- D: Weak alignment, mostly activity-first bullets, unclear narrative, significant gaps
- F: Poor alignment, generic bullets, no clear connection to the target role`;

export const REVIEW_TOOL = {
  name: "resume_review",
  description: "Structured review and scoring of a tailored resume against a job description",
  input_schema: {
    type: "object" as const,
    properties: {
      keywordAlignment: {
        type: "object",
        description: "Keywords from the JD that appear or are missing in the resume",
        properties: {
          matched: { type: "array", items: { type: "string" } },
          missing: { type: "array", items: { type: "string" } },
        },
        required: ["matched", "missing"],
      },
      narrativeCoherence: {
        type: "string",
        description: "Assessment of how well the resume tells a coherent story aligned with the target role",
      },
      bulletImprovements: {
        type: "array",
        description: "Specific bullets that could be improved, with suggestions",
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
    required: ["keywordAlignment", "narrativeCoherence", "bulletImprovements", "gapsAndRisks", "overallGrade", "gradeJustification"],
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

Review this tailored resume against the job description. Evaluate keyword alignment, narrative coherence, bullet quality, gaps, and assign an overall grade.`;
}
