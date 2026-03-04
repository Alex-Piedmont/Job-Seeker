import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const GET = authenticatedHandler(async (_request, { userId, params }) => {
  const { appId } = params;

  // Verify application ownership
  const application = await prisma.jobApplication.findFirst({
    where: { id: appId, userId },
    select: { id: true },
  });

  if (!application) {
    return NextResponse.json(
      { error: "Application not found" },
      { status: 404 }
    );
  }

  const generations = await prisma.resumeGeneration.findMany({
    where: { jobApplicationId: appId, userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      markdownOutput: true,
      promptTokens: true,
      completionTokens: true,
      estimatedCost: true,
      parentGenerationId: true,
      reviewJson: true,
      createdAt: true,
    },
  });

  return Response.json(generations);
});
