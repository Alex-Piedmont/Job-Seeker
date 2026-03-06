import { NextResponse } from "next/server";
import { adminHandler } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const PATCH = adminHandler(async (_request, { params }) => {
  const { id } = params;

  const existing = await prisma.company.findUnique({ where: { id } });
  if (!existing || existing.isRemoved) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const company = await prisma.company.update({
    where: { id },
    data: { enabled: !existing.enabled },
  });

  return Response.json(company);
});
