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

export function htmlToMarkdown(html: string): string {
  try {
    return turndown.turndown(html).trim();
  } catch {
    return `<!-- Markdown conversion failed -->\n${html}`;
  }
}
