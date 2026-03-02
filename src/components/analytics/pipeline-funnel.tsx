"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FunnelEntry {
  columnId: string;
  columnName: string;
  columnColor: string;
  count: number;
  percentage: number;
}

interface PipelineFunnelProps {
  funnel: FunnelEntry[];
}

export function PipelineFunnel({ funnel }: PipelineFunnelProps) {
  if (funnel.length === 0) return null;

  const ariaLabel = `Pipeline funnel: ${funnel.map((f) => `${f.count} ${f.columnName}`).join(", ")}`;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div aria-label={ariaLabel} role="img">
          <ResponsiveContainer width="100%" height={funnel.length * 44 + 20}>
            <BarChart
              data={funnel}
              layout="vertical"
              margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
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
              <Tooltip
                formatter={(value, _name, props) => [
                  `${value} (${(props.payload as FunnelEntry).percentage}%)`,
                  "Applications",
                ]}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                {funnel.map((entry) => (
                  <Cell key={entry.columnId} fill={entry.columnColor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
