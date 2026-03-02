import { authenticatedHandler } from "@/lib/api-handler";
import {
  getSummaryMetrics,
  getPipelineFunnel,
  getWeeklyApplications,
  getTimeStats,
  getConversionRates,
  getClosureBreakdown,
  getResumeUsage,
  type AnalyticsResponse,
} from "@/lib/analytics";

export const GET = authenticatedHandler(async (_request, { userId }) => {
  const results = await Promise.allSettled([
    getSummaryMetrics(userId),
    getPipelineFunnel(userId),
    getWeeklyApplications(userId),
    getTimeStats(userId),
    getConversionRates(userId),
    getClosureBreakdown(userId),
    getResumeUsage(userId),
  ]);

  const [summary, funnel, weekly, timeStats, conversion, closure, resumeUsage] =
    results;

  const response: AnalyticsResponse = {
    // Summary
    totalApplications:
      summary.status === "fulfilled" ? summary.value.totalApplications : 0,
    activeApplications:
      summary.status === "fulfilled" ? summary.value.activeApplications : 0,
    interviewsScheduled:
      summary.status === "fulfilled" ? summary.value.interviewsScheduled : 0,
    offers: summary.status === "fulfilled" ? summary.value.offers : 0,

    // Funnel
    funnel: funnel.status === "fulfilled" ? funnel.value : [],

    // Weekly
    weeklyApplications: weekly.status === "fulfilled" ? weekly.value : [],

    // Time stats
    medianDaysToFirstResponse:
      timeStats.status === "fulfilled"
        ? timeStats.value.medianDaysToFirstResponse
        : null,
    avgDaysToFirstResponse:
      timeStats.status === "fulfilled"
        ? timeStats.value.avgDaysToFirstResponse
        : null,

    // Conversion
    appToInterviewRate:
      conversion.status === "fulfilled"
        ? conversion.value.appToInterviewRate
        : null,
    interviewToOfferRate:
      conversion.status === "fulfilled"
        ? conversion.value.interviewToOfferRate
        : null,

    // Closure
    closureRate:
      closure.status === "fulfilled" ? closure.value.closureRate : null,
    ghostedRate:
      closure.status === "fulfilled" ? closure.value.ghostedRate : null,
    closuresByStage:
      closure.status === "fulfilled" ? closure.value.closuresByStage : [],

    // Resume usage
    resumeUsage:
      resumeUsage.status === "fulfilled"
        ? resumeUsage.value
        : {
            used: 0,
            cap: 5,
            resetsAt: new Date().toISOString(),
            isAdmin: false,
            totalAllTime: 0,
          },
  };

  return Response.json(response);
});
