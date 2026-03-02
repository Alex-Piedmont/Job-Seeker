"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SummaryCards } from "@/components/analytics/summary-cards";
import { PipelineFunnel } from "@/components/analytics/pipeline-funnel";
import { WeeklyChart } from "@/components/analytics/weekly-chart";
import { TimeStats } from "@/components/analytics/time-stats";
import { ResumeUsageCard } from "@/components/analytics/resume-usage-card";
import { ClosureBreakdown } from "@/components/analytics/closure-breakdown";
import { EmptyState } from "@/components/analytics/empty-state";
import type { AnalyticsResponse } from "@/lib/analytics";

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Summary cards skeleton */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      {/* Charts skeleton */}
      <Skeleton className="h-64 rounded-lg" />
      <Skeleton className="h-56 rounded-lg" />
      {/* Stats skeleton */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/analytics");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
    } catch {
      toast.error("Failed to load analytics. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchAnalytics(true)}
          disabled={refreshing}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Loading state */}
      {loading && <LoadingSkeleton />}

      {/* Empty state */}
      {!loading && data && data.totalApplications === 0 && <EmptyState />}

      {/* Dashboard content */}
      {!loading && data && data.totalApplications > 0 && (
        <div className="space-y-6">
          <SummaryCards
            totalApplications={data.totalApplications}
            activeApplications={data.activeApplications}
            interviewsScheduled={data.interviewsScheduled}
            offers={data.offers}
          />

          <PipelineFunnel funnel={data.funnel} />

          <WeeklyChart weeklyApplications={data.weeklyApplications} />

          <TimeStats
            medianDaysToFirstResponse={data.medianDaysToFirstResponse}
            avgDaysToFirstResponse={data.avgDaysToFirstResponse}
            appToInterviewRate={data.appToInterviewRate}
            interviewToOfferRate={data.interviewToOfferRate}
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ClosureBreakdown
              closureRate={data.closureRate}
              ghostedRate={data.ghostedRate}
              closuresByStage={data.closuresByStage}
            />

            <ResumeUsageCard
              used={data.resumeUsage.used}
              cap={data.resumeUsage.cap}
              resetsAt={data.resumeUsage.resetsAt}
              isAdmin={data.resumeUsage.isAdmin}
              totalAllTime={data.resumeUsage.totalAllTime}
            />
          </div>
        </div>
      )}
    </div>
  );
}
