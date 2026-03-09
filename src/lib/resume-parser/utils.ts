/**
 * Shared utilities for resume parsing.
 */

// ─── Constants ──────────────────────────────────────────────────────────────

export const MONTH_MAP: Record<string, string> = {
  jan: "01", january: "01",
  feb: "02", february: "02",
  mar: "03", march: "03",
  apr: "04", april: "04",
  may: "05",
  jun: "06", june: "06",
  jul: "07", july: "07",
  aug: "08", august: "08",
  sep: "09", sept: "09", september: "09",
  oct: "10", october: "10",
  nov: "11", november: "11",
  dec: "12", december: "12",
};

export const SUMMARY_HEADINGS = new Set([
  "summary", "professional summary", "objective", "profile", "about", "about me",
]);

export const EXPERIENCE_HEADINGS = new Set([
  "work experience", "experience", "professional experience",
  "employment", "employment history", "career history",
]);

export const EDUCATION_HEADINGS = new Set([
  "education", "academic background", "academic history",
]);

export const SKILLS_HEADINGS = new Set([
  "skills", "technical skills", "core competencies",
  "areas of expertise", "competencies",
]);

export const PUBLICATIONS_HEADINGS = new Set([
  "publications", "papers", "research", "research & publications",
  "publications & patents", "publications and patents",
]);

export const CONTACT_HEADINGS = new Set([
  "contact", "contact info", "contact information",
]);

export const IGNORED_HEADINGS = new Set([
  "instructions",
]);

export const HONORS_PATTERNS = [
  /magna cum laude/i,
  /summa cum laude/i,
  /cum laude/i,
  /dean'?s list/i,
  /with honors/i,
  /with distinction/i,
  /honors/i,
];

export const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
export const PHONE_REGEX = /(\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/;
export const URL_REGEX = /https?:\/\/[^\s]+/;
export const LINKEDIN_REGEX = /linkedin\.com\/in\/[^\s]*/i;

/**
 * Experience indicator labels that signal an H2 is a company/experience block.
 */
export const EXPERIENCE_INDICATORS = [
  "timeframe", "relevant titles", "key wins",
  "relevant experience", "leadership style", "leadership",
  "titles", "experiences", "notable clients",
];

// ─── Date Parsing ───────────────────────────────────────────────────────────

/**
 * Parse a single date string into YYYY-MM or YYYY format, or null.
 * Best-effort: returns null for unparsable dates.
 */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // "Present" / "Current" → null (means ongoing)
  if (/^(present|current|now|ongoing)$/i.test(s)) return null;

  // YYYY-MM already (e.g., "2020-01")
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) return s;

  // YYYY only
  if (/^\d{4}$/.test(s)) return s;

  // MM/YYYY (e.g., "01/2020")
  const slashMatch = s.match(/^(0?[1-9]|1[0-2])\/(\d{4})$/);
  if (slashMatch) {
    return `${slashMatch[2]}-${slashMatch[1].padStart(2, "0")}`;
  }

  // Month YYYY (e.g., "Jan 2020", "January 2020")
  const monthYearMatch = s.match(/^([a-z]+)\s+(\d{4})$/i);
  if (monthYearMatch) {
    const month = MONTH_MAP[monthYearMatch[1].toLowerCase()];
    if (month) return `${monthYearMatch[2]}-${month}`;
  }

  // YYYY-MM-DD → YYYY-MM
  const isoMatch = s.match(/^(\d{4})-(0[1-9]|1[0-2])-\d{2}$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;

  return null;
}

/**
 * Parse a date range string like "Jan 2020 - Present" into { start, end }.
 */
export function parseDateRange(raw: string): { start: string | null; end: string | null } {
  const s = raw.trim();

  // Try splitting on common separators: " - ", " – ", " — ", " to "
  const separatorMatch = s.match(/^(.+?)\s*[-–—]\s*(.+)$/) ||
    s.match(/^(.+?)\s+to\s+(.+)$/i);

  if (separatorMatch) {
    const startRaw = separatorMatch[1].trim();
    const endRaw = separatorMatch[2].trim();
    const start = parseDate(startRaw);
    const end = /^(present|current|now|ongoing)$/i.test(endRaw) ? null : parseDate(endRaw);
    return { start, end };
  }

  // Single date
  const single = parseDate(s);
  return { start: single, end: single };
}

// ─── Structure Pass ─────────────────────────────────────────────────────────

export type Block = {
  heading: string | null; // null = preamble (before first heading)
  headingLevel: number;   // 1 for H1, 2 for H2, 0 for preamble
  content: string;
};

