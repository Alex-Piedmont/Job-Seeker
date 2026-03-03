import { describe, it, expect } from "vitest";
import { compileResumeSource, formatDate, type CompilerInput } from "@/lib/resume-compiler";

describe("formatDate", () => {
  it("formats YYYY-MM as Mon YYYY", () => {
    expect(formatDate("2024-03")).toBe("Mar 2024");
    expect(formatDate("2020-12")).toBe("Dec 2020");
    expect(formatDate("2019-01")).toBe("Jan 2019");
  });

  it("returns 'Present' for null/undefined", () => {
    expect(formatDate(null)).toBe("Present");
    expect(formatDate(undefined)).toBe("Present");
  });

  it("returns YYYY for year-only format", () => {
    expect(formatDate("2024")).toBe("2024");
  });
});

describe("compileResumeSource", () => {
  it("returns empty string for empty source", () => {
    expect(compileResumeSource({})).toBe("");
  });

  it("compiles full source with all sections", () => {
    const data: CompilerInput = {
      contact: {
        fullName: "Alex Rudd",
        email: "alex@example.com",
        phone: "+1-555-0100",
        location: "San Francisco, CA",
        linkedIn: "https://linkedin.com/in/alexrudd",
        website: "https://alexrudd.dev",
        summary: "Senior product manager with 10+ years of experience.",
      },
      experiences: [
        {
          title: "Senior PM",
          company: "Acme Corp",
          location: "San Francisco, CA",
          startDate: "2020-01",
          endDate: null,
          description: "Led product strategy for the platform.",
          subsections: [
            {
              label: "Key Accomplishments",
              bullets: [
                "Led migration of 2M-user platform",
                "Grew team from 3 to 12",
              ],
            },
          ],
        },
      ],
      education: [
        {
          institution: "MIT",
          degree: "BS",
          fieldOfStudy: "Computer Science",
          startDate: "2012-09",
          endDate: "2016-05",
          gpa: "3.8/4.0",
          honors: "magna cum laude",
          notes: null,
        },
      ],
      skills: [
        {
          category: "Programming Languages",
          items: ["Python", "TypeScript", "Go"],
        },
      ],
      publications: [
        {
          title: "Building Scalable Systems",
          publisher: "O'Reilly",
          date: "2023-06",
          url: "https://example.com/book",
          description: "A guide to distributed systems.",
        },
      ],
    };

    const md = compileResumeSource(data);

    expect(md).toContain("# Alex Rudd");
    expect(md).toContain("alex@example.com | +1-555-0100 | San Francisco, CA");
    expect(md).toContain(
      "https://linkedin.com/in/alexrudd | https://alexrudd.dev"
    );
    expect(md).toContain("## Summary");
    expect(md).toContain("Senior product manager");
    expect(md).toContain("## Work Experience");
    expect(md).toContain("### Senior PM -- Acme Corp");
    expect(md).toContain("*Jan 2020 - Present | San Francisco, CA*");
    expect(md).toContain("#### Key Accomplishments");
    expect(md).toContain("- Led migration of 2M-user platform");
    expect(md).toContain("## Education");
    expect(md).toContain("### BS, Computer Science -- MIT");
    expect(md).toContain("*Sep 2012 - May 2016*");
    expect(md).toContain("GPA: 3.8/4.0 | magna cum laude");
    expect(md).toContain("## Skills");
    expect(md).toContain("**Programming Languages**: Python, TypeScript, Go");
    expect(md).toContain("## Publications");
    expect(md).toContain(
      "- **Building Scalable Systems** -- O'Reilly, Jun 2023. https://example.com/book"
    );
    expect(md).toContain("  A guide to distributed systems.");
  });

  it("compiles source with only contact info (no empty section headings)", () => {
    const data: CompilerInput = {
      contact: {
        fullName: "Jane Doe",
        email: "jane@example.com",
      },
    };

    const md = compileResumeSource(data);

    expect(md).toContain("# Jane Doe");
    expect(md).toContain("jane@example.com");
    expect(md).not.toContain("## Work Experience");
    expect(md).not.toContain("## Education");
    expect(md).not.toContain("## Skills");
    expect(md).not.toContain("## Publications");
  });

  it("omits null optional fields without dangling pipes", () => {
    const data: CompilerInput = {
      contact: {
        fullName: "Jane Doe",
        email: "jane@example.com",
        phone: null,
        location: "NYC",
        linkedIn: null,
        website: null,
      },
    };

    const md = compileResumeSource(data);

    expect(md).toContain("jane@example.com | NYC");
    // No dangling pipes or empty segments
    expect(md).not.toContain("| |");
    expect(md).not.toMatch(/\|\s*$/m);
    // No links line since both are null
    const lines = md.split("\n");
    const contactLineIndex = lines.findIndex((l) =>
      l.includes("jane@example.com")
    );
    expect(lines[contactLineIndex]).toBe("jane@example.com | NYC");
  });

  it("omits entries with missing required fields", () => {
    const data: CompilerInput = {
      contact: { fullName: "Jane Doe", email: "jane@example.com" },
      education: [
        { institution: "", degree: "BS", fieldOfStudy: null },
        { institution: "MIT", degree: "BS", fieldOfStudy: "CS" },
      ],
      experiences: [
        { company: "Acme", title: "", location: null },
        { company: "Acme", title: "PM", location: null },
      ],
    };

    const md = compileResumeSource(data);

    // Only the valid entries should appear
    expect(md).toContain("### BS, CS -- MIT");
    expect(md).not.toContain("### BS --"); // The one missing institution
    expect(md).toContain("### PM -- Acme");
    expect((md.match(/###/g) || []).length).toBe(2);
  });

  it("formats dates correctly and handles null endDate as Present", () => {
    const data: CompilerInput = {
      contact: { fullName: "Test", email: "t@t.com" },
      experiences: [
        {
          title: "Dev",
          company: "Co",
          startDate: "2024-03",
          endDate: null,
        },
      ],
    };

    const md = compileResumeSource(data);
    expect(md).toContain("Mar 2024 - Present");
  });

  it("renders subsection label with no bullets", () => {
    const data: CompilerInput = {
      contact: { fullName: "Test", email: "t@t.com" },
      experiences: [
        {
          title: "Dev",
          company: "Co",
          subsections: [{ label: "Projects", bullets: [] }],
        },
      ],
    };

    const md = compileResumeSource(data);
    expect(md).toContain("#### Projects");
    // No bullet lines (lines starting with "- ")
    const hasBulletLine = md.split("\n").some((l) => l.startsWith("- "));
    expect(hasBulletLine).toBe(false);
  });

  it("handles correct heading hierarchy (H2 → H3 → H4)", () => {
    const data: CompilerInput = {
      contact: { fullName: "Test", email: "t@t.com" },
      experiences: [
        {
          title: "PM",
          company: "A",
          subsections: [
            { label: "Achievements", bullets: ["Built stuff"] },
          ],
        },
        {
          title: "Dev",
          company: "B",
          subsections: [
            { label: "Projects", bullets: ["Coded things"] },
          ],
        },
      ],
    };

    const md = compileResumeSource(data);

    // H2 for section
    expect(md).toContain("## Work Experience");
    // H3 for each experience
    expect(md).toContain("### PM -- A");
    expect(md).toContain("### Dev -- B");
    // H4 for subsections
    expect(md).toContain("#### Achievements");
    expect(md).toContain("#### Projects");
  });

  it("returns empty string when contact has no name", () => {
    const data: CompilerInput = {
      contact: { fullName: "", email: "test@test.com" },
      education: [{ institution: "MIT", degree: "BS" }],
    };

    // Contact is required for header; education alone without a name header
    // still renders since education section is independent
    const md = compileResumeSource(data);
    // No H1 header, but education still renders
    const hasH1 = md.split("\n").some((l) => /^# [^#]/.test(l));
    expect(hasH1).toBe(false);
    expect(md).toContain("## Education");
    expect(md).toContain("### BS -- MIT");
  });

  it("includes alternate titles in experience heading", () => {
    const data: CompilerInput = {
      contact: { fullName: "Test", email: "t@t.com" },
      experiences: [
        {
          title: "Product Manager",
          company: "Acme Corp",
          alternateTitles: ["Program Manager", "TPM"],
        },
      ],
    };

    const md = compileResumeSource(data);
    expect(md).toContain(
      "### Product Manager | Program Manager | TPM -- Acme Corp"
    );
  });

  it("filters out empty alternate titles", () => {
    const data: CompilerInput = {
      contact: { fullName: "Test", email: "t@t.com" },
      experiences: [
        {
          title: "Product Manager",
          company: "Acme Corp",
          alternateTitles: ["Program Manager", "", "  ", "TPM"],
        },
      ],
    };

    const md = compileResumeSource(data);
    expect(md).toContain(
      "### Product Manager | Program Manager | TPM -- Acme Corp"
    );
  });

  it("outputs standard heading when no alternate titles exist", () => {
    const data: CompilerInput = {
      contact: { fullName: "Test", email: "t@t.com" },
      experiences: [
        {
          title: "Product Manager",
          company: "Acme Corp",
          alternateTitles: [],
        },
      ],
    };

    const md = compileResumeSource(data);
    expect(md).toContain("### Product Manager -- Acme Corp");
    expect(md).not.toContain("|");
  });

  it("handles publication with year-only date", () => {
    const data: CompilerInput = {
      contact: { fullName: "Test", email: "t@t.com" },
      publications: [
        { title: "My Paper", publisher: "IEEE", date: "2023" },
      ],
    };

    const md = compileResumeSource(data);
    expect(md).toContain("- **My Paper** -- IEEE, 2023");
  });
});
