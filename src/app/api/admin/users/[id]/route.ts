import { NextResponse } from "next/server";
import { adminHandler } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const GET = adminHandler(async (_request, { params }) => {
  const { id } = params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      applicationCap: true,
      resumeGenerationCap: true,
      resumeGenerationsUsedThisMonth: true,
      lastActiveAt: true,
      createdAt: true,
      _count: {
        select: {
          jobApplications: true,
          resumeGenerations: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const costAgg = await prisma.resumeGeneration.aggregate({
    where: { userId: id },
    _sum: { estimatedCost: true },
  });

  return Response.json({
    ...user,
    applicationCount: user._count.jobApplications,
    totalResumeGenerations: user._count.resumeGenerations,
    estimatedTotalCost: Math.round((costAgg._sum.estimatedCost ?? 0) * 100) / 100,
  });
});
