"use client";

import { FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ResumeUsageCardProps {
  used: number;
  cap: number;
  resetsAt: string;
  isAdmin: boolean;
  totalAllTime: number;
}

export function ResumeUsageCard({
  used,
  cap,
  resetsAt,
  isAdmin,
  totalAllTime,
}: ResumeUsageCardProps) {
  const pct = cap > 0 ? (used / cap) * 100 : 0;
  const barColor =
    pct >= 80
      ? "bg-red-500"
      : pct >= 50
        ? "bg-yellow-500"
        : "bg-green-500";

  const resetDate = new Date(resetsAt);
  const resetLabel = resetDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <Card>
      <CardContent className="p-4">
        <dl>
          <dt className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            Resume Generations
          </dt>
          {isAdmin ? (
            <dd className="mt-1 text-2xl font-bold">Unlimited</dd>
          ) : (
            <>
              <dd className="mt-1 text-2xl font-bold">
                {used}/{cap} <span className="text-sm font-normal text-muted-foreground">this month</span>
              </dd>
              <dd className="mt-2">
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className={`h-2 rounded-full transition-all ${barColor}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </dd>
              <dd className="mt-1 text-xs text-muted-foreground">
                Resets {resetLabel}
              </dd>
            </>
          )}
          <dd className="mt-2 text-xs text-muted-foreground">
            {totalAllTime} total all-time
          </dd>
        </dl>
      </CardContent>
    </Card>
  );
}
