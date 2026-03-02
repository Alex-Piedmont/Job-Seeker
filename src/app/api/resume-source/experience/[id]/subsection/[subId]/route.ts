import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { validateBody } from "@/lib/validations";
import { subsectionUpdateSchema } from "@/lib/validations/resume-source";
import { prisma } from "@/lib/prisma";
import { verifySubsectionOwnership } from "@/lib/resume-source-helpers";

export const PUT = authenticatedHandler(async (request, { userId, params }) => {
  const existing = await verifySubsectionOwnership(params.subId, params.id, userId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const validation = await validateBody(request, subsectionUpdateSchema);
  if (!validation.success) return validation.response;

  const updated = await prisma.resumeWorkSubsection.update({
    where: { id: params.subId },
    data: validation.data,
  });

  return Response.json(updated);
});

export const DELETE = authenticatedHandler(async (_request, { userId, params }) => {
  const existing = await verifySubsectionOwnership(params.subId, params.id, userId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.resumeWorkSubsection.delete({ where: { id: params.subId } });
  return Response.json({ success: true });
});
