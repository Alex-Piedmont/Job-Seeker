import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const GET = authenticatedHandler(async (_request, { userId, params }) => {
  const { id } = params;

  const job = await prisma.scrapedJob.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true } },
      userArchives: {
        where: { userId },
        select: { id: true },
      },
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const { userArchives, ...rest } = job;
  return NextResponse.json({ ...rest, isArchived: userArchives.length > 0 });
});
