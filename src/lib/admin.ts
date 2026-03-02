import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ─── Admin Email Detection ─────────────────────────────────────────────────

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email);
}

// ─── Admin Handler ──────────────────────────────────────────────────────────

type AdminContext = {
  userId: string;
  params: Record<string, string>;
};

type AdminHandlerFn = (
  request: Request,
  context: AdminContext
) => Promise<Response | NextResponse>;

/**
 * Wraps an API route handler with auth + admin role check.
 */
export function adminHandler(handler: AdminHandlerFn) {
  return async (
    request: Request,
    { params }: { params: Promise<Record<string, string>> }
  ): Promise<Response | NextResponse> => {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const resolvedParams = await params;
      return await handler(request, {
        userId: session.user.id,
        params: resolvedParams,
      });
    } catch (error) {
      console.error("Admin API error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}

// ─── Query Functions ────────────────────────────────────────────────────────

/**
 * Platform overview stats.
 */
export async function getPlatformStats() {
  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );

  const [totalUsers, totalApplications, genAgg, dauToday, mauThisMonth] =
    await Promise.all([
      prisma.user.count(),
      prisma.jobApplication.count(),
      prisma.resumeGeneration.aggregate({
        _count: true,
        _sum: { estimatedCost: true },
      }),
      prisma.user.count({
        where: { lastActiveAt: { gte: todayStart } },
      }),
      prisma.user.count({
        where: { lastActiveAt: { gte: monthStart } },
      }),
    ]);

  return {
    totalUsers,
    totalApplications,
    totalGenerations: genAgg._count,
    estimatedTotalSpend: genAgg._sum.estimatedCost ?? 0,
    dauToday,
    mauThisMonth,
  };
}

/**
 * DAU over last 30 days (zero-filled).
 */
export async function getDauOverTime() {
  const now = new Date();
  const days: Date[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    d.setUTCHours(0, 0, 0, 0);
    days.push(d);
  }

  const startDate = days[0];

  const users = await prisma.user.findMany({
    where: { lastActiveAt: { gte: startDate } },
    select: { lastActiveAt: true },
  });

  const dayCounts = new Map<string, Set<string>>();
  for (const d of days) {
    dayCounts.set(d.toISOString().split("T")[0], new Set());
  }

  // Count unique users per day based on lastActiveAt
  // Note: lastActiveAt only stores the last activity, so a user is counted on that day
  for (const u of users) {
    if (!u.lastActiveAt) continue;
    const key = new Date(u.lastActiveAt).toISOString().split("T")[0];
    if (dayCounts.has(key)) {
      // Use a counter since we can't track individual user IDs across days with just lastActiveAt
      dayCounts.get(key)!.add("user");
    }
  }

  // Better approach: count users whose lastActiveAt falls on each day
  const result: Array<{ date: string; count: number }> = [];
  for (const d of days) {
    const key = d.toISOString().split("T")[0];
    const dayStart = new Date(d);
    const dayEnd = new Date(d);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const count = users.filter((u) => {
      if (!u.lastActiveAt) return false;
      const active = new Date(u.lastActiveAt);
      return active >= dayStart && active < dayEnd;
    }).length;

    result.push({ date: key, count });
  }

  return result;
}

/**
 * Generation stats: daily volume + cost for last 30 days, top users.
 */
export async function getGenerationStats() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
  thirtyDaysAgo.setUTCHours(0, 0, 0, 0);

  const [allTimeAgg, recentGens, topUsersRaw] = await Promise.all([
    prisma.resumeGeneration.aggregate({
      _count: true,
      _sum: { totalTokens: true, estimatedCost: true },
    }),
    prisma.resumeGeneration.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, estimatedCost: true },
    }),
    prisma.resumeGeneration.groupBy({
      by: ["userId"],
      _count: true,
      _sum: { totalTokens: true, estimatedCost: true },
      orderBy: { _sum: { estimatedCost: "desc" } },
      take: 10,
    }),
  ]);

  // Zero-fill 30 days
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    d.setUTCHours(0, 0, 0, 0);
    days.push(d.toISOString().split("T")[0]);
  }

  const dayMap = new Map<string, { count: number; cost: number }>();
  for (const day of days) {
    dayMap.set(day, { count: 0, cost: 0 });
  }
  for (const gen of recentGens) {
    const key = new Date(gen.createdAt).toISOString().split("T")[0];
    if (dayMap.has(key)) {
      const entry = dayMap.get(key)!;
      entry.count++;
      entry.cost += gen.estimatedCost;
    }
  }

  const generationsByDay = days.map((date) => ({
    date,
    count: dayMap.get(date)!.count,
    cost: Math.round(dayMap.get(date)!.cost * 100) / 100,
  }));

  // Resolve user names for top users
  const userIds = topUsersRaw.map((u) => u.userId);
  const userDetails = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(userDetails.map((u) => [u.id, u]));

  const topUsersByCost = topUsersRaw.map((u) => {
    const details = userMap.get(u.userId);
    return {
      userId: u.userId,
      name: details?.name ?? "Unknown",
      email: details?.email ?? "",
      generationCount: u._count,
      totalTokens: u._sum.totalTokens ?? 0,
      estimatedCost: Math.round((u._sum.estimatedCost ?? 0) * 100) / 100,
    };
  });

  return {
    totalGenerations: allTimeAgg._count,
    totalTokens: allTimeAgg._sum.totalTokens ?? 0,
    estimatedTotalCost:
      Math.round((allTimeAgg._sum.estimatedCost ?? 0) * 100) / 100,
    generationsByDay,
    topUsersByCost,
  };
}

