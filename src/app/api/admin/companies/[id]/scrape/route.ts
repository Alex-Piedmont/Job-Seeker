import { NextResponse, after } from "next/server";
import { adminHandler } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { scrapeCompany } from "@/lib/scraper/scrape-company";

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

  after(async () => {
    await scrapeCompany({
      id: existing.id,
      name: existing.name,
      baseUrl: existing.baseUrl,
      atsPlatform: existing.atsPlatform,
    });
  });

  return Response.json({ message: "Scrape triggered" }, { status: 202 });
});
