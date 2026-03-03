"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { FileText, Hash, DollarSign, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface GenerationStatsData {
  totalGenerations: number;
  totalTokens: number;
  estimatedTotalCost: number;
  generationsByDay: Array<{ date: string; count: number; cost: number }>;
  topUsersByCost: Array<{
    userId: string;
    name: string;
    email: string;
    generationCount: number;
    totalTokens: number;
    estimatedCost: number;
  }>;
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function GenerationsTab() {
  const [data, setData] = useState<GenerationStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/stats/generations");
        if (!res.ok) throw new Error();
        setData(await res.json());
      } catch {
        toast.error("Failed to load generation stats.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-56 rounded-lg" />
        <Skeleton className="h-56 rounded-lg" />
      </div>
    );
  }

  if (!data) return null;

  // Compute cumulative cost
  let cumCost = 0;
  const cumulativeData = data.generationsByDay.map((d) => {
    cumCost += d.cost;
    return { date: d.date, cumulativeCost: Math.round(cumCost * 100) / 100 };
  });

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <dl>
              <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                Total Generations
              </dt>
              <dd className="mt-1 text-2xl font-bold">{data.totalGenerations}</dd>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <dl>
              <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                <Hash className="h-4 w-4" />
                Total Tokens
              </dt>
              <dd className="mt-1 text-2xl font-bold">
                {data.totalTokens >= 1_000_000
                  ? `${(data.totalTokens / 1_000_000).toFixed(1)}M`
                  : data.totalTokens >= 1000
                    ? `${(data.totalTokens / 1000).toFixed(1)}K`
                    : data.totalTokens}
              </dd>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <dl>
              <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                Est. Cost
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      Costs are estimated from token counts and configured
                      rates. Compare against your Anthropic invoice for actual
                      billing.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </dt>
              <dd className="mt-1 text-2xl font-bold">
                Est. ${data.estimatedTotalCost.toFixed(2)}
              </dd>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Generations per day */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Generations Per Day (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={data.generationsByDay}
              margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateLabel}
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <RechartsTooltip
                labelFormatter={(label) => formatDateLabel(String(label))}
                formatter={(value) => [value, "Generations"]}
              />
              <Bar
                dataKey="count"
                fill="var(--color-primary)"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cumulative cost */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Cumulative Cost (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={cumulativeData}
              margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateLabel}
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <RechartsTooltip
                labelFormatter={(label) => formatDateLabel(String(label))}
                formatter={(value) => [`$${Number(value).toFixed(2)}`, "Cumulative Cost"]}
              />
              <Line
                type="monotone"
                dataKey="cumulativeCost"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top users by cost */}
      {data.topUsersByCost.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Users by Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-medium">#</th>
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium hidden sm:table-cell">
                      Email
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Gens</th>
                    <th className="px-3 py-2 text-right font-medium hidden md:table-cell">
                      Tokens
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      Est. Cost
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.topUsersByCost.map((user, i) => (
                    <tr key={user.userId} className="border-b last:border-0">
                      <td className="px-3 py-2 text-muted-foreground">
                        {i + 1}
                      </td>
                      <td className="px-3 py-2 font-medium">{user.name}</td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell truncate max-w-[200px]">
                        {user.email}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {user.generationCount}
                      </td>
                      <td className="px-3 py-2 text-right hidden md:table-cell">
                        {user.totalTokens >= 1000
                          ? `${(user.totalTokens / 1000).toFixed(1)}K`
                          : user.totalTokens}
                      </td>
                      <td className="px-3 py-2 text-right">
                        Est. ${user.estimatedCost.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
