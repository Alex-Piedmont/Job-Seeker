import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { validateBody } from "@/lib/validations";
import { reviewResumeSchema } from "@/lib/validations/resume";
import { prisma } from "@/lib/prisma";
import { callWithTool, estimateCost } from "@/lib/anthropic";
import {
  REVIEW_SYSTEM,
  REVIEW_TOOL,
  buildReviewUserMessage,
  type ReviewResult,
} from "@/lib/resume-prompts/review";

export const maxDuration = 60;

export const POST = authenticatedHandler(async (request, { userId }) => {
  const validation = await validateBody(request, reviewResumeSchema);
  if (!validation.success) return validation.response;

  const { jobApplicationId, resumeMarkdown, generationId } = validation.data;

  const application = await prisma.jobApplication.findFirst({
    where: { id: jobApplicationId, userId },
    select: { id: true, jobDescription: true },
  });

  if (!application) {
    return NextResponse.json(
      { error: "Application not found" },
      { status: 404 }
    );
  }

  if (!application.jobDescription?.trim()) {
    return NextResponse.json(
      { error: "Job description is required for review" },
      { status: 400 }
    );
  }

  const result = await callWithTool<ReviewResult>(
    REVIEW_SYSTEM,
    buildReviewUserMessage(resumeMarkdown, application.jobDescription),
    REVIEW_TOOL,
    { model: "claude-haiku-4-5-20251001" }
  );

  const cost = estimateCost(result.promptTokens, result.completionTokens);

  // Persist review to the generation record
  if (generationId) {
    await prisma.resumeGeneration.update({
      where: { id: generationId, userId },
      data: { reviewJson: result.data as unknown as Record<string, unknown> },
    });
  }

  await prisma.resumeAuxCall.create({
    data: {
      userId,
      jobApplicationId,
      callType: "review",
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      totalTokens: result.totalTokens,
      estimatedCost: cost,
      modelId: result.modelId,
    },
  });

  return NextResponse.json({
    review: result.data,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    estimatedCost: cost,
  });
}, { rateLimit: "resume-review" });
