import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    kanbanColumn: {
      findMany: vi.fn(),
    },
    jobApplication: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    interviewRecord: {
      count: vi.fn(),
    },
    applicationStatusLog: {
      findMany: vi.fn(),
    },
    resumeGeneration: {
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import {
  getSummaryMetrics,
  getPipelineFunnel,
  getWeeklyApplications,
  getTimeStats,
  getConversionRates,
  getClosureBreakdown,
  getResumeUsage,
} from "../analytics";

describe("getPipelineFunnel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns columns with counts and percentages", async () => {
    mockPrisma.kanbanColumn.findMany.mockResolvedValue([
      { id: "c1", name: "Saved", color: "#6B7280", _count: { applications: 10 } },
      { id: "c2", name: "Applied", color: "#3B82F6", _count: { applications: 5 } },
      { id: "c3", name: "Closed", color: "#EF4444", _count: { applications: 5 } },
    ]);

    const result = await getPipelineFunnel("user1");
    expect(result).toHaveLength(3);
    expect(result[0].percentage).toBe(50);
    expect(result[1].percentage).toBe(25);
    expect(result[2].percentage).toBe(25);
  });

  it("handles empty columns (zero count, zero percentage)", async () => {
    mockPrisma.kanbanColumn.findMany.mockResolvedValue([
      { id: "c1", name: "Saved", color: "#6B7280", _count: { applications: 0 } },
      { id: "c2", name: "Applied", color: "#3B82F6", _count: { applications: 0 } },
    ]);

    const result = await getPipelineFunnel("user1");
    expect(result[0].count).toBe(0);
    expect(result[0].percentage).toBe(0);
  });
});

describe("getWeeklyApplications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 12 weeks zero-filled", async () => {
    mockPrisma.jobApplication.findMany.mockResolvedValue([]);
    const result = await getWeeklyApplications("user1");
    expect(result).toHaveLength(12);
    expect(result.every((w) => w.count === 0)).toBe(true);
  });

  it("excludes applications without dateApplied (filter handled by query)", async () => {
    mockPrisma.jobApplication.findMany.mockResolvedValue([]);
    const result = await getWeeklyApplications("user1");
    expect(result).toHaveLength(12);
  });
});

describe("getTimeStats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when fewer than 3 data points", async () => {
    mockPrisma.jobApplication.findMany.mockResolvedValue([
      {
        id: "a1",
        dateApplied: new Date("2026-01-01"),
        statusLogs: [{ movedAt: new Date("2026-01-05") }],
      },
    ]);
    const result = await getTimeStats("user1");
    expect(result.medianDaysToFirstResponse).toBeNull();
    expect(result.avgDaysToFirstResponse).toBeNull();
  });

  it("calculates median and average correctly", async () => {
    mockPrisma.jobApplication.findMany.mockResolvedValue([
      {
        id: "a1",
        dateApplied: new Date("2026-01-01"),
        statusLogs: [{ movedAt: new Date("2026-01-04") }], // 3 days
      },
      {
        id: "a2",
        dateApplied: new Date("2026-01-01"),
        statusLogs: [{ movedAt: new Date("2026-01-08") }], // 7 days
      },
      {
        id: "a3",
        dateApplied: new Date("2026-01-01"),
        statusLogs: [{ movedAt: new Date("2026-01-11") }], // 10 days
      },
    ]);
    const result = await getTimeStats("user1");
    expect(result.medianDaysToFirstResponse).toBe(7);
    expect(result.avgDaysToFirstResponse).toBeCloseTo(6.7, 1);
  });
});

describe("getConversionRates", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when no applied applications", async () => {
    mockPrisma.kanbanColumn.findMany.mockResolvedValue([]);
    mockPrisma.jobApplication.findMany.mockResolvedValue([]);
    const result = await getConversionRates("user1");
    expect(result.appToInterviewRate).toBeNull();
    expect(result.interviewToOfferRate).toBeNull();
  });

  it("calculates rates correctly", async () => {
    mockPrisma.kanbanColumn.findMany.mockResolvedValue([
      { id: "c1", columnType: null },
      { id: "c2", columnType: "OFFER" },
    ]);
    mockPrisma.jobApplication.findMany.mockResolvedValue([
      { id: "a1", columnId: "c1", _count: { interviews: 2 } },
      { id: "a2", columnId: "c1", _count: { interviews: 0 } },
      { id: "a3", columnId: "c2", _count: { interviews: 1 } },
      { id: "a4", columnId: "c1", _count: { interviews: 1 } },
    ]);
    const result = await getConversionRates("user1");
    // 3 of 4 have interviews = 0.75
    expect(result.appToInterviewRate).toBe(0.75);
    // 1 of 3 with interviews is in offer = 0.333
    expect(result.interviewToOfferRate).toBeCloseTo(0.333, 2);
  });
});

