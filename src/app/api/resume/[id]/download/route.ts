import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { markdownToDocx, sanitizeFilename } from "@/lib/docx-generator";

export const GET = authenticatedHandler(async (request, { userId, params }) => {
  const { id } = params;

  const generation = await prisma.resumeGeneration.findFirst({
    where: { id, userId },
    include: {
      jobApplication: { select: { company: true, role: true } },
    },
  });

  if (!generation) {
    return NextResponse.json(
      { error: "Generation not found" },
      { status: 404 }
    );
  }

  // Check for user-edited markdown (base64-encoded query param)
  const url = new URL(request.url);
  const editedMarkdown = url.searchParams.get("markdown");
  let markdown = generation.markdownOutput;

  if (editedMarkdown) {
    try {
      markdown = Buffer.from(editedMarkdown, "base64").toString("utf-8");
    } catch {
      // Fall back to original if base64 decode fails
    }
  }

  const buffer = await markdownToDocx(markdown);
  const filename = sanitizeFilename(
    generation.jobApplication.company,
    generation.jobApplication.role
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}.docx"`,
    },
  });
});
