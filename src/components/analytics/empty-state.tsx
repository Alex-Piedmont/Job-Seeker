"use client";

import { BarChart3 } from "lucide-react";
import { EmptyState as EmptyStateBase } from "@/components/ui/empty-state";

export function EmptyState() {
  return (
    <EmptyStateBase
      icon={BarChart3}
      title="No analytics yet"
      description="Start tracking applications to see your analytics here. Add applications on the board to populate your pipeline, conversion rates, and more."
      action={{ label: "Go to Board", href: "/applications" }}
    />
  );
}
