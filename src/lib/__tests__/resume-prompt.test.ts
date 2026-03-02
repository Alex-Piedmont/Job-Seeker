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

  it("returns a system prompt with resume writing instructions", () => {
    const { system } = buildResumePrompt("resume", "jd");
    expect(system).toContain("Impact-first");
    expect(system).toContain("ATS-optimized");
    expect(system).toContain("NEVER fabricate");
  });

  it("separates resume and JD with section headers", () => {
    const { user } = buildResumePrompt("my resume", "my jd");
    expect(user).toContain("## Source Resume");
    expect(user).toContain("## Target Job Description");
  });
});
