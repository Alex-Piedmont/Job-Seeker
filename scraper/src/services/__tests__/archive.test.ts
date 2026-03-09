import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    scrapedJob: {
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../config", () => ({
  config: { archiveAfterDays: 7 },
}));
vi.mock("../../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { autoArchiveStaleJobs } from "../archive";

describe("autoArchiveStaleJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("archives stale jobs and returns the count", async () => {
    mockPrisma.scrapedJob.updateMany.mockResolvedValue({ count: 3 });

    const result = await autoArchiveStaleJobs();

    expect(result).toBe(3);
    expect(mockPrisma.scrapedJob.updateMany).toHaveBeenCalledOnce();
    expect(mockPrisma.scrapedJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          archivedAt: null,
          OR: expect.arrayContaining([
            expect.objectContaining({ removedAt: expect.objectContaining({ not: null }) }),
            expect.objectContaining({ postingEndDate: expect.objectContaining({ not: null }) }),
          ]),
        }),
        data: expect.objectContaining({
          archivedAt: expect.any(Date),
        }),
      })
    );
  });

  it("returns 0 when no stale jobs exist", async () => {
    mockPrisma.scrapedJob.updateMany.mockResolvedValue({ count: 0 });

    const result = await autoArchiveStaleJobs();

    expect(result).toBe(0);
  });
});
