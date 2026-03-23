import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validations";
import { createColumnSchema } from "@/lib/validations/kanban";
import { DEFAULT_COLUMNS } from "@/lib/kanban-utils";

export const GET = authenticatedHandler(async (_request, { userId }) => {
  let columns = await prisma.kanbanColumn.findMany({
    where: { userId },
    orderBy: { order: "asc" },
    include: {
      applications: {
        orderBy: { columnOrder: "asc" },
        include: {
          _count: { select: { interviews: true, notes: true } },
          statusLogs: {
            orderBy: { movedAt: "desc" },
            take: 1,
            select: { movedAt: true },
          },
          notes: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
          interviews: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
          resumeGenerations: {
            where: { reviewJson: { not: null } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { reviewJson: true },
          },
          scrapedJob: { select: { removedAt: true } },
        },
      },
    },
  });

  // Auto-seed default columns on first visit
  if (columns.length === 0) {
    // Verify user exists before seeding (JWT may outlive the DB row)
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!userExists) {
      return NextResponse.json(
        { error: "User not found. Please sign out and sign back in." },
        { status: 401 }
      );
    }

    await prisma.kanbanColumn.createMany({
      data: DEFAULT_COLUMNS.map((col) => ({
        userId,
        name: col.name,
        order: col.order,
        color: col.color,
        columnType: col.columnType,
      })),
      skipDuplicates: true,
    });

    columns = await prisma.kanbanColumn.findMany({
      where: { userId },
      orderBy: { order: "asc" },
      include: {
        applications: {
          orderBy: { columnOrder: "asc" },
          include: {
            _count: { select: { interviews: true, notes: true } },
            statusLogs: {
              orderBy: { movedAt: "desc" },
              take: 1,
              select: { movedAt: true },
            },
            notes: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { createdAt: true },
            },
            interviews: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { createdAt: true },
            },
            resumeGenerations: {
              where: { reviewJson: { not: null } },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { reviewJson: true },
            },
            scrapedJob: { select: { removedAt: true } },
          },
        },
      },
    });
  }

  return NextResponse.json(columns);
});

export const POST = authenticatedHandler(async (request, { userId }) => {
  const validation = await validateBody(request, createColumnSchema);
  if (!validation.success) return validation.response;
  const { name, color } = validation.data;

  // Max 12 columns per user
  const count = await prisma.kanbanColumn.count({ where: { userId } });
  if (count >= 12) {
    return NextResponse.json(
      { error: "Maximum of 12 columns allowed" },
      { status: 400 }
    );
  }

  // Assign next order
  const maxOrder = await prisma.kanbanColumn.aggregate({
    where: { userId },
    _max: { order: true },
  });
  const nextOrder = (maxOrder._max.order ?? -1) + 1;

  const column = await prisma.kanbanColumn.create({
    data: { userId, name, color, order: nextOrder },
  });

  return NextResponse.json(column, { status: 201 });
});
