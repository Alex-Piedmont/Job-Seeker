import { authenticatedHandler } from "@/lib/api-handler";
import { validateBody } from "@/lib/validations";
import { miscellaneousUpdateSchema } from "@/lib/validations/resume-source";
import { prisma } from "@/lib/prisma";
import { getResumeSourceId } from "@/lib/resume-source-helpers";

export const PATCH = authenticatedHandler(async (request, { userId }) => {
  const resumeSourceId = await getResumeSourceId(userId);

  const validation = await validateBody(request, miscellaneousUpdateSchema);
  if (!validation.success) return validation.response;

  const updated = await prisma.resumeSource.update({
    where: { id: resumeSourceId },
    data: { miscellaneous: validation.data.content },
  });

  return Response.json(updated);
});
