import { prisma } from "@/lib/prisma";
import { createReorderHandler } from "@/lib/resume-source-helpers";

export const PUT = createReorderHandler("resumePublication", (resumeSourceId) =>
  prisma.resumePublication.findMany({ where: { resumeSourceId }, select: { id: true } })
);
