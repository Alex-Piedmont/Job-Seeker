import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { mockAuth, mockAdmin } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockAdmin = {
    getPlatformStats: vi.fn(),
    getDauOverTime: vi.fn(),
    getGenerationStats: vi.fn(),
  };
  return { mockAuth, mockAdmin };
});

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/admin", () => ({
  adminHandler: (handler: Function) => {
    return async (
      request: Request,
      { params }: { params: Promise<Record<string, string>> }
    ) => {
      const session = mockAuth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const resolvedParams = await params;
      return handler(request, {
        userId: session.user.id,
        params: resolvedParams,
      });
    };
  },
  getPlatformStats: (...args: unknown[]) =>
    mockAdmin.getPlatformStats(...args),
  getDauOverTime: (...args: unknown[]) => mockAdmin.getDauOverTime(...args),
  getGenerationStats: (...args: unknown[]) =>
    mockAdmin.getGenerationStats(...args),
}));

import { GET } from "../route";
import { GET as GET_GENERATIONS } from "../../stats/generations/route";

function callStats() {
  return GET(
    new Request("http://localhost/api/admin/stats"),
    { params: Promise.resolve({}) }
  );
}

function callGenerations() {
  return GET_GENERATIONS(
    new Request("http://localhost/api/admin/stats/generations"),
    { params: Promise.resolve({}) }
  );
}

describe("GET /api/admin/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockReturnValue(null);
    const res = await callStats();
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin user", async () => {
    mockAuth.mockReturnValue({ user: { id: "u1", role: "USER" } });
    const res = await callStats();
    expect(res.status).toBe(403);
  });

  it("returns stats for admin", async () => {
    mockAuth.mockReturnValue({ user: { id: "admin1", role: "ADMIN" } });
    mockAdmin.getPlatformStats.mockResolvedValue({
      totalUsers: 42,
      totalApplications: 100,
      totalGenerations: 50,
      estimatedTotalSpend: 12.34,
      dauToday: 5,
      mauThisMonth: 20,
    });
    mockAdmin.getDauOverTime.mockResolvedValue([
      { date: "2026-03-01", count: 5 },
    ]);

    const res = await callStats();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalUsers).toBe(42);
    expect(body.totalApplications).toBe(100);
    expect(body.totalGenerations).toBe(50);
    expect(body.estimatedTotalSpend).toBe(12.34);
    expect(body.dauOverTime).toHaveLength(1);
  });
});

describe("GET /api/admin/stats/generations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockReturnValue(null);
    const res = await callGenerations();
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockAuth.mockReturnValue({ user: { id: "u1", role: "USER" } });
    const res = await callGenerations();
    expect(res.status).toBe(403);
  });

  it("returns generation stats for admin", async () => {
    mockAuth.mockReturnValue({ user: { id: "admin1", role: "ADMIN" } });
    mockAdmin.getGenerationStats.mockResolvedValue({
      totalGenerations: 200,
      totalTokens: 500000,
      estimatedTotalCost: 5.67,
      generationsByDay: [{ date: "2026-03-01", count: 10, cost: 0.56 }],
      topUsersByCost: [],
    });

    const res = await callGenerations();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalGenerations).toBe(200);
    expect(body.totalTokens).toBe(500000);
    expect(body.generationsByDay).toHaveLength(1);
  });
});
