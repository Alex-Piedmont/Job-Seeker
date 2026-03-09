import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { withSerialNumber } from "@/lib/serial-number";

// Fields to copy when duplicating
const COPY_FIELDS = [
  "company",
  "role",
  "locationType",
  "primaryLocation",
  "additionalLocations",
  "salaryMin",
  "salaryMax",
  "bonusTargetPct",
  "variableComp",
  "hiringOrg",
  "jobDescription",
  "referrals",
] as const;

export const POST = authenticatedHandler(async (_request, { userId, params }) => {
  const { id } = params;

  const original = await prisma.jobApplication.findFirst({
    where: { id, userId },
  });
  if (!original) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
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

  // Build copied fields
  const copiedData: Record<string, unknown> = {};
  for (const field of COPY_FIELDS) {
    copiedData[field] = original[field];
  }

  const duplicate = await withSerialNumber(userId, async (tx, serialNumber) => {
    const maxOrder = await tx.jobApplication.aggregate({
      where: { columnId: original.columnId },
      _max: { columnOrder: true },
    });
    const columnOrder = (maxOrder._max.columnOrder ?? -1) + 1;

    return tx.jobApplication.create({
      data: {
        userId,
        serialNumber,
        columnId: original.columnId,
        columnOrder,
        ...copiedData,
        company: original.company,
        role: original.role,
      },
    });
  });

  return NextResponse.json(duplicate, { status: 201 });
});
