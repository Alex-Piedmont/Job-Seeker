import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { validateBody } from "@/lib/validations";
import { customSectionCreateSchema, ENTRY_CAPS } from "@/lib/validations/resume-source";
import { prisma } from "@/lib/prisma";
import { getResumeSourceId } from "@/lib/resume-source-helpers";

export const POST = authenticatedHandler(async (request, { userId }) => {
  const resumeSourceId = await getResumeSourceId(userId);

  const count = await prisma.resumeCustomSection.count({ where: { resumeSourceId } });
  if (count >= ENTRY_CAPS.customSections) {
    return NextResponse.json(
      { error: `Maximum of ${ENTRY_CAPS.customSections} custom sections reached` },
      { status: 400 }
    );
  }

  const validation = await validateBody(request, customSectionCreateSchema);
  if (!validation.success) return validation.response;

  const maxSort = await prisma.resumeCustomSection.aggregate({
    where: { resumeSourceId },
    _max: { sortOrder: true },
  });

  const section = await prisma.resumeCustomSection.create({
    data: {
      resumeSourceId,
      title: validation.data.title,
      content: validation.data.content,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json(section, { status: 201 });
});
