"use client";

import { Clock, TrendingUp, ArrowRightLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface TimeStatsProps {
  medianDaysToFirstResponse: number | null;
  avgDaysToFirstResponse: number | null;
  appToInterviewRate: number | null;
  interviewToOfferRate: number | null;
}

export function TimeStats({
  medianDaysToFirstResponse,
  avgDaysToFirstResponse,
  appToInterviewRate,
  interviewToOfferRate,
}: TimeStatsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {/* Response Time */}
      <Card>
        <CardContent className="p-4">
          <dl>
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Days to First Response
            </dt>
            {medianDaysToFirstResponse != null ? (
              <>
                <dd className="mt-1 text-2xl font-bold">
                  {medianDaysToFirstResponse} days
                </dd>
                <dd className="text-xs text-muted-foreground">
                  median (avg: {avgDaysToFirstResponse} days)
                </dd>
              </>
            ) : (
              <dd className="mt-1 text-sm text-muted-foreground">
                Not enough data
              </dd>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* App to Interview */}
      <Card>
        <CardContent className="p-4">
          <dl>
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              App to Interview
            </dt>
            {appToInterviewRate != null ? (
              <dd className="mt-1 text-2xl font-bold">
                {Math.round(appToInterviewRate * 100)}%
              </dd>
            ) : (
              <dd className="mt-1 text-sm text-muted-foreground">
                Not enough data
              </dd>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Interview to Offer */}
      <Card>
        <CardContent className="p-4">
          <dl>
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowRightLeft className="h-4 w-4" />
              Interview to Offer
            </dt>
            {interviewToOfferRate != null ? (
              <dd className="mt-1 text-2xl font-bold">
                {Math.round(interviewToOfferRate * 100)}%
              </dd>
            ) : (
              <dd className="mt-1 text-sm text-muted-foreground">
                Not enough data
              </dd>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
