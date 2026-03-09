import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validations";
import { createNoteSchema } from "@/lib/validations/kanban";

export const POST = authenticatedHandler(async (request, { userId, params }) => {
  const { id } = params;

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
});
