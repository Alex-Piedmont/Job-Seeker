"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ScrapeLogEntry {
  id: string;
  companyId: string;
  status: string;
  error: string | null;
  durationMs: number | null;
  jobsFound: number | null;
  jobsAdded: number | null;
  jobsUpdated: number | null;
  jobsRemoved: number | null;
  createdAt: string;
  company: {
    name: string;
    atsPlatform: string;
  };
}

const PAGE_SIZE = 50;

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; className: string; label: string }> = {
  SUCCESS: { icon: CheckCircle2, className: "text-green-600", label: "Success" },
  FAILURE: { icon: AlertCircle, className: "text-red-600", label: "Failed" },
  PARTIAL_FAILURE: { icon: AlertTriangle, className: "text-yellow-600", label: "Partial" },
  PENDING: { icon: Clock, className: "text-muted-foreground", label: "Pending" },
};

export function ScrapeLogsTab() {
  const [logs, setLogs] = useState<ScrapeLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      const res = await fetch(`/api/admin/scrape-logs?${params}`);
      if (!res.ok) throw new Error("Failed to fetch scrape logs");
      const data = await res.json();
      setLogs(data.logs);
      setTotalPages(data.pagination.totalPages);
      setTotalCount(data.pagination.total);
    } catch {
      toast.error("Failed to load scrape logs");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    setLoading(true);
    fetchLogs();
  }, [fetchLogs]);

  function handleStatusFilter(value: string) {
    setStatusFilter(value);
    setPage(1);
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="rounded-md border">
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {totalCount} log entr{totalCount !== 1 ? "ies" : "y"}
          </p>
          <Select value={statusFilter} onValueChange={handleStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="SUCCESS">Success</SelectItem>
              <SelectItem value="FAILURE">Failed</SelectItem>
              <SelectItem value="PARTIAL_FAILURE">Partial Failure</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Timestamp</th>
                <th className="px-4 py-3 text-left font-medium">Company</th>
                <th className="px-4 py-3 text-left font-medium">Platform</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Duration</th>
                <th className="px-4 py-3 text-left font-medium">Jobs</th>
                <th className="px-4 py-3 text-left font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No scrape logs yet.
                  </td>
                </tr>
              )}
              {logs.map((log) => {
                const config = STATUS_CONFIG[log.status] ?? STATUS_CONFIG.PENDING;
                const Icon = config.icon;
                return (
                  <tr key={log.id} className="border-b last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {format(new Date(log.createdAt), "MMM d, h:mm a")}
                    </td>
                    <td className="px-4 py-3 font-medium">{log.company.name}</td>
                    <td className="px-4 py-3">
                      {log.company.atsPlatform.charAt(0) +
                        log.company.atsPlatform.slice(1).toLowerCase()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 ${config.className}`}>
                        <Icon className="h-4 w-4" />
                        {config.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {log.durationMs != null
                        ? log.durationMs >= 1000
                          ? `${(log.durationMs / 1000).toFixed(1)}s`
                          : `${log.durationMs}ms`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {log.jobsFound != null ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-default">
                              {log.jobsFound} found
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <div className="text-xs space-y-0.5">
                              <p>{log.jobsAdded ?? 0} added</p>
                              <p>{log.jobsUpdated ?? 0} updated</p>
                              <p>{log.jobsRemoved ?? 0} removed</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {log.error ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-default block max-w-[200px] truncate text-red-600">
                              {log.error}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-sm">
                            <p className="break-all text-xs">{log.error}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
