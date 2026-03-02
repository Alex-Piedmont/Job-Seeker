import { prisma } from "@/lib/prisma";
import { shouldResetCap, getNextCapResetDate } from "@/lib/caps";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FunnelEntry {
  columnId: string;
  columnName: string;
  columnColor: string;
  count: number;
  percentage: number;
}

export interface WeeklyEntry {
  weekStart: string; // ISO date of Monday
  count: number;
}

export interface ClosureStageEntry {
  columnName: string;
  count: number;
  rejectedCount: number;
  ghostedCount: number;
}

export interface ResumeUsageData {
  used: number;
  cap: number;
  resetsAt: string;
  isAdmin: boolean;
  totalAllTime: number;
}

export interface AnalyticsResponse {
  totalApplications: number;
  activeApplications: number;
  interviewsScheduled: number;
  offers: number;
  funnel: FunnelEntry[];
  weeklyApplications: WeeklyEntry[];
  medianDaysToFirstResponse: number | null;
  avgDaysToFirstResponse: number | null;
  appToInterviewRate: number | null;
  interviewToOfferRate: number | null;
  closureRate: number | null;
  ghostedRate: number | null;
  closuresByStage: ClosureStageEntry[];
  resumeUsage: ResumeUsageData;
}

// ─── Query Functions ────────────────────────────────────────────────────────

/**
 * Summary metrics: total, active, interviews scheduled, offers.
 */
export async function getSummaryMetrics(userId: string) {
  const [columns, totalApplications, interviewsScheduled] = await Promise.all([
    prisma.kanbanColumn.findMany({
      where: { userId },
      select: { id: true, columnType: true },
    }),
    prisma.jobApplication.count({ where: { userId } }),
    prisma.interviewRecord.count({
      where: {
        jobApplication: { userId },
        OR: [{ date: { gte: new Date() } }, { date: null }],
      },
    }),
  ]);

  const closedColumnIds = columns
    .filter((c) => c.columnType === "CLOSED")
    .map((c) => c.id);
  const offerColumnIds = columns
    .filter((c) => c.columnType === "OFFER")
    .map((c) => c.id);

  const [closedCount, offers] = await Promise.all([
    closedColumnIds.length > 0
      ? prisma.jobApplication.count({
          where: { userId, columnId: { in: closedColumnIds } },
        })
      : 0,
    offerColumnIds.length > 0
      ? prisma.jobApplication.count({
          where: { userId, columnId: { in: offerColumnIds } },
        })
      : 0,
  ]);

  return {
    totalApplications,
    activeApplications: totalApplications - closedCount,
    interviewsScheduled,
    offers,
  };
}

/**
 * Pipeline funnel: count of applications per column, ordered by column order.
 */
export async function getPipelineFunnel(userId: string): Promise<FunnelEntry[]> {
  const columns = await prisma.kanbanColumn.findMany({
    where: { userId },
    orderBy: { order: "asc" },
    select: {
      id: true,
      name: true,
      color: true,
      _count: { select: { applications: true } },
    },
  });

  const total = columns.reduce((sum, c) => sum + c._count.applications, 0);

  return columns.map((c) => ({
    columnId: c.id,
    columnName: c.name,
    columnColor: c.color,
    count: c._count.applications,
    percentage: total > 0 ? Math.round((c._count.applications / total) * 1000) / 10 : 0,
  }));
}

/**
 * Weekly application volume (last 12 weeks, zero-filled).
 */
