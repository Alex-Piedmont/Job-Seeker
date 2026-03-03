import { NextResponse } from "next/server";
import { authenticatedHandler } from "@/lib/api-handler";
import { adminHandler } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validations";
import { createFeedbackSchema } from "@/lib/validations/feedback";

export const POST = authenticatedHandler(
  async (request, { userId }) => {
    const validation = await validateBody(request, createFeedbackSchema);
    if (!validation.success) return validation.response;

    const { category, message, pageUrl } = validation.data;

    const feedback = await prisma.feedback.create({
      data: { userId, category, message, pageUrl },
    });

    return NextResponse.json(feedback, { status: 201 });
  },
  { rateLimit: "feedback" }
);

export const GET = adminHandler(async (request) => {
  const url = new URL(request.url);
  const category = url.searchParams.get("category");

  const where = category ? { category: category as never } : {};

  const [feedback, total] = await Promise.all([
    prisma.feedback.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.feedback.count({ where }),
  ]);

  return Response.json({ feedback, total });
});
