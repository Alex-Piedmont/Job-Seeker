import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validations";
import { updateColumnSchema } from "@/lib/validations/kanban";

export const PUT = authenticatedHandler(async (request, { userId, params }) => {
  const { id } = params;

  const validation = await validateBody(request, updateColumnSchema);
  if (!validation.success) return validation.response;

  const column = await prisma.kanbanColumn.findFirst({
    where: { id, userId },
  });
  if (!column) {
    return NextResponse.json({ error: "Column not found" }, { status: 404 });
  }

  const updated = await prisma.kanbanColumn.update({
    where: { id },
    data: validation.data,
  });

  return NextResponse.json(updated);
});

export const DELETE = authenticatedHandler(async (_request, { userId, params }) => {
  const { id } = params;

  const column = await prisma.kanbanColumn.findFirst({
    where: { id, userId },
  });
  if (!column) {
    return NextResponse.json({ error: "Column not found" }, { status: 404 });
  }

  // Block deletion of the last column
  const columnCount = await prisma.kanbanColumn.count({ where: { userId } });
  if (columnCount <= 1) {
    return NextResponse.json(
      { error: "Cannot delete the last column" },
      { status: 409 }
    );
  }

  // Block deletion if column has applications
  const appCount = await prisma.jobApplication.count({
    where: { columnId: id },
  });
  if (appCount > 0) {
    return NextResponse.json(
      { error: "Column is not empty. Move or delete all applications first." },
      { status: 409 }
    );
  }

  await prisma.kanbanColumn.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
});
