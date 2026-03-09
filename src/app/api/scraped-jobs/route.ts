import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { scrapedJobQuerySchema } from "@/lib/validations/scraper";

export const GET = authenticatedHandler(async (request, { userId }) => {
  const url = new URL(request.url);
  const rawParams = Object.fromEntries(url.searchParams.entries());
  const parsed = scrapedJobQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }
  const { q, titleLevels, company, companyId, companyIds, location, locationType, salaryMin, salaryMax, postedFrom, postedTo, includeRemoved, includeArchived, page, limit, sort, order } = parsed.data;

  const where: Record<string, unknown> = {};

  if (q) {
    where.title = { contains: q, mode: "insensitive" };
  }
  if (companyIds) {
    where.companyId = { in: companyIds.split(",").filter(Boolean) };
  } else if (companyId) {
    where.companyId = companyId;
  } else if (company) {
    where.company = { name: { equals: company, mode: "insensitive" } };
  }

  // Helper to intersect ID sets from raw SQL filters
  const intersectIds = (ids: string[]) => {
    if (where.id && typeof where.id === "object" && "in" in (where.id as Record<string, unknown>)) {
      const existing = new Set((where.id as { in: string[] }).in);
      where.id = { in: ids.filter((id) => existing.has(id)) };
    } else {
      where.id = { in: ids };
    }
  };

  if (location) {
    const matchingIds = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM scraped_jobs WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(locations) AS loc
        WHERE loc ILIKE $1
      )`,
      `%${location}%`
    );
    intersectIds(matchingIds.map((r) => r.id));
  }
  if (titleLevels) {
    const levels = titleLevels.split(",").filter(Boolean);
    if (levels.length > 0) {
      // Match any selected level in the title (case-insensitive, OR between levels)
      const levelMatchIds = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM scraped_jobs WHERE ${levels.map((_, i) => `title ILIKE $${i + 1}`).join(" OR ")}`,
        ...levels.map((l) => `%${l}%`)
      );
      intersectIds(levelMatchIds.map((r) => r.id));
    }
  }
  if (locationType) {
    where.locationType = locationType;
  }
  if (salaryMin !== undefined) {
    where.salaryMax = { gte: salaryMin };
  }
  if (salaryMax !== undefined) {
    where.salaryMin = { ...(typeof where.salaryMin === "object" ? where.salaryMin as Record<string, unknown> : {}), lte: salaryMax };
  }
  if (postedFrom) {
    where.firstSeenAt = { gte: new Date(postedFrom) };
  }
  if (postedTo) {
    where.firstSeenAt = { ...(typeof where.firstSeenAt === "object" ? where.firstSeenAt as Record<string, unknown> : {}), lte: new Date(postedTo) };
  }
  if (!includeRemoved) {
    where.removedAt = null;
  }
  if (!includeArchived) {
    where.archivedAt = null;
    where.NOT = { userArchives: { some: { userId } } };
  }

  const skip = (page - 1) * limit;
  const [jobs, total] = await Promise.all([
    prisma.scrapedJob.findMany({
      where,
      orderBy: { [sort]: order },
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        url: true,
        department: true,
        locations: true,
        locationType: true,
        salaryMin: true,
        salaryMax: true,
        salaryCurrency: true,
        firstSeenAt: true,
        removedAt: true,
        archivedAt: true,
        company: { select: { id: true, name: true } },
        userArchives: {
          where: { userId },
          select: { id: true },
        },
      },
    }),
    prisma.scrapedJob.count({ where }),
  ]);

  const formattedJobs = jobs.map(({ userArchives, ...job }) => ({
    ...job,
    isArchived: userArchives.length > 0,
  }));

  return NextResponse.json({
    jobs: formattedJobs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});
