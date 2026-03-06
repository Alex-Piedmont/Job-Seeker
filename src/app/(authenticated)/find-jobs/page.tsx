"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { JobCard, type ScrapedJob } from "@/components/find-jobs/job-card";
import { JobDetailModal } from "@/components/find-jobs/job-detail-modal";
import {
  JobFilterSidebar,
  emptyFilters,
  type FilterValues,
} from "@/components/find-jobs/job-filter-sidebar";
import {
  JobSortControl,
  sortToApiParams,
  type SortOption,
} from "@/components/find-jobs/job-sort-control";
import { JobPagination } from "@/components/find-jobs/job-pagination";
import { Filter, Loader2, SearchX, Briefcase } from "lucide-react";
import { toast } from "sonner";

interface Company {
  id: string;
  name: string;
  jobCount: number;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function filtersFromParams(params: URLSearchParams): FilterValues {
  return {
    q: params.get("q") ?? "",
    companyIds: params.get("companyIds")?.split(",").filter(Boolean) ?? [],
    location: params.get("location") ?? "",
    salaryMin: params.get("salaryMin") ?? "",
    salaryMax: params.get("salaryMax") ?? "",
    postedFrom: params.get("postedFrom") ?? "",
    postedTo: params.get("postedTo") ?? "",
    showArchived: params.get("showArchived") === "true",
  };
}

function sortFromParams(params: URLSearchParams): SortOption {
  const s = params.get("sort") as SortOption | null;
  if (s && ["newest", "oldest", "title-asc", "title-desc", "salary"].includes(s)) return s;
  return "newest";
}

function filtersToParams(filters: FilterValues, sort: SortOption, page: number): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.q) p.set("q", filters.q);
  if (filters.companyIds.length) p.set("companyIds", filters.companyIds.join(","));
  if (filters.location) p.set("location", filters.location);
  if (filters.salaryMin) p.set("salaryMin", filters.salaryMin);
  if (filters.salaryMax) p.set("salaryMax", filters.salaryMax);
  if (filters.postedFrom) p.set("postedFrom", filters.postedFrom);
  if (filters.postedTo) p.set("postedTo", filters.postedTo);
  if (filters.showArchived) p.set("showArchived", "true");
  if (sort !== "newest") p.set("sort", sort);
  if (page > 1) p.set("page", String(page));
  return p;
}

function buildApiUrl(filters: FilterValues, sort: SortOption, page: number): string {
  const { sort: apiSort, order } = sortToApiParams(sort);
  const p = new URLSearchParams();
  if (filters.q) p.set("q", filters.q);
  if (filters.companyIds.length) p.set("companyIds", filters.companyIds.join(","));
  if (filters.location) p.set("location", filters.location);
  if (filters.salaryMin) p.set("salaryMin", filters.salaryMin);
  if (filters.salaryMax) p.set("salaryMax", filters.salaryMax);
  if (filters.postedFrom) p.set("postedFrom", filters.postedFrom);
  if (filters.postedTo) p.set("postedTo", filters.postedTo);
  if (filters.showArchived) p.set("includeArchived", "true");
  p.set("sort", apiSort);
  p.set("order", order);
  p.set("page", String(page));
  return `/api/scraped-jobs?${p.toString()}`;
}

export default function FindJobsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <FindJobsContent />
    </Suspense>
  );
}

function FindJobsContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<FilterValues>(() => filtersFromParams(searchParams));
  const [sort, setSort] = useState<SortOption>(() => sortFromParams(searchParams));
  const [page, setPage] = useState(() => Number(searchParams.get("page")) || 1);

  const [jobs, setJobs] = useState<ScrapedJob[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [importedJobIds, setImportedJobIds] = useState<Set<string>>(new Set());

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

  // Fetch companies on mount
  useEffect(() => {
    fetch("/api/scraped-jobs/companies")
      .then((r) => r.json())
      .then((data) => setCompanies(data.companies ?? []))
      .catch(() => {});
  }, []);

  // Fetch jobs
  const fetchJobs = useCallback(
    async (f: FilterValues, s: SortOption, p: number) => {
      setFetching(true);
      try {
        const res = await fetch(buildApiUrl(f, s, p));
        if (!res.ok) throw new Error("Failed to fetch jobs");
        const data = await res.json();
        setJobs(data.jobs);
        setPagination(data.pagination);
      } catch {
        toast.error("Failed to load jobs. Please try again.");
      } finally {
        setLoading(false);
        setFetching(false);
      }
    },
    []
  );

  // Sync URL and fetch on filter/sort/page changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      fetchJobs(filters, sort, page);
      return;
    }

    // Update URL
    const params = filtersToParams(filters, sort, page);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "/find-jobs", { scroll: false });

    // Debounce text inputs
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchJobs(filters, sort, page);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters, sort, page, router, fetchJobs]);

  const handleFilterChange = (newFilters: FilterValues) => {
    setFilters(newFilters);
    setPage(1);
  };

  const handleClearAll = () => {
    setFilters(emptyFilters);
    setPage(1);
  };

  const handleSortChange = (newSort: SortOption) => {
    setSort(newSort);
    setPage(1);
  };

  const handleToggleArchive = async (job: ScrapedJob) => {
    const isArchiving = !job.isArchived;
    const method = isArchiving ? "POST" : "DELETE";

    // Optimistic update
    setJobs((prev) =>
      prev.map((j) => (j.id === job.id ? { ...j, isArchived: isArchiving } : j))
    );

    try {
      const res = await fetch(`/api/scraped-jobs/${job.id}/archive`, { method });
      if (!res.ok) throw new Error();

      // If archiving and not showing archived, remove from list
      if (isArchiving && !filters.showArchived) {
        setJobs((prev) => {
          const next = prev.filter((j) => j.id !== job.id);
          // If last item on page, go to previous page
          if (next.length === 0 && page > 1) {
            setPage(page - 1);
          }
          return next;
        });
        if (pagination) {
          setPagination({ ...pagination, total: pagination.total - 1 });
        }
      }
    } catch {
      // Revert optimistic update
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, isArchived: !isArchiving } : j))
      );
      toast.error(`Failed to ${isArchiving ? "archive" : "unarchive"} job`);
    }
  };

  if (status === "loading") {
    return <LoadingSkeleton />;
  }

  const totalStart = pagination ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const totalEnd = pagination ? Math.min(pagination.page * pagination.limit, pagination.total) : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Find Jobs</h1>
        {/* Mobile filter button */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="md:hidden">
              <Filter className="h-4 w-4 mr-1" />
              Filters
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="pt-4">
              <JobFilterSidebar
                filters={filters}
                companies={companies}
                onFilterChange={handleFilterChange}
                onClearAll={handleClearAll}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex gap-6">
        {/* Desktop sidebar */}
        <aside className="hidden md:block w-[260px] shrink-0">
          <div className="sticky top-20">
            <JobFilterSidebar
              filters={filters}
              companies={companies}
              onFilterChange={handleFilterChange}
              onClearAll={handleClearAll}
            />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {pagination && pagination.total > 0 && (
                <span>
                  Showing {totalStart}-{totalEnd} of {pagination.total} jobs
                </span>
              )}
              {fetching && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
            <JobSortControl value={sort} onChange={handleSortChange} />
          </div>

          {loading ? (
            <LoadingGrid />
          ) : jobs.length === 0 ? (
            pagination && pagination.total === 0 ? (
              <EmptyState
                icon={searchParams.toString() ? SearchX : Briefcase}
                title={searchParams.toString() ? "No jobs match your filters" : "No jobs yet"}
                description={
                  searchParams.toString()
                    ? "Try broadening your search or clearing some filters."
                    : "Jobs will appear here once the scraper has run."
                }
                action={
                  searchParams.toString()
                    ? { label: "Clear All Filters", onClick: handleClearAll }
                    : undefined
                }
              />
            ) : null
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onSelect={(j) => setSelectedJobId(j.id)}
                  onToggleArchive={handleToggleArchive}
                />
              ))}
            </div>
          )}

          {pagination && (
            <JobPagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
            />
          )}
        </main>
      </div>

      <JobDetailModal
        jobId={selectedJobId}
        onClose={() => setSelectedJobId(null)}
        onToggleArchive={handleToggleArchive}
        importedJobIds={importedJobIds}
        onImported={(jobId) => setImportedJobIds(prev => new Set(prev).add(jobId))}
      />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Skeleton className="h-8 w-48 mb-6" />
      <div className="flex gap-6">
        <div className="hidden md:block w-[260px] space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
        <div className="flex-1">
          <LoadingGrid />
        </div>
      </div>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-lg border p-4 space-y-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
          <div className="flex justify-between">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
