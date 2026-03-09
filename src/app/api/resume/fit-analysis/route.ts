import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { validateBody } from "@/lib/validations";
import { fitAnalysisSchema } from "@/lib/validations/resume";
import { prisma } from "@/lib/prisma";
import { compileResumeSource } from "@/lib/resume-compiler";
import { hashContent } from "@/lib/hash";
import { callWithTool, estimateCost } from "@/lib/anthropic";
import {
  FIT_ANALYSIS_SYSTEM,
  FIT_ANALYSIS_TOOL,
  buildFitAnalysisUserMessage,
  type FitAnalysisResult,
} from "@/lib/resume-prompts/fit-analysis";

/** Normalize AI output so every field is the expected type. */
function normalizeFitAnalysis(raw: Record<string, unknown>): FitAnalysisResult {
  return {
    relevantRoles: Array.isArray(raw.relevantRoles) ? raw.relevantRoles : [],
    alignedWins: Array.isArray(raw.alignedWins) ? raw.alignedWins : [],
    skillsMatch: raw.skillsMatch && typeof raw.skillsMatch === "object" && !Array.isArray(raw.skillsMatch)
      ? {
          strong: Array.isArray((raw.skillsMatch as Record<string, unknown>).strong) ? (raw.skillsMatch as { strong: string[] }).strong : [],
          partial: Array.isArray((raw.skillsMatch as Record<string, unknown>).partial) ? (raw.skillsMatch as { partial: string[] }).partial : [],
          missing: Array.isArray((raw.skillsMatch as Record<string, unknown>).missing) ? (raw.skillsMatch as { missing: string[] }).missing : [],
        }
      : { strong: [], partial: [], missing: [] },
    gaps: Array.isArray(raw.gaps) ? raw.gaps : [],
    titleRecommendations: Array.isArray(raw.titleRecommendations) ? raw.titleRecommendations : [],
    questions: Array.isArray(raw.questions) ? raw.questions : [],
  };
}

export const maxDuration = 60;

export const POST = authenticatedHandler(async (request, { userId }) => {
  const validation = await validateBody(request, fitAnalysisSchema);
  if (!validation.success) return validation.response;

  const { jobApplicationId } = validation.data;

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
      { error: "Job description is required for fit analysis" },
      { status: 400 }
    );
  }

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

  // Version prefix invalidates cache when analysis format changes
  const CACHE_VERSION = "v2:";
  const resumeHash = hashContent(CACHE_VERSION + resumeMarkdown);
  const jdHash = hashContent(CACHE_VERSION + application.jobDescription);

  // Check cache
  const cached = await prisma.fitAnalysisCache.findUnique({
    where: { jobApplicationId },
  });

  if (
    cached &&
    cached.resumeSourceHash === resumeHash &&
    cached.jobDescriptionHash === jdHash
  ) {
    return NextResponse.json({
      analysis: normalizeFitAnalysis(JSON.parse(cached.analysisJson)),
      cached: true,
    });
  }

  // Call Claude (use Haiku for speed — this is prep work, not final generation)
  const result = await callWithTool<FitAnalysisResult>(
    FIT_ANALYSIS_SYSTEM,
    buildFitAnalysisUserMessage(resumeMarkdown, application.jobDescription),
    FIT_ANALYSIS_TOOL,
    { model: "claude-haiku-4-5-20251001" }
  );

  const analysis = normalizeFitAnalysis(result.data as unknown as Record<string, unknown>);
  const cost = estimateCost(result.promptTokens, result.completionTokens);

  // Upsert cache (store normalized data)
  await prisma.fitAnalysisCache.upsert({
    where: { jobApplicationId },
    create: {
      userId,
      jobApplicationId,
      resumeSourceHash: resumeHash,
      jobDescriptionHash: jdHash,
      analysisJson: JSON.stringify(analysis),
    },
    update: {
      resumeSourceHash: resumeHash,
      jobDescriptionHash: jdHash,
      analysisJson: JSON.stringify(analysis),
    },
  });

  // Record aux call
  await prisma.resumeAuxCall.create({
    data: {
      userId,
      jobApplicationId,
      callType: "fit_analysis",
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      totalTokens: result.totalTokens,
      estimatedCost: cost,
      modelId: result.modelId,
    },
  });

  return NextResponse.json({
    analysis,
    cached: false,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    estimatedCost: cost,
  });
}, { rateLimit: "fit-analysis" });
