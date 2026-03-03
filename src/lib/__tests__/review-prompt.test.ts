import { describe, it, expect } from "vitest";
import {
  REVIEW_SYSTEM,
  REVIEW_TOOL,
  buildReviewUserMessage,
} from "../resume-prompts/review";

describe("review prompt", () => {
  it("system prompt instructs resume evaluation", () => {
    expect(REVIEW_SYSTEM).toContain("resume reviewer");
    expect(REVIEW_SYSTEM).toContain("keyword alignment");
    expect(REVIEW_SYSTEM).toContain("Grading rubric");
  });

  it("tool schema has all required fields", () => {
    const required = REVIEW_TOOL.input_schema.required as string[];
    expect(required).toContain("keywordAlignment");
    expect(required).toContain("narrativeCoherence");
    expect(required).toContain("bulletImprovements");
    expect(required).toContain("gapsAndRisks");
    expect(required).toContain("overallGrade");
    expect(required).toContain("gradeJustification");
  });

  it("tool schema is a valid object type", () => {
    expect(REVIEW_TOOL.input_schema.type).toBe("object");
    expect(REVIEW_TOOL.name).toBe("resume_review");
  });

  it("user message includes resume and JD", () => {
    const message = buildReviewUserMessage("# Tailored Resume", "JD content");
    expect(message).toContain("# Tailored Resume");
    expect(message).toContain("JD content");
    expect(message).toContain("## Tailored Resume");
    expect(message).toContain("## Target Job Description");
  });
});
