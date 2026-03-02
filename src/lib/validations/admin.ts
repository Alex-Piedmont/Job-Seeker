import { z } from "zod";

export const updateLimitsSchema = z
  .object({
    applicationCap: z
      .number()
      .int("Must be a whole number")
      .min(1, "Must be at least 1")
      .max(10000, "Must be at most 10,000")
      .optional(),
    resumeGenerationCap: z
      .number()
      .int("Must be a whole number")
      .min(1, "Must be at least 1")
      .max(10000, "Must be at most 10,000")
      .optional(),
  })
  .refine((data) => data.applicationCap !== undefined || data.resumeGenerationCap !== undefined, {
    message: "At least one cap must be provided",
  });

export type UpdateLimitsInput = z.infer<typeof updateLimitsSchema>;
