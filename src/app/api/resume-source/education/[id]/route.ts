import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { validateBody } from "@/lib/validations";
import { educationUpdateSchema } from "@/lib/validations/resume-source";
import { prisma } from "@/lib/prisma";
import { verifyEducationOwnership } from "@/lib/resume-source-helpers";

export const PUT = authenticatedHandler(async (request, { userId, params }) => {
  const existing = await verifyEducationOwnership(params.id, userId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const validation = await validateBody(request, educationUpdateSchema);
  if (!validation.success) return validation.response;

  const updated = await prisma.resumeEducation.update({
    where: { id: params.id },
    data: validation.data,
  });

  return Response.json(updated);
});

export const DELETE = authenticatedHandler(async (_request, { userId, params }) => {
  const existing = await verifyEducationOwnership(params.id, userId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.resumeEducation.delete({ where: { id: params.id } });
  return Response.json({ success: true });
});
