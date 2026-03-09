/**
 * Skills section parsing for resumes.
 */

import type { ParsedResume } from "./index";
import { parseIndentedKeyValues } from "./utils";

// ─── Skills Parsing ─────────────────────────────────────────────────────────

export function parseSkillsBlock(content: string): ParsedResume["skills"] {
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
