import { prisma } from "@/lib/prisma";
import { createReorderHandler } from "@/lib/resume-source-helpers";

export const PUT = createReorderHandler("resumeSkill", (resumeSourceId) =>
  prisma.resumeSkill.findMany({ where: { resumeSourceId }, select: { id: true } })
);
