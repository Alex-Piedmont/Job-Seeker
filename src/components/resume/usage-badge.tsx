"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";

interface UsageData {
  used: number;
  cap: number;
  resetsAt: string | null;
  isAdmin: boolean;
}

interface UsageBadgeProps {
  refreshKey?: number;
}

export function UsageBadge({ refreshKey }: UsageBadgeProps) {
  const [usage, setUsage] = useState<UsageData | null>(null);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/resume/usage");
      if (res.ok) {
        setUsage(await res.json());
      }
    } catch {
      // Silent fail — badge is non-critical
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage, refreshKey]);

  if (!usage) return null;

  if (usage.isAdmin) {
    return (
      <Badge variant="secondary" className="text-xs" aria-label="Unlimited resume generations">
        Unlimited
      </Badge>
    );
  }

  const pct = usage.cap > 0 ? (usage.used / usage.cap) * 100 : 100;
  const color =
    pct >= 80
      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      : pct >= 50
        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
        : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";

  return (
    <Badge
      variant="outline"
      className={`text-xs ${color}`}
      aria-label={`${usage.used} of ${usage.cap} resume generations used this month`}
    >
      {usage.used}/{usage.cap}
    </Badge>
  );
}
