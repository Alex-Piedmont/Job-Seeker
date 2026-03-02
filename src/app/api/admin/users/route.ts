import { adminHandler, getUserList } from "@/lib/admin";

const SORTABLE_FIELDS = [
  "name",
  "email",
  "applicationCount",
  "resumeGenerationsUsedThisMonth",
  "totalResumeGenerations",
  "estimatedTotalCost",
  "lastActiveAt",
  "createdAt",
];

export const GET = adminHandler(async (request) => {
  const url = new URL(request.url);

  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20)
  );
  const search = (url.searchParams.get("search") ?? "").slice(0, 100);
  const sort = SORTABLE_FIELDS.includes(url.searchParams.get("sort") ?? "")
    ? url.searchParams.get("sort")!
    : "createdAt";
  const order =
    url.searchParams.get("order") === "asc" ? "asc" : ("desc" as const);

  const result = await getUserList({ page, limit, search, sort, order });
  return Response.json(result);
});
