import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { validateBody } from "@/lib/validations";
import { generateResumeSchema } from "@/lib/validations/resume";
import { prisma } from "@/lib/prisma";
import { compileResumeSource } from "@/lib/resume-compiler";
import { reserveGeneration, rollbackGeneration } from "@/lib/resume-cap";
import { buildResumePrompt } from "@/lib/resume-prompt";
import { generateResume, estimateCost } from "@/lib/anthropic";

export const maxDuration = 60;

export const POST = authenticatedHandler(async (request, { userId }) => {
  // 1. Validate input
  const validation = await validateBody(request, generateResumeSchema);
  if (!validation.success) return validation.response;

  const {
    jobApplicationId,
    fitAnalysis,
    userAnswers,
    parentGenerationId,
    revisionContext,
  } = validation.data;

  // 2. Verify ownership and JD presence
  const application = await prisma.jobApplication.findFirst({
    where: { id: jobApplicationId, userId },
    select: { id: true, company: true, role: true, jobDescription: true },
  });

  if (!application) {
    return NextResponse.json(
      { error: "Application not found" },
      { status: 404 }
    );
  }

  if (!application.jobDescription?.trim()) {
    return NextResponse.json(
      { error: "Job description is required to generate a resume" },
      { status: 400 }
    );
  }

  // 3. Compile resume source
  const resumeSource = await prisma.resumeSource.findUnique({
    where: { userId },
    include: {
      contact: true,
      education: { orderBy: { sortOrder: "asc" } },
      experiences: {
        orderBy: { sortOrder: "asc" },
        include: { subsections: { orderBy: { sortOrder: "asc" } } },
      },
      skills: { orderBy: { sortOrder: "asc" } },
      publications: { orderBy: { sortOrder: "asc" } },
      customSections: { orderBy: { sortOrder: "asc" } },
    },
  });

  const resumeMarkdown = resumeSource
    ? compileResumeSource({
        contact: resumeSource.contact,
        education: resumeSource.education,
        experiences: resumeSource.experiences,
        skills: resumeSource.skills,
        publications: resumeSource.publications,
        customSections: resumeSource.customSections,
        miscellaneous: resumeSource.miscellaneous,
      })
    : "";

  if (!resumeMarkdown.trim()) {
    return NextResponse.json(
      { error: "Resume source is empty. Please add your resume details first." },
      { status: 400 }
    );
  }

  // 4. Reserve generation slot (cap check)
  const reserved = await reserveGeneration(userId);
  if (!reserved) {
    return NextResponse.json(
      { error: "Monthly resume generation limit reached" },
      { status: 429 }
    );
  }

  // 5. Build revision context if parentGenerationId provided
  let promptRevisionContext: { previousMarkdown: string; reviewFeedback: string; userNotes?: string } | undefined;
  if (parentGenerationId && revisionContext) {
    const parent = await prisma.resumeGeneration.findFirst({
      where: { id: parentGenerationId, userId },
      select: { markdownOutput: true },
    });
    if (parent) {
      promptRevisionContext = {
        previousMarkdown: parent.markdownOutput,
        reviewFeedback: revisionContext.reviewFeedback,
        userNotes: revisionContext.userNotes,
      };
    }
  }

  // 6. Call Claude — rollback on any failure
  try {
    const { system, user } = buildResumePrompt(
      resumeMarkdown,
      application.jobDescription,
      {
        fitAnalysis,
        userAnswers,
        revisionContext: promptRevisionContext,
      }
    );
    const result = await generateResume(system, user);

    const cost = estimateCost(result.promptTokens, result.completionTokens);

    // 7. Save generation record
    const generation = await prisma.resumeGeneration.create({
      data: {
        userId,
        jobApplicationId,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
        estimatedCost: cost,
        markdownOutput: result.markdown,
        modelId: result.modelId,
        fitAnalysisJson: fitAnalysis ?? null,
        userAnswersJson: userAnswers ? JSON.stringify(userAnswers) : null,
        parentGenerationId: parentGenerationId ?? null,
      },
    });

    return NextResponse.json({
      id: generation.id,
      markdownOutput: result.markdown,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      estimatedCost: cost,
      modelId: result.modelId,
      createdAt: generation.createdAt,
    });
  } catch (error) {
    // Rollback the reserved slot on failure
    await rollbackGeneration(userId);
    console.error("Resume generation failed:", error);
    return NextResponse.json(
      { error: "Resume generation failed. Please try again." },
      { status: 500 }
    );
  }
}, { rateLimit: "resume-generate" });
