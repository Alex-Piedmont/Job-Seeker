import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const GET = authenticatedHandler(async (_request) => {
  const companies = await prisma.company.findMany({
    where: { enabled: true },
    select: {
      id: true,
      name: true,
      _count: { select: { scrapedJobs: true } },
    },
    orderBy: { name: "asc" },
  });

  const formatted = companies.map(({ _count, ...company }) => ({
    ...company,
    jobCount: _count.scrapedJobs,
  }));

  return NextResponse.json({ companies: formatted });
});
