"use client";

import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <BarChart3 className="h-16 w-16 text-muted-foreground/40 mb-4" />
      <h2 className="text-lg font-semibold">No analytics yet</h2>
      <p className="mt-1 text-sm text-muted-foreground max-w-md">
        Start tracking applications to see your analytics here. Add applications
        on the board to populate your pipeline, conversion rates, and more.
      </p>
      <Link href="/applications" className="mt-4">
        <Button>Go to Board</Button>
      </Link>
    </div>
  );
}
