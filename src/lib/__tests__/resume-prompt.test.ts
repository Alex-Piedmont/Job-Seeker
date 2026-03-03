import { describe, it, expect } from "vitest";
import { buildResumePrompt } from "../resume-prompt";

describe("buildResumePrompt", () => {
  it("includes resume markdown in user prompt", () => {
    const { user } = buildResumePrompt("# John Doe\nSoftware Engineer", "We need a dev");
    expect(user).toContain("# John Doe");
    expect(user).toContain("Software Engineer");
  });

  it("includes job description in user prompt", () => {
    const { user } = buildResumePrompt("resume content", "Looking for a senior engineer");
    expect(user).toContain("Looking for a senior engineer");
  });

  it("returns a system prompt with impact-first instructions", () => {
    const { system } = buildResumePrompt("resume", "jd");
    expect(system).toContain("Impact-first bullets");
    expect(system).toContain("DO NOT start bullets with action verbs");
    expect(system).toContain("ATS-optimized");
    expect(system).toContain("NEVER fabricate");
  });

  it("includes bullet count rules", () => {
    const { system } = buildResumePrompt("resume", "jd");
    expect(system).toContain("3-4 bullets");
    expect(system).toContain("2-3 bullets");
    expect(system).toContain("1-2 bullets");
  });

  it("includes title selection guidance", () => {
    const { system } = buildResumePrompt("resume", "jd");
    expect(system).toContain("Title selection");
    expect(system).toContain("alternate titles");
  });

  it("separates resume and JD with section headers", () => {
    const { user } = buildResumePrompt("my resume", "my jd");
    expect(user).toContain("## Source Resume");
    expect(user).toContain("## Target Job Description");
  });

  it("appends fit analysis when provided in context", () => {
    const { user } = buildResumePrompt("resume", "jd", {
      fitAnalysis: "Strong match for backend roles",
    });
    expect(user).toContain("## Fit Analysis");
    expect(user).toContain("Strong match for backend roles");
  });

  it("appends user answers when provided in context", () => {
    const { user } = buildResumePrompt("resume", "jd", {
      userAnswers: [
        { question: "Biggest achievement?", answer: "Scaled system to 1M users" },
        { question: "Leadership experience?", answer: "Managed team of 5" },
      ],
    });
    expect(user).toContain("## Candidate Context");
    expect(user).toContain("Biggest achievement?");
    expect(user).toContain("Scaled system to 1M users");
    expect(user).toContain("Leadership experience?");
  });

  it("does not append empty user answers", () => {
    const { user } = buildResumePrompt("resume", "jd", { userAnswers: [] });
    expect(user).not.toContain("## Candidate Context");
  });

  it("appends revision context when provided", () => {
    const { user } = buildResumePrompt("resume", "jd", {
      revisionContext: {
        previousMarkdown: "# Old Resume",
        reviewFeedback: "Missing keywords",
        userNotes: "Focus on cloud experience",
      },
    });
    expect(user).toContain("## Revision Request");
    expect(user).toContain("# Old Resume");
    expect(user).toContain("Missing keywords");
    expect(user).toContain("Focus on cloud experience");
  });

  it("omits user notes from revision context when not provided", () => {
    const { user } = buildResumePrompt("resume", "jd", {
      revisionContext: {
        previousMarkdown: "# Old Resume",
        reviewFeedback: "Needs more impact",
      },
    });
    expect(user).toContain("## Revision Request");
    expect(user).not.toContain("### Additional Notes from Candidate");
  });

  it("works with no context (backward compatible)", () => {
    const { user } = buildResumePrompt("resume", "jd");
    expect(user).not.toContain("## Fit Analysis");
    expect(user).not.toContain("## Candidate Context");
    expect(user).not.toContain("## Revision Request");
    expect(user).toContain("## Source Resume");
    expect(user).toContain("## Target Job Description");
  });
});
