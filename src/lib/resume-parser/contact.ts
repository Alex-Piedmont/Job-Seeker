/**
 * Contact information parsing for resumes.
 */

import type { ParsedResume } from "./index";
import {
  EMAIL_REGEX,
  PHONE_REGEX,
  URL_REGEX,
  LINKEDIN_REGEX,
  parseIndentedKeyValues,
} from "./utils";

// ─── Types ──────────────────────────────────────────────────────────────────

type ContactInfo = {
  email: string;
  phone: string | null;
  location: string | null;
  linkedIn: string | null;
  website: string | null;
};

// ─── Contact Line Detection ─────────────────────────────────────────────────

export function extractContactFromLines(lines: string[]): ContactInfo {
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

/**
 * Parse a ## Contact block with indented key-value pairs.
 */
export function parseContactBlock(content: string): Partial<ParsedResume["contact"]> {
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
