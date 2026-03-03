import { Skeleton } from "@/components/ui/skeleton";

export default function ResumeSourceLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      {/* Tab bar */}
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-9 w-24" />
        ))}
      </div>
      {/* Form fields */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
