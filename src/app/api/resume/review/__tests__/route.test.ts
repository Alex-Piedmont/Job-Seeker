import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockPrisma, mockCallWithTool, mockEstimateCost } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockPrisma = {
    jobApplication: { findFirst: vi.fn() },
    resumeAuxCall: { create: vi.fn() },
  };
  const mockCallWithTool = vi.fn();
  const mockEstimateCost = vi.fn();
  return { mockAuth, mockPrisma, mockCallWithTool, mockEstimateCost };
});

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/anthropic", () => ({
  callWithTool: (...args: unknown[]) => mockCallWithTool(...args),
  estimateCost: (...args: unknown[]) => mockEstimateCost(...args),
}));

import { POST } from "../route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/resume/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function callPost(body: unknown) {
  return POST(makeRequest(body), { params: Promise.resolve({}) });
}

const mockReview = {
  keywordAlignment: { matched: ["TypeScript"], missing: ["Rust"] },
  narrativeCoherence: "Good overall arc",
  bulletImprovements: [
    { original: "Led team", suggested: "Reduced churn 30% by leading team", reason: "Impact-first" },
  ],
  gapsAndRisks: ["No Rust experience"],
  overallGrade: "B",
  gradeJustification: "Strong alignment with minor gaps",
};

describe("POST /api/resume/review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await callPost({ jobApplicationId: "app1", resumeMarkdown: "# Resume" });
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing fields", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    const res = await callPost({});
    expect(res.status).toBe(400);
  });

  it("returns 404 when application not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue(null);
    const res = await callPost({ jobApplicationId: "app1", resumeMarkdown: "# Resume" });
    expect(res.status).toBe(404);
  });

  it("returns 400 when job description is empty", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue({
      id: "app1",
      jobDescription: "",
    });
    const res = await callPost({ jobApplicationId: "app1", resumeMarkdown: "# Resume" });
    expect(res.status).toBe(400);
  });

  it("returns review on success", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue({
      id: "app1",
      jobDescription: "Some JD",
    });
    mockCallWithTool.mockResolvedValue({
      data: mockReview,
      promptTokens: 400,
      completionTokens: 200,
      totalTokens: 600,
      modelId: "claude-sonnet-4-6",
    });
    mockEstimateCost.mockReturnValue(0.004);
    mockPrisma.resumeAuxCall.create.mockResolvedValue({});

    const res = await callPost({ jobApplicationId: "app1", resumeMarkdown: "# Resume" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.review.overallGrade).toBe("B");
    expect(body.review.keywordAlignment.matched).toContain("TypeScript");
    expect(mockPrisma.resumeAuxCall.create).toHaveBeenCalled();
  });

  it("returns 500 when Claude API fails", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue({
      id: "app1",
      jobDescription: "Some JD",
    });
    mockCallWithTool.mockRejectedValue(new Error("API error"));

    const res = await callPost({ jobApplicationId: "app1", resumeMarkdown: "# Resume" });
    expect(res.status).toBe(500);
  });
});
