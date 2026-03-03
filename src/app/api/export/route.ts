import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const GET = authenticatedHandler(async (_request, { userId }) => {
  const [resumeSource, columns] = await Promise.all([
    prisma.resumeSource.findUnique({
      where: { userId },
      include: {
        contact: true,
        education: { orderBy: { sortOrder: "asc" } },
        experiences: {
          orderBy: { sortOrder: "asc" },
          include: { subsections: { orderBy: { sortOrder: "asc" } } },
        },
        skills: { orderBy: { sortOrder: "asc" } },
        publications: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.kanbanColumn.findMany({
      where: { userId },
      orderBy: { order: "asc" },
      include: {
        applications: {
          orderBy: { columnOrder: "asc" },
          include: {
            interviews: { orderBy: { sortOrder: "asc" } },
            notes: { orderBy: { createdAt: "desc" } },
            resumeGenerations: {
              orderBy: { createdAt: "desc" },
              select: {
                markdownOutput: true,
                promptTokens: true,
                completionTokens: true,
                estimatedCost: true,
                modelId: true,
                createdAt: true,
              },
            },
          },
        },
      },
    }),
  ]);

  // Strip internal IDs from export data
  const exportData = {
    exportedAt: new Date().toISOString(),
    resumeSource: resumeSource
      ? {
          contact: resumeSource.contact
            ? {
                fullName: resumeSource.contact.fullName,
                email: resumeSource.contact.email,
                phone: resumeSource.contact.phone,
                location: resumeSource.contact.location,
                linkedIn: resumeSource.contact.linkedIn,
                website: resumeSource.contact.website,
                summary: resumeSource.contact.summary,
              }
            : null,
          education: resumeSource.education.map((e) => ({
            institution: e.institution,
            degree: e.degree,
            fieldOfStudy: e.fieldOfStudy,
            startDate: e.startDate,
            endDate: e.endDate,
            gpa: e.gpa,
            honors: e.honors,
            notes: e.notes,
          })),
          experiences: resumeSource.experiences.map((exp) => ({
            company: exp.company,
            title: exp.title,
            location: exp.location,
            startDate: exp.startDate,
            endDate: exp.endDate,
            description: exp.description,
            subsections: exp.subsections.map((s) => ({
              label: s.label,
              bullets: s.bullets,
            })),
          })),
          skills: resumeSource.skills.map((s) => ({
            category: s.category,
            items: s.items,
          })),
          publications: resumeSource.publications.map((p) => ({
            title: p.title,
            publisher: p.publisher,
            date: p.date,
            url: p.url,
            description: p.description,
          })),
        }
      : null,
    columns: columns.map((col) => ({
      name: col.name,
      color: col.color,
      columnType: col.columnType,
      applications: col.applications.map((app) => ({
        serialNumber: app.serialNumber,
        company: app.company,
        role: app.role,
        hiringManager: app.hiringManager,
        hiringOrg: app.hiringOrg,
        postingNumber: app.postingNumber,
        postingUrl: app.postingUrl,
        locationType: app.locationType,
        primaryLocation: app.primaryLocation,
        additionalLocations: app.additionalLocations,
        salaryMin: app.salaryMin,
        salaryMax: app.salaryMax,
        bonusTargetPct: app.bonusTargetPct,
        variableComp: app.variableComp,
        referrals: app.referrals,
        datePosted: app.datePosted,
        dateApplied: app.dateApplied,
        rejectionDate: app.rejectionDate,
        closedReason: app.closedReason,
        jobDescription: app.jobDescription,
        createdAt: app.createdAt,
        interviews: app.interviews.map((i) => ({
          type: i.type,
          format: i.format,
          people: i.people,
          date: i.date,
          notes: i.notes,
        })),
        notes: app.notes.map((n) => ({
          content: n.content,
          createdAt: n.createdAt,
        })),
        resumeGenerations: app.resumeGenerations.map((g) => ({
          markdownOutput: g.markdownOutput,
          promptTokens: g.promptTokens,
          completionTokens: g.completionTokens,
          estimatedCost: g.estimatedCost,
          modelId: g.modelId,
          createdAt: g.createdAt,
        })),
      })),
    })),
  };

  const date = new Date().toISOString().split("T")[0];

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="job-seeker-export-${date}.json"`,
    },
  });
}, { rateLimit: "export" });
