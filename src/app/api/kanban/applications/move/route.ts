import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validations";
import { moveApplicationSchema } from "@/lib/validations/kanban";

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const validation = await validateBody(request, moveApplicationSchema);
  if (!validation.success) return validation.response;
  const { id, columnId, newOrder, rejectionDate, closedReason } = validation.data;

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

    // Handle closed column moves
    if (isMovingColumns && targetColumn.columnType === "CLOSED") {
      if (rejectionDate) {
        updateData.rejectionDate = new Date(rejectionDate);
      }
      if (closedReason) {
        updateData.closedReason = closedReason;
      }
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
}
