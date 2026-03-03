import { describe, it, expect } from "vitest";
import {
  FIT_ANALYSIS_SYSTEM,
  FIT_ANALYSIS_TOOL,
  buildFitAnalysisUserMessage,
} from "../resume-prompts/fit-analysis";

describe("fit analysis prompt", () => {
  it("system prompt instructs analysis of resume vs JD", () => {
    expect(FIT_ANALYSIS_SYSTEM).toContain("resume strategist");
    expect(FIT_ANALYSIS_SYSTEM).toContain("gaps");
    expect(FIT_ANALYSIS_SYSTEM).toContain("Questions");
    expect(FIT_ANALYSIS_SYSTEM).toContain("additional context");
  });

  it("tool schema has all required fields", () => {
    const required = FIT_ANALYSIS_TOOL.input_schema.required as string[];
    expect(required).toContain("relevantRoles");
    expect(required).toContain("alignedWins");
    expect(required).toContain("skillsMatch");
    expect(required).toContain("gaps");
    expect(required).toContain("titleRecommendations");
    expect(required).toContain("questions");
  });

  it("tool schema is a valid object type", () => {
    expect(FIT_ANALYSIS_TOOL.input_schema.type).toBe("object");
    expect(FIT_ANALYSIS_TOOL.name).toBe("fit_analysis");
  });

  it("user message includes resume and JD", () => {
    const message = buildFitAnalysisUserMessage("# Resume", "JD content");
    expect(message).toContain("# Resume");
    expect(message).toContain("JD content");
    expect(message).toContain("## Candidate Resume");
    expect(message).toContain("## Target Job Description");
  });
});
