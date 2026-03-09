import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validations";
import { createInterviewSchema } from "@/lib/validations/kanban";

export const POST = authenticatedHandler(async (request, { userId, params }) => {
  const { id } = params;

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
});
