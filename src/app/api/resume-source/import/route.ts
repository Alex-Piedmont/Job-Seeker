import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { validateBody } from "@/lib/validations";
import { importSchema } from "@/lib/validations/resume-source";
import { prisma } from "@/lib/prisma";
import { parseResumeMarkdown } from "@/lib/resume-parser";
import { fullInclude } from "@/app/api/resume-source/route";

export const POST = authenticatedHandler(async (request, { userId }) => {
  const validation = await validateBody(request, importSchema);
  if (!validation.success) return validation.response;

  const parsed = parseResumeMarkdown(validation.data.markdown);

  const resumeSource = await prisma.$transaction(async (tx) => {
    // Upsert ResumeSource (handles users who haven't visited the page)
    const rs = await tx.resumeSource.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: { id: true },
    });

    // Delete all existing child records
    await tx.resumeContact.deleteMany({ where: { resumeSourceId: rs.id } });
    await tx.resumeEducation.deleteMany({ where: { resumeSourceId: rs.id } });
    await tx.resumeWorkExperience.deleteMany({ where: { resumeSourceId: rs.id } });
    await tx.resumeSkill.deleteMany({ where: { resumeSourceId: rs.id } });
    await tx.resumePublication.deleteMany({ where: { resumeSourceId: rs.id } });
    await tx.resumeCustomSection.deleteMany({ where: { resumeSourceId: rs.id } });

    // Create contact
    await tx.resumeContact.create({
      data: {
        resumeSourceId: rs.id,
        fullName: parsed.contact.fullName,
        email: parsed.contact.email,
        phone: parsed.contact.phone,
        location: parsed.contact.location,
        linkedIn: parsed.contact.linkedIn,
        website: parsed.contact.website,
        summary: parsed.contact.summary,
      },
    });

    // Create education entries
    for (let i = 0; i < parsed.education.length; i++) {
      const edu = parsed.education[i];
      await tx.resumeEducation.create({
        data: {
          resumeSourceId: rs.id,
          institution: edu.institution,
          degree: edu.degree,
          fieldOfStudy: edu.fieldOfStudy,
          startDate: edu.startDate,
          endDate: edu.endDate,
          gpa: edu.gpa,
          honors: edu.honors,
          notes: edu.notes,
          sortOrder: i,
        },
      });
    }

    // Create experience entries with subsections
    for (let i = 0; i < parsed.experiences.length; i++) {
      const exp = parsed.experiences[i];
      const experience = await tx.resumeWorkExperience.create({
        data: {
          resumeSourceId: rs.id,
          company: exp.company,
          title: exp.title,
          location: exp.location,
          startDate: exp.startDate,
          endDate: exp.endDate,
          description: exp.description,
          sortOrder: i,
        },
      });

      for (let j = 0; j < exp.subsections.length; j++) {
        const sub = exp.subsections[j];
        await tx.resumeWorkSubsection.create({
          data: {
            workExperienceId: experience.id,
            label: sub.label,
            bullets: sub.bullets,
            sortOrder: j,
          },
        });
      }
    }

    // Create skill entries
    for (let i = 0; i < parsed.skills.length; i++) {
      const skill = parsed.skills[i];
      await tx.resumeSkill.create({
        data: {
          resumeSourceId: rs.id,
          category: skill.category,
          items: skill.items,
          sortOrder: i,
        },
      });
    }

    // Create publication entries
    for (let i = 0; i < parsed.publications.length; i++) {
      const pub = parsed.publications[i];
      await tx.resumePublication.create({
        data: {
          resumeSourceId: rs.id,
          title: pub.title,
          publisher: pub.publisher,
          date: pub.date,
          url: pub.url,
          description: pub.description,
          sortOrder: i,
        },
      });
    }

    // Create custom sections
    for (let i = 0; i < parsed.customSections.length; i++) {
      const section = parsed.customSections[i];
      await tx.resumeCustomSection.create({
        data: {
          resumeSourceId: rs.id,
          title: section.title,
          content: section.content,
          sortOrder: i,
        },
      });
    }

    // Update miscellaneous
    await tx.resumeSource.update({
      where: { id: rs.id },
      data: { miscellaneous: parsed.miscellaneous },
    });

    // Return full data
    return tx.resumeSource.findUniqueOrThrow({
      where: { id: rs.id },
      include: fullInclude,
    });
  });

  return NextResponse.json(resumeSource);
});