export async function getWeeklyApplications(userId: string): Promise<WeeklyEntry[]> {
  // Generate the last 12 Monday dates
  const now = new Date();
  const weeks: Date[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - d.getUTCDay() + 1 - i * 7); // Monday of i weeks ago
    d.setUTCHours(0, 0, 0, 0);
    weeks.push(d);
  }

  const startDate = weeks[0];

  const applications = await prisma.jobApplication.findMany({
    where: {
      userId,
      dateApplied: { not: null, gte: startDate },
    },
    select: { dateApplied: true },
  });

  // Bucket by week
  const weekCounts = new Map<string, number>();
  for (const w of weeks) {
    weekCounts.set(w.toISOString().split("T")[0], 0);
  }

  for (const app of applications) {
    if (!app.dateApplied) continue;
    const d = new Date(app.dateApplied);
    // Find the Monday of that week
    const day = d.getUTCDay();
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
    monday.setUTCHours(0, 0, 0, 0);
    const key = monday.toISOString().split("T")[0];
    if (weekCounts.has(key)) {
      weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1);
    }
  }

  return Array.from(weekCounts.entries()).map(([weekStart, count]) => ({
    weekStart,
    count,
  }));
}

/**
 * Time-based stats: median/avg days to first response.
 * Requires at least 3 data points to return non-null.
 */
export async function getTimeStats(userId: string) {
  // Get applications with dateApplied and their first status log
  const applications = await prisma.jobApplication.findMany({
    where: { userId, dateApplied: { not: null } },
    select: {
      id: true,
      dateApplied: true,
      statusLogs: {
        orderBy: { movedAt: "asc" },
        take: 1,
        select: { movedAt: true },
      },
    },
  });

  const daysToFirstResponse: number[] = [];
  for (const app of applications) {
    if (!app.dateApplied || app.statusLogs.length === 0) continue;
    const applied = new Date(app.dateApplied).getTime();
    const firstMove = new Date(app.statusLogs[0].movedAt).getTime();
    const days = (firstMove - applied) / (1000 * 60 * 60 * 24);
    if (days >= 0) daysToFirstResponse.push(days);
  }

  if (daysToFirstResponse.length < 3) {
    return { medianDaysToFirstResponse: null, avgDaysToFirstResponse: null };
  }

  daysToFirstResponse.sort((a, b) => a - b);
  const mid = Math.floor(daysToFirstResponse.length / 2);
  const median =
    daysToFirstResponse.length % 2 === 0
      ? (daysToFirstResponse[mid - 1] + daysToFirstResponse[mid]) / 2
      : daysToFirstResponse[mid];

  const avg =
    daysToFirstResponse.reduce((sum, d) => sum + d, 0) / daysToFirstResponse.length;

  return {
    medianDaysToFirstResponse: Math.round(median * 10) / 10,
    avgDaysToFirstResponse: Math.round(avg * 10) / 10,
  };
}

/**
 * Conversion rates: app-to-interview, interview-to-offer.
 */
export async function getConversionRates(userId: string) {
  const columns = await prisma.kanbanColumn.findMany({
    where: { userId },
    select: { id: true, columnType: true },
  });
  const offerColumnIds = columns
    .filter((c) => c.columnType === "OFFER")
    .map((c) => c.id);

  // Apps with dateApplied (past "Saved" stage)
  const appliedApps = await prisma.jobApplication.findMany({
    where: { userId, dateApplied: { not: null } },
    select: {
      id: true,
      columnId: true,
      _count: { select: { interviews: true } },
    },
  });

  const totalApplied = appliedApps.length;
  const withInterviews = appliedApps.filter((a) => a._count.interviews > 0);
  const offersWithInterviews = withInterviews.filter((a) =>
    offerColumnIds.includes(a.columnId)
  );

  return {
    appToInterviewRate:
      totalApplied > 0
        ? Math.round((withInterviews.length / totalApplied) * 1000) / 1000
        : null,
    interviewToOfferRate:
      withInterviews.length > 0
        ? Math.round((offersWithInterviews.length / withInterviews.length) * 1000) / 1000
        : null,
  };
}

/**
 * Closure breakdown: rate, ghosted rate, and closures by pre-closure stage.
 */
