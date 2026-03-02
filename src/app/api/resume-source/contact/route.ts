import { authenticatedHandler } from "@/lib/api-handler";
import { validateBody } from "@/lib/validations";
import { contactSchema } from "@/lib/validations/resume-source";
import { prisma } from "@/lib/prisma";

export const PUT = authenticatedHandler(async (request, { userId }) => {
  const validation = await validateBody(request, contactSchema);
  if (!validation.success) return validation.response;

  // Ensure resume source exists
  const resumeSource = await prisma.resumeSource.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  const contact = await prisma.resumeContact.upsert({
    where: { resumeSourceId: resumeSource.id },
    create: {
      resumeSourceId: resumeSource.id,
      ...validation.data,
    },
    update: validation.data,
  });

  return Response.json(contact);
});
