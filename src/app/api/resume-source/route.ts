import { authenticatedHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

const fullInclude = {
  contact: true,
  education: { orderBy: { sortOrder: "asc" as const } },
  experiences: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      subsections: { orderBy: { sortOrder: "asc" as const } },
    },
  },
  skills: { orderBy: { sortOrder: "asc" as const } },
  publications: { orderBy: { sortOrder: "asc" as const } },
};

export const GET = authenticatedHandler(async (_request, { userId }) => {
  // Auto-create if missing (FR-5a)
  const resumeSource = await prisma.resumeSource.upsert({
    where: { userId },
    create: { userId },
    update: {},
    include: fullInclude,
  });

  return Response.json(resumeSource);
});

export const PUT = authenticatedHandler(async (_request, { userId }) => {
  const resumeSource = await prisma.resumeSource.upsert({
    where: { userId },
    create: { userId },
    update: { updatedAt: new Date() },
    include: fullInclude,
  });

  return Response.json(resumeSource);
});
