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
  const { q, company, companyId, location, locationType, includeRemoved, includeArchived, page, limit, sort, order } = parsed.data;

  const where: Record<string, unknown> = {};

  if (q) {
    where.title = { contains: q, mode: "insensitive" };
  }
  if (companyId) {
    where.companyId = companyId;
  } else if (company) {
    where.company = { name: { equals: company, mode: "insensitive" } };
  }
  if (location) {
    // Cast locations JSON to string and search
    where.locations = { string_contains: location };
  }
  if (locationType) {
    where.locationType = locationType;
  }
  if (!includeRemoved) {
    where.removedAt = null;
  }
  if (!includeArchived) {
    where.archivedAt = null;
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
