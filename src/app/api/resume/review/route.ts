import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { validateBody } from "@/lib/validations";
import { reviewResumeSchema } from "@/lib/validations/resume";
import { prisma } from "@/lib/prisma";
import { callWithTool, estimateCost } from "@/lib/anthropic";
import {
  REVIEW_SCORECARD_SYSTEM,
  REVIEW_BULLETS_SYSTEM,
  REVIEW_SCORECARD_TOOL,
  REVIEW_BULLETS_TOOL,
  buildReviewUserMessage,
  type ReviewResult,
  type ReviewScorecardResult,
  type ReviewBulletsResult,
} from "@/lib/resume-prompts/review";

export const maxDuration = 120;

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

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

  const userMessage = buildReviewUserMessage(
    resumeMarkdown,
    application.jobDescription
  );

  const [scorecardResult, bulletsResult] = await Promise.all([
    callWithTool<ReviewScorecardResult>(
      REVIEW_SCORECARD_SYSTEM,
      userMessage,
      REVIEW_SCORECARD_TOOL,
      { model: HAIKU_MODEL, maxTokens: 4096 }
    ),
    callWithTool<ReviewBulletsResult>(
      REVIEW_BULLETS_SYSTEM,
      userMessage,
      REVIEW_BULLETS_TOOL,
      { model: HAIKU_MODEL, maxTokens: 4096 }
    ),
  ]);

  const review: ReviewResult = {
    ...scorecardResult.data,
    ...bulletsResult.data,
  };

  const promptTokens =
    scorecardResult.promptTokens + bulletsResult.promptTokens;
  const completionTokens =
    scorecardResult.completionTokens + bulletsResult.completionTokens;
  const totalTokens = promptTokens + completionTokens;
  const cost = estimateCost(promptTokens, completionTokens);

  // Persist review to the generation record
  if (generationId) {
    await prisma.resumeGeneration.update({
      where: { id: generationId, userId },
      data: { reviewJson: JSON.stringify(review) },
    });
  }

  await prisma.resumeAuxCall.create({
    data: {
      userId,
      jobApplicationId,
      callType: "review",
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCost: cost,
      modelId: HAIKU_MODEL,
    },
  });

  return NextResponse.json({
    review,
    promptTokens,
    completionTokens,
    estimatedCost: cost,
  });
}, { rateLimit: "resume-review" });
