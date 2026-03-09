import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validations";
import { createApplicationSchema } from "@/lib/validations/kanban";
import { withSerialNumber } from "@/lib/serial-number";

export const POST = authenticatedHandler(async (request, { userId }) => {
  const validation = await validateBody(request, createApplicationSchema);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Validate columnId belongs to this user
  const column = await prisma.kanbanColumn.findFirst({
    where: { id: data.columnId, userId },
  });
  if (!column) {
    return NextResponse.json({ error: "Column not found" }, { status: 404 });
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
      { error: "Application limit reached", count: appCount, cap: user.applicationCap },
      { status: 403 }
    );
  }

  // Auto-set dateApplied when creating in the Applied column
  let dateApplied = data.dateApplied ? new Date(data.dateApplied) : null;
  if (!dateApplied && column.name.toLowerCase() === "applied") {
    dateApplied = new Date();
  }

  const application = await withSerialNumber(userId, async (tx, serialNumber) => {
    // Get max columnOrder in target column
    const maxOrder = await tx.jobApplication.aggregate({
      where: { columnId: data.columnId },
      _max: { columnOrder: true },
    });
    const columnOrder = (maxOrder._max.columnOrder ?? -1) + 1;

    const app = await tx.jobApplication.create({
      data: {
        userId,
        serialNumber,
        columnId: data.columnId,
        columnOrder,
        company: data.company,
        role: data.role,
        hiringManager: data.hiringManager ?? null,
        hiringOrg: data.hiringOrg ?? null,
        postingNumber: data.postingNumber ?? null,
        postingUrl: data.postingUrl ?? null,
        locationType: data.locationType ?? null,
        primaryLocation: data.primaryLocation ?? null,
        additionalLocations: data.additionalLocations ?? null,
        salaryMin: data.salaryMin ?? null,
        salaryMax: data.salaryMax ?? null,
        bonusTargetPct: data.bonusTargetPct ?? null,
        variableComp: data.variableComp ?? null,
        referrals: data.referrals ?? null,
        datePosted: data.datePosted ? new Date(data.datePosted) : null,
        dateApplied,
        jobDescription: data.jobDescription ?? null,
      },
    });

    // Create initial status log
    await tx.applicationStatusLog.create({
      data: {
        jobApplicationId: app.id,
        fromColumnId: null,
        toColumnId: data.columnId,
      },
    });

    return app;
  });

  return NextResponse.json(application, { status: 201 });
});
