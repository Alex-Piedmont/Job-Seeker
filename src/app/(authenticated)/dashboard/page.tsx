"use client";

import { useSession } from "next-auth/react";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { data: session } = useSession();

  if (!session) {
    return <Skeleton className="h-8 w-48" />;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">
        Welcome, {session.user.name ?? "there"}
      </h1>
      <p className="mt-2 text-muted-foreground">
        Your job search dashboard. More features coming soon.
      </p>
    </div>
  );
}
