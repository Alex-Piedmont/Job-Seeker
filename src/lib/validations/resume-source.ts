import { z } from "zod";

// Shared patterns
const dateRegex = /^(\d{4}-(0[1-9]|1[0-2])|\d{4})$/;
const urlRegex = /^https?:\/\//;

const trimmedString = (max: number) => z.string().trim().max(max);
const optionalTrimmedString = (max: number) =>
  z.string().trim().max(max).nullable().optional();
const optionalUrl = () =>
  z
    .string()
    .trim()
    .max(2000)
    .regex(urlRegex, "Must start with http:// or https://")
    .nullable()
    .optional();
const optionalDate = () =>
  z
    .string()
    .trim()
    .regex(dateRegex, "Must be YYYY-MM or YYYY format")
    .nullable()
    .optional();

// Contact
export const contactSchema = z.object({
  fullName: trimmedString(200).optional().default(""),
  email: trimmedString(200).optional().default(""),
  phone: optionalTrimmedString(30),
  location: optionalTrimmedString(200),
  linkedIn: optionalUrl(),
  website: optionalUrl(),
  summary: optionalTrimmedString(10000),
});
export type ContactInput = z.infer<typeof contactSchema>;

// Education
export const educationCreateSchema = z.object({});

export const educationUpdateSchema = z.object({
  institution: trimmedString(200).optional(),
  degree: trimmedString(200).optional(),
  fieldOfStudy: optionalTrimmedString(200),
  startDate: optionalDate(),
  endDate: optionalDate(),
  gpa: optionalTrimmedString(50),
  honors: optionalTrimmedString(200),
  notes: optionalTrimmedString(10000),
});
export type EducationInput = z.infer<typeof educationUpdateSchema>;

// Work Experience
export const experienceCreateSchema = z.object({});

export const experienceUpdateSchema = z.object({
  company: trimmedString(200).optional(),
  title: trimmedString(200).optional(),
  location: optionalTrimmedString(200),
  startDate: optionalDate(),
  endDate: optionalDate(),
  description: optionalTrimmedString(10000),
  alternateTitles: z
    .array(z.string().trim().min(1).max(200))
    .max(10)
    .optional(),
});
export type ExperienceInput = z.infer<typeof experienceUpdateSchema>;

// Subsection
export const subsectionCreateSchema = z.object({
  label: trimmedString(200).default("New Subsection"),
  bullets: z
    .array(z.string().trim().max(1000))
    .max(50)
    .optional()
    .default([]),
});

export const subsectionUpdateSchema = z.object({
  label: trimmedString(200).optional(),
  bullets: z.array(z.string().trim().max(1000)).max(50).optional(),
});
export type SubsectionInput = z.infer<typeof subsectionUpdateSchema>;

// Skill
export const skillCreateSchema = z.object({
  category: trimmedString(200).default("New Category"),
  items: z
    .array(z.string().trim().max(100))
    .max(50)
    .optional()
    .default([]),
});

export const skillUpdateSchema = z.object({
  category: trimmedString(200).optional(),
  items: z.array(z.string().trim().max(100)).max(50).optional(),
});
export type SkillInput = z.infer<typeof skillUpdateSchema>;

// Publication
export const publicationCreateSchema = z.object({
  title: trimmedString(200).default("New Publication"),
  publisher: optionalTrimmedString(200),
  date: z
    .string()
    .trim()
    .regex(/^(\d{4}-(0[1-9]|1[0-2])|\d{4})$/, "Must be YYYY-MM or YYYY format")
    .nullable()
    .optional(),
  url: optionalUrl(),
  description: optionalTrimmedString(10000),
});

export const publicationUpdateSchema = z.object({
  title: trimmedString(200).optional(),
  publisher: optionalTrimmedString(200),
  date: z
    .string()
    .trim()
    .regex(/^(\d{4}-(0[1-9]|1[0-2])|\d{4})$/, "Must be YYYY-MM or YYYY format")
    .nullable()
    .optional(),
  url: optionalUrl(),
  description: optionalTrimmedString(10000),
});
export type PublicationInput = z.infer<typeof publicationUpdateSchema>;

// Reorder
export const reorderSchema = z.object({
  ids: z.array(z.string()).min(1),
});
export type ReorderInput = z.infer<typeof reorderSchema>;

// Import
export const importSchema = z.object({
  markdown: z.string().min(1, "Markdown content is required").max(204800, "File too large (max 200KB)"),
});
export type ImportInput = z.infer<typeof importSchema>;

// Custom Section
export const customSectionCreateSchema = z.object({
  title: trimmedString(200).min(1, "Title is required"),
  content: z.string().max(50000).optional().default(""),
});

export const customSectionUpdateSchema = z.object({
  title: trimmedString(200).min(1, "Title is required").optional(),
  content: z.string().max(50000).optional(),
});
export type CustomSectionInput = z.infer<typeof customSectionUpdateSchema>;

// Miscellaneous
export const miscellaneousUpdateSchema = z.object({
  content: z.string().max(50000).nullable(),
});
export type MiscellaneousInput = z.infer<typeof miscellaneousUpdateSchema>;

// Entry caps
export const ENTRY_CAPS = {
  education: 30,
  experience: 30,
  subsections: 20,
  skills: 30,
  publications: 30,
  customSections: 20,
} as const;
