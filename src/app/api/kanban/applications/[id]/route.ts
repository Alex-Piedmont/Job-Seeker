import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validations";
import { updateApplicationSchema } from "@/lib/validations/kanban";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  const application = await prisma.jobApplication.findFirst({
    where: { id, userId },
    include: {
      interviews: { orderBy: [{ date: "asc" }, { sortOrder: "asc" }] },
      notes: { orderBy: { createdAt: "desc" } },
      column: { select: { id: true, name: true, columnType: true } },
      statusLogs: { orderBy: { movedAt: "desc" }, take: 1 },
    },
  });
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  return NextResponse.json(application);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  const validation = await validateBody(request, updateApplicationSchema);
  if (!validation.success) return validation.response;
  const data = validation.data;

  const existing = await prisma.jobApplication.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  // If columnId is changing, validate it belongs to user
  if (data.columnId && data.columnId !== existing.columnId) {
    const column = await prisma.kanbanColumn.findFirst({
      where: { id: data.columnId, userId },
    });
    if (!column) {
      return NextResponse.json({ error: "Column not found" }, { status: 404 });
    }
  }

  // Convert date strings to Date objects
  const updateData: Record<string, unknown> = { ...data };
  for (const field of ["datePosted", "dateApplied", "rejectionDate"] as const) {
    if (field in data && data[field] !== undefined) {
      updateData[field] = data[field] ? new Date(data[field]) : null;
    }
  }

  const updated = await prisma.jobApplication.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  const application = await prisma.jobApplication.findFirst({
    where: { id, userId },
  });
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  await prisma.jobApplication.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
