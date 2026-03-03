"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center"
    >
      <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="mt-1 text-sm text-muted-foreground max-w-md">
        An unexpected error occurred. Please try again or go back to the board.
      </p>
      <div className="flex gap-3 mt-4">
        <Button onClick={reset}>Try again</Button>
        <Link href="/applications">
          <Button variant="outline">Go to Board</Button>
        </Link>
      </div>
    </div>
  );
}
