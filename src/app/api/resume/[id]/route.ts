import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  editedMarkdown: z.string().max(100000),
});

export const PATCH = authenticatedHandler(async (request, { userId, params }) => {
  const { id } = params;

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const generation = await prisma.resumeGeneration.findFirst({
    where: { id, userId },
    select: { id: true, markdownOutput: true },
  });

  if (!generation) {
    return NextResponse.json({ error: "Generation not found" }, { status: 404 });
  }

  // Store null if edit matches original (no diff to persist)
  const editedValue =
    parsed.data.editedMarkdown === generation.markdownOutput
      ? null
      : parsed.data.editedMarkdown;

  await prisma.resumeGeneration.update({
    where: { id },
    data: { editedMarkdown: editedValue },
  });

  return NextResponse.json({ ok: true });
});
