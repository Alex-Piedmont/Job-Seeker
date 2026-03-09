import { describe, it, expect } from "vitest";
import {
  REVIEW_SCORECARD_SYSTEM,
  REVIEW_BULLETS_SYSTEM,
  REVIEW_SCORECARD_TOOL,
  REVIEW_BULLETS_TOOL,
  buildReviewUserMessage,
} from "../resume-prompts/review";

describe("review prompt", () => {
  it("scorecard system prompt instructs resume evaluation", () => {
    expect(REVIEW_SCORECARD_SYSTEM).toContain("resume reviewer");
    expect(REVIEW_SCORECARD_SYSTEM).toContain("keyword alignment");
    expect(REVIEW_SCORECARD_SYSTEM).toContain("Grading rubric");
  });

  it("bullets system prompt instructs bullet improvements", () => {
    expect(REVIEW_BULLETS_SYSTEM).toContain("resume reviewer");
    expect(REVIEW_BULLETS_SYSTEM).toContain("bullet improvements");
  });

  it("scorecard tool schema has all required fields", () => {
    const required = REVIEW_SCORECARD_TOOL.input_schema.required as string[];
    expect(required).toContain("keywordAlignment");
    expect(required).toContain("narrativeCoherence");
    expect(required).toContain("gapsAndRisks");
    expect(required).toContain("overallGrade");
    expect(required).toContain("gradeJustification");
  });

  it("bullets tool schema has bulletImprovements required", () => {
    const required = REVIEW_BULLETS_TOOL.input_schema.required as string[];
    expect(required).toContain("bulletImprovements");
  });

  it("tool schemas are valid object types", () => {
    expect(REVIEW_SCORECARD_TOOL.input_schema.type).toBe("object");
    expect(REVIEW_SCORECARD_TOOL.name).toBe("resume_scorecard");
    expect(REVIEW_BULLETS_TOOL.input_schema.type).toBe("object");
    expect(REVIEW_BULLETS_TOOL.name).toBe("resume_bullet_improvements");
  });

  it("user message includes resume and JD", () => {
    const message = buildReviewUserMessage("# Tailored Resume", "JD content");
    expect(message).toContain("# Tailored Resume");
    expect(message).toContain("JD content");
    expect(message).toContain("## Tailored Resume");
    expect(message).toContain("## Target Job Description");
  });
});
