import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validations";
import { moveApplicationSchema } from "@/lib/validations/kanban";

export const PUT = authenticatedHandler(async (request, { userId }) => {
  const validation = await validateBody(request, moveApplicationSchema);
  if (!validation.success) return validation.response;
  const { id, columnId, newOrder, rejectionDate, closedReason, isGhosted } = validation.data;

  // Validate application belongs to user
  const application = await prisma.jobApplication.findFirst({
    where: { id, userId },
  });
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  // Validate target column belongs to user
  const targetColumn = await prisma.kanbanColumn.findFirst({
    where: { id: columnId, userId },
  });
  if (!targetColumn) {
    return NextResponse.json({ error: "Column not found" }, { status: 404 });
  }

  const fromColumnId = application.columnId;
  const isMovingColumns = fromColumnId !== columnId;

  await prisma.$transaction(async (tx) => {
    // Build update data
    const updateData: Record<string, unknown> = {
      columnId,
      columnOrder: newOrder,
    };

    // Auto-set dateApplied when moving to "Applied" column
    if (
      isMovingColumns &&
      targetColumn.name.toLowerCase() === "applied" &&
      !application.dateApplied
    ) {
      updateData.dateApplied = new Date();
    }

    // Handle closed column moves — default rejection date to today if not provided
    if (isMovingColumns && targetColumn.columnType === "CLOSED") {
      if (!application.rejectionDate) {
        updateData.rejectionDate = rejectionDate
          ? new Date(rejectionDate)
          : new Date();
      }
      if (closedReason) {
        updateData.closedReason = closedReason;
      }
    }

    // Pass through isGhosted if provided
    if (isGhosted !== undefined) {
      updateData.isGhosted = isGhosted;
    }

    // Update the application
    await tx.jobApplication.update({
      where: { id },
      data: updateData,
    });

    // Reorder cards in target column (shift cards at or after newOrder)
    if (isMovingColumns) {
      await tx.jobApplication.updateMany({
        where: {
          columnId,
          id: { not: id },
          columnOrder: { gte: newOrder },
        },
        data: { columnOrder: { increment: 1 } },
      });
    }

    // Append status log for column changes
    if (isMovingColumns) {
      await tx.applicationStatusLog.create({
        data: {
          jobApplicationId: id,
          fromColumnId,
          toColumnId: columnId,
        },
      });
    }
  });

  const updated = await prisma.jobApplication.findUnique({
    where: { id },
    include: {
      column: { select: { id: true, name: true, columnType: true } },
    },
  });

  return NextResponse.json(updated);
});
