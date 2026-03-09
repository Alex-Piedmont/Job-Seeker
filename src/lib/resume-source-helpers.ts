import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { validateBody } from "@/lib/validations";
import { reorderSchema } from "@/lib/validations/resume-source";
import { prisma } from "@/lib/prisma";

/**
 * Get or create the user's ResumeSource, returning just the id.
 */
export async function getResumeSourceId(userId: string): Promise<string> {
  const rs = await prisma.resumeSource.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { id: true },
  });
  return rs.id;
}

/**
 * Verify an education entry belongs to the given user.
 * Returns the education record or null.
 */
export async function verifyEducationOwnership(id: string, userId: string) {
  return prisma.resumeEducation.findFirst({
    where: {
      id,
      resumeSource: { userId },
    },
  });
}

/**
 * Verify an experience entry belongs to the given user.
 */
export async function verifyExperienceOwnership(id: string, userId: string) {
  return prisma.resumeWorkExperience.findFirst({
    where: {
      id,
      resumeSource: { userId },
    },
  });
}

/**
 * Verify a subsection belongs to the given user via its experience.
 */
export async function verifySubsectionOwnership(
  subId: string,
  experienceId: string,
  userId: string
) {
  return prisma.resumeWorkSubsection.findFirst({
    where: {
      id: subId,
      workExperienceId: experienceId,
      workExperience: { resumeSource: { userId } },
    },
  });
}

/**
 * Verify a skill entry belongs to the given user.
 */
export async function verifySkillOwnership(id: string, userId: string) {
  return prisma.resumeSkill.findFirst({
    where: {
      id,
      resumeSource: { userId },
    },
  });
}

/**
 * Verify a publication entry belongs to the given user.
 */
export async function verifyPublicationOwnership(id: string, userId: string) {
  return prisma.resumePublication.findFirst({
    where: {
      id,
      resumeSource: { userId },
    },
  });
}

/**
 * Verify a custom section entry belongs to the given user.
 */
export async function verifyCustomSectionOwnership(id: string, userId: string) {
  return prisma.resumeCustomSection.findFirst({
    where: {
      id,
      resumeSource: { userId },
    },
  });
}

/**
 * Generic reorder: updates sortOrder for each id in the array.
 */
export async function reorderEntries(
  model: "resumeEducation" | "resumeWorkExperience" | "resumeWorkSubsection" | "resumeSkill" | "resumePublication" | "resumeCustomSection",
  ids: string[]
) {
  await prisma.$transaction(
    ids.map((id, index) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma[model] as any).update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );
}

type ReorderModel = Parameters<typeof reorderEntries>[0];

/**
 * Factory for reorder route handlers. Each reorder route validates IDs,
 * verifies ownership, appends missing IDs, and calls reorderEntries.
 */
export function createReorderHandler(
  model: ReorderModel,
  findMany: (resumeSourceId: string) => Promise<{ id: string }[]>
) {
  return authenticatedHandler(async (request, { userId }) => {
    const validation = await validateBody(request, reorderSchema);
    if (!validation.success) return validation.response;

    const resumeSourceId = await getResumeSourceId(userId);

    const entries = await findMany(resumeSourceId);
    const validIds = new Set(entries.map((e) => e.id));
    const requestedIds = validation.data.ids.filter((id) => validIds.has(id));
    const missingIds = entries
      .map((e) => e.id)
      .filter((id) => !requestedIds.includes(id));
    const finalIds = [...requestedIds, ...missingIds];

    await reorderEntries(model, finalIds);

    return NextResponse.json({ success: true });
  });
}
