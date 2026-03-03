import { describe, it, expect } from "vitest";
import {
  parseResumeMarkdown,
  parseDate,
  parseDateRange,
} from "@/lib/resume-parser";

// ─── Date Parsing ───────────────────────────────────────────────────────────

describe("parseDate", () => {
  it("parses Month YYYY formats", () => {
    expect(parseDate("Jan 2020")).toBe("2020-01");
    expect(parseDate("January 2020")).toBe("2020-01");
    expect(parseDate("Dec 2022")).toBe("2022-12");
    expect(parseDate("September 2019")).toBe("2019-09");
    expect(parseDate("Sept 2019")).toBe("2019-09");
  });

  it("parses YYYY-MM format", () => {
    expect(parseDate("2020-01")).toBe("2020-01");
    expect(parseDate("2022-12")).toBe("2022-12");
  });

  it("parses YYYY only", () => {
    expect(parseDate("2020")).toBe("2020");
  });

  it("parses MM/YYYY format", () => {
    expect(parseDate("01/2020")).toBe("2020-01");
    expect(parseDate("12/2022")).toBe("2022-12");
  });

  it("returns null for Present/Current", () => {
    expect(parseDate("Present")).toBeNull();
    expect(parseDate("Current")).toBeNull();
    expect(parseDate("present")).toBeNull();
  });

  it("returns null for unparsable dates", () => {
    expect(parseDate("Summer 2019")).toBeNull();
    expect(parseDate("Q3 2020")).toBeNull();
    expect(parseDate("")).toBeNull();
  });

  it("parses YYYY-MM-DD → YYYY-MM", () => {
    expect(parseDate("2020-01-15")).toBe("2020-01");
  });
});

describe("parseDateRange", () => {
  it("parses 'Month YYYY - Month YYYY'", () => {
    const result = parseDateRange("Jan 2020 - Dec 2022");
    expect(result).toEqual({ start: "2020-01", end: "2022-12" });
  });

  it("parses 'Month YYYY - Present'", () => {
    const result = parseDateRange("Jan 2020 - Present");
    expect(result).toEqual({ start: "2020-01", end: null });
  });

  it("parses 'YYYY - YYYY'", () => {
    const result = parseDateRange("2020 - 2022");
    expect(result).toEqual({ start: "2020", end: "2022" });
  });

  it("parses single date", () => {
    const result = parseDateRange("2020");
    expect(result).toEqual({ start: "2020", end: "2020" });
  });

  it("handles en dash and em dash", () => {
    expect(parseDateRange("Jan 2020 – Dec 2022")).toEqual({
      start: "2020-01",
      end: "2022-12",
    });
    expect(parseDateRange("Jan 2020 — Present")).toEqual({
      start: "2020-01",
      end: null,
    });
  });
});

// ─── Full Parser ────────────────────────────────────────────────────────────

