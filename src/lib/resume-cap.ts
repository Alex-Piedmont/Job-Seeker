import { prisma } from "@/lib/prisma";
import { shouldResetCap, getNextCapResetDate } from "@/lib/caps";

/**
 * Atomically reserve a resume generation slot.
 * Returns true if reserved, false if cap reached.
 * Admin users bypass cap checks entirely.
 */
export async function reserveGeneration(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      resumeGenerationCap: true,
      resumeGenerationsUsedThisMonth: true,
      capResetAt: true,
    },
  });

  if (!user) return false;

  // Admin bypass
  if (user.role === "ADMIN") return true;

  // Check if monthly reset is needed
  if (shouldResetCap(user.capResetAt)) {
    const nextReset = getNextCapResetDate();
    // Reset counter and try to reserve in one atomic operation
    const result = await prisma.user.updateMany({
      where: {
        id: userId,
        role: { not: "ADMIN" },
      },
      data: {
        resumeGenerationsUsedThisMonth: 1,
        capResetAt: nextReset,
      },
    });
    return result.count > 0;
  }

  // Atomic increment WHERE used < cap
  const result = await prisma.user.updateMany({
    where: {
      id: userId,
      resumeGenerationsUsedThisMonth: { lt: user.resumeGenerationCap },
    },
    data: {
      resumeGenerationsUsedThisMonth: { increment: 1 },
    },
  });

  return result.count > 0;
}

/**
 * Roll back a reserved generation slot (e.g., on failure after reserve).
 * Floors at 0 to prevent negative counts.
 */
export async function rollbackGeneration(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, resumeGenerationsUsedThisMonth: true },
  });

  if (!user || user.role === "ADMIN") return;

  if (user.resumeGenerationsUsedThisMonth > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        resumeGenerationsUsedThisMonth: { decrement: 1 },
      },
    });
  }
}

/**
 * Get current usage info for a user.
 */
export async function getUserUsage(userId: string): Promise<{
  used: number;
  cap: number;
  resetsAt: Date | null;
  isAdmin: boolean;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      resumeGenerationCap: true,
      resumeGenerationsUsedThisMonth: true,
      capResetAt: true,
    },
  });

  if (!user) {
    return { used: 0, cap: 5, resetsAt: null, isAdmin: false };
  }

  const isAdmin = user.role === "ADMIN";

  // If cap should reset, report 0 used
  let used = user.resumeGenerationsUsedThisMonth;
  let resetsAt = user.capResetAt;
  if (shouldResetCap(user.capResetAt)) {
    used = 0;
    resetsAt = getNextCapResetDate();
  }

  return {
    used,
    cap: user.resumeGenerationCap,
    resetsAt,
    isAdmin,
  };
}
