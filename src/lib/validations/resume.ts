import { z } from "zod";

export const generateResumeSchema = z.object({
  jobApplicationId: z.string().min(1, "jobApplicationId is required"),
  fitAnalysis: z.string().optional(),
  userAnswers: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).optional(),
  parentGenerationId: z.string().optional(),
  revisionContext: z.object({
    reviewFeedback: z.string(),
    userNotes: z.string().max(2000).optional(),
  }).optional(),
});

export type GenerateResumeInput = z.infer<typeof generateResumeSchema>;

export const fitAnalysisSchema = z.object({
  jobApplicationId: z.string().min(1, "jobApplicationId is required"),
});

export const reviewResumeSchema = z.object({
  jobApplicationId: z.string().min(1),
  resumeMarkdown: z.string().min(1),
  generationId: z.string().min(1).optional(),
});
