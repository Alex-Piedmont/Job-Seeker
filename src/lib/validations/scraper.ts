import { z } from "zod";

const booleanString = z
  .union([z.boolean(), z.string()])
  .transform((val) => (typeof val === "string" ? val === "true" : val));

const atsPlatformValues = ["GREENHOUSE", "LEVER", "WORKDAY", "ICIMS", "ORACLE", "SUCCESSFACTORS"] as const;

export const createCompanySchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name must be 200 characters or less"),
  atsPlatform: z.enum(atsPlatformValues, {
    message: "Invalid ATS platform. Must be one of: GREENHOUSE, LEVER, WORKDAY, ICIMS",
  }),
  baseUrl: z.string().url("Invalid URL format for baseUrl").startsWith("https", "baseUrl must use HTTPS"),
  enabled: z.boolean().optional(),
});

export const updateCompanySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  atsPlatform: z.enum(atsPlatformValues, {
    message: "Invalid ATS platform. Must be one of: GREENHOUSE, LEVER, WORKDAY, ICIMS",
  }).optional(),
  baseUrl: z.string().url("Invalid URL format for baseUrl").startsWith("https", "baseUrl must use HTTPS").optional(),
  enabled: z.boolean().optional(),
});

export const scrapedJobQuerySchema = z.object({
  q: z.string().optional(),
  company: z.string().optional(),
  companyId: z.string().optional(),
  companyIds: z.string().optional(), // comma-separated company IDs
  location: z.string().optional(),
  locationType: z.string().optional(),
  salaryMin: z.coerce.number().int().min(0).optional(),
  salaryMax: z.coerce.number().int().min(0).optional(),
  postedFrom: z.string().optional(), // ISO date string
  postedTo: z.string().optional(), // ISO date string
  includeRemoved: booleanString.optional().default(true),
  includeArchived: booleanString.optional().default(false),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(24),
  sort: z.enum(["firstSeenAt", "title", "salaryMax"]).optional().default("firstSeenAt"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type ScrapedJobQuery = z.infer<typeof scrapedJobQuerySchema>;
