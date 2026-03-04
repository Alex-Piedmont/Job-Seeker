"use client";

import type { SaveStatus } from "@/hooks/use-auto-save";
import { cn } from "@/lib/utils";

export function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;

  return (
    <span
      className={cn(
        "text-xs transition-opacity duration-300",
        status === "saving" && "text-muted-foreground",
        status === "saved" && "text-green-600",
        status === "error" && "text-destructive",
        status === "retrying" && "text-amber-600"
      )}
    >
      {status === "saving" && "Saving..."}
      {status === "saved" && "Saved"}
      {status === "error" && "Failed to save"}
      {status === "retrying" && "Retrying..."}
    </span>
  );
}
