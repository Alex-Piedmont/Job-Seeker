import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { reserveGeneration, rollbackGeneration, getUserUsage } from "../resume-cap";

describe("reserveGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false if user not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    expect(await reserveGeneration("user1")).toBe(false);
  });

  it("bypasses cap for admin users", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      role: "ADMIN",
      resumeGenerationCap: 5,
      resumeGenerationsUsedThisMonth: 100,
      capResetAt: new Date("2026-04-01"),
    });
    expect(await reserveGeneration("admin1")).toBe(true);
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("reserves when under cap", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      role: "USER",
      resumeGenerationCap: 5,
      resumeGenerationsUsedThisMonth: 2,
      capResetAt: new Date("2026-04-01"),
    });
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    expect(await reserveGeneration("user1")).toBe(true);
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: "user1",
        resumeGenerationsUsedThisMonth: { lt: 5 },
      },
      data: {
        resumeGenerationsUsedThisMonth: { increment: 1 },
      },
    });
  });

  it("returns false when at cap", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      role: "USER",
      resumeGenerationCap: 5,
      resumeGenerationsUsedThisMonth: 5,
      capResetAt: new Date("2026-04-01"),
    });
    mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });

    expect(await reserveGeneration("user1")).toBe(false);
  });

  it("resets counter on month boundary", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      role: "USER",
      resumeGenerationCap: 5,
      resumeGenerationsUsedThisMonth: 5,
      capResetAt: new Date("2026-03-01"), // already passed
    });
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    expect(await reserveGeneration("user1")).toBe(true);
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: "user1",
        role: { not: "ADMIN" },
      },
      data: {
        resumeGenerationsUsedThisMonth: 1,
        capResetAt: new Date("2026-04-01T00:00:00.000Z"),
      },
    });
  });
});

describe("rollbackGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing for admin users", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      role: "ADMIN",
      resumeGenerationsUsedThisMonth: 5,
    });
    await rollbackGeneration("admin1");
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("decrements counter when > 0", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      role: "USER",
      resumeGenerationsUsedThisMonth: 3,
    });
    await rollbackGeneration("user1");
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user1" },
      data: { resumeGenerationsUsedThisMonth: { decrement: 1 } },
    });
  });

  it("floors at 0 (does not decrement when already 0)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      role: "USER",
      resumeGenerationsUsedThisMonth: 0,
    });
    await rollbackGeneration("user1");
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});

describe("getUserUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns defaults when user not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const result = await getUserUsage("missing");
    expect(result).toEqual({ used: 0, cap: 5, resetsAt: null, isAdmin: false });
  });

  it("returns usage for normal user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      role: "USER",
      resumeGenerationCap: 5,
      resumeGenerationsUsedThisMonth: 3,
      capResetAt: new Date("2026-04-01"),
    });
    const result = await getUserUsage("user1");
    expect(result).toEqual({
      used: 3,
      cap: 5,
      resetsAt: new Date("2026-04-01"),
      isAdmin: false,
    });
  });

  it("returns isAdmin true for admin users", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      role: "ADMIN",
      resumeGenerationCap: 5,
      resumeGenerationsUsedThisMonth: 10,
      capResetAt: new Date("2026-04-01"),
    });
    const result = await getUserUsage("admin1");
    expect(result.isAdmin).toBe(true);
  });

  it("resets used to 0 when cap reset is due", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      role: "USER",
      resumeGenerationCap: 5,
      resumeGenerationsUsedThisMonth: 5,
      capResetAt: new Date("2026-03-01"), // already passed
    });
    const result = await getUserUsage("user1");
    expect(result.used).toBe(0);
    expect(result.resetsAt).toEqual(new Date("2026-04-01T00:00:00.000Z"));
  });
});
