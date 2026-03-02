import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockPrisma, mockReserve, mockRollback, mockGenerateResume, mockEstimateCost } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockPrisma = {
    jobApplication: {
      findFirst: vi.fn(),
    },
    resumeSource: {
      findUnique: vi.fn(),
    },
    resumeGeneration: {
      create: vi.fn(),
    },
  };
  const mockReserve = vi.fn();
  const mockRollback = vi.fn();
  const mockGenerateResume = vi.fn();
  const mockEstimateCost = vi.fn();
  return { mockAuth, mockPrisma, mockReserve, mockRollback, mockGenerateResume, mockEstimateCost };
});

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/resume-cap", () => ({
  reserveGeneration: (...args: unknown[]) => mockReserve(...args),
  rollbackGeneration: (...args: unknown[]) => mockRollback(...args),
}));
vi.mock("@/lib/anthropic", () => ({
  generateResume: (...args: unknown[]) => mockGenerateResume(...args),
  estimateCost: (...args: unknown[]) => mockEstimateCost(...args),
}));
vi.mock("@/lib/resume-compiler", () => ({
  compileResumeSource: () => "# John Doe\nSoftware Engineer",
}));
vi.mock("@/lib/resume-prompt", () => ({
  buildResumePrompt: () => ({ system: "sys", user: "usr" }),
}));

import { POST } from "../route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/resume/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Wrap in authenticatedHandler format
function callPost(body: unknown) {
  return POST(makeRequest(body), { params: Promise.resolve({}) });
}

describe("POST /api/resume/generate", () => {
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

  it("returns 404 when application not owned by user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue(null);
    const res = await callPost({ jobApplicationId: "app1" });
    expect(res.status).toBe(404);
  });

  it("returns 400 when job description is empty", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue({
      id: "app1",
      company: "Acme",
      role: "Dev",
      jobDescription: "",
    });
    const res = await callPost({ jobApplicationId: "app1" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Job description");
  });

  it("returns 400 when resume source is empty (null)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue({
      id: "app1",
      company: "Acme",
      role: "Dev",
      jobDescription: "Some JD",
    });
    // When resumeSource is null, code skips compile and uses ""
    mockPrisma.resumeSource.findUnique.mockResolvedValue(null);
    const res = await callPost({ jobApplicationId: "app1" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Resume source is empty");
  });

  it("returns 429 when cap is reached", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue({
      id: "app1",
      company: "Acme",
      role: "Dev",
      jobDescription: "Some JD",
    });
    mockPrisma.resumeSource.findUnique.mockResolvedValue({
      contact: { fullName: "John" },
      education: [],
      experiences: [],
      skills: [],
      publications: [],
    });
    mockReserve.mockResolvedValue(false);
    const res = await callPost({ jobApplicationId: "app1" });
    expect(res.status).toBe(429);
  });

  it("rolls back on Claude API error", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue({
      id: "app1",
      company: "Acme",
      role: "Dev",
      jobDescription: "Some JD",
    });
    mockPrisma.resumeSource.findUnique.mockResolvedValue({
      contact: { fullName: "John" },
      education: [],
      experiences: [],
      skills: [],
      publications: [],
    });
    mockReserve.mockResolvedValue(true);
    mockGenerateResume.mockRejectedValue(new Error("API error"));

    const res = await callPost({ jobApplicationId: "app1" });
    expect(res.status).toBe(500);
    expect(mockRollback).toHaveBeenCalledWith("user1");
  });

  it("returns generated resume on success", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue({
      id: "app1",
      company: "Acme",
      role: "Dev",
      jobDescription: "Some JD",
    });
    mockPrisma.resumeSource.findUnique.mockResolvedValue({
      contact: { fullName: "John" },
      education: [],
      experiences: [],
      skills: [],
      publications: [],
    });
    mockReserve.mockResolvedValue(true);
    mockGenerateResume.mockResolvedValue({
      markdown: "# Tailored Resume",
      promptTokens: 1000,
      completionTokens: 500,
      totalTokens: 1500,
      modelId: "claude-sonnet-4-6",
    });
    mockEstimateCost.mockReturnValue(0.0105);
    mockPrisma.resumeGeneration.create.mockResolvedValue({
      id: "gen1",
      createdAt: new Date("2026-03-02"),
    });

    const res = await callPost({ jobApplicationId: "app1" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("gen1");
    expect(body.markdownOutput).toBe("# Tailored Resume");
    expect(body.estimatedCost).toBe(0.0105);
  });
});
