import { adminHandler, getGenerationStats } from "@/lib/admin";

export const GET = adminHandler(async () => {
  const stats = await getGenerationStats();
  return Response.json(stats);
});