/**
 * Paginated user list with aggregate stats.
 */
export async function getUserList(params: {
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}) {
  const { page, limit, search, sort, order } = params;
  const skip = (page - 1) * limit;

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  // Build orderBy based on sort field
  const directSortFields = [
    "name",
    "email",
    "resumeGenerationsUsedThisMonth",
    "lastActiveAt",
    "createdAt",
  ];

  const orderBy = directSortFields.includes(sort)
    ? { [sort]: order }
    : { createdAt: order }; // Default fallback for computed fields

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        applicationCap: true,
        resumeGenerationCap: true,
        resumeGenerationsUsedThisMonth: true,
        lastActiveAt: true,
        createdAt: true,
        _count: {
          select: {
            jobApplications: true,
            resumeGenerations: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  // Get per-user cost aggregates
  const userIds = users.map((u) => u.id);
  const costAggs = await prisma.resumeGeneration.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds } },
    _sum: { estimatedCost: true },
  });
  const costMap = new Map(
    costAggs.map((a) => [a.userId, a._sum.estimatedCost ?? 0])
  );

  const formattedUsers = users.map((u) => ({
    id: u.id,
    name: u.name ?? "No name",
    email: u.email ?? "",
    image: u.image,
    role: u.role,
    applicationCap: u.applicationCap,
    applicationCount: u._count.jobApplications,
    resumeGenerationCap: u.resumeGenerationCap,
    resumeGenerationsUsedThisMonth: u.resumeGenerationsUsedThisMonth,
    totalResumeGenerations: u._count.resumeGenerations,
    estimatedTotalCost: Math.round((costMap.get(u.id) ?? 0) * 100) / 100,
    lastActiveAt: u.lastActiveAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  }));

  // Client-side sort for computed fields
  if (
    ["applicationCount", "totalResumeGenerations", "estimatedTotalCost"].includes(sort)
  ) {
    formattedUsers.sort((a, b) => {
      const aVal = a[sort as keyof typeof a] as number;
      const bVal = b[sort as keyof typeof b] as number;
      return order === "asc" ? aVal - bVal : bVal - aVal;
    });
  }

  return {
    users: formattedUsers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
