import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    scrapedJob: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../utils/html-to-md", () => ({
  htmlToMarkdown: vi.fn((html: string) => `md:${html}`),
}));
vi.mock("../../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { upsertJobs } from "../job-store";

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
  ...overrides,
});

describe("upsertJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates new jobs when none exist", async () => {
    mockPrisma.scrapedJob.findUnique.mockResolvedValue(null);
    mockPrisma.scrapedJob.create.mockResolvedValue({});
    mockPrisma.scrapedJob.findMany.mockResolvedValue([]);

    const result = await upsertJobs("company1", [makeJob()]);

    expect(result.added).toBe(1);
    expect(result.updated).toBe(0);
    expect(mockPrisma.scrapedJob.create).toHaveBeenCalledOnce();
    expect(mockPrisma.scrapedJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: "company1",
          externalJobId: "ext1",
          title: "Engineer",
          jobDescriptionMd: "md:<p>Description</p>",
        }),
      })
    );
  });

  it("updates existing jobs", async () => {
    const existingJob = { id: "db-id-1", removedAt: null };
    mockPrisma.scrapedJob.findUnique.mockResolvedValue(existingJob);
    mockPrisma.scrapedJob.update.mockResolvedValue({});
    mockPrisma.scrapedJob.findMany.mockResolvedValue([
      { id: "db-id-1", externalJobId: "ext1" },
    ]);

    const result = await upsertJobs("company1", [makeJob()]);

    expect(result.updated).toBe(1);
    expect(result.added).toBe(0);
    expect(mockPrisma.scrapedJob.update).toHaveBeenCalledOnce();
    expect(mockPrisma.scrapedJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "db-id-1" },
        data: expect.objectContaining({
          title: "Engineer",
          removedAt: null,
        }),
      })
    );
  });

  it("detects removals for jobs not in scraped list", async () => {
    mockPrisma.scrapedJob.findUnique.mockResolvedValue(null);
    mockPrisma.scrapedJob.create.mockResolvedValue({});
    mockPrisma.scrapedJob.findMany.mockResolvedValue([
      { id: "db-id-old", externalJobId: "ext-old" },
    ]);
    mockPrisma.scrapedJob.updateMany.mockResolvedValue({ count: 1 });

    const result = await upsertJobs("company1", [makeJob({ externalJobId: "ext-new" })]);

    expect(result.removed).toBe(1);
    expect(mockPrisma.scrapedJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["db-id-old"] } },
        data: expect.objectContaining({ removedAt: expect.any(Date) }),
      })
    );
  });

  it("clears removedAt on re-opened job", async () => {
    const existingJob = { id: "db-id-1", removedAt: new Date("2025-01-01") };
    mockPrisma.scrapedJob.findUnique.mockResolvedValue(existingJob);
    mockPrisma.scrapedJob.update.mockResolvedValue({});
    mockPrisma.scrapedJob.findMany.mockResolvedValue([
      { id: "db-id-1", externalJobId: "ext1" },
    ]);

    await upsertJobs("company1", [makeJob()]);

    expect(mockPrisma.scrapedJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          removedAt: null,
        }),
      })
    );
  });

  it("returns zero removed when all jobs are still present", async () => {
    mockPrisma.scrapedJob.findUnique.mockResolvedValue(null);
    mockPrisma.scrapedJob.create.mockResolvedValue({});
    mockPrisma.scrapedJob.findMany.mockResolvedValue([]);

    const result = await upsertJobs("company1", [makeJob()]);

    expect(result.removed).toBe(0);
    expect(mockPrisma.scrapedJob.updateMany).not.toHaveBeenCalled();
  });
});
