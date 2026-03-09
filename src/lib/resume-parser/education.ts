/**
 * Education section parsing for resumes.
 */

import type { ParsedResume } from "./index";
import {
  HONORS_PATTERNS,
  parseDateRange,
  parseIndentedKeyValues,
} from "./utils";

// ─── Education Parsing ──────────────────────────────────────────────────────

export function parseEducationBlock(content: string): ParsedResume["education"] {
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
