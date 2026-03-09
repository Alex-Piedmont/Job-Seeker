import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

// Remove style and script tags
turndown.remove(["style", "script", "noscript"]);

// Clean up ATS-specific markup
turndown.addRule("removeEmptyParagraphs", {
  filter: (node) =>
    node.nodeName === "P" && (node.textContent?.trim() ?? "") === "",
  replacement: () => "",
});

turndown.addRule("preserveLineBreaks", {
  filter: "br",
  replacement: () => "\n",
});

/**
 * Decode HTML entities (e.g. `&lt;h2&gt;` → `<h2>`).
 * Some ATS APIs (notably Greenhouse) return entity-encoded HTML
 * instead of raw HTML in their content fields.
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#xa0;/g, "\u00A0")
    .replace(/&nbsp;/g, "\u00A0");
}

export function htmlToMarkdown(html: string): string {
  try {
    // Detect entity-encoded HTML (e.g. from Greenhouse API)
    const decoded = html.includes("&lt;") ? decodeHtmlEntities(html) : html;
    return turndown.turndown(decoded).trim();
  } catch {
    return `<!-- Markdown conversion failed -->\n${html}`;
  }
}
