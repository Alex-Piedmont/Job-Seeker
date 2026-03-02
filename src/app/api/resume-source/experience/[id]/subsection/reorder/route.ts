import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { validateBody } from "@/lib/validations";
import { reorderSchema } from "@/lib/validations/resume-source";
import { prisma } from "@/lib/prisma";
import { verifyExperienceOwnership, reorderEntries } from "@/lib/resume-source-helpers";

export const PUT = authenticatedHandler(async (request, { userId, params }) => {
  const experience = await verifyExperienceOwnership(params.id, userId);
  if (!experience) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const validation = await validateBody(request, reorderSchema);
  if (!validation.success) return validation.response;

  const entries = await prisma.resumeWorkSubsection.findMany({
    where: { workExperienceId: params.id },
    select: { id: true },
  });
  const validIds = new Set(entries.map((e) => e.id));
  const requestedIds = validation.data.ids.filter((id) => validIds.has(id));
  const missingIds = entries
    .map((e) => e.id)
    .filter((id) => !requestedIds.includes(id));
  const finalIds = [...requestedIds, ...missingIds];

  await reorderEntries("resumeWorkSubsection", finalIds);

  return NextResponse.json({ success: true });
});