describe("getClosureBreakdown", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty when no closures", async () => {
    mockPrisma.kanbanColumn.findMany.mockResolvedValue([
      { id: "c1", name: "Saved", columnType: null },
      { id: "c2", name: "Closed", columnType: "CLOSED" },
    ]);
    mockPrisma.jobApplication.count
      .mockResolvedValueOnce(5)   // totalApplications
      .mockResolvedValueOnce(0);  // totalGhostedAll (isGhosted: true)
    mockPrisma.jobApplication.findMany.mockResolvedValue([]);
    const result = await getClosureBreakdown("user1");
    expect(result.closuresByStage).toHaveLength(0);
    expect(result.closureRate).toBe(0);
  });

  it("splits ghosted vs rejected per stage", async () => {
    mockPrisma.kanbanColumn.findMany.mockResolvedValue([
      { id: "c1", name: "Applied", columnType: null },
      { id: "c2", name: "Screening", columnType: null },
      { id: "c3", name: "Closed", columnType: "CLOSED" },
    ]);
    mockPrisma.jobApplication.count
      .mockResolvedValueOnce(10)  // totalApplications
      .mockResolvedValueOnce(2);  // totalGhostedAll (isGhosted: true)
    mockPrisma.jobApplication.findMany.mockResolvedValue([
      { id: "a1", closedReason: "rejected" },
      { id: "a2", closedReason: "ghosted" },
      { id: "a3", closedReason: "ghosted" },
    ]);
    mockPrisma.applicationStatusLog.findMany.mockResolvedValue([
      { jobApplicationId: "a1", fromColumnId: "c1" },
      { jobApplicationId: "a2", fromColumnId: "c1" },
      { jobApplicationId: "a3", fromColumnId: "c2" },
    ]);

    const result = await getClosureBreakdown("user1");
    expect(result.closureRate).toBe(0.3);
    // ghostedRate is now % of ALL apps (2 ghosted / 10 total = 0.2)
    expect(result.ghostedRate).toBe(0.2);
    expect(result.closuresByStage).toHaveLength(2);
    // Applied stage: 1 rejected, 1 ghosted
    const applied = result.closuresByStage.find((s) => s.columnName === "Applied");
    expect(applied?.rejectedCount).toBe(1);
    expect(applied?.ghostedCount).toBe(1);
  });

  it("handles deleted columns in breakdown", async () => {
    mockPrisma.kanbanColumn.findMany.mockResolvedValue([
      { id: "c1", name: "Closed", columnType: "CLOSED" },
    ]);
    mockPrisma.jobApplication.count
      .mockResolvedValueOnce(1)   // totalApplications
      .mockResolvedValueOnce(0);  // totalGhostedAll
    mockPrisma.jobApplication.findMany.mockResolvedValue([
      { id: "a1", closedReason: null },
    ]);
    mockPrisma.applicationStatusLog.findMany.mockResolvedValue([
      { jobApplicationId: "a1", fromColumnId: "deleted-col" },
    ]);

    const result = await getClosureBreakdown("user1");
    expect(result.closuresByStage[0].columnName).toBe("Deleted Column");
  });
});

describe("getSummaryMetrics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns correct counts", async () => {
    mockPrisma.kanbanColumn.findMany.mockResolvedValue([
      { id: "c1", columnType: null },
      { id: "c2", columnType: "OFFER" },
      { id: "c3", columnType: "CLOSED" },
    ]);
    mockPrisma.jobApplication.count
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(3) // closed
      .mockResolvedValueOnce(2); // offers
    mockPrisma.interviewRecord.count.mockResolvedValue(4);

    const result = await getSummaryMetrics("user1");
    expect(result.totalApplications).toBe(10);
    expect(result.activeApplications).toBe(7); // 10 - 3
    expect(result.interviewsScheduled).toBe(4);
    expect(result.offers).toBe(2);
  });
});

describe("getResumeUsage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns admin flag and all-time total", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      role: "ADMIN",
      resumeGenerationCap: 5,
      resumeGenerationsUsedThisMonth: 10,
      capResetAt: new Date("2026-04-01"),
    });
    mockPrisma.resumeGeneration.count.mockResolvedValue(42);

    const result = await getResumeUsage("admin1");
    expect(result.isAdmin).toBe(true);
    expect(result.totalAllTime).toBe(42);
  });
});