describe("parseResumeMarkdown", () => {
  it("returns empty defaults for empty string", () => {
    const result = parseResumeMarkdown("");
    expect(result.contact.fullName).toBe("");
    expect(result.contact.email).toBe("");
    expect(result.experiences).toEqual([]);
    expect(result.education).toEqual([]);
    expect(result.skills).toEqual([]);
    expect(result.publications).toEqual([]);
    expect(result.customSections).toEqual([]);
    expect(result.miscellaneous).toBeNull();
  });

  it("parses H1 as fullName", () => {
    const result = parseResumeMarkdown("# John Doe");
    expect(result.contact.fullName).toBe("John Doe");
  });

  it("parses contact lines under H1", () => {
    const md = `# John Doe
john@example.com | (555) 123-4567 | San Francisco, CA
https://linkedin.com/in/johndoe | https://johndoe.dev`;

    const result = parseResumeMarkdown(md);
    expect(result.contact.fullName).toBe("John Doe");
    expect(result.contact.email).toBe("john@example.com");
    expect(result.contact.phone).toBe("(555) 123-4567");
    expect(result.contact.location).toBe("San Francisco, CA");
    expect(result.contact.linkedIn).toBe("https://linkedin.com/in/johndoe");
    expect(result.contact.website).toBe("https://johndoe.dev");
  });

  it("parses summary section", () => {
    const md = `# John Doe

## Summary

Experienced engineer with 10+ years in distributed systems.`;

    const result = parseResumeMarkdown(md);
    expect(result.contact.summary).toBe(
      "Experienced engineer with 10+ years in distributed systems."
    );
  });

  it("maps variant summary headings", () => {
    for (const heading of [
      "Professional Summary",
      "Objective",
      "Profile",
      "About",
    ]) {
      const md = `# Name\n\n## ${heading}\n\nSome summary text.`;
      const result = parseResumeMarkdown(md);
      expect(result.contact.summary).toBe("Some summary text.");
    }
  });

  it("parses work experience with title -- company", () => {
    const md = `# John Doe

## Work Experience

### Senior Engineer -- Acme Corp
*Jan 2020 - Present | San Francisco, CA*

Led platform engineering team.

#### Key Accomplishments
- Reduced latency by 40%
- Launched new microservice architecture`;

    const result = parseResumeMarkdown(md);
    expect(result.experiences).toHaveLength(1);
    const exp = result.experiences[0];
    expect(exp.title).toBe("Senior Engineer");
    expect(exp.company).toBe("Acme Corp");
    expect(exp.startDate).toBe("2020-01");
    expect(exp.endDate).toBeNull();
    expect(exp.location).toBe("San Francisco, CA");
    expect(exp.description).toBe("Led platform engineering team.");
    expect(exp.subsections).toHaveLength(1);
    expect(exp.subsections[0].label).toBe("Key Accomplishments");
    expect(exp.subsections[0].bullets).toEqual([
      "Reduced latency by 40%",
      "Launched new microservice architecture",
    ]);
  });

  it("parses 'Title at Company' pattern", () => {
    const md = `## Experience

### Software Engineer at Google
*2018 - 2020*

- Built search features`;

    const result = parseResumeMarkdown(md);
    expect(result.experiences[0].title).toBe("Software Engineer");
    expect(result.experiences[0].company).toBe("Google");
  });

  it("parses 'Title, Company' pattern", () => {
    const md = `## Experience

### Software Engineer, Google
*2018 - 2020*`;

    const result = parseResumeMarkdown(md);
    expect(result.experiences[0].title).toBe("Software Engineer");
    expect(result.experiences[0].company).toBe("Google");
  });

  it("parses education with degree -- institution", () => {
    const md = `## Education

### Bachelor of Science, Computer Science -- MIT
*2014 - 2018*
GPA: 3.9
Magna Cum Laude`;

    const result = parseResumeMarkdown(md);
    expect(result.education).toHaveLength(1);
    const edu = result.education[0];
    expect(edu.degree).toBe("Bachelor of Science");
    expect(edu.fieldOfStudy).toBe("Computer Science");
    expect(edu.institution).toBe("MIT");
    expect(edu.startDate).toBe("2014");
    expect(edu.endDate).toBe("2018");
    expect(edu.gpa).toBe("3.9");
    expect(edu.honors).toBe("Magna Cum Laude");
  });

  it("parses skills with bold categories", () => {
    const md = `## Skills

**Languages**: Python, JavaScript, TypeScript, Go
**Frameworks**: React, Next.js, Django
**Cloud**: AWS, GCP, Docker, Kubernetes`;

    const result = parseResumeMarkdown(md);
    expect(result.skills).toHaveLength(3);
    expect(result.skills[0].category).toBe("Languages");
    expect(result.skills[0].items).toEqual([
      "Python",
      "JavaScript",
      "TypeScript",
      "Go",
    ]);
    expect(result.skills[1].category).toBe("Frameworks");
    expect(result.skills[2].category).toBe("Cloud");
  });

  it("parses skills with colon inside bold", () => {
    const md = `## Skills

**Languages:** Python, JavaScript, Go`;

    const result = parseResumeMarkdown(md);
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].category).toBe("Languages");
    expect(result.skills[0].items).toEqual(["Python", "JavaScript", "Go"]);
  });

  it("parses skills with pipe separator", () => {
    const md = `## Skills

**Languages**: Python | JavaScript | Go`;

    const result = parseResumeMarkdown(md);
    expect(result.skills[0].items).toEqual(["Python", "JavaScript", "Go"]);
  });

  it("puts uncategorized skills into General", () => {
    const md = `## Skills

- Python
- JavaScript
- Go`;

    const result = parseResumeMarkdown(md);
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].category).toBe("General");
    expect(result.skills[0].items).toEqual(["Python", "JavaScript", "Go"]);
  });

  it("parses publications", () => {
    const md = `## Publications

- **Building Scalable Systems** -- ACM, 2022. https://example.com/paper
  A paper on distributed architecture.`;

    const result = parseResumeMarkdown(md);
    expect(result.publications).toHaveLength(1);
    const pub = result.publications[0];
    expect(pub.title).toBe("Building Scalable Systems");
    expect(pub.publisher).toBe("ACM");
    expect(pub.date).toBe("2022");
    expect(pub.url).toBe("https://example.com/paper");
  });

  it("creates custom sections for unrecognized headings", () => {
    const md = `# John Doe

## Certifications

- AWS Solutions Architect, 2023
- Kubernetes Administrator, 2022

## Volunteer Work

Led coding workshops for underserved communities.`;

    const result = parseResumeMarkdown(md);
    expect(result.customSections).toHaveLength(2);
    expect(result.customSections[0].title).toBe("Certifications");
    expect(result.customSections[0].content).toContain("AWS Solutions Architect");
    expect(result.customSections[1].title).toBe("Volunteer Work");
    expect(result.customSections[1].content).toContain("Led coding workshops");
  });

  it("puts preamble content (before headings) into miscellaneous", () => {
    const md = `Some random text before any heading.

# John Doe

## Experience

### Engineer -- Acme
*2020 - Present*`;

    const result = parseResumeMarkdown(md);
    expect(result.miscellaneous).toBe("Some random text before any heading.");
    expect(result.contact.fullName).toBe("John Doe");
  });

  it("puts all content into miscellaneous when there are no headings", () => {
    const md = `Just some plain text without any headings.
Another line of text.`;

    const result = parseResumeMarkdown(md);
    expect(result.miscellaneous).toContain("Just some plain text");
    expect(result.contact.fullName).toBe("");
  });

  it("defaults fullName to empty when no H1 present", () => {
    const md = `## Skills

**Languages**: Python, JavaScript`;

    const result = parseResumeMarkdown(md);
    expect(result.contact.fullName).toBe("");
    expect(result.skills).toHaveLength(1);
  });

  it("treats multiple H1s correctly: first is name, rest are custom", () => {
    const md = `# John Doe

## Experience

### Engineer -- Acme
*2020 - Present*

# References

Available upon request.`;

    const result = parseResumeMarkdown(md);
    expect(result.contact.fullName).toBe("John Doe");
    expect(result.customSections).toHaveLength(1);
    expect(result.customSections[0].title).toBe("References");
    expect(result.customSections[0].content).toBe("Available upon request.");
  });

  it("handles heading matching case-insensitively", () => {
    const md = `## WORK EXPERIENCE

### Engineer -- Acme
*2020 - 2022*`;

    const result = parseResumeMarkdown(md);
    expect(result.experiences).toHaveLength(1);
  });

  it("strips trailing colons from headings", () => {
    const md = `## Skills:

**Languages**: Python, Go`;

    const result = parseResumeMarkdown(md);
    expect(result.skills).toHaveLength(1);
  });

  it("parses multiple experience entries", () => {
    const md = `## Work Experience

### Senior Engineer -- Acme Corp
*Jan 2020 - Present*

- Led platform team

### Junior Engineer -- Startup Inc
*Jun 2017 - Dec 2019*

- Built web features`;

    const result = parseResumeMarkdown(md);
    expect(result.experiences).toHaveLength(2);
    expect(result.experiences[0].title).toBe("Senior Engineer");
    expect(result.experiences[0].company).toBe("Acme Corp");
    expect(result.experiences[1].title).toBe("Junior Engineer");
    expect(result.experiences[1].company).toBe("Startup Inc");
  });

  it("parses a comprehensive resume", () => {
    const md = `# Alex Rudd
alex@example.com | (555) 123-4567 | San Francisco, CA
https://linkedin.com/in/alexrudd | https://alexrudd.dev

## Professional Summary

Senior product manager with 10+ years building developer tools.

## Work Experience

### Senior PM -- Acme Corp
*Jan 2020 - Present | San Francisco, CA*

Led product strategy for the developer platform.

#### Key Accomplishments
- Grew platform revenue 3x
- Launched API marketplace

### Product Manager -- Beta Inc
*Jun 2017 - Dec 2019 | New York, NY*

#### Achievements
- Shipped mobile app v2.0

## Education

### MBA -- Stanford GSB
*2015 - 2017*

### BS, Computer Science -- UC Berkeley
*2011 - 2015*
GPA: 3.8
Dean's List

## Skills

**Languages**: Python, JavaScript, SQL
**Tools**: Jira, Figma, Amplitude

## Publications

- **Product-Led Growth** -- O'Reilly, 2023. https://example.com/plg

## Certifications

- PMP, 2021
- CSPO, 2020

## Languages

English (Native), Spanish (Conversational)`;

    const result = parseResumeMarkdown(md);

    // Contact
    expect(result.contact.fullName).toBe("Alex Rudd");
    expect(result.contact.email).toBe("alex@example.com");
    expect(result.contact.phone).toBe("(555) 123-4567");
    expect(result.contact.summary).toContain("Senior product manager");

    // Experience
    expect(result.experiences).toHaveLength(2);
    expect(result.experiences[0].subsections).toHaveLength(1);
    expect(result.experiences[0].subsections[0].bullets).toHaveLength(2);

    // Education
    expect(result.education).toHaveLength(2);
    expect(result.education[0].degree).toBe("MBA");
    expect(result.education[0].institution).toBe("Stanford GSB");
    expect(result.education[1].fieldOfStudy).toBe("Computer Science");
    expect(result.education[1].gpa).toBe("3.8");
    expect(result.education[1].honors).toBe("Dean's List");

    // Skills
    expect(result.skills).toHaveLength(2);

    // Publications
    expect(result.publications).toHaveLength(1);
    expect(result.publications[0].title).toBe("Product-Led Growth");

    // Custom sections
    expect(result.customSections).toHaveLength(2);
    expect(result.customSections[0].title).toBe("Certifications");
    expect(result.customSections[1].title).toBe("Languages");

    // No miscellaneous
    expect(result.miscellaneous).toBeNull();
  });

  it("assigns bullets to default subsection when no H4 present", () => {
    const md = `## Experience

### Engineer -- Acme
*2020 - Present*

- Built stuff
- Fixed bugs`;

    const result = parseResumeMarkdown(md);
    expect(result.experiences[0].subsections).toHaveLength(1);
    expect(result.experiences[0].subsections[0].label).toBe("Key Accomplishments");
    expect(result.experiences[0].subsections[0].bullets).toHaveLength(2);
  });

  it("handles variant experience headings", () => {
    for (const heading of [
      "Employment",
      "Employment History",
      "Career History",
      "Professional Experience",
    ]) {
      const md = `## ${heading}\n\n### Engineer -- Acme\n*2020 - Present*`;
      const result = parseResumeMarkdown(md);
      expect(result.experiences).toHaveLength(1);
    }
  });

  it("handles variant education headings", () => {
    for (const heading of ["Academic Background", "Academic History"]) {
      const md = `## ${heading}\n\n### BS -- MIT\n*2018*`;
      const result = parseResumeMarkdown(md);
      expect(result.education).toHaveLength(1);
    }
  });

  it("handles variant publication headings", () => {
    for (const heading of ["Papers", "Research", "Research & Publications"]) {
      const md = `## ${heading}\n\n- **Paper Title** -- Journal, 2023`;
      const result = parseResumeMarkdown(md);
      expect(result.publications).toHaveLength(1);
    }
  });
});

