import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validations";
import { updateInterviewSchema } from "@/lib/validations/kanban";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; intId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id, intId } = await params;

  // Verify ownership chain
  const application = await prisma.jobApplication.findFirst({
    where: { id, userId },
  });
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const interview = await prisma.interviewRecord.findFirst({
    where: { id: intId, jobApplicationId: id },
  });
  if (!interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  const validation = await validateBody(request, updateInterviewSchema);
  if (!validation.success) return validation.response;
  const data = validation.data;

  const updateData: Record<string, unknown> = { ...data };
  if ("date" in data && data.date !== undefined) {
    updateData.date = data.date ? new Date(data.date) : null;
  }

  const updated = await prisma.interviewRecord.update({
    where: { id: intId },
    data: updateData,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; intId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id, intId } = await params;

  const application = await prisma.jobApplication.findFirst({
    where: { id, userId },
  });
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const interview = await prisma.interviewRecord.findFirst({
    where: { id: intId, jobApplicationId: id },
  });
  if (!interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  await prisma.interviewRecord.delete({ where: { id: intId } });
  return new NextResponse(null, { status: 204 });
}
