export interface FitAnalysisResult {
  relevantRoles: Array<{
    title: string;
    company: string;
    relevanceReason: string;
  }>;
  alignedWins: string[];
  skillsMatch: {
    strong: string[];
    partial: string[];
    missing: string[];
  };
  gaps: string[];
  titleRecommendations: string[];
  questions: Array<{
    question: string;
    type: "text" | "select";
    options?: string[];
    purpose: string;
  }>;
}

export const FIT_ANALYSIS_SYSTEM = `You are an expert resume strategist. Analyze the candidate's resume against the target job description to identify alignment, gaps, and areas where additional context from the candidate would improve the tailored resume.

Focus on:
- Which roles and experiences are most relevant to the target position
- Specific accomplishments that align with job requirements
- Skills that match, partially match, or are missing
- Gaps that could be addressed with the right framing
- Which alternate title (if available) best matches the target posting
- Questions that would help you write a stronger, more targeted resume
- Company culture fit: if the target company is well-known (e.g., FAANG, major consultancies, Fortune 500), leverage your knowledge of their leadership principles, cultural values, and hiring signals. Flag experiences that align with or could be reframed to reflect these values, and note gaps where the candidate should emphasize different qualities.

Be direct and actionable. Do not pad with generic advice.`;

export const FIT_ANALYSIS_TOOL = {
  name: "fit_analysis",
  description: "Structured analysis of resume-to-job-description fit",
  input_schema: {
    type: "object" as const,
    properties: {
      relevantRoles: {
        type: "array",
        description: "Roles from the resume most relevant to the target position",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            company: { type: "string" },
            relevanceReason: { type: "string" },
          },
          required: ["title", "company", "relevanceReason"],
        },
      },
      alignedWins: {
        type: "array",
        description: "Specific accomplishments from the resume that align with job requirements",
        items: { type: "string" },
      },
      skillsMatch: {
        type: "object",
        description: "Skills categorized by match strength",
        properties: {
          strong: { type: "array", items: { type: "string" } },
          partial: { type: "array", items: { type: "string" } },
          missing: { type: "array", items: { type: "string" } },
        },
        required: ["strong", "partial", "missing"],
      },
      gaps: {
        type: "array",
        description: "Key gaps between resume and job requirements",
        items: { type: "string" },
      },
      titleRecommendations: {
        type: "array",
        description: "Recommended titles from candidate's alternate titles that best match the posting",
        items: { type: "string" },
      },
      questions: {
        type: "array",
        description: "Clarifying questions to ask the candidate for a better-tailored resume",
        items: {
          type: "object",
          properties: {
            question: { type: "string" },
            type: { type: "string", enum: ["text", "select"] },
            options: { type: "array", items: { type: "string" } },
            purpose: { type: "string", description: "Why this question helps improve the resume" },
          },
          required: ["question", "type", "purpose"],
        },
      },
    },
    required: ["relevantRoles", "alignedWins", "skillsMatch", "gaps", "titleRecommendations", "questions"],
  },
};

export function buildFitAnalysisUserMessage(
  resumeMarkdown: string,
  jobDescription: string
): string {
  return `## Candidate Resume

${resumeMarkdown}

## Target Job Description

${jobDescription}

---

Analyze the fit between this resume and the job description. Identify relevant experience, aligned wins, skills match/gaps, recommended titles, and generate clarifying questions that would help produce a more targeted resume.`;
}
