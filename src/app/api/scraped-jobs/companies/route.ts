import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

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

  return Response.json({ companies: formatted });
}
