"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Users, Briefcase, FileText, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface StatsData {
  totalUsers: number;
  totalApplications: number;
  totalGenerations: number;
  estimatedTotalSpend: number;
  dauToday: number;
  mauThisMonth: number;
  dauOverTime: Array<{ date: string; count: number }>;
}

export function OverviewTab() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/stats");
        if (!res.ok) throw new Error();
        setData(await res.json());
      } catch {
        toast.error("Failed to load admin stats.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    { label: "Users", value: data.totalUsers, icon: Users },
    { label: "Applications", value: data.totalApplications.toLocaleString(), icon: Briefcase },
    { label: "Resumes Generated", value: data.totalGenerations, icon: FileText },
    {
      label: "Est. Spend",
      value: `Est. $${data.estimatedTotalSpend.toFixed(2)}`,
      icon: DollarSign,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4">
              <dl>
                <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                  <card.icon className="h-4 w-4" />
                  {card.label}
                </dt>
                <dd className="mt-1 text-2xl font-bold">{card.value}</dd>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Daily Active Users (Last 30 Days)
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              MAU: {data.mauThisMonth}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={data.dauOverTime}
              margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => {
                  const date = new Date(d + "T00:00:00Z");
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  });
                }}
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip
                labelFormatter={(label) => {
                  const date = new Date(String(label) + "T00:00:00Z");
                  return date.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  });
                }}
                formatter={(value) => [value, "Active Users"]}
              />
              <Bar
                dataKey="count"
                fill="hsl(var(--primary))"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
