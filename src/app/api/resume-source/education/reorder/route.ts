import { prisma } from "@/lib/prisma";
import { createReorderHandler } from "@/lib/resume-source-helpers";

export const PUT = createReorderHandler("resumeEducation", (resumeSourceId) =>
  prisma.resumeEducation.findMany({ where: { resumeSourceId }, select: { id: true } })
);