export async function getClosureBreakdown(userId: string) {
  const columns = await prisma.kanbanColumn.findMany({
    where: { userId },
    select: { id: true, name: true, columnType: true },
  });

  const closedColumnIds = columns
    .filter((c) => c.columnType === "CLOSED")
    .map((c) => c.id);

  const totalApplications = await prisma.jobApplication.count({ where: { userId } });

  if (closedColumnIds.length === 0 || totalApplications === 0) {
    return {
      closureRate: totalApplications > 0 ? 0 : null,
      ghostedRate: null,
      closuresByStage: [],
    };
  }

  // Get closed applications with their closedReason
  const closedApps = await prisma.jobApplication.findMany({
    where: { userId, columnId: { in: closedColumnIds } },
    select: { id: true, closedReason: true },
  });

  const totalClosed = closedApps.length;
  if (totalClosed === 0) {
    return {
      closureRate: 0,
      ghostedRate: null,
      closuresByStage: [],
    };
  }

  const ghostedCount = closedApps.filter((a) => a.closedReason === "ghosted").length;
  const closureRate = Math.round((totalClosed / totalApplications) * 1000) / 1000;
  const ghostedRate = Math.round((ghostedCount / totalClosed) * 1000) / 1000;

  // Get the last status log that moved each app to a closed column
  const closedAppIds = closedApps.map((a) => a.id);
  const statusLogs = await prisma.applicationStatusLog.findMany({
    where: {
      jobApplicationId: { in: closedAppIds },
      toColumnId: { in: closedColumnIds },
    },
    orderBy: { movedAt: "desc" },
    select: {
      jobApplicationId: true,
      fromColumnId: true,
    },
  });

  // Build a map of appId -> fromColumnId (last entry that moved to closed)
  const appToFromColumn = new Map<string, string | null>();
  for (const log of statusLogs) {
    // Only keep the first (most recent) entry per app
    if (!appToFromColumn.has(log.jobApplicationId)) {
      appToFromColumn.set(log.jobApplicationId, log.fromColumnId);
    }
  }

  // Build column name lookup
  const columnNameMap = new Map<string, string>();
  for (const col of columns) {
    columnNameMap.set(col.id, col.name);
  }

  // Group by from-column
  const stageMap = new Map<
    string,
    { columnName: string; count: number; rejectedCount: number; ghostedCount: number }
  >();

  for (const app of closedApps) {
    const fromColumnId = appToFromColumn.get(app.id);
    const columnName = fromColumnId
      ? columnNameMap.get(fromColumnId) ?? "Deleted Column"
      : "Unknown";

    const key = fromColumnId ?? "unknown";
    if (!stageMap.has(key)) {
      stageMap.set(key, { columnName, count: 0, rejectedCount: 0, ghostedCount: 0 });
    }
    const entry = stageMap.get(key)!;
    entry.count++;
    if (app.closedReason === "ghosted") {
      entry.ghostedCount++;
    } else {
      entry.rejectedCount++;
    }
  }

  const closuresByStage = Array.from(stageMap.values()).sort(
    (a, b) => b.count - a.count
  );

  return { closureRate, ghostedRate, closuresByStage };
}

/**
 * Resume generation usage.
 */
export async function getResumeUsage(userId: string): Promise<ResumeUsageData> {
  const [user, totalAllTime] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        resumeGenerationCap: true,
        resumeGenerationsUsedThisMonth: true,
        capResetAt: true,
      },
    }),
    prisma.resumeGeneration.count({ where: { userId } }),
  ]);

  if (!user) {
    return {
      used: 0,
      cap: 5,
      resetsAt: getNextCapResetDate().toISOString(),
      isAdmin: false,
      totalAllTime: 0,
    };
  }

  const isAdmin = user.role === "ADMIN";
  let used = user.resumeGenerationsUsedThisMonth;
  let resetsAt: Date;

  if (shouldResetCap(user.capResetAt)) {
    used = 0;
    resetsAt = getNextCapResetDate();
  } else {
    resetsAt = user.capResetAt ?? getNextCapResetDate();
  }

  return {
    used,
    cap: user.resumeGenerationCap,
    resetsAt: resetsAt.toISOString(),
    isAdmin,
    totalAllTime,
  };
}
