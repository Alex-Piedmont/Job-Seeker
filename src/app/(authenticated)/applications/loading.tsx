import { Skeleton } from "@/components/ui/skeleton";

export default function ApplicationsLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-24" />
        <div className="ml-auto">
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <div className="flex gap-4 overflow-hidden flex-1">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="w-[280px] shrink-0 space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            {i <= 2 && <Skeleton className="h-24 w-full" />}
          </div>
        ))}
      </div>
    </div>
  );
}
