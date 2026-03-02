import { describe, it, expect } from "vitest";
import { markdownToDocx, sanitizeFilename } from "../docx-generator";

describe("markdownToDocx", () => {
  it("produces a valid buffer from markdown", async () => {
    const md = `# John Doe
john@example.com | 555-1234 | San Francisco, CA

## Summary
Experienced engineer.

## Work Experience

### Senior Engineer -- Acme Corp
*Jan 2020 - Present | Remote*

#### Key Projects
- Led migration to microservices, reducing latency by 40%
- Built CI/CD pipeline serving 50+ engineers

## Education

### BS Computer Science -- MIT
*2012 - 2016*

## Skills
**Languages**: JavaScript, TypeScript, Python
**Frameworks**: React, Node.js`;

    const buffer = await markdownToDocx(md);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    // DOCX files start with PK zip signature
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });

  it("handles empty input gracefully", async () => {
    const buffer = await markdownToDocx("");
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("handles markdown with only bullets", async () => {
    const md = `- First bullet
- Second bullet
- Third bullet`;
    const buffer = await markdownToDocx(md);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it("handles unknown/plain text gracefully", async () => {
    const md = `Just some plain text
with multiple lines
and no markdown formatting`;
    const buffer = await markdownToDocx(md);
    expect(buffer).toBeInstanceOf(Buffer);
  });
});

describe("sanitizeFilename", () => {
  it("creates a clean filename", () => {
    expect(sanitizeFilename("Acme Corp", "Software Engineer")).toBe(
      "Resume-Acme-Corp-Software-Engineer"
    );
  });

  it("handles special characters", () => {
    expect(sanitizeFilename("O'Brien & Co.", "Sr. Dev/Ops")).toBe(
      "Resume-O-Brien-Co-Sr-Dev-Ops"
    );
  });

  it("collapses consecutive hyphens", () => {
    expect(sanitizeFilename("Acme   Inc", "Dev")).toBe("Resume-Acme-Inc-Dev");
  });
});
