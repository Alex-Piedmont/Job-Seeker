import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    jobApplication: {
      count: vi.fn(),
    },
    resumeGeneration: {
      aggregate: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import {
  isAdminEmail,
  getPlatformStats,
  getDauOverTime,
  getGenerationStats,
  getUserList,
} from "../admin";

describe("isAdminEmail", () => {
  it("returns false for null/undefined", () => {
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });

  it("returns false for non-admin email", () => {
    expect(isAdminEmail("nobody@example.com")).toBe(false);
  });

  // Note: actual admin email detection depends on ADMIN_EMAILS env var at module load time
});

describe("getPlatformStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns aggregated platform statistics", async () => {
    mockPrisma.user.count
      .mockResolvedValueOnce(42) // totalUsers
      .mockResolvedValueOnce(5) // dauToday
      .mockResolvedValueOnce(20); // mauThisMonth
    mockPrisma.jobApplication.count.mockResolvedValue(100);
    mockPrisma.resumeGeneration.aggregate.mockResolvedValue({
      _count: 50,
      _sum: { estimatedCost: 12.34 },
    });

    const stats = await getPlatformStats();
    expect(stats.totalUsers).toBe(42);
    expect(stats.totalApplications).toBe(100);
    expect(stats.totalGenerations).toBe(50);
    expect(stats.estimatedTotalSpend).toBe(12.34);
    expect(stats.dauToday).toBe(5);
    expect(stats.mauThisMonth).toBe(20);
  });

  it("defaults estimatedTotalSpend to 0 when null", async () => {
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.jobApplication.count.mockResolvedValue(0);
    mockPrisma.resumeGeneration.aggregate.mockResolvedValue({
      _count: 0,
      _sum: { estimatedCost: null },
    });

    const stats = await getPlatformStats();
    expect(stats.estimatedTotalSpend).toBe(0);
  });
});

describe("getDauOverTime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 30-day array with zero-filled days", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);

    const result = await getDauOverTime();
    expect(result).toHaveLength(30);
    expect(result.every((d) => d.count === 0)).toBe(true);
    // Each entry should have date and count
    expect(result[0]).toHaveProperty("date");
    expect(result[0]).toHaveProperty("count");
  });

  it("counts users active on a given day", async () => {
    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);

    mockPrisma.user.findMany.mockResolvedValue([
      { lastActiveAt: today },
      { lastActiveAt: today },
    ]);

    const result = await getDauOverTime();
    // The last entry (today) should have count 2
    const todayEntry = result[result.length - 1];
    expect(todayEntry.count).toBe(2);
  });
});

describe("getGenerationStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns generation stats with zero-filled days", async () => {
    mockPrisma.resumeGeneration.aggregate.mockResolvedValue({
      _count: 10,
      _sum: { totalTokens: 50000, estimatedCost: 1.5 },
    });
    mockPrisma.resumeGeneration.findMany.mockResolvedValue([]);
    mockPrisma.resumeGeneration.groupBy.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);

    const stats = await getGenerationStats();
    expect(stats.totalGenerations).toBe(10);
    expect(stats.totalTokens).toBe(50000);
    expect(stats.estimatedTotalCost).toBe(1.5);
    expect(stats.generationsByDay).toHaveLength(30);
    expect(stats.topUsersByCost).toHaveLength(0);
  });

  it("resolves top users with names", async () => {
    mockPrisma.resumeGeneration.aggregate.mockResolvedValue({
      _count: 5,
      _sum: { totalTokens: 10000, estimatedCost: 0.8 },
    });
    mockPrisma.resumeGeneration.findMany.mockResolvedValue([]);
    mockPrisma.resumeGeneration.groupBy.mockResolvedValue([
      {
        userId: "u1",
        _count: 3,
        _sum: { totalTokens: 7000, estimatedCost: 0.5 },
      },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "u1", name: "Alice", email: "alice@test.com" },
    ]);

    const stats = await getGenerationStats();
    expect(stats.topUsersByCost).toHaveLength(1);
    expect(stats.topUsersByCost[0].name).toBe("Alice");
    expect(stats.topUsersByCost[0].generationCount).toBe(3);
    expect(stats.topUsersByCost[0].estimatedCost).toBe(0.5);
  });

  it("handles null sums gracefully", async () => {
    mockPrisma.resumeGeneration.aggregate.mockResolvedValue({
      _count: 0,
      _sum: { totalTokens: null, estimatedCost: null },
    });
    mockPrisma.resumeGeneration.findMany.mockResolvedValue([]);
    mockPrisma.resumeGeneration.groupBy.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);

    const stats = await getGenerationStats();
    expect(stats.totalTokens).toBe(0);
    expect(stats.estimatedTotalCost).toBe(0);
  });
});

describe("getUserList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseParams = {
    page: 1,
    limit: 20,
    search: "",
    sort: "createdAt",
    order: "desc" as const,
  };

  it("returns paginated user list", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "u1",
        name: "Alice",
        email: "alice@test.com",
        image: null,
        role: "USER",
        applicationCap: 25,
        resumeGenerationCap: 5,
        resumeGenerationsUsedThisMonth: 2,
        lastActiveAt: new Date("2026-03-01"),
        createdAt: new Date("2026-01-01"),
        _count: { jobApplications: 10, resumeGenerations: 3 },
      },
    ]);
    mockPrisma.user.count.mockResolvedValue(1);
    mockPrisma.resumeGeneration.groupBy.mockResolvedValue([
      { userId: "u1", _sum: { estimatedCost: 0.45 } },
    ]);

    const result = await getUserList(baseParams);
    expect(result.users).toHaveLength(1);
    expect(result.users[0].name).toBe("Alice");
    expect(result.users[0].applicationCount).toBe(10);
    expect(result.users[0].estimatedTotalCost).toBe(0.45);
    expect(result.pagination.total).toBe(1);
    expect(result.pagination.totalPages).toBe(1);
  });

  it("applies search filter", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.resumeGeneration.groupBy.mockResolvedValue([]);

    await getUserList({ ...baseParams, search: "alice" });

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: "alice", mode: "insensitive" } },
            { email: { contains: "alice", mode: "insensitive" } },
          ],
        },
      })
    );
  });

  it("handles empty results", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.resumeGeneration.groupBy.mockResolvedValue([]);

    const result = await getUserList(baseParams);
    expect(result.users).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
    expect(result.pagination.totalPages).toBe(0);
  });

  it("defaults null name/email to fallbacks", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "u2",
        name: null,
        email: null,
        image: null,
        role: "USER",
        applicationCap: 25,
        resumeGenerationCap: 5,
        resumeGenerationsUsedThisMonth: 0,
        lastActiveAt: null,
        createdAt: new Date("2026-01-01"),
        _count: { jobApplications: 0, resumeGenerations: 0 },
      },
    ]);
    mockPrisma.user.count.mockResolvedValue(1);
    mockPrisma.resumeGeneration.groupBy.mockResolvedValue([]);

    const result = await getUserList(baseParams);
    expect(result.users[0].name).toBe("No name");
    expect(result.users[0].email).toBe("");
    expect(result.users[0].lastActiveAt).toBeNull();
  });
});
