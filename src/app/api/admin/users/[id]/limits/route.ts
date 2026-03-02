import { NextResponse } from "next/server";
import { adminHandler } from "@/lib/admin";
import { validateBody } from "@/lib/validations";
import { updateLimitsSchema } from "@/lib/validations/admin";
import { prisma } from "@/lib/prisma";

export const PUT = adminHandler(async (request, { userId, params }) => {
  const { id } = params;

  // Cannot edit own limits
  if (id === userId) {
    return NextResponse.json(
      { error: "You cannot edit your own limits" },
      { status: 400 }
    );
  }

  const validation = await validateBody(request, updateLimitsSchema);
  if (!validation.success) return validation.response;

  const { applicationCap, resumeGenerationCap } = validation.data;

  // Verify target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Build update data
  const data: Record<string, number> = {};
  if (applicationCap !== undefined) data.applicationCap = applicationCap;
  if (resumeGenerationCap !== undefined) data.resumeGenerationCap = resumeGenerationCap;

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      applicationCap: true,
      resumeGenerationCap: true,
    },
  });

  return Response.json(updated);
});