// ─── CV Format Parsing ──────────────────────────────────────────────────────

describe("CV format parsing", () => {
  it("strips indented comment lines and horizontal rules", () => {
    const md = `## Education

Georgia Institute of Technology
    Executive MBA
    # details can be omitted
    2024 - 2025

---

## Skills`;

    const result = parseResumeMarkdown(md);
    // Comments and --- should be stripped; education should parse correctly
    expect(result.education).toHaveLength(1);
    expect(result.education[0].institution).toBe("Georgia Institute of Technology");
  });

  it("parses contact from indented key-value format", () => {
    const md = `## Contact

Name
    Alex Rudd
Location
    Peachtree City GA, 30269
Phone Number
    770-846-8242
Email:
    Paul.Alex.Rudd@gmail.com
LinkedIn Profile
    [text](https://www.linkedin.com/in/alex-rudd-54389158/)`;

    const result = parseResumeMarkdown(md);
    expect(result.contact.fullName).toBe("Alex Rudd");
    expect(result.contact.email).toBe("Paul.Alex.Rudd@gmail.com");
    expect(result.contact.phone).toBe("770-846-8242");
    expect(result.contact.location).toBe("Peachtree City GA, 30269");
    expect(result.contact.linkedIn).toBe("https://www.linkedin.com/in/alex-rudd-54389158/");
  });

  it("parses education from indented format (3 entries)", () => {
    const md = `## Education

Georgia Institute of Technology
    Executive MBA
    Global Business Specialization
    2024 - 2025

University of Minnesota
    Ph.D.
    Chemistry
    2009 - 2014

Emory University
    B.S.
    Chemistry
    2005-2009`;

    const result = parseResumeMarkdown(md);
    expect(result.education).toHaveLength(3);

    expect(result.education[0].institution).toBe("Georgia Institute of Technology");
    expect(result.education[0].degree).toBe("Executive MBA");
    expect(result.education[0].fieldOfStudy).toBe("Global Business Specialization");
    expect(result.education[0].startDate).toBe("2024");
    expect(result.education[0].endDate).toBe("2025");

    expect(result.education[1].institution).toBe("University of Minnesota");
    expect(result.education[1].degree).toBe("Ph.D.");
    expect(result.education[1].fieldOfStudy).toBe("Chemistry");

    expect(result.education[2].institution).toBe("Emory University");
    expect(result.education[2].degree).toBe("B.S.");
    expect(result.education[2].fieldOfStudy).toBe("Chemistry");
  });

  it("parses skills from indented categories", () => {
    const md = `## Skills

General Skills
    Safety
    Sustainability
    Research and Development

Sales Skills
    Sales
    Technical Sales
    Pre-sales
    Account Management

AI and ML
    Python
    Random Forests
    Neural Networks`;

    const result = parseResumeMarkdown(md);
    expect(result.skills.length).toBeGreaterThanOrEqual(3);
    expect(result.skills[0].category).toBe("General Skills");
    expect(result.skills[0].items).toContain("Safety");

    const salesSkills = result.skills.find((s) => s.category === "Sales Skills");
    expect(salesSkills).toBeDefined();
    expect(salesSkills!.items).toContain("Technical Sales");

    const aiSkills = result.skills.find((s) => s.category === "AI and ML");
    expect(aiSkills).toBeDefined();
    expect(aiSkills!.items).toContain("Python");
  });

  it("parses company-as-H2 experience (Workday)", () => {
    const md = `## Workday

Timeframe:
    2024 - 2025

Relevant Titles:
    Senior Product Manager, Product Owner

Key Wins:
    - Led enterprise sales business intelligence transition
    - Led team of 13 for enterprise transitions

Relevant Experience:
    - Led Adoption & Value group
    - Worked closely with Sales Strategy teams

Leadership Style
    - Worked directly with senior managers`;

    const result = parseResumeMarkdown(md);
    expect(result.experiences).toHaveLength(1);
    const exp = result.experiences[0];
    expect(exp.company).toBe("Workday");
    expect(exp.title).toBe("Senior Product Manager, Product Owner");
    expect(exp.startDate).toBe("2024");
    expect(exp.endDate).toBe("2025");
    expect(exp.subsections.length).toBeGreaterThanOrEqual(2);

    const keyWins = exp.subsections.find((s) => s.label === "Key Wins");
    expect(keyWins).toBeDefined();
    expect(keyWins!.bullets).toContain("Led enterprise sales business intelligence transition");
  });

  it("parses BASF with H3 sub-roles as multiple experience entries", () => {
    const md = `## BASF

### IP Management

Timeframe:
    2017 - 2019

Relevant Titles
    R&D Program Manager, Intellectual Property Manager

Key Wins:
    - Wrote R&D innovation strategy

Relevant Experience:
    - Managed innovation efforts for 9 distinct R&D teams

### Leadership Development Program

Timeframe
    2014 - 2016

Titles
    Ph.D. Leadership Development Program

Key Wins
    - The LDP is a highly selective cohort

### Strategic Marketing Manager

Timeframe
    2015 - 2016

Titles
    Marketing Manager, Strategic Marketing Manager

Key Wins
    - Calculated SRM from scratch`;

    const result = parseResumeMarkdown(md);
    expect(result.experiences.length).toBeGreaterThanOrEqual(3);

    const ipMgmt = result.experiences.find((e) => e.title.includes("R&D Program Manager"));
    expect(ipMgmt).toBeDefined();
    expect(ipMgmt!.company).toBe("BASF");
    expect(ipMgmt!.startDate).toBe("2017");
    expect(ipMgmt!.endDate).toBe("2019");

    const ldp = result.experiences.find((e) => e.title.includes("Leadership Development"));
    expect(ldp).toBeDefined();
    expect(ldp!.company).toBe("BASF");
    expect(ldp!.startDate).toBe("2014");

    const marketing = result.experiences.find((e) => e.title.includes("Marketing Manager"));
    expect(marketing).toBeDefined();
    expect(marketing!.company).toBe("BASF");
  });

  it("parses publications from indented citations", () => {
    const md = `## Publications & Patents

Patents
    A Business Consulting Engine. Provisional US Patent Application. October 31, 2024.
    Recyclable Composition for Paper Coating. PCT Application WO2022008730A1. July 9, 2021.

Peer Reviewed Publications
    Pushing the limits of delta bonding in metal-chromium complexes with redox changes and metal swapping. Inorg. Chem., 2015, 54, 7579-7592.
    Student Involvement in Improving the Culture of Safety in Academic Laboratories. J. Chem. Ed., 2013, 90, 1414-1417.`;

    const result = parseResumeMarkdown(md);
    expect(result.publications.length).toBeGreaterThanOrEqual(4);

    const patent = result.publications.find((p) =>
      p.title.includes("Business Consulting Engine")
    );
    expect(patent).toBeDefined();

    const paper = result.publications.find((p) =>
      p.title.includes("Pushing the limits")
    );
    expect(paper).toBeDefined();
  });

  it("ignores Instructions section", () => {
    const md = `## Instructions

This is a complete markdown file of my resume experience.

## Contact

Name
    Alex Rudd
Email:
    alex@example.com`;

    const result = parseResumeMarkdown(md);
    expect(result.customSections.find((s) => s.title === "Instructions")).toBeUndefined();
    expect(result.contact.fullName).toBe("Alex Rudd");
  });

  it("parses the full Alex Rudd CV", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const cvPath = path.resolve(process.cwd(), "Reference Materials/Alex Rudd CV.md");
    const cvContent = fs.readFileSync(cvPath, "utf-8");

    const result = parseResumeMarkdown(cvContent);

    // Contact
    expect(result.contact.fullName).toBe("Alex Rudd");
    expect(result.contact.email).toBe("Paul.Alex.Rudd@gmail.com");
    expect(result.contact.phone).toBe("770-846-8242");
    expect(result.contact.linkedIn).toContain("linkedin.com");

    // Education: 3 entries
    expect(result.education).toHaveLength(3);
    expect(result.education[0].institution).toBe("Georgia Institute of Technology");
    expect(result.education[1].institution).toBe("University of Minnesota");
    expect(result.education[2].institution).toBe("Emory University");

    // Experiences: at least 7 (Workday, Piedmont, Evalueserve, + BASF sub-roles)
    expect(result.experiences.length).toBeGreaterThanOrEqual(7);

    // Skills: at least 5 categories
    expect(result.skills.length).toBeGreaterThanOrEqual(5);

    // Publications: at least 6
    expect(result.publications.length).toBeGreaterThanOrEqual(6);

    // Instructions section should NOT appear as custom section
    expect(result.customSections.find((s) => s.title === "Instructions")).toBeUndefined();
  });
});
