import { NextResponse } from "next/server";
import { adminHandler } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validations";
import { updateCompanySchema } from "@/lib/validations/scraper";

export const PUT = adminHandler(async (request, { params }) => {
  const { id } = params;

  const existing = await prisma.company.findUnique({ where: { id } });
  if (!existing || existing.isRemoved) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const validation = await validateBody(request, updateCompanySchema);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Check name uniqueness if name is being changed
  if (data.name && data.name.toLowerCase() !== existing.name.toLowerCase()) {
    const duplicate = await prisma.company.findFirst({
      where: {
        name: { equals: data.name, mode: "insensitive" },
        id: { not: id },
      },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "A company with this name already exists" },
        { status: 409 }
      );
    }
  }

  const company = await prisma.company.update({ where: { id }, data });
  return Response.json(company);
});

export const DELETE = adminHandler(async (_request, { params }) => {
  const { id } = params;

  const existing = await prisma.company.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  await prisma.company.update({ where: { id }, data: { isRemoved: true } });
  return new Response(null, { status: 204 });
});
