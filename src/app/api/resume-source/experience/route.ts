import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { getResumeSourceId } from "@/lib/resume-source-helpers";
import { ENTRY_CAPS } from "@/lib/validations/resume-source";

export const POST = authenticatedHandler(async (_request, { userId }) => {
  const resumeSourceId = await getResumeSourceId(userId);

  const count = await prisma.resumeWorkExperience.count({ where: { resumeSourceId } });
  if (count >= ENTRY_CAPS.experience) {
    return NextResponse.json(
      { error: `Maximum of ${ENTRY_CAPS.experience} experience entries reached` },
      { status: 400 }
    );
  }

  const maxSort = await prisma.resumeWorkExperience.aggregate({
    where: { resumeSourceId },
    _max: { sortOrder: true },
  });

  const experience = await prisma.resumeWorkExperience.create({
    data: {
      resumeSourceId,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
    include: { subsections: true },
  });

  return NextResponse.json(experience, { status: 201 });
});
