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
 * Generic reorder: updates sortOrder for each id in the array.
 */
export async function reorderEntries(
  model: "resumeEducation" | "resumeWorkExperience" | "resumeWorkSubsection" | "resumeSkill" | "resumePublication",
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
