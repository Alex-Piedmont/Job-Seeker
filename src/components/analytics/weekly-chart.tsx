"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WeeklyEntry {
  weekStart: string;
  count: number;
}

interface WeeklyChartProps {
  weeklyApplications: WeeklyEntry[];
}

function formatWeekLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function WeeklyChart({ weeklyApplications }: WeeklyChartProps) {
  if (weeklyApplications.length === 0) return null;

  const hasData = weeklyApplications.some((w) => w.count > 0);

  const ariaLabel = hasData
    ? `Weekly applications: ${weeklyApplications
        .filter((w) => w.count > 0)
        .map((w) => `${formatWeekLabel(w.weekStart)}: ${w.count}`)
        .join(", ")}`
    : "No applications submitted in the last 12 weeks";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Applications Per Week</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No applications with a date applied in the last 12 weeks
          </p>
        ) : (
          <div aria-label={ariaLabel} role="img">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={weeklyApplications}
                margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="weekStart"
                  tickFormatter={formatWeekLabel}
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  labelFormatter={(label) => `Week of ${formatWeekLabel(String(label))}`}
                  formatter={(value) => [value, "Applications"]}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
