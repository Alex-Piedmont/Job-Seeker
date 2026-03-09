/**
 * Work experience parsing for resumes.
 */

import type { ParsedResume } from "./index";
import {
  parseDateRange,
  parseIndentedKeyValues,
  extractBullets,
  formatSubsectionLabel,
  parseMetadataLine,
} from "./utils";

// ─── Experience Parsing ─────────────────────────────────────────────────────

export function parseExperienceBlock(content: string): ParsedResume["experiences"] {
  const lines = content.split("\n");
  const experiences: ParsedResume["experiences"] = [];
  let current: ParsedResume["experiences"][number] | null = null;
  let currentSubsection: { label: string; bullets: string[] } | null = null;
  let descriptionLines: string[] = [];

  function flushExperience() {
    if (!current) return;
    if (currentSubsection) {
      current.subsections.push(currentSubsection);
      currentSubsection = null;
    }
    if (descriptionLines.length > 0) {
      current.description = descriptionLines.join("\n").trim() || null;
      descriptionLines = [];
    }
    experiences.push(current);
    current = null;
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // H3: new experience entry
    const h3Match = trimmed.match(/^###\s+(.+)$/);
    if (h3Match) {
      flushExperience();
      const { title, company } = parseTitleCompany(h3Match[1]);
      current = {
        title,
        company,
        location: null,
        startDate: null,
        endDate: null,
        description: null,
        subsections: [],
      };
      continue;
    }

    if (!current) continue;

    // H4: subsection
    const h4Match = trimmed.match(/^####\s+(.+)$/);
    if (h4Match) {
      if (currentSubsection) {
        current.subsections.push(currentSubsection);
      }
      currentSubsection = { label: h4Match[1].trim(), bullets: [] };
      continue;
    }

    // Italic metadata line: *date | location*
    const italicMatch = trimmed.match(/^\*([^*]+)\*$/);
    if (italicMatch && !current.startDate && !current.location) {
      parseMetadataLine(italicMatch[1], current);
      continue;
    }

    // Bullet point
    if (/^[-*]\s+/.test(trimmed)) {
      const bulletText = trimmed.replace(/^[-*]\s+/, "").trim();
      if (bulletText) {
        if (!currentSubsection) {
          currentSubsection = { label: "Key Accomplishments", bullets: [] };
        }
        currentSubsection.bullets.push(bulletText);
      }
      continue;
    }

    // Non-empty non-heading line → description
    if (trimmed) {
      descriptionLines.push(trimmed);
    }
  }

  flushExperience();
  return experiences;
}

function parseTitleCompany(raw: string): { title: string; company: string } {
  // Try "Title -- Company" (double dash)
  const doubleDash = raw.match(/^(.+?)\s*--\s*(.+)$/);
  if (doubleDash) return { title: doubleDash[1].trim(), company: doubleDash[2].trim() };

  // Try "Title — Company" (em dash)
  const emDash = raw.match(/^(.+?)\s*—\s*(.+)$/);
  if (emDash) return { title: emDash[1].trim(), company: emDash[2].trim() };

  // Try "Title – Company" (en dash)
  const enDash = raw.match(/^(.+?)\s*–\s*(.+)$/);
  if (enDash) return { title: enDash[1].trim(), company: enDash[2].trim() };

  // Try "Title at Company"
  const atMatch = raw.match(/^(.+?)\s+at\s+(.+)$/i);
  if (atMatch) return { title: atMatch[1].trim(), company: atMatch[2].trim() };

  // Try "Title, Company" (only if comma present)
  const commaMatch = raw.match(/^(.+?),\s+(.+)$/);
  if (commaMatch) return { title: commaMatch[1].trim(), company: commaMatch[2].trim() };

  // Fallback: entire string as title
  return { title: raw.trim(), company: "" };
}

/**
 * Parse an indented experience block where the H2 heading is the company name.
 * Handles both simple (no H3 sub-roles) and complex (H3 sub-roles like BASF).
 */
export function parseIndentedExperienceBlock(
  company: string,
  content: string
): ParsedResume["experiences"] {
  // Check for H3 sub-roles
  const h3Pattern = /^###\s+(.+)$/gm;
  const h3Matches = [...content.matchAll(h3Pattern)];

  if (h3Matches.length > 0) {
    // Complex case: split on H3s, each becomes a separate experience entry
    return parseCompanyWithSubRoles(company, content, h3Matches);
  }

  // Simple case: single experience entry
  return [parseSingleIndentedExperience(company, content)];
}

function parseSingleIndentedExperience(
  company: string,
  content: string
): ParsedResume["experiences"][number] {
  const kv = parseIndentedKeyValues(content);

  let title = "";
  let startDate: string | null = null;
  let endDate: string | null = null;
  const subsections: Array<{ label: string; bullets: string[] }> = [];

  for (const [key, values] of kv) {
    const keyLower = key.toLowerCase();

    if (keyLower === "timeframe" || keyLower === "timeframe:") {
      if (values.length > 0) {
        const { start, end } = parseDateRange(values[0]);
        startDate = start;
        endDate = end;
      }
    } else if (keyLower.includes("title")) {
      if (values.length > 0) {
        title = values[0];
      }
    } else if (
      keyLower === "key wins" || keyLower === "relevant experience" ||
      keyLower === "leadership style" || keyLower === "leadership" ||
      keyLower === "experiences"
    ) {
      const bullets = extractBullets(values);
      if (bullets.length > 0) {
        subsections.push({ label: formatSubsectionLabel(keyLower), bullets });
      }
    }
    // Skip "who is" descriptions, "notable clients", etc.
  }

  return {
    company,
    title,
    location: null,
    startDate,
    endDate,
    description: null,
    subsections,
  };
}

function parseCompanyWithSubRoles(
  company: string,
  content: string,
  _h3Matches: RegExpExecArray[] | RegExpMatchArray[]
): ParsedResume["experiences"] {
  const experiences: ParsedResume["experiences"] = [];
  const lines = content.split("\n");

  // Find line indices of each H3
  const h3Indices: Array<{ title: string; lineIdx: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^###\s+(.+)$/);
    if (m) {
      h3Indices.push({ title: m[1].trim(), lineIdx: i });
    }
  }

  for (let i = 0; i < h3Indices.length; i++) {
    const startLine = h3Indices[i].lineIdx + 1;
    const endLine = i + 1 < h3Indices.length ? h3Indices[i + 1].lineIdx : lines.length;
    const subContent = lines.slice(startLine, endLine).join("\n");

    const entry = parseSingleIndentedExperience(company, subContent);
    // Use the H3 title as a fallback title if "Relevant Titles" not found
    if (!entry.title) {
      entry.title = h3Indices[i].title;
    }
    experiences.push(entry);
  }

  return experiences;
}
