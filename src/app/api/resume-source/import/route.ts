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

  console.log("[import] parsed:", {
    contact: parsed.contact.fullName,
    education: parsed.education.length,
    experiences: parsed.experiences.length,
    skills: parsed.skills.length,
    publications: parsed.publications.length,
    customSections: parsed.customSections.length,
  });

  let step = "init";
  const resumeSource = await prisma.$transaction(async (tx) => {
    step = "upsert";
    const rs = await tx.resumeSource.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: { id: true },
    });

    step = "delete-children";
    await tx.resumeContact.deleteMany({ where: { resumeSourceId: rs.id } });
    await tx.resumeEducation.deleteMany({ where: { resumeSourceId: rs.id } });
    await tx.resumeWorkExperience.deleteMany({ where: { resumeSourceId: rs.id } });
    await tx.resumeSkill.deleteMany({ where: { resumeSourceId: rs.id } });
    await tx.resumePublication.deleteMany({ where: { resumeSourceId: rs.id } });
    await tx.resumeCustomSection.deleteMany({ where: { resumeSourceId: rs.id } });

    step = "create-contact";
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

    step = "create-education";
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

    step = "create-experiences";
    for (let i = 0; i < parsed.experiences.length; i++) {
      const exp = parsed.experiences[i];
      step = `create-experience-${i}(${exp.company})`;
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
        step = `create-subsection-${i}.${j}(${sub.label})`;
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

    step = "create-skills";
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

    step = "create-publications";
    for (let i = 0; i < parsed.publications.length; i++) {
      const pub = parsed.publications[i];
      step = `create-publication-${i}(${pub.title.substring(0, 30)})`;
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

    step = "create-custom-sections";
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

    step = "update-misc";
    await tx.resumeSource.update({
      where: { id: rs.id },
      data: { miscellaneous: parsed.miscellaneous },
    });

    step = "final-query";
    return tx.resumeSource.findUniqueOrThrow({
      where: { id: rs.id },
      include: fullInclude,
    });
  }).catch((err) => {
    console.error(`[import] FAILED at step: ${step}`, err);
    throw err;
  });

  return NextResponse.json(resumeSource);
});
