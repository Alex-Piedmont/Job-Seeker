import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validations";
import { createInterviewSchema } from "@/lib/validations/kanban";

export async function POST(
  request: Request,
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

  const validation = await validateBody(request, createInterviewSchema);
  if (!validation.success) return validation.response;
  const data = validation.data;

  const interview = await prisma.interviewRecord.create({
    data: {
      jobApplicationId: id,
      type: data.type,
      format: data.format,
      people: data.people ?? null,
      date: data.date ? new Date(data.date) : null,
      notes: data.notes ?? null,
      sortOrder: data.sortOrder,
    },
  });

  return NextResponse.json(interview, { status: 201 });
}
