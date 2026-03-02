import { adminHandler, getPlatformStats, getDauOverTime } from "@/lib/admin";

export const GET = adminHandler(async () => {
  const [stats, dauOverTime] = await Promise.all([
    getPlatformStats(),
    getDauOverTime(),
  ]);

  return Response.json({ ...stats, dauOverTime });
});
