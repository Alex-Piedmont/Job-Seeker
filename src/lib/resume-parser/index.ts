/**
 * Pure function that parses a markdown resume into structured data.
 * No side effects — takes string, returns ParsedResume.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type ParsedResume = {
  contact: {
    fullName: string;
    email: string;
    phone: string | null;
    location: string | null;
    linkedIn: string | null;
    website: string | null;
    summary: string | null;
  };
  experiences: Array<{
    company: string;
    title: string;
    location: string | null;
    startDate: string | null;
    endDate: string | null;
    description: string | null;
    subsections: Array<{ label: string; bullets: string[] }>;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    fieldOfStudy: string | null;
    startDate: string | null;
    endDate: string | null;
    gpa: string | null;
    honors: string | null;
    notes: string | null;
  }>;
  skills: Array<{
    category: string;
    items: string[];
  }>;
  publications: Array<{
    title: string;
    publisher: string | null;
    date: string | null;
    url: string | null;
    description: string | null;
  }>;
  customSections: Array<{
    title: string;
    content: string;
  }>;
  miscellaneous: string | null;
};

// ─── Re-exports ─────────────────────────────────────────────────────────────

export { parseDate, parseDateRange } from "./utils";

// ─── Internal imports ───────────────────────────────────────────────────────

import { extractContactFromLines, parseContactBlock } from "./contact";
import { parseExperienceBlock, parseIndentedExperienceBlock } from "./experience";
import { parseEducationBlock } from "./education";
import { parseSkillsBlock } from "./skills";
import { parsePublicationsBlock } from "./publications";
import {
  SUMMARY_HEADINGS,
  EXPERIENCE_HEADINGS,
  EDUCATION_HEADINGS,
  SKILLS_HEADINGS,
  PUBLICATIONS_HEADINGS,
  CONTACT_HEADINGS,
  IGNORED_HEADINGS,
  preprocessMarkdown,
  splitIntoBlocks,
  normalizeHeading,
  looksLikeExperienceBlock,
} from "./utils";

// ─── Main Parser ────────────────────────────────────────────────────────────

export function parseResumeMarkdown(markdown: string): ParsedResume {
  const result: ParsedResume = {
    contact: {
      fullName: "",
      email: "",
      phone: null,
      location: null,
      linkedIn: null,
      website: null,
      summary: null,
    },
    experiences: [],
    education: [],
    skills: [],
    publications: [],
    customSections: [],
    miscellaneous: null,
  };

  // Preprocess: strip comments and horizontal rules
  const cleaned = preprocessMarkdown(markdown);
  const blocks = splitIntoBlocks(cleaned);

  if (blocks.length === 0) return result;

  // Track if we've seen an H1
  let foundH1 = false;
  const miscParts: string[] = [];

  for (const block of blocks) {
    // Preamble (no heading) — could be contact info or misc
    if (block.heading === null) {
      // Preamble content goes to miscellaneous
      if (block.content.trim()) {
        miscParts.push(block.content.trim());
      }
      continue;
    }

    // H1 heading
    if (block.headingLevel === 1) {
      // Skip instruction-like H1s (long sentences, not names)
      if (block.heading.length > 80) continue;

      if (!foundH1) {
        foundH1 = true;
        result.contact.fullName = block.heading.trim();

        // Parse contact lines from content under H1
        if (block.content.trim()) {
          const contactLines = block.content.split("\n").filter((l) => l.trim());
          const contactInfo = extractContactFromLines(contactLines);
          result.contact.email = contactInfo.email;
          result.contact.phone = contactInfo.phone;
          result.contact.location = contactInfo.location;
          result.contact.linkedIn = contactInfo.linkedIn;
          result.contact.website = contactInfo.website;
        }
      } else {
        // Subsequent H1s treated as custom sections
        result.customSections.push({
          title: block.heading.trim(),
          content: block.content.trim(),
        });
      }
      continue;
    }

    // H2 heading — map to known section or custom
    const normalized = normalizeHeading(block.heading);

    // Skip ignored headings
    if (IGNORED_HEADINGS.has(normalized)) continue;

    // Contact section
    if (CONTACT_HEADINGS.has(normalized)) {
      const contactData = parseContactBlock(block.content);
      if (contactData.fullName) result.contact.fullName = contactData.fullName;
      if (contactData.email) result.contact.email = contactData.email;
      if (contactData.phone) result.contact.phone = contactData.phone;
      if (contactData.location) result.contact.location = contactData.location;
      if (contactData.linkedIn) result.contact.linkedIn = contactData.linkedIn;
      if (contactData.website) result.contact.website = contactData.website;
    } else if (SUMMARY_HEADINGS.has(normalized)) {
      result.contact.summary = block.content.trim() || null;
    } else if (EXPERIENCE_HEADINGS.has(normalized)) {
      result.experiences = parseExperienceBlock(block.content);
    } else if (EDUCATION_HEADINGS.has(normalized)) {
      result.education = parseEducationBlock(block.content);
    } else if (SKILLS_HEADINGS.has(normalized)) {
      result.skills = parseSkillsBlock(block.content);
    } else if (PUBLICATIONS_HEADINGS.has(normalized)) {
      result.publications = parsePublicationsBlock(block.content);
    } else if (looksLikeExperienceBlock(block.content)) {
      // Unrecognized H2 that looks like experience → company-as-heading
      const exps = parseIndentedExperienceBlock(block.heading.trim(), block.content);
      result.experiences.push(...exps);
    } else {
      // Unrecognized heading → custom section
      result.customSections.push({
        title: block.heading.trim(),
        content: block.content.trim(),
      });
    }
  }

  // Set miscellaneous
  const misc = miscParts.join("\n\n").trim();
  result.miscellaneous = misc || null;

  return result;
}
