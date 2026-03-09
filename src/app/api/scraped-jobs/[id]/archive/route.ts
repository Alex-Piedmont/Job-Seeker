import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const POST = authenticatedHandler(async (_request, { userId, params }) => {
  const { id } = params;

  // Verify the scraped job exists
  const job = await prisma.scrapedJob.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Check if already archived
  const existing = await prisma.userJobArchive.findUnique({
    where: { userId_scrapedJobId: { userId, scrapedJobId: id } },
  });
  if (existing) {
    return NextResponse.json({ error: "Job is already archived" }, { status: 409 });
  }

  const archive = await prisma.userJobArchive.create({
    data: { userId, scrapedJobId: id },
  });
  return NextResponse.json(archive, { status: 201 });
});

export const DELETE = authenticatedHandler(async (_request, { userId, params }) => {
  const { id } = params;

  const existing = await prisma.userJobArchive.findUnique({
    where: { userId_scrapedJobId: { userId, scrapedJobId: id } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Archive record not found" }, { status: 404 });
  }

  await prisma.userJobArchive.delete({
    where: { userId_scrapedJobId: { userId, scrapedJobId: id } },
  });
  return new NextResponse(null, { status: 204 });
});
