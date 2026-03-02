import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { validateBody } from "@/lib/validations";
import { publicationCreateSchema, ENTRY_CAPS } from "@/lib/validations/resume-source";
import { prisma } from "@/lib/prisma";
import { getResumeSourceId } from "@/lib/resume-source-helpers";

export const POST = authenticatedHandler(async (request, { userId }) => {
  const resumeSourceId = await getResumeSourceId(userId);

  const count = await prisma.resumePublication.count({ where: { resumeSourceId } });
  if (count >= ENTRY_CAPS.publications) {
    return NextResponse.json(
      { error: `Maximum of ${ENTRY_CAPS.publications} publication entries reached` },
      { status: 400 }
    );
  }

  const validation = await validateBody(request, publicationCreateSchema);
  if (!validation.success) return validation.response;

  const maxSort = await prisma.resumePublication.aggregate({
    where: { resumeSourceId },
    _max: { sortOrder: true },
  });

  const publication = await prisma.resumePublication.create({
    data: {
      resumeSourceId,
      ...validation.data,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json(publication, { status: 201 });
});
