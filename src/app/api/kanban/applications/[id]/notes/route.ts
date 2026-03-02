import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validations";
import { createNoteSchema } from "@/lib/validations/kanban";

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

  const validation = await validateBody(request, createNoteSchema);
  if (!validation.success) return validation.response;
  const { content } = validation.data;

  // Max 500 notes per application
  const noteCount = await prisma.applicationNote.count({
    where: { jobApplicationId: id },
  });
  if (noteCount >= 500) {
    return NextResponse.json(
      { error: "Maximum of 500 notes per application" },
      { status: 400 }
    );
  }

  const note = await prisma.applicationNote.create({
    data: {
      jobApplicationId: id,
      content,
    },
  });

  return NextResponse.json(note, { status: 201 });
}
