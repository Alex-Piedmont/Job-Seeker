import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockAnalytics } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockAnalytics = {
    getSummaryMetrics: vi.fn(),
    getPipelineFunnel: vi.fn(),
    getWeeklyApplications: vi.fn(),
    getTimeStats: vi.fn(),
    getConversionRates: vi.fn(),
    getClosureBreakdown: vi.fn(),
    getResumeUsage: vi.fn(),
  };
  return { mockAuth, mockAnalytics };
});

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/analytics", () => ({
  getSummaryMetrics: (...args: unknown[]) => mockAnalytics.getSummaryMetrics(...args),
  getPipelineFunnel: (...args: unknown[]) => mockAnalytics.getPipelineFunnel(...args),
  getWeeklyApplications: (...args: unknown[]) => mockAnalytics.getWeeklyApplications(...args),
  getTimeStats: (...args: unknown[]) => mockAnalytics.getTimeStats(...args),
  getConversionRates: (...args: unknown[]) => mockAnalytics.getConversionRates(...args),
  getClosureBreakdown: (...args: unknown[]) => mockAnalytics.getClosureBreakdown(...args),
  getResumeUsage: (...args: unknown[]) => mockAnalytics.getResumeUsage(...args),
}));

import { GET } from "../route";

function callGet() {
  return GET(
    new Request("http://localhost/api/analytics"),
    { params: Promise.resolve({}) }
  );
}

describe("GET /api/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("returns full analytics response", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockAnalytics.getSummaryMetrics.mockResolvedValue({
      totalApplications: 10,
      activeApplications: 7,
      interviewsScheduled: 3,
      offers: 1,
    });
    mockAnalytics.getPipelineFunnel.mockResolvedValue([
      { columnId: "c1", columnName: "Saved", columnColor: "#ccc", count: 5, percentage: 50 },
    ]);
    mockAnalytics.getWeeklyApplications.mockResolvedValue([
      { weekStart: "2026-02-23", count: 3 },
    ]);
    mockAnalytics.getTimeStats.mockResolvedValue({
      medianDaysToFirstResponse: 8,
      avgDaysToFirstResponse: 11,
    });
    mockAnalytics.getConversionRates.mockResolvedValue({
      appToInterviewRate: 0.3,
      interviewToOfferRate: 0.15,
    });
    mockAnalytics.getClosureBreakdown.mockResolvedValue({
      closureRate: 0.1,
      ghostedRate: 0.4,
      closuresByStage: [],
    });
    mockAnalytics.getResumeUsage.mockResolvedValue({
      used: 3,
      cap: 5,
      resetsAt: "2026-04-01T00:00:00.000Z",
      isAdmin: false,
      totalAllTime: 10,
    });

    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalApplications).toBe(10);
    expect(body.funnel).toHaveLength(1);
    expect(body.medianDaysToFirstResponse).toBe(8);
    expect(body.resumeUsage.used).toBe(3);
  });

  it("handles partial query failure gracefully", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockAnalytics.getSummaryMetrics.mockRejectedValue(new Error("DB error"));
    mockAnalytics.getPipelineFunnel.mockResolvedValue([]);
    mockAnalytics.getWeeklyApplications.mockResolvedValue([]);
    mockAnalytics.getTimeStats.mockResolvedValue({
      medianDaysToFirstResponse: null,
      avgDaysToFirstResponse: null,
    });
    mockAnalytics.getConversionRates.mockResolvedValue({
      appToInterviewRate: null,
      interviewToOfferRate: null,
    });
    mockAnalytics.getClosureBreakdown.mockResolvedValue({
      closureRate: null,
      ghostedRate: null,
      closuresByStage: [],
    });
    mockAnalytics.getResumeUsage.mockResolvedValue({
      used: 0,
      cap: 5,
      resetsAt: "2026-04-01",
      isAdmin: false,
      totalAllTime: 0,
    });

    const res = await callGet();
    // Should still be 200, not 500
    expect(res.status).toBe(200);
    const body = await res.json();
    // Failed summary should default to 0
    expect(body.totalApplications).toBe(0);
    // Other sections should still have data
    expect(body.funnel).toEqual([]);
  });
});
