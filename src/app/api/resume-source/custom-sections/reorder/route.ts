import { prisma } from "@/lib/prisma";
import { createReorderHandler } from "@/lib/resume-source-helpers";

export const PUT = createReorderHandler("resumeCustomSection", (resumeSourceId) =>
  prisma.resumeCustomSection.findMany({ where: { resumeSourceId }, select: { id: true } })
);
