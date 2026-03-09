import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const DELETE = authenticatedHandler(async (_request, { userId, params }) => {
  const { id, noteId } = params;

  const application = await prisma.jobApplication.findFirst({
    where: { id, userId },
  });
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const note = await prisma.applicationNote.findFirst({
    where: { id: noteId, jobApplicationId: id },
  });
  if (!note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  await prisma.applicationNote.delete({ where: { id: noteId } });
  return new NextResponse(null, { status: 204 });
});
