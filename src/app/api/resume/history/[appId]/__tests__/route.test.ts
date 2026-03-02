import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockPrisma } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockPrisma = {
    jobApplication: {
      findFirst: vi.fn(),
    },
    resumeGeneration: {
      findMany: vi.fn(),
    },
  };
  return { mockAuth, mockPrisma };
});

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "../route";

function callGet(appId: string) {
  return GET(
    new Request(`http://localhost/api/resume/history/${appId}`),
    { params: Promise.resolve({ appId }) }
  );
}

describe("GET /api/resume/history/[appId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await callGet("app1");
    expect(res.status).toBe(401);
  });

  it("returns 404 when application not owned by user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue(null);
    const res = await callGet("app1");
    expect(res.status).toBe(404);
  });

  it("returns generations ordered newest-first", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue({ id: "app1" });
    const gens = [
      { id: "gen2", markdownOutput: "v2", promptTokens: 200, completionTokens: 100, estimatedCost: 0.02, createdAt: "2026-03-02" },
      { id: "gen1", markdownOutput: "v1", promptTokens: 100, completionTokens: 50, estimatedCost: 0.01, createdAt: "2026-03-01" },
    ];
    mockPrisma.resumeGeneration.findMany.mockResolvedValue(gens);

    const res = await callGet("app1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].id).toBe("gen2");

    // Verify query scoping
    expect(mockPrisma.resumeGeneration.findMany).toHaveBeenCalledWith({
      where: { jobApplicationId: "app1", userId: "user1" },
      orderBy: { createdAt: "desc" },
      select: expect.objectContaining({
        id: true,
        markdownOutput: true,
      }),
    });
  });
});
