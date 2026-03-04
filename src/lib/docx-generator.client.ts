import { Packer } from "docx";
import { buildDocument } from "./docx-generator";

/**
 * Convert resume markdown to a .docx Blob (client-side).
 * Uses the same buildDocument() as the server path for zero visual drift.
 */
export async function markdownToDocxBlob(markdown: string): Promise<Blob> {
  const doc = buildDocument(markdown);
  return Packer.toBlob(doc);
}
