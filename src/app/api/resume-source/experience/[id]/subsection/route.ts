import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { validateBody } from "@/lib/validations";
import { subsectionCreateSchema, ENTRY_CAPS } from "@/lib/validations/resume-source";
import { prisma } from "@/lib/prisma";
import { verifyExperienceOwnership } from "@/lib/resume-source-helpers";

export const POST = authenticatedHandler(async (request, { userId, params }) => {
  const experience = await verifyExperienceOwnership(params.id, userId);
  if (!experience) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const count = await prisma.resumeWorkSubsection.count({
    where: { workExperienceId: params.id },
  });
  if (count >= ENTRY_CAPS.subsections) {
    return NextResponse.json(
      { error: `Maximum of ${ENTRY_CAPS.subsections} subsections per experience reached` },
      { status: 400 }
    );
  }

  const validation = await validateBody(request, subsectionCreateSchema);
  if (!validation.success) return validation.response;

  const maxSort = await prisma.resumeWorkSubsection.aggregate({
    where: { workExperienceId: params.id },
    _max: { sortOrder: true },
  });

  const subsection = await prisma.resumeWorkSubsection.create({
    data: {
      workExperienceId: params.id,
      label: validation.data.label,
      bullets: validation.data.bullets,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json(subsection, { status: 201 });
});
