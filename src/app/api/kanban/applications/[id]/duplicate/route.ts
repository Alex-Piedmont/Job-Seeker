import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_SERIAL_RETRIES = 3;

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

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

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

  for (let attempt = 0; attempt < MAX_SERIAL_RETRIES; attempt++) {
    try {
      const duplicate = await prisma.$transaction(async (tx) => {
        const max = await tx.jobApplication.aggregate({
          where: { userId },
          _max: { serialNumber: true },
        });
        const serialNumber = (max._max.serialNumber ?? 0) + 1;

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
      }, { isolationLevel: "Serializable" });

      return NextResponse.json(duplicate, { status: 201 });
    } catch (error: unknown) {
      const isUniqueViolation =
        error instanceof Error &&
        "code" in error &&
        (error as { code: string }).code === "P2002";
      if (isUniqueViolation && attempt < MAX_SERIAL_RETRIES - 1) {
        continue;
      }
      throw error;
    }
  }

  return NextResponse.json(
    { error: "Failed to assign serial number" },
    { status: 500 }
  );
}
