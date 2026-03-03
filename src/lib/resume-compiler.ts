/**
 * Pure function that compiles structured resume source data into markdown.
 * No side effects — takes data, returns string.
 */

/**
 * Loose input type for the compiler. Accepts partial data so callers
 * don't need to provide all fields (e.g., id, resumeSourceId).
 * The canonical ResumeSourceData from types/ satisfies this type.
 */
export type CompilerInput = {
  contact?: {
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
    location?: string | null;
    linkedIn?: string | null;
    website?: string | null;
    summary?: string | null;
  } | null;
  education?: Array<{
    institution?: string | null;
    degree?: string | null;
    fieldOfStudy?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    gpa?: string | null;
    honors?: string | null;
    notes?: string | null;
  }>;
  experiences?: Array<{
    company?: string | null;
    title?: string | null;
    location?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    description?: string | null;
    subsections?: Array<{
      label?: string | null;
      bullets?: string[];
    }>;
  }>;
  skills?: Array<{
    category?: string | null;
    items?: string[];
  }>;
  publications?: Array<{
    title?: string | null;
    publisher?: string | null;
    date?: string | null;
    url?: string | null;
    description?: string | null;
  }>;
  customSections?: Array<{
    title: string;
    content: string;
    sortOrder?: number;
  }>;
  miscellaneous?: string | null;
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Present";
  // Handle YYYY-only format
  if (/^\d{4}$/.test(dateStr)) return dateStr;
  const match = dateStr.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!match) return dateStr;
  const monthIndex = parseInt(match[2], 10) - 1;
  return `${MONTH_NAMES[monthIndex]} ${match[1]}`;
}

/** Join non-null/non-empty values with separator, skipping blanks */
function joinParts(parts: (string | null | undefined)[], sep: string): string {
  return parts.filter((p) => p && p.trim()).join(sep);
}

export function compileResumeSource(data: CompilerInput): string {
  const sections: string[] = [];

  // Contact / Header
  if (data.contact) {
    const c = data.contact;
    const hasName = c.fullName && c.fullName.trim();

    if (hasName) {
      sections.push(`# ${c.fullName!.trim()}`);

      // Contact line 1: email | phone | location
      const contactLine1 = joinParts([c.email, c.phone, c.location], " | ");
      if (contactLine1) sections.push(contactLine1);

      // Contact line 2: linkedIn | website
      const contactLine2 = joinParts([c.linkedIn, c.website], " | ");
      if (contactLine2) sections.push(contactLine2);

      // Summary
      if (c.summary && c.summary.trim()) {
        sections.push("");
        sections.push("## Summary");
        sections.push(c.summary.trim());
      }
    }
  }

  // Work Experience
  const validExperiences = (data.experiences ?? []).filter(
    (e) => e.company?.trim() && e.title?.trim()
  );
  if (validExperiences.length > 0) {
    sections.push("");
    sections.push("## Work Experience");

    for (const exp of validExperiences) {
      sections.push("");
      sections.push(`### ${exp.title!.trim()} -- ${exp.company!.trim()}`);

      const datePart = exp.startDate
        ? `${formatDate(exp.startDate)} - ${formatDate(exp.endDate)}`
        : null;
      const metaLine = joinParts([datePart, exp.location], " | ");
      if (metaLine) sections.push(`*${metaLine}*`);

      if (exp.description?.trim()) {
        sections.push("");
        sections.push(exp.description.trim());
      }

      for (const sub of exp.subsections ?? []) {
        if (!sub.label?.trim()) continue;
        sections.push("");
        sections.push(`#### ${sub.label.trim()}`);
        const nonEmptyBullets = (sub.bullets ?? []).filter((b) => b.trim());
        for (const bullet of nonEmptyBullets) {
          sections.push(`- ${bullet.trim()}`);
        }
      }
    }
  }

  // Education
  const validEducation = (data.education ?? []).filter(
    (e) => e.institution?.trim() && e.degree?.trim()
  );
  if (validEducation.length > 0) {
    sections.push("");
    sections.push("## Education");

    for (const edu of validEducation) {
      sections.push("");
      const titleParts = [edu.degree!.trim()];
      if (edu.fieldOfStudy?.trim()) titleParts.push(edu.fieldOfStudy.trim());
      sections.push(
        `### ${titleParts.join(", ")} -- ${edu.institution!.trim()}`
      );

      const datePart =
        edu.startDate || edu.endDate
          ? `${formatDate(edu.startDate)} - ${formatDate(edu.endDate)}`
          : null;
      if (datePart) sections.push(`*${datePart}*`);

      const detailLine = joinParts(
        [edu.gpa ? `GPA: ${edu.gpa.trim()}` : null, edu.honors],
        " | "
      );
      if (detailLine) sections.push(detailLine);

      if (edu.notes?.trim()) sections.push(edu.notes.trim());
    }
  }

  // Skills
  const validSkills = (data.skills ?? []).filter(
    (s) => s.category?.trim() && s.items && s.items.length > 0
  );
  if (validSkills.length > 0) {
    sections.push("");
    sections.push("## Skills");
    for (const skill of validSkills) {
      const items = skill
        .items!.filter((i) => i.trim())
        .map((i) => i.trim())
        .join(", ");
      if (items) {
        sections.push(`**${skill.category!.trim()}**: ${items}`);
      }
    }
  }

  // Publications
  const validPublications = (data.publications ?? []).filter(
    (p) => p.title?.trim()
  );
  if (validPublications.length > 0) {
    sections.push("");
    sections.push("## Publications");
    for (const pub of validPublications) {
      const parts = [
        pub.publisher?.trim(),
        pub.date ? formatDate(pub.date) : null,
      ].filter(Boolean);
      const meta = parts.length > 0 ? ` -- ${parts.join(", ")}` : "";
      const urlPart = pub.url?.trim() ? `. ${pub.url.trim()}` : "";
      sections.push(`- **${pub.title!.trim()}**${meta}${urlPart}`);
      if (pub.description?.trim()) {
        sections.push(`  ${pub.description.trim()}`);
      }
    }
  }

  // Custom Sections
  const customSections = (data.customSections ?? []).filter(
    (s) => s.title?.trim() && s.content?.trim()
  );
  for (const section of customSections) {
    sections.push("");
    sections.push(`## ${section.title.trim()}`);
    sections.push("");
    sections.push(section.content.trim());
  }

  // Miscellaneous
  if (data.miscellaneous?.trim()) {
    sections.push("");
    sections.push("## Miscellaneous");
    sections.push("");
    sections.push(data.miscellaneous.trim());
  }

  return sections.join("\n");
}
