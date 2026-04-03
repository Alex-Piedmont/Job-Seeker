import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    $queryRawUnsafe: vi.fn(),
  },
}));

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../utils/html-to-md", () => ({
  htmlToMarkdown: vi.fn((html: string) => `md:${html}`),
}));
vi.mock("../../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { upsertJobs, computeContentHash } from "../job-store";

const makeJob = (overrides: Partial<{
  externalJobId: string;
  title: string;
  url: string;
  department: string | null;
  locations: string[];
  locationType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  jobDescriptionHtml: string;
  postedAt: string | null;
  postingEndDate: string | null;
}> = {}) => ({
  externalJobId: "ext1",
  title: "Engineer",
  url: "https://example.com/1",
  department: "Eng",
  locations: ["Remote"],
  locationType: "Remote",
  salaryMin: 100000,
  salaryMax: 150000,
  salaryCurrency: "USD",
  jobDescriptionHtml: "<p>Description</p>",
  postedAt: null,
  postingEndDate: null,
  ...overrides,
});

describe("upsertJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates new jobs via batch upsert", async () => {
    // First call: executeBatchUpsert (INSERT ... ON CONFLICT)
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ added: 1n, updated: 0n, reopened: 0n }])
      // Second call: detectRemovals
      .mockResolvedValueOnce([{ count: 0n }]);

    const result = await upsertJobs("company1", [makeJob()]);

    expect(result.added).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.removed).toBe(0);
    // First call should be the batch upsert INSERT
    expect(mockPrisma.$queryRawUnsafe.mock.calls[0][0]).toContain("INSERT INTO scraped_jobs");
  });

  it("reports updated jobs from upsert", async () => {
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ added: 0n, updated: 1n, reopened: 0n }])
      .mockResolvedValueOnce([{ count: 0n }]);

    const result = await upsertJobs("company1", [makeJob()]);

    expect(result.updated).toBe(1);
    expect(result.added).toBe(0);
  });

  it("detects removals via raw SQL", async () => {
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ added: 1n, updated: 0n, reopened: 0n }])
      .mockResolvedValueOnce([{ count: 1n }]);

    const result = await upsertJobs("company1", [makeJob({ externalJobId: "ext-new" })]);

    expect(result.removed).toBe(1);
    // Second call should be the detectRemovals query
    const removalCall = mockPrisma.$queryRawUnsafe.mock.calls[1];
    expect(removalCall[0]).toContain("removedAt");
    expect(removalCall[1]).toBe("company1");
    expect(removalCall[2]).toEqual(["ext-new"]);
  });

  it("reports reopened jobs", async () => {
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ added: 0n, updated: 1n, reopened: 1n }])
      .mockResolvedValueOnce([{ count: 0n }]);

    const result = await upsertJobs("company1", [makeJob()]);

    expect(result.reopened).toBe(1);
    expect(result.updated).toBe(1);
  });

  it("returns zero removed when all jobs are still present", async () => {
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ added: 1n, updated: 0n, reopened: 0n }])
      .mockResolvedValueOnce([{ count: 0n }]);

    const result = await upsertJobs("company1", [makeJob()]);

    expect(result.removed).toBe(0);
  });

  it("skips markdown conversion when content hash matches", async () => {
    const html = "<p>Description</p>";
    const hash = computeContentHash(html);
    const existing = new Map([["ext1", { externalJobId: "ext1", title: "Engineer", contentHash: hash }]]);

    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ added: 0n, updated: 1n, reopened: 0n }])
      .mockResolvedValueOnce([{ count: 0n }]);

    const result = await upsertJobs("company1", [makeJob()], existing);

    expect(result.skipped).toBe(1);
  });

  it("retries row-by-row when batch upsert fails", async () => {
    mockPrisma.$queryRawUnsafe
      // First call: batch fails
      .mockRejectedValueOnce(new Error("batch error"))
      // Second call: row-by-row retry succeeds
      .mockResolvedValueOnce([{ added: 1n, updated: 0n, reopened: 0n }])
      // Third call: detectRemovals
      .mockResolvedValueOnce([{ count: 0n }]);

    const result = await upsertJobs("company1", [makeJob()]);

    expect(result.added).toBe(1);
    // 3 calls: failed batch + successful row retry + detectRemovals
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(3);
  });

  it("skips removals when seen count is less than 50% of previous active", async () => {
    // Simulate 200 existing active jobs but adapter only returned 80
    const existing = new Map(
      Array.from({ length: 200 }, (_, i) => [
        `ext-${i}`,
        { externalJobId: `ext-${i}`, title: `Job ${i}`, contentHash: null },
      ]),
    );

    // Only 1 job returned by adapter (well below 50% of 200)
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ added: 0n, updated: 1n, reopened: 0n }]);
    // detectRemovals should NOT be called (guard triggers)

    const result = await upsertJobs("company1", [makeJob({ externalJobId: "ext-0" })], existing);

    expect(result.removed).toBe(0);
    // Only 1 call: the batch upsert. No detectRemovals query.
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
  });

  it("proceeds with removals when seen count is above 50% of previous active", async () => {
    // Simulate 10 existing active jobs, adapter returned 8 (80% — above threshold)
    const existing = new Map(
      Array.from({ length: 10 }, (_, i) => [
        `ext-${i}`,
        { externalJobId: `ext-${i}`, title: `Job ${i}`, contentHash: null },
      ]),
    );

    const jobs = Array.from({ length: 8 }, (_, i) => makeJob({ externalJobId: `ext-${i}` }));

    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ added: 0n, updated: 8n, reopened: 0n }])
      .mockResolvedValueOnce([{ count: 2n }]);

    const result = await upsertJobs("company1", jobs, existing);

    expect(result.removed).toBe(2);
    // 2 calls: batch upsert + detectRemovals
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(2);
  });
});
