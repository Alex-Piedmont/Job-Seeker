import { authenticatedHandler } from "@/lib/api-handler";
import { getUserUsage } from "@/lib/resume-cap";

export const GET = authenticatedHandler(async (_request, { userId }) => {
  const usage = await getUserUsage(userId);
  return Response.json(usage);
});
