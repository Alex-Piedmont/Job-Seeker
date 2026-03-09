import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validations";
import { updateInterviewSchema } from "@/lib/validations/kanban";

export const PUT = authenticatedHandler(async (request, { userId, params }) => {
  const { id, intId } = params;

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
});

export const DELETE = authenticatedHandler(async (_request, { userId, params }) => {
  const { id, intId } = params;

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
});
