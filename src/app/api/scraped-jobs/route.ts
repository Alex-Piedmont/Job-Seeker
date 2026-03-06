import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scrapedJobQuerySchema } from "@/lib/validations/scraper";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const userId = session.user.id;

  const url = new URL(request.url);
  const rawParams = Object.fromEntries(url.searchParams.entries());
  const parsed = scrapedJobQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }
  const { q, company, companyId, companyIds, location, locationType, salaryMin, salaryMax, postedFrom, postedTo, includeRemoved, includeArchived, page, limit, sort, order } = parsed.data;

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
  if (location) {
    where.locations = { string_contains: location };
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

  return Response.json({
    jobs: formattedJobs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
