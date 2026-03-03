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

// ─── Constants ──────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
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

const SUMMARY_HEADINGS = new Set([
  "summary", "professional summary", "objective", "profile", "about", "about me",
]);

const EXPERIENCE_HEADINGS = new Set([
  "work experience", "experience", "professional experience",
  "employment", "employment history", "career history",
]);

const EDUCATION_HEADINGS = new Set([
  "education", "academic background", "academic history",
]);

const SKILLS_HEADINGS = new Set([
  "skills", "technical skills", "core competencies",
  "areas of expertise", "competencies",
]);

const PUBLICATIONS_HEADINGS = new Set([
  "publications", "papers", "research", "research & publications",
  "publications & patents", "publications and patents",
]);

const CONTACT_HEADINGS = new Set([
  "contact", "contact info", "contact information",
]);

const IGNORED_HEADINGS = new Set([
  "instructions",
]);

const HONORS_PATTERNS = [
  /magna cum laude/i,
  /summa cum laude/i,
  /cum laude/i,
  /dean'?s list/i,
  /with honors/i,
  /with distinction/i,
  /honors/i,
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

// ─── Contact Line Detection ─────────────────────────────────────────────────

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_REGEX = /(\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/;
const URL_REGEX = /https?:\/\/[^\s]+/;
const LINKEDIN_REGEX = /linkedin\.com\/in\/[^\s]*/i;

type ContactInfo = {
  email: string;
  phone: string | null;
  location: string | null;
  linkedIn: string | null;
  website: string | null;
};

function extractContactFromLines(lines: string[]): ContactInfo {
  const contact: ContactInfo = {
    email: "",
    phone: null,
    location: null,
    linkedIn: null,
    website: null,
  };

  const allSegments: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Split pipe-delimited lines
    if (trimmed.includes("|")) {
      allSegments.push(...trimmed.split("|").map((s) => s.trim()).filter(Boolean));
    } else {
      allSegments.push(trimmed);
    }
  }

  for (const segment of allSegments) {
    // Try email
    const emailMatch = segment.match(EMAIL_REGEX);
    if (emailMatch && !contact.email) {
      contact.email = emailMatch[0];
      // Check if there's more content on this segment after extracting email
      const remainder = segment.replace(emailMatch[0], "").trim();
      if (remainder) {
        processRemainder(remainder, contact);
      }
      continue;
    }

    // Try LinkedIn URL
    const linkedInMatch = segment.match(LINKEDIN_REGEX);
    if (linkedInMatch && !contact.linkedIn) {
      // Extract full URL if present, otherwise construct it
      const urlMatch = segment.match(URL_REGEX);
      contact.linkedIn = urlMatch ? urlMatch[0] : `https://${linkedInMatch[0]}`;
      continue;
    }

    // Try other URLs
    const urlMatch = segment.match(URL_REGEX);
    if (urlMatch && !contact.website) {
      contact.website = urlMatch[0];
      continue;
    }

    // Try phone
    const phoneMatch = segment.match(PHONE_REGEX);
    if (phoneMatch && !contact.phone) {
      contact.phone = phoneMatch[0].trim();
      continue;
    }

    // Remainder → location (heuristic: short, often has comma)
    if (!contact.location && segment.length < 100) {
      contact.location = segment;
    }
  }

  return contact;
}

function processRemainder(text: string, contact: ContactInfo): void {
  const phoneMatch = text.match(PHONE_REGEX);
  if (phoneMatch && !contact.phone) {
    contact.phone = phoneMatch[0].trim();
    return;
  }
  const urlMatch = text.match(URL_REGEX);
  if (urlMatch && !contact.website) {
    contact.website = urlMatch[0];
    return;
  }
  if (!contact.location && text.length < 100) {
    contact.location = text;
  }
}

// ─── Structure Pass ─────────────────────────────────────────────────────────

type Block = {
  heading: string | null; // null = preamble (before first heading)
  headingLevel: number;   // 1 for H1, 2 for H2, 0 for preamble
  content: string;
};

function splitIntoBlocks(markdown: string): Block[] {
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

function normalizeHeading(heading: string): string {
  return heading
    .toLowerCase()
    .trim()
    .replace(/:+$/, "") // strip trailing colons
    .trim();
}

// ─── Section Parsers ────────────────────────────────────────────────────────

function parseExperienceBlock(content: string): ParsedResume["experiences"] {
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

function parseMetadataLine(
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

function parseEducationBlock(content: string): ParsedResume["education"] {
  // Check if there are any H3 headings; if not, use indented fallback
  if (!/^###\s+/m.test(content)) {
    return parseIndentedEducationBlock(content);
  }

  const lines = content.split("\n");
  const entries: ParsedResume["education"] = [];
  let current: ParsedResume["education"][number] | null = null;
  let notesLines: string[] = [];

  function flushEntry() {
    if (!current) return;
    if (notesLines.length > 0) {
      current.notes = notesLines.join("\n").trim() || null;
      notesLines = [];
    }
    entries.push(current);
    current = null;
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // H3: new education entry
    const h3Match = trimmed.match(/^###\s+(.+)$/);
    if (h3Match) {
      flushEntry();
      const parsed = parseDegreeInstitution(h3Match[1]);
      current = {
        institution: parsed.institution,
        degree: parsed.degree,
        fieldOfStudy: parsed.fieldOfStudy,
        startDate: null,
        endDate: null,
        gpa: null,
        honors: null,
        notes: null,
      };
      continue;
    }

    if (!current) continue;

    // Italic metadata line (dates)
    const italicMatch = trimmed.match(/^\*([^*]+)\*$/);
    if (italicMatch && !current.startDate) {
      const { start, end } = parseDateRange(italicMatch[1]);
      current.startDate = start;
      current.endDate = end;
      continue;
    }

    // GPA line
    const gpaMatch = trimmed.match(/GPA:\s*(.+)/i);
    if (gpaMatch && !current.gpa) {
      current.gpa = gpaMatch[1].trim();
      continue;
    }

    // Honors detection
    if (!current.honors && HONORS_PATTERNS.some((p) => p.test(trimmed))) {
      current.honors = trimmed;
      continue;
    }

    // Everything else → notes
    if (trimmed) {
      notesLines.push(trimmed);
    }
  }

  flushEntry();
  return entries;
}

function parseDegreeInstitution(raw: string): {
  degree: string;
  institution: string;
  fieldOfStudy: string | null;
} {
  // Try "Degree, Field of Study -- Institution"
  const doubleDash = raw.match(/^(.+?)\s*--\s*(.+)$/);
  if (doubleDash) {
    const left = doubleDash[1].trim();
    const institution = doubleDash[2].trim();
    const commaMatch = left.match(/^(.+?),\s+(.+)$/);
    if (commaMatch) {
      return { degree: commaMatch[1].trim(), fieldOfStudy: commaMatch[2].trim(), institution };
    }
    return { degree: left, fieldOfStudy: null, institution };
  }

  // Try with em/en dash
  const dashMatch = raw.match(/^(.+?)\s*[—–]\s*(.+)$/);
  if (dashMatch) {
    const left = dashMatch[1].trim();
    const institution = dashMatch[2].trim();
    const commaMatch = left.match(/^(.+?),\s+(.+)$/);
    if (commaMatch) {
      return { degree: commaMatch[1].trim(), fieldOfStudy: commaMatch[2].trim(), institution };
    }
    return { degree: left, fieldOfStudy: null, institution };
  }

  // Fallback: entire string as degree
  return { degree: raw.trim(), institution: "", fieldOfStudy: null };
}

function parseSkillsBlock(content: string): ParsedResume["skills"] {
  // Check if there are any bold categories; if not and there are indented lines, use indented fallback
  if (!/\*\*.+?\*\*/.test(content) && /^\s{4,}\S/m.test(content)) {
    return parseIndentedSkillsBlock(content);
  }

  const lines = content.split("\n");
  const skills: ParsedResume["skills"] = [];
  const generalItems: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Remove leading bullet
    const noBullet = trimmed.replace(/^[-*]\s+/, "").trim();

    // Try "**Category**: items" or "**Category:** items"
    const categoryMatch = noBullet.match(/^\*\*(.+?)\*\*:?\s*(.*)$/);
    if (categoryMatch) {
      const category = categoryMatch[1].replace(/:$/, "").trim();
      const itemsStr = categoryMatch[2].trim();
      if (itemsStr) {
        const items = splitSkillItems(itemsStr);
        if (items.length > 0) {
          skills.push({ category, items });
          continue;
        }
      }
    }

    // Plain line → add to general items
    const items = splitSkillItems(noBullet);
    generalItems.push(...items);
  }

  if (generalItems.length > 0 && skills.length === 0) {
    skills.push({ category: "General", items: generalItems });
  }

  return skills;
}

function splitSkillItems(str: string): string[] {
  // Split on comma or pipe
  return str
    .split(/[,|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parsePublicationsBlock(content: string): ParsedResume["publications"] {
  const lines = content.split("\n");
  const publications: ParsedResume["publications"] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Only process bullet lines
    if (!/^[-*]\s+/.test(trimmed)) continue;

    const text = trimmed.replace(/^[-*]\s+/, "").trim();
    const pub = parsePublicationLine(text);
    if (pub) publications.push(pub);
  }

  // If no bullets found, try indented key-value format
  if (publications.length === 0) {
    const indented = parseIndentedPublicationsBlock(content);
    if (indented.length > 0) return indented;

    // Last resort: try processing all non-empty lines
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const pub = parsePublicationLine(trimmed);
      if (pub) publications.push(pub);
    }
  }

  return publications;
}

function parsePublicationLine(text: string): ParsedResume["publications"][number] | null {
  if (!text) return null;

  let title = text;
  let publisher: string | null = null;
  let date: string | null = null;
  let url: string | null = null;
  let description: string | null = null;

  // Extract URL
  const urlMatch = text.match(URL_REGEX);
  if (urlMatch) {
    url = urlMatch[0];
    text = text.replace(urlMatch[0], "").trim();
  }

  // Try "**Title** -- Publisher, Date. Description"
  const boldTitleMatch = text.match(/^\*\*(.+?)\*\*\s*(?:--\s*|[—–]\s*)?(.*)$/);
  if (boldTitleMatch) {
    title = boldTitleMatch[1].trim();
    const rest = boldTitleMatch[2].trim();

    if (rest) {
      // Try to split "Publisher, Date. Description"
      const dotSplit = rest.split(/\.\s*/);
      const firstPart = dotSplit[0];

      // Check if firstPart has "Publisher, Date" pattern
      const commaMatch = firstPart.match(/^(.+?),\s*(.+)$/);
      if (commaMatch) {
        const possibleDate = parseDate(commaMatch[2].trim());
        if (possibleDate) {
          publisher = commaMatch[1].trim();
          date = possibleDate;
        } else {
          publisher = firstPart.trim();
        }
      } else {
        // Try as date
        const possibleDate = parseDate(firstPart.trim());
        if (possibleDate) {
          date = possibleDate;
        } else if (firstPart.trim()) {
          publisher = firstPart.trim();
        }
      }

      if (dotSplit.length > 1) {
        description = dotSplit.slice(1).join(". ").trim() || null;
      }
    }
  }

  // If no bold title was matched, try period-delimited plain-text citation
  // e.g., "Title. Journal, Year, Volume, Pages."
  if (!boldTitleMatch && !publisher && !date) {
    const periodParts = text.split(/\.\s+/);
    if (periodParts.length >= 2) {
      title = periodParts[0].trim();
      const rest = periodParts.slice(1).join(". ").trim();

      // Try to extract journal and year from rest
      // Pattern: "Journal, Year, Volume, Pages" or "Journal, Year."
      const yearMatch = rest.match(/(\d{4})/);
      if (yearMatch) {
        date = parseDate(yearMatch[1]);
        // Everything before the year in the same segment is likely the publisher/journal
        const beforeYear = rest.substring(0, rest.indexOf(yearMatch[0])).replace(/,\s*$/, "").trim();
        if (beforeYear) {
          publisher = beforeYear;
        }
        description = rest.replace(/\.\s*$/, "").trim() || null;
      } else {
        description = rest.replace(/\.\s*$/, "").trim() || null;
      }
    }
  }

  // Clean up trailing punctuation from title
  title = title.replace(/[.,;:]+$/, "").trim();

  return title ? { title, publisher, date, url, description } : null;
}

// ─── CV Format Utilities ────────────────────────────────────────────────────

/**
 * Strip indented comment lines (4+ spaces then #) and horizontal rules (---+).
 */
function preprocessMarkdown(markdown: string): string {
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
function parseIndentedKeyValues(content: string): Map<string, string[]> {
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
 * Parse a ## Contact block with indented key-value pairs.
 */
function parseContactBlock(content: string): Partial<ParsedResume["contact"]> {
  const kv = parseIndentedKeyValues(content);
  const contact: Partial<ParsedResume["contact"]> = {};

  for (const [key, values] of kv) {
    const keyLower = key.toLowerCase();
    const val = values[0]?.trim();
    if (!val) continue;

    if (keyLower === "name") {
      contact.fullName = val;
    } else if (keyLower === "email") {
      contact.email = val;
    } else if (keyLower.includes("phone")) {
      contact.phone = val;
    } else if (keyLower === "location") {
      contact.location = val;
    } else if (keyLower.includes("linkedin")) {
      // Handle markdown link syntax [text](url)
      const linkMatch = val.match(/\[.*?\]\((.*?)\)/);
      contact.linkedIn = linkMatch ? linkMatch[1] : val;
    }
  }

  return contact;
}

/**
 * Experience indicator labels that signal an H2 is a company/experience block.
 */
const EXPERIENCE_INDICATORS = [
  "timeframe", "relevant titles", "key wins",
  "relevant experience", "leadership style", "leadership",
  "titles", "experiences", "notable clients",
];

/**
 * Check if content has enough experience indicators to be treated as an experience block.
 */
function looksLikeExperienceBlock(content: string): boolean {
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
 * Parse an indented experience block where the H2 heading is the company name.
 * Handles both simple (no H3 sub-roles) and complex (H3 sub-roles like BASF).
 */
function parseIndentedExperienceBlock(
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
  h3Matches: RegExpExecArray[] | RegExpMatchArray[]
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

/**
 * Extract bullet points from indented values, handling sub-indented items.
 */
function extractBullets(values: string[]): string[] {
  const bullets: string[] = [];
  for (const v of values) {
    const stripped = v.replace(/^[-*]\s+/, "").trim();
    if (stripped) {
      bullets.push(stripped);
    }
  }
  return bullets;
}

function formatSubsectionLabel(key: string): string {
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
 * Indented education fallback: unindented lines = institutions,
 * indented lines = degree, field, dates.
 */
function parseIndentedEducationBlock(content: string): ParsedResume["education"] {
  const entries: ParsedResume["education"] = [];
  const kv = parseIndentedKeyValues(content);

  for (const [key, values] of kv) {
    if (!values.length) continue;

    const institution = key;
    let degree = "";
    let fieldOfStudy: string | null = null;
    let startDate: string | null = null;
    let endDate: string | null = null;

    for (const v of values) {
      // Try as date range
      const dateResult = parseDateRange(v);
      if (dateResult.start) {
        startDate = dateResult.start;
        endDate = dateResult.end;
        continue;
      }

      // First non-date value = degree, second = field of study
      if (!degree) {
        degree = v;
      } else if (!fieldOfStudy) {
        fieldOfStudy = v;
      }
    }

    entries.push({
      institution,
      degree,
      fieldOfStudy,
      startDate,
      endDate,
      gpa: null,
      honors: null,
      notes: null,
    });
  }

  return entries;
}

/**
 * Indented skills fallback: unindented lines = category names,
 * indented lines = items.
 */
function parseIndentedSkillsBlock(content: string): ParsedResume["skills"] {
  const skills: ParsedResume["skills"] = [];
  const kv = parseIndentedKeyValues(content);

  for (const [category, values] of kv) {
    if (!values.length) continue;
    // Flatten all indented lines as items
    const items: string[] = [];
    for (const v of values) {
      items.push(v);
    }
    if (items.length > 0) {
      skills.push({ category, items });
    }
  }

  return skills;
}

/**
 * Indented publications fallback: unindented lines = category labels (skipped),
 * indented lines = citation entries.
 */
function parseIndentedPublicationsBlock(content: string): ParsedResume["publications"] {
  const publications: ParsedResume["publications"] = [];
  const kv = parseIndentedKeyValues(content);

  for (const [, values] of kv) {
    for (const v of values) {
      const pub = parsePublicationLine(v);
      if (pub) publications.push(pub);
    }
  }

  return publications;
}

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
