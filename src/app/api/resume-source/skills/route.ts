import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { validateBody } from "@/lib/validations";
import { skillCreateSchema, ENTRY_CAPS } from "@/lib/validations/resume-source";
import { prisma } from "@/lib/prisma";
import { getResumeSourceId } from "@/lib/resume-source-helpers";

export const POST = authenticatedHandler(async (request, { userId }) => {
  const resumeSourceId = await getResumeSourceId(userId);

  const count = await prisma.resumeSkill.count({ where: { resumeSourceId } });
  if (count >= ENTRY_CAPS.skills) {
    return NextResponse.json(
      { error: `Maximum of ${ENTRY_CAPS.skills} skill categories reached` },
      { status: 400 }
    );
  }

  const validation = await validateBody(request, skillCreateSchema);
  if (!validation.success) return validation.response;

  const maxSort = await prisma.resumeSkill.aggregate({
    where: { resumeSourceId },
    _max: { sortOrder: true },
  });

  const skill = await prisma.resumeSkill.create({
    data: {
      resumeSourceId,
      category: validation.data.category,
      items: validation.data.items,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json(skill, { status: 201 });
});
