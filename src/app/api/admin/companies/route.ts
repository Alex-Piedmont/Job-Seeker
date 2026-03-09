import { NextResponse, after } from "next/server";
import { adminHandler } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { scrapeCompany } from "@/lib/scraper/scrape-company";
import { validateBody } from "@/lib/validations";
import { createCompanySchema } from "@/lib/validations/scraper";

export const GET = adminHandler(async (request) => {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));
  const sort = ["name", "createdAt", "lastScrapeAt", "scrapeStatus"].includes(url.searchParams.get("sort") ?? "")
    ? url.searchParams.get("sort")!
    : "name";
  const order = url.searchParams.get("order") === "desc" ? "desc" : ("asc" as const);

  const skip = (page - 1) * limit;
  const where = { isRemoved: false };
  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      orderBy: { [sort]: order },
      skip,
      take: limit,
      include: { _count: { select: { scrapedJobs: { where: { removedAt: null } } } } },
    }),
    prisma.company.count({ where }),
  ]);

  return Response.json({
    companies,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

export const POST = adminHandler(async (request) => {
  const validation = await validateBody(request, createCompanySchema);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Check name uniqueness (case-insensitive)
  const existing = await prisma.company.findFirst({
    where: { name: { equals: data.name, mode: "insensitive" } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A company with this name already exists" },
      { status: 409 }
    );
  }

  const company = await prisma.company.create({ data });

  after(async () => {
    await scrapeCompany({
      id: company.id,
      name: company.name,
      baseUrl: company.baseUrl,
      atsPlatform: company.atsPlatform,
    });
  });

  return Response.json(company, { status: 201 });
});