export function splitIntoBlocks(markdown: string): Block[] {
  const lines = markdown.split("\n");
  const blocks: Block[] = [];
  let currentHeading: string | null = null;
  let currentLevel = 0;
  let contentLines: string[] = [];

  function flushBlock() {
    const content = contentLines.join("\n").trim();
    if (currentHeading !== null || content) {
      blocks.push({
        heading: currentHeading,
        headingLevel: currentLevel,
        content,
      });
    }
    contentLines = [];
  }

  for (const line of lines) {
    // Match heading lines: # Heading, ## Heading, etc.
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      // Skip H1 lines that are clearly comments/instructions (>60 chars)
      if (level === 1 && headingMatch[2].trim().length > 60) {
        continue; // Drop comment-like # lines
      }
      // Only split on H1 and H2 (top-level structure)
      if (level <= 2) {
        flushBlock();
        currentHeading = headingMatch[2].trim();
        currentLevel = level;
        continue;
      }
    }
    contentLines.push(line);
  }
  flushBlock();

  return blocks;
}

// ─── Heading Normalization ──────────────────────────────────────────────────

export function normalizeHeading(heading: string): string {
  return heading
    .toLowerCase()
    .trim()
    .replace(/:+$/, "") // strip trailing colons
    .trim();
}

// ─── CV Format Utilities ────────────────────────────────────────────────────

/**
 * Strip indented comment lines (4+ spaces then #) and horizontal rules (---+).
 */
export function preprocessMarkdown(markdown: string): string {
  return markdown
    .split("\n")
    .filter((line) => !/^\s{4,}#\s/.test(line))
    .filter((line) => !/^---+\s*$/.test(line))
    .join("\n");
}

/**
 * Parse indented key-value content where unindented lines are keys
 * and indented (4+ spaces) lines are values.
 */
export function parseIndentedKeyValues(content: string): Map<string, string[]> {
  const lines = content.split("\n");
  const map = new Map<string, string[]>();
  let currentKey: string | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    if (/^\s{4,}/.test(line)) {
      // Indented line → value for current key
      if (currentKey !== null) {
        const values = map.get(currentKey) ?? [];
        values.push(line.trim());
        map.set(currentKey, values);
      }
    } else {
      // Unindented line → new key
      currentKey = line.trim().replace(/:+$/, "").trim();
      if (!map.has(currentKey)) {
        map.set(currentKey, []);
      }
    }
  }

  return map;
}

/**
 * Check if content has enough experience indicators to be treated as an experience block.
 */
export function looksLikeExperienceBlock(content: string): boolean {
  const contentLower = content.toLowerCase();
  let count = 0;
  for (const indicator of EXPERIENCE_INDICATORS) {
    // Match as unindented line (key in indented key-value format) or H3
    if (new RegExp(`(?:^|\\n)(?:#{3}\\s+)?${indicator}`, "i").test(contentLower)) {
      count++;
    }
  }
  return count >= 2;
}

/**
 * Extract bullet points from indented values, handling sub-indented items.
 */
export function extractBullets(values: string[]): string[] {
  const bullets: string[] = [];
  for (const v of values) {
    const stripped = v.replace(/^[-*]\s+/, "").trim();
    if (stripped) {
      bullets.push(stripped);
    }
  }
  return bullets;
}

export function formatSubsectionLabel(key: string): string {
  const labelMap: Record<string, string> = {
    "key wins": "Key Wins",
    "relevant experience": "Relevant Experience",
    "leadership style": "Leadership Style",
    "leadership": "Leadership",
    "experiences": "Experiences",
  };
  return labelMap[key] ?? key;
}

/**
 * Parse a metadata line with date and location info.
 */
export function parseMetadataLine(
  raw: string,
  target: { startDate: string | null; endDate: string | null; location: string | null }
): void {
  // Split on pipe for "date | location" pattern
  const parts = raw.includes("|")
    ? raw.split("|").map((p) => p.trim())
    : [raw.trim()];

  for (const part of parts) {
    // Try to parse as date range
    const dateRangeMatch = part.match(
      /(?:(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+)?\d{4}\s*[-–—]\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+)?\d{0,4}(?:Present|Current)?)/i
    ) || part.match(/\d{4}\s*[-–—]\s*(?:\d{4}|Present|Current)/i);

    if (dateRangeMatch) {
      const { start, end } = parseDateRange(dateRangeMatch[0]);
      target.startDate = start;
      target.endDate = end;
      // Remainder after removing date might be location
      const remainder = part.replace(dateRangeMatch[0], "").trim().replace(/^[|,]\s*/, "").trim();
      if (remainder && !target.location) {
        target.location = remainder;
      }
    } else if (!target.location) {
      target.location = part;
    }
  }
}
