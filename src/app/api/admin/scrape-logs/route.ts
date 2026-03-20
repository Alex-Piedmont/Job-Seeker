import { adminHandler } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const GET = adminHandler(async (request) => {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));
  const status = url.searchParams.get("status"); // SUCCESS | FAILURE | PARTIAL_FAILURE
  const companyId = url.searchParams.get("companyId");

  const where: Record<string, unknown> = {};
  if (status && ["SUCCESS", "FAILURE", "PARTIAL_FAILURE", "PENDING"].includes(status)) {
    where.status = status;
  }
  if (companyId) {
    where.companyId = companyId;
  }

  const skip = (page - 1) * limit;
  const [logs, total] = await Promise.all([
    prisma.scrapeLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        company: { select: { name: true, atsPlatform: true } },
      },
    }),
    prisma.scrapeLog.count({ where }),
  ]);

  return Response.json({
    logs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});
