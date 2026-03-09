import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validations";
import { reorderColumnsSchema } from "@/lib/validations/kanban";

export const PUT = authenticatedHandler(async (request, { userId }) => {
  const validation = await validateBody(request, reorderColumnsSchema);
  if (!validation.success) return validation.response;
  const { ids } = validation.data;

  // Verify all columns belong to this user
  const columns = await prisma.kanbanColumn.findMany({
    where: { userId },
    select: { id: true },
  });
  const userColumnIds = new Set(columns.map((c) => c.id));
  for (const id of ids) {
    if (!userColumnIds.has(id)) {
      return NextResponse.json(
        { error: "Column not found" },
        { status: 404 }
      );
    }
  }

  // Update order for each column
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.kanbanColumn.update({
        where: { id },
        data: { order: index },
      })
    )
  );

  return NextResponse.json({ success: true });
});
