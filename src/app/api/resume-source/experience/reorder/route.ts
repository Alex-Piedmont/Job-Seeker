import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { validateBody } from "@/lib/validations";
import { reorderSchema } from "@/lib/validations/resume-source";
import { prisma } from "@/lib/prisma";
import { getResumeSourceId, reorderEntries } from "@/lib/resume-source-helpers";

export const PUT = authenticatedHandler(async (request, { userId }) => {
  const validation = await validateBody(request, reorderSchema);
  if (!validation.success) return validation.response;

  const resumeSourceId = await getResumeSourceId(userId);

  const entries = await prisma.resumeWorkExperience.findMany({
    where: { resumeSourceId },
    select: { id: true },
  });
  const validIds = new Set(entries.map((e) => e.id));
  const requestedIds = validation.data.ids.filter((id) => validIds.has(id));
  const missingIds = entries
    .map((e) => e.id)
    .filter((id) => !requestedIds.includes(id));
  const finalIds = [...requestedIds, ...missingIds];

  await reorderEntries("resumeWorkExperience", finalIds);

  return NextResponse.json({ success: true });
});
