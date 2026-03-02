import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validations";
import { reorderColumnsSchema } from "@/lib/validations/kanban";

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

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
}
