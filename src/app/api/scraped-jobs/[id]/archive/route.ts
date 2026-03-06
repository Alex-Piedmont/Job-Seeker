import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<Record<string, string>> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

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
  return Response.json(archive, { status: 201 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<Record<string, string>> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  const existing = await prisma.userJobArchive.findUnique({
    where: { userId_scrapedJobId: { userId, scrapedJobId: id } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Archive record not found" }, { status: 404 });
  }

  await prisma.userJobArchive.delete({
    where: { userId_scrapedJobId: { userId, scrapedJobId: id } },
  });
  return new Response(null, { status: 204 });
}
