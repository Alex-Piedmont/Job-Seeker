import { NextResponse } from "next/server";
import { adminHandler } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const POST = adminHandler(async (_request, { params }) => {
  const { id } = params;

  const existing = await prisma.company.findUnique({ where: { id } });
  if (!existing || existing.isRemoved) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  if (!existing.enabled) {
    return NextResponse.json(
      { error: "Company is disabled. Enable it before triggering a scrape." },
      { status: 400 }
    );
  }

  await prisma.company.update({
    where: { id },
    data: { scrapeStatus: "PENDING" },
  });

  return Response.json({ message: "Scrape queued" }, { status: 202 });
});
