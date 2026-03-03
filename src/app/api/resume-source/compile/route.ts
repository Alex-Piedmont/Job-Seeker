import { authenticatedHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { compileResumeSource } from "@/lib/resume-compiler";

export const GET = authenticatedHandler(async (_request, { userId }) => {
  const resumeSource = await prisma.resumeSource.findUnique({
    where: { userId },
    include: {
      contact: true,
      education: { orderBy: { sortOrder: "asc" } },
      experiences: {
        orderBy: { sortOrder: "asc" },
        include: {
          subsections: { orderBy: { sortOrder: "asc" } },
        },
      },
      skills: { orderBy: { sortOrder: "asc" } },
      publications: { orderBy: { sortOrder: "asc" } },
      customSections: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!resumeSource) {
    return Response.json({ markdown: "", updatedAt: null });
  }

  const markdown = compileResumeSource({
    contact: resumeSource.contact,
    education: resumeSource.education,
    experiences: resumeSource.experiences,
    skills: resumeSource.skills,
    publications: resumeSource.publications,
    customSections: resumeSource.customSections,
    miscellaneous: resumeSource.miscellaneous,
  });

  return Response.json({
    markdown,
    updatedAt: resumeSource.updatedAt,
  });
});
