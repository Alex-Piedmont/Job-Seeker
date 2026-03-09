// Note: This test imports turndown transitively via html-to-md.
// If turndown is not resolvable from the root project's node_modules,
// this test will fail at import time. Install turndown in the root
// or configure vitest's resolve.alias to point at scraper/node_modules.

import { describe, it, expect } from "vitest";
import { htmlToMarkdown } from "../html-to-md";

describe("htmlToMarkdown", () => {
  it("converts simple paragraph", () => {
    expect(htmlToMarkdown("<p>Hello world</p>")).toBe("Hello world");
  });

  it("converts bold and italic", () => {
    const result = htmlToMarkdown(
      "<p><strong>Bold</strong> and <em>italic</em></p>"
    );
    expect(result).toContain("**Bold**");
    expect(result).toMatch(/[_*]italic[_*]/);
  });

  it("converts unordered list", () => {
    const result = htmlToMarkdown(
      "<ul><li>Item 1</li><li>Item 2</li></ul>"
    );
    expect(result).toMatch(/-\s+Item 1/);
    expect(result).toMatch(/-\s+Item 2/);
  });

  it("converts heading", () => {
    expect(htmlToMarkdown("<h2>Section</h2>")).toBe("## Section");
  });

  it("converts link", () => {
    expect(
      htmlToMarkdown('<a href="https://example.com">Click</a>')
    ).toBe("[Click](https://example.com)");
  });

  it("removes empty paragraphs", () => {
    expect(htmlToMarkdown("<p></p><p>Content</p>")).toBe("Content");
  });

  it("removes script tags", () => {
    expect(
      htmlToMarkdown("<script>alert(1)</script><p>Safe</p>")
    ).toBe("Safe");
  });

  it("returns HTML with comment on conversion failure", () => {
    const result = htmlToMarkdown("");
    expect(typeof result).toBe("string");
  });

  it("decodes entity-encoded HTML (Greenhouse API format)", () => {
    const encoded =
      "&lt;h2&gt;&lt;strong&gt;Who we are&lt;/strong&gt;&lt;/h2&gt;&lt;p&gt;Description&lt;/p&gt;";
    const result = htmlToMarkdown(encoded);
    expect(result).toBe("## **Who we are**\n\nDescription");
  });

  it("decodes &amp; &quot; and &#39; entities", () => {
    const encoded = "&lt;p&gt;A &amp;amp; B &amp;quot;quoted&amp;quot; it&amp;#39;s&lt;/p&gt;";
    const result = htmlToMarkdown(encoded);
    expect(result).toContain('A & B "quoted" it\'s');
  });
});
