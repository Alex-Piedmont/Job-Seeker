import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockPrisma, mockCallWithTool, mockEstimateCost } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockPrisma = {
    jobApplication: { findFirst: vi.fn() },
    resumeSource: { findUnique: vi.fn() },
    fitAnalysisCache: { findUnique: vi.fn(), upsert: vi.fn() },
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
vi.mock("@/lib/resume-compiler", () => ({
  compileResumeSource: () => "# John Doe\nSoftware Engineer",
}));
vi.mock("@/lib/hash", () => ({
  hashContent: (s: string) => `hash_${s.slice(0, 10)}`,
}));

import { POST } from "../route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/resume/fit-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function callPost(body: unknown) {
  return POST(makeRequest(body), { params: Promise.resolve({}) });
}

const mockAnalysis = {
  relevantRoles: [{ title: "Engineer", company: "Acme", relevanceReason: "Direct match" }],
  alignedWins: ["Scaled system to 1M users"],
  skillsMatch: { strong: ["TypeScript"], partial: ["Go"], missing: ["Rust"] },
  gaps: ["No Rust experience"],
  titleRecommendations: ["Senior Engineer"],
  questions: [{ question: "Tell me about scaling?", type: "text", purpose: "Improve bullets" }],
};

describe("POST /api/resume/fit-analysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await callPost({ jobApplicationId: "app1" });
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing jobApplicationId", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    const res = await callPost({});
    expect(res.status).toBe(400);
  });

  it("returns 404 when application not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue(null);
    const res = await callPost({ jobApplicationId: "app1" });
    expect(res.status).toBe(404);
  });

  it("returns 400 when job description is empty", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue({
      id: "app1",
      jobDescription: "",
    });
    const res = await callPost({ jobApplicationId: "app1" });
    expect(res.status).toBe(400);
  });

  it("returns cached result when hashes match", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue({
      id: "app1",
      jobDescription: "Some JD",
    });
    mockPrisma.resumeSource.findUnique.mockResolvedValue({
      contact: { fullName: "John" },
      education: [],
      experiences: [],
      skills: [],
      publications: [],
      customSections: [],
      miscellaneous: null,
    });
    mockPrisma.fitAnalysisCache.findUnique.mockResolvedValue({
      resumeSourceHash: "hash_# John Doe",
      jobDescriptionHash: "hash_Some JD",
      analysisJson: JSON.stringify(mockAnalysis),
    });

    const res = await callPost({ jobApplicationId: "app1" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cached).toBe(true);
    expect(body.analysis.relevantRoles).toHaveLength(1);
    expect(mockCallWithTool).not.toHaveBeenCalled();
  });

  it("calls Claude on cache miss and stores result", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue({
      id: "app1",
      jobDescription: "Some JD",
    });
    mockPrisma.resumeSource.findUnique.mockResolvedValue({
      contact: { fullName: "John" },
      education: [],
      experiences: [],
      skills: [],
      publications: [],
      customSections: [],
      miscellaneous: null,
    });
    mockPrisma.fitAnalysisCache.findUnique.mockResolvedValue(null);
    mockCallWithTool.mockResolvedValue({
      data: mockAnalysis,
      promptTokens: 500,
      completionTokens: 300,
      totalTokens: 800,
      modelId: "claude-sonnet-4-6",
    });
    mockEstimateCost.mockReturnValue(0.006);
    mockPrisma.fitAnalysisCache.upsert.mockResolvedValue({});
    mockPrisma.resumeAuxCall.create.mockResolvedValue({});

    const res = await callPost({ jobApplicationId: "app1" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cached).toBe(false);
    expect(body.analysis.relevantRoles).toHaveLength(1);
    expect(mockPrisma.fitAnalysisCache.upsert).toHaveBeenCalled();
    expect(mockPrisma.resumeAuxCall.create).toHaveBeenCalled();
  });

  it("returns 500 when Claude API fails", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue({
      id: "app1",
      jobDescription: "Some JD",
    });
    mockPrisma.resumeSource.findUnique.mockResolvedValue({
      contact: { fullName: "John" },
      education: [],
      experiences: [],
      skills: [],
      publications: [],
      customSections: [],
      miscellaneous: null,
    });
    mockPrisma.fitAnalysisCache.findUnique.mockResolvedValue(null);
    mockCallWithTool.mockRejectedValue(new Error("API error"));

    const res = await callPost({ jobApplicationId: "app1" });
    expect(res.status).toBe(500);
  });
});
