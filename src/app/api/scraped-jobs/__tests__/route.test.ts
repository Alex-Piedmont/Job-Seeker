import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockPrisma } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockPrisma = {
    scrapedJob: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  };
  return { mockAuth, mockPrisma };
});

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "../route";

function callGet(query = "") {
  return GET(new Request(`http://localhost/api/scraped-jobs${query}`));
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
      limit: 20,
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

  it("excludes removed jobs by default", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.scrapedJob.findMany.mockResolvedValue([]);
    mockPrisma.scrapedJob.count.mockResolvedValue(0);

    await callGet();

    const findManyCall = mockPrisma.scrapedJob.findMany.mock.calls[0][0];
    expect(findManyCall.where.removedAt).toBeNull();
  });

  it("includes removed jobs when includeRemoved=true", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.scrapedJob.findMany.mockResolvedValue([]);
    mockPrisma.scrapedJob.count.mockResolvedValue(0);

    await callGet("?includeRemoved=true");

    const findManyCall = mockPrisma.scrapedJob.findMany.mock.calls[0][0];
    expect(findManyCall.where.removedAt).toBeUndefined();
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
