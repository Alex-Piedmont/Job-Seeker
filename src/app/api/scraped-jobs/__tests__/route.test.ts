import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockPrisma } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockPrisma = {
    scrapedJob: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $queryRaw: vi.fn(),
  };
  return { mockAuth, mockPrisma };
});

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/generated/prisma/client", () => ({
  Prisma: { sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }) },
}));

import { GET } from "../route";

const defaultParams = { params: Promise.resolve({}) };

function callGet(query = "") {
  return GET(new Request(`http://localhost/api/scraped-jobs${query}`), defaultParams);
}

const sampleJob = {
  id: "job1",
  title: "Engineer",
  url: "https://example.com/job/1",
  department: "Engineering",
  locations: ["Remote"],
  locationType: "Remote",
  salaryMin: 100000,
  salaryMax: 150000,
  salaryCurrency: "USD",
  firstSeenAt: new Date(),
  removedAt: null,
  archivedAt: null,
  company: { id: "c1", name: "TestCo" },
  userArchives: [],
};

describe("GET /api/scraped-jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("returns paginated results for authenticated user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.scrapedJob.findMany.mockResolvedValue([sampleJob]);
    mockPrisma.scrapedJob.count.mockResolvedValue(1);

    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobs).toHaveLength(1);
    expect(body.jobs[0].id).toBe("job1");
    expect(body.pagination).toEqual({
      page: 1,
      limit: 24,
      total: 1,
      totalPages: 1,
    });
  });

  it("applies title filter via q param", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.scrapedJob.findMany.mockResolvedValue([]);
    mockPrisma.scrapedJob.count.mockResolvedValue(0);

    await callGet("?q=Senior");

    const findManyCall = mockPrisma.scrapedJob.findMany.mock.calls[0][0];
    expect(findManyCall.where.title).toEqual({
      contains: "Senior",
      mode: "insensitive",
    });
  });

  it("applies company filter via companyId param", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.scrapedJob.findMany.mockResolvedValue([]);
    mockPrisma.scrapedJob.count.mockResolvedValue(0);

    await callGet("?companyId=c1");

    const findManyCall = mockPrisma.scrapedJob.findMany.mock.calls[0][0];
    expect(findManyCall.where.companyId).toBe("c1");
  });

  it("includes removed jobs by default", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.scrapedJob.findMany.mockResolvedValue([]);
    mockPrisma.scrapedJob.count.mockResolvedValue(0);

    await callGet();

    const findManyCall = mockPrisma.scrapedJob.findMany.mock.calls[0][0];
    expect(findManyCall.where.removedAt).toBeUndefined();
  });

  it("excludes removed jobs when includeRemoved=false", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.scrapedJob.findMany.mockResolvedValue([]);
    mockPrisma.scrapedJob.count.mockResolvedValue(0);

    await callGet("?includeRemoved=false");

    const findManyCall = mockPrisma.scrapedJob.findMany.mock.calls[0][0];
    expect(findManyCall.where.removedAt).toBeNull();
  });

  it("applies companyIds filter", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.scrapedJob.findMany.mockResolvedValue([]);
    mockPrisma.scrapedJob.count.mockResolvedValue(0);

    await callGet("?companyIds=c1,c2");

    const findManyCall = mockPrisma.scrapedJob.findMany.mock.calls[0][0];
    expect(findManyCall.where.companyId).toEqual({ in: ["c1", "c2"] });
  });

  it("applies location filter via raw query and passes matching IDs", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.$queryRaw.mockResolvedValue([{ id: "job1" }, { id: "job2" }]);
    mockPrisma.scrapedJob.findMany.mockResolvedValue([sampleJob]);
    mockPrisma.scrapedJob.count.mockResolvedValue(1);

    await callGet("?location=Atlanta");

    expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    const findManyCall = mockPrisma.scrapedJob.findMany.mock.calls[0][0];
    expect(findManyCall.where.id).toEqual({ in: ["job1", "job2"] });
  });

  it("applies salary filters", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.scrapedJob.findMany.mockResolvedValue([]);
    mockPrisma.scrapedJob.count.mockResolvedValue(0);

    await callGet("?salaryMin=100000&salaryMax=200000");

    const findManyCall = mockPrisma.scrapedJob.findMany.mock.calls[0][0];
    expect(findManyCall.where.salaryMax).toEqual({ gte: 100000 });
    expect(findManyCall.where.salaryMin).toEqual({ lte: 200000 });
  });

  it("applies date range filters", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.scrapedJob.findMany.mockResolvedValue([]);
    mockPrisma.scrapedJob.count.mockResolvedValue(0);

    await callGet("?postedFrom=2025-01-01&postedTo=2025-06-30");

    const findManyCall = mockPrisma.scrapedJob.findMany.mock.calls[0][0];
    expect(findManyCall.where.firstSeenAt).toEqual({
      gte: new Date("2025-01-01"),
      lte: new Date("2025-06-30"),
    });
  });

  it("excludes user-archived jobs when includeArchived=false", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.scrapedJob.findMany.mockResolvedValue([]);
    mockPrisma.scrapedJob.count.mockResolvedValue(0);

    await callGet();

    const findManyCall = mockPrisma.scrapedJob.findMany.mock.calls[0][0];
    expect(findManyCall.where.NOT).toEqual({
      userArchives: { some: { userId: "user1" } },
    });
  });

  it("returns isArchived=true when user has archive record", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    const jobWithArchive = {
      ...sampleJob,
      userArchives: [{ id: "archive1" }],
    };
    mockPrisma.scrapedJob.findMany.mockResolvedValue([jobWithArchive]);
    mockPrisma.scrapedJob.count.mockResolvedValue(1);

    const res = await callGet();
    const body = await res.json();
    expect(body.jobs[0].isArchived).toBe(true);
  });

  it("returns isArchived=false when user has no archive record", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.scrapedJob.findMany.mockResolvedValue([sampleJob]);
    mockPrisma.scrapedJob.count.mockResolvedValue(1);

    const res = await callGet();
    const body = await res.json();
    expect(body.jobs[0].isArchived).toBe(false);
  });
});
