import { z } from "zod";

// ─── Shared Enums ───────────────────────────────────────────────────────────

const locationTypeEnum = z.enum(["Remote", "Hybrid", "On-site"]);
const interviewTypeEnum = z.enum([
  "Screening",
  "Hiring Manager",
  "Panel",
  "Technical",
  "Final",
  "Other",
]);
const interviewFormatEnum = z.enum(["Virtual", "On-site", "Phone"]);
const closedReasonEnum = z.enum(["rejected", "ghosted"]);

// ─── Column Schemas ─────────────────────────────────────────────────────────

export const createColumnSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name must be 50 characters or less"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a valid hex color (e.g., #6366f1)")
    .default("#6366f1"),
});

export const updateColumnSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name must be 50 characters or less").optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a valid hex color")
    .optional(),
});

export const reorderColumnsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "At least one column ID is required"),
});

// ─── Application Schemas ────────────────────────────────────────────────────

const optionalUrl = z
  .string()
  .max(2000, "URL must be 2000 characters or less")
  .refine((val) => val === "" || val.startsWith("http://") || val.startsWith("https://"), {
    message: "URL must start with http:// or https://",
  })
  .optional()
  .nullable();

const optionalDate = z
  .string()
  .datetime({ offset: true })
  .optional()
  .nullable()
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable());

export const createApplicationSchema = z
  .object({
    company: z.string().min(1, "Company is required").max(200),
    role: z.string().min(1, "Role is required").max(200),
    columnId: z.string().min(1, "Column is required"),
    hiringManager: z.string().max(200).optional().nullable(),
    hiringOrg: z.string().max(200).optional().nullable(),
    postingNumber: z.string().max(200).optional().nullable(),
    postingUrl: optionalUrl,
    locationType: locationTypeEnum.optional().nullable(),
    primaryLocation: z.string().max(500).optional().nullable(),
    additionalLocations: z.string().max(500).optional().nullable(),
    salaryMin: z.number().int().min(0).optional().nullable(),
    salaryMax: z.number().int().min(0).optional().nullable(),
    bonusTargetPct: z.number().min(0).max(100).optional().nullable(),
    variableComp: z.number().int().min(0).optional().nullable(),
    referrals: z.string().max(50000).optional().nullable(),
    datePosted: optionalDate,
    dateApplied: optionalDate,
    jobDescription: z.string().max(50000).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.salaryMin != null && data.salaryMax != null) {
        return data.salaryMax >= data.salaryMin;
      }
      return true;
    },
    { message: "Salary max must be >= salary min", path: ["salaryMax"] }
  );

export const updateApplicationSchema = z
  .object({
    company: z.string().min(1).max(200).optional(),
    role: z.string().min(1).max(200).optional(),
    columnId: z.string().min(1).optional(),
    hiringManager: z.string().max(200).optional().nullable(),
    hiringOrg: z.string().max(200).optional().nullable(),
    postingNumber: z.string().max(200).optional().nullable(),
    postingUrl: optionalUrl,
    locationType: locationTypeEnum.optional().nullable(),
    primaryLocation: z.string().max(500).optional().nullable(),
    additionalLocations: z.string().max(500).optional().nullable(),
    salaryMin: z.number().int().min(0).optional().nullable(),
    salaryMax: z.number().int().min(0).optional().nullable(),
    bonusTargetPct: z.number().min(0).max(100).optional().nullable(),
    variableComp: z.number().int().min(0).optional().nullable(),
    referrals: z.string().max(50000).optional().nullable(),
    datePosted: optionalDate,
    dateApplied: optionalDate,
    rejectionDate: optionalDate,
    closedReason: closedReasonEnum.optional().nullable(),
    jobDescription: z.string().max(50000).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.salaryMin != null && data.salaryMax != null) {
        return data.salaryMax >= data.salaryMin;
      }
      return true;
    },
    { message: "Salary max must be >= salary min", path: ["salaryMax"] }
  );

// ─── Move Schema ────────────────────────────────────────────────────────────

export const moveApplicationSchema = z.object({
  id: z.string().min(1, "Application ID is required"),
  columnId: z.string().min(1, "Column ID is required"),
  newOrder: z.number().int().min(0),
  rejectionDate: optionalDate,
  closedReason: closedReasonEnum.optional().nullable(),
});

// ─── Interview Schemas ──────────────────────────────────────────────────────

export const createInterviewSchema = z.object({
  type: interviewTypeEnum,
  format: interviewFormatEnum,
  people: z.string().max(2000).optional().nullable(),
  date: optionalDate,
  notes: z.string().max(2000).optional().nullable(),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateInterviewSchema = z.object({
  type: interviewTypeEnum.optional(),
  format: interviewFormatEnum.optional(),
  people: z.string().max(2000).optional().nullable(),
  date: optionalDate,
  notes: z.string().max(2000).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
});

// ─── Note Schema ────────────────────────────────────────────────────────────

export const createNoteSchema = z.object({
  content: z.string().min(1, "Content is required").max(5000, "Note must be 5000 characters or less"),
});

// ─── Type Exports ───────────────────────────────────────────────────────────

export type CreateColumnInput = z.infer<typeof createColumnSchema>;
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;
export type ReorderColumnsInput = z.infer<typeof reorderColumnsSchema>;
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
export type MoveApplicationInput = z.infer<typeof moveApplicationSchema>;
export type CreateInterviewInput = z.infer<typeof createInterviewSchema>;
export type UpdateInterviewInput = z.infer<typeof updateInterviewSchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
