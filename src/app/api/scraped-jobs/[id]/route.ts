import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<Record<string, string>> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

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
  return Response.json({ ...rest, isArchived: userArchives.length > 0 });
}
