import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validations";
import { withSerialNumber } from "@/lib/serial-number";

const importSchema = z.object({
  scrapedJobId: z.string().min(1),
});

export const POST = authenticatedHandler(async (request, { userId }) => {
  const validation = await validateBody(request, importSchema);
  if (!validation.success) return validation.response;
  const { scrapedJobId } = validation.data;

  // Fetch scraped job with company
  const scrapedJob = await prisma.scrapedJob.findUnique({
    where: { id: scrapedJobId },
    include: { company: true },
  });
  if (!scrapedJob) {
    return NextResponse.json(
      { error: "Scraped job not found" },
      { status: 404 }
    );
  }

  // Check for duplicate import
  const existing = await prisma.jobApplication.findFirst({
    where: { userId, scrapedJobId },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Job already imported", applicationId: existing.id },
      { status: 409 }
    );
  }

  // Cap enforcement
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { applicationCap: true, role: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const appCount = await prisma.jobApplication.count({ where: { userId } });
  if (appCount >= user.applicationCap && user.role !== "ADMIN") {
    return NextResponse.json(
      {
        error: "Application limit reached",
        count: appCount,
        cap: user.applicationCap,
      },
      { status: 403 }
    );
  }

  // Find user's "Saved" column (order: 0)
  const savedColumn = await prisma.kanbanColumn.findFirst({
    where: { userId, order: 0 },
  });
  if (!savedColumn) {
    return NextResponse.json(
      { error: "Saved column not found" },
      { status: 404 }
    );
  }

  // Parse locations from JSON field
  const locations = (
    Array.isArray(scrapedJob.locations) ? scrapedJob.locations : []
  ) as string[];
  const primaryLocation = locations[0] ?? null;
  const additionalLocations =
    locations.length > 1 ? locations.slice(1).join(", ") : null;

  const application = await withSerialNumber(userId, async (tx, serialNumber) => {
    // Shift existing apps in Saved column down to make room at top
    await tx.jobApplication.updateMany({
      where: { columnId: savedColumn.id },
      data: { columnOrder: { increment: 1 } },
    });

    const app = await tx.jobApplication.create({
      data: {
        userId,
        serialNumber,
        columnId: savedColumn.id,
        columnOrder: 0,
        company: scrapedJob.company.name,
        role: scrapedJob.title,
        primaryLocation,
        additionalLocations,
        salaryMin: scrapedJob.salaryMin,
        salaryMax: scrapedJob.salaryMax,
        jobDescription: scrapedJob.jobDescriptionMd,
        postingUrl: scrapedJob.url,
        scrapedJobId: scrapedJob.id,
        locationType: scrapedJob.locationType,
        hiringOrg: scrapedJob.department,
      },
    });

    // Create initial status log
    await tx.applicationStatusLog.create({
      data: {
        jobApplicationId: app.id,
        fromColumnId: null,
        toColumnId: savedColumn.id,
      },
    });

    return app;
  });

  return NextResponse.json(application, { status: 201 });
});
