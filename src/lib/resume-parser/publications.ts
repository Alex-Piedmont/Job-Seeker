/**
 * Publications section parsing for resumes.
 */

import type { ParsedResume } from "./index";
import { URL_REGEX, parseDate, parseIndentedKeyValues } from "./utils";

// ─── Publications Parsing ───────────────────────────────────────────────────

export function parsePublicationsBlock(content: string): ParsedResume["publications"] {
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
