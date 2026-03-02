import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { getResumeSourceId } from "@/lib/resume-source-helpers";
import { ENTRY_CAPS } from "@/lib/validations/resume-source";

export const POST = authenticatedHandler(async (_request, { userId }) => {
  const resumeSourceId = await getResumeSourceId(userId);

  const count = await prisma.resumeEducation.count({ where: { resumeSourceId } });
  if (count >= ENTRY_CAPS.education) {
    return NextResponse.json(
      { error: `Maximum of ${ENTRY_CAPS.education} education entries reached` },
      { status: 400 }
    );
  }

  const maxSort = await prisma.resumeEducation.aggregate({
    where: { resumeSourceId },
    _max: { sortOrder: true },
  });

  const education = await prisma.resumeEducation.create({
    data: {
      resumeSourceId,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json(education, { status: 201 });
});
