import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  TabStopPosition,
  TabStopType,
  BorderStyle,
  convertInchesToTwip,
} from "docx";

const NAVY = "1F3864";
const BLUE = "2E75B6";
const BLACK = "000000";
const FONT = "Calibri";
const FONT_SIZE_NAME = 28; // 14pt in half-points
const FONT_SIZE_BODY = 20; // 10pt
const FONT_SIZE_SECTION = 22; // 11pt
const FONT_SIZE_SMALL = 18; // 9pt

/** Section header (H2) — navy, bold, with bottom border */
function sectionHeader(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 1, color: NAVY },
    },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        font: FONT,
        size: FONT_SIZE_SECTION,
        color: NAVY,
      }),
    ],
  });
}

/** Experience/education header (H3) — two-column with title left, dates right */
function experienceHeader(text: string): Paragraph {
  // Split on " -- " to separate title from company/institution
  const parts = text.split(" -- ");
  const runs: TextRun[] = [];

  runs.push(
    new TextRun({
      text: parts[0].trim(),
      bold: true,
      font: FONT,
      size: FONT_SIZE_BODY,
      color: BLUE,
    })
  );

  if (parts[1]) {
    runs.push(
      new TextRun({
        text: ` — ${parts[1].trim()}`,
        font: FONT,
        size: FONT_SIZE_BODY,
        color: BLACK,
      })
    );
  }

  return new Paragraph({
    spacing: { before: 120, after: 40 },
    children: runs,
  });
}

/** Bullet point */
function bullet(text: string): Paragraph {
  // Parse bold segments: **text**
  const runs = parseBoldRuns(text, FONT_SIZE_BODY);

  return new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 20, after: 20 },
    children: runs,
  });
}

/** Parse **bold** segments into TextRuns */
function parseBoldRuns(text: string, size: number): TextRun[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts
    .filter((p) => p)
    .map((part) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return new TextRun({
          text: part.slice(2, -2),
          bold: true,
          font: FONT,
          size,
          color: BLACK,
        });
      }
      return new TextRun({ text: part, font: FONT, size, color: BLACK });
    });
}

/** Body text paragraph */
function bodyText(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 20, after: 20 },
    children: parseBoldRuns(text, FONT_SIZE_BODY),
  });
}

/** Italic meta line (dates, location) */
function metaLine(text: string): Paragraph {
  // Strip surrounding * from italic markers
  const clean = text.replace(/^\*/, "").replace(/\*$/, "");
  return new Paragraph({
    spacing: { before: 0, after: 40 },
    children: [
      new TextRun({
        text: clean,
        italics: true,
        font: FONT,
        size: FONT_SIZE_SMALL,
        color: BLACK,
      }),
    ],
  });
}

/**
 * Build a Document object from resume markdown.
 * Parses line-by-line: H1→name, contact lines, H2→sections, H3→entries, bullets.
 * Shared by server (toBuffer) and client (toBlob) paths.
 */
export function buildDocument(markdown: string): Document {
  const lines = markdown.split("\n");
  const children: Paragraph[] = [];

  let afterName = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // H1 — Name
    if (trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
      const name = trimmed.slice(2).trim();
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: name,
              bold: true,
              font: FONT,
              size: FONT_SIZE_NAME,
              color: NAVY,
            }),
          ],
        })
      );
      afterName = true;
      continue;
    }

    // Contact lines (right after name, before first H2)
    if (afterName && !trimmed.startsWith("#")) {
      // Check if it looks like a contact line (contains | or is short text)
      if (!trimmed.startsWith("-") && !trimmed.startsWith("*")) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 20 },
            children: [
              new TextRun({
                text: trimmed,
                font: FONT,
                size: FONT_SIZE_SMALL,
                color: BLACK,
              }),
            ],
          })
        );
        continue;
      }
    }

    // H2 — Section headers
    if (trimmed.startsWith("## ")) {
      afterName = false;
      children.push(sectionHeader(trimmed.slice(3).trim()));
      continue;
    }

    // H3 — Experience/education entries
    if (trimmed.startsWith("### ")) {
      afterName = false;
      children.push(experienceHeader(trimmed.slice(4).trim()));
      continue;
    }

    // H4 — Subsection labels
    if (trimmed.startsWith("#### ")) {
      afterName = false;
      children.push(
        new Paragraph({
          spacing: { before: 60, after: 20 },
          children: [
            new TextRun({
              text: trimmed.slice(5).trim(),
              bold: true,
              italics: true,
              font: FONT,
              size: FONT_SIZE_BODY,
              color: BLACK,
            }),
          ],
        })
      );
      continue;
    }

    afterName = false;

    // Italic lines (*text*)
    if (trimmed.startsWith("*") && trimmed.endsWith("*") && !trimmed.startsWith("**")) {
      children.push(metaLine(trimmed));
      continue;
    }

    // Bullets
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      children.push(bullet(trimmed.slice(2).trim()));
      continue;
    }

    // Skills line: **Category**: items
    if (trimmed.startsWith("**") && trimmed.includes("**:")) {
      children.push(bodyText(trimmed));
      continue;
    }

    // Fallback: plain body text
    children.push(bodyText(trimmed));
  }

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.5),
              bottom: convertInchesToTwip(0.5),
              left: convertInchesToTwip(0.6),
              right: convertInchesToTwip(0.6),
            },
          },
        },
        children,
      },
    ],
  });
}

/**
 * Convert resume markdown to a .docx buffer (server-side).
 */
export async function markdownToDocx(markdown: string): Promise<Buffer> {
  const doc = buildDocument(markdown);
  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

/**
 * Create a safe filename from company and role.
 */
export function sanitizeFilename(company: string, role: string): string {
  const raw = `Resume-${company}-${role}`;
  return raw
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
