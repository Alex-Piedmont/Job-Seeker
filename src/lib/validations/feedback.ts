import { z } from "zod";

export const feedbackCategorySchema = z.enum([
  "BUG",
  "SUGGESTION",
  "PRAISE",
  "OTHER",
]);

export const createFeedbackSchema = z.object({
  category: feedbackCategorySchema,
  message: z.string().min(10).max(2000),
  pageUrl: z.string().max(500).optional(),
});

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
