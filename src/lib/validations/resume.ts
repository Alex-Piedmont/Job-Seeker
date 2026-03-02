import { z } from "zod";

export const generateResumeSchema = z.object({
  jobApplicationId: z.string().min(1, "jobApplicationId is required"),
});

export type GenerateResumeInput = z.infer<typeof generateResumeSchema>;
