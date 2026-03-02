"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ClosureStageEntry {
  columnName: string;
  count: number;
  rejectedCount: number;
  ghostedCount: number;
}

interface ClosureBreakdownProps {
  closureRate: number | null;
  ghostedRate: number | null;
  closuresByStage: ClosureStageEntry[];
}

export function ClosureBreakdown({
  closureRate,
  ghostedRate,
  closuresByStage,
}: ClosureBreakdownProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Closures by Stage</CardTitle>
          {ghostedRate != null && (
            <span className="text-sm text-muted-foreground">
              Ghosted: {Math.round(ghostedRate * 100)}%
            </span>
          )}
        </div>
        {closureRate != null && (
          <p className="text-sm text-muted-foreground">
            Overall closure rate: {Math.round(closureRate * 100)}%
          </p>
        )}
      </CardHeader>
      <CardContent>
        {closuresByStage.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No closures recorded
          </p>
        ) : (
          <div
            aria-label={`Closures by stage: ${closuresByStage
              .map((s) => `${s.columnName}: ${s.count}`)
              .join(", ")}`}
            role="img"
          >
            <ResponsiveContainer
              width="100%"
              height={closuresByStage.length * 44 + 40}
            >
              <BarChart
                data={closuresByStage}
                layout="vertical"
                margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="columnName"
                  width={90}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: string) =>
                    v.length > 10 ? v.slice(0, 10) + "..." : v
                  }
                />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="rejectedCount"
                  name="Rejected"
                  stackId="a"
                  fill="#ef4444"
                  radius={[0, 0, 0, 0]}
                  barSize={24}
                />
                <Bar
                  dataKey="ghostedCount"
                  name="Ghosted"
                  stackId="a"
                  fill="#9ca3af"
                  radius={[0, 4, 4, 0]}
                  barSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
