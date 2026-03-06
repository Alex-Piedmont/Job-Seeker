"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Archive,
  ArchiveRestore,
  ExternalLink,
  MapPin,
  Building2,
  DollarSign,
  Calendar,
  AlertTriangle,
  Plus,
  Loader2,
  Check,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import ReactMarkdown from "react-markdown";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { ScrapedJob } from "./job-card";

interface JobDetail extends ScrapedJob {
  jobDescriptionMd: string;
}

interface JobDetailModalProps {
  jobId: string | null;
  onClose: () => void;
  onToggleArchive: (job: ScrapedJob) => void;
  importedJobIds: Set<string>;
  onImported: (jobId: string) => void;
}

export function JobDetailModal({ jobId, onClose, onToggleArchive, importedJobIds, onImported }: JobDetailModalProps) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const isMobile = useMediaQuery("(max-width: 767px)");

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }
    setLoading(true);
    fetch(`/api/scraped-jobs/${jobId}`)
      .then((r) => r.json())
      .then((data) => setJob(data))
      .finally(() => setLoading(false));
  }, [jobId]);

  const isRemoved = !!job?.removedAt;
  const isAutoArchived = !!job?.archivedAt;

  const salary = (() => {
    if (!job) return null;
    const fmt = (n: number) =>
      job.salaryCurrency === "USD"
        ? `$${n.toLocaleString()}`
        : `${n.toLocaleString()} ${job.salaryCurrency}`;
    if (job.salaryMin && job.salaryMax) return `${fmt(job.salaryMin)} - ${fmt(job.salaryMax)}`;
    if (job.salaryMin) return `${fmt(job.salaryMin)}+`;
    if (job.salaryMax) return `Up to ${fmt(job.salaryMax)}`;
    return null;
  })();

  const content = loading ? (
    <div className="space-y-4 p-6">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-32 w-full" />
    </div>
  ) : job ? (
    <div className="space-y-4 overflow-y-auto max-h-[70vh] md:max-h-[80vh] p-6 pt-0">
      {isRemoved && (
        <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            This job posting is no longer available on the company&apos;s careers page.
            {isAutoArchived && " It will be automatically removed soon."}
          </span>
        </div>
      )}

      {job.isArchived && !isRemoved && (
        <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
          <Archive className="h-4 w-4 shrink-0" />
          <span>You archived this role.</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {job.locationType && <Badge variant="secondary">{job.locationType}</Badge>}
        {isRemoved && <Badge variant="destructive">No longer available</Badge>}
      </div>

      <div className="grid gap-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span>{job.company.name}</span>
        </div>
        {job.department && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span>Hiring Org: {job.department}</span>
          </div>
        )}
        {job.locations.length > 0 && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{job.locations.join(", ")}</span>
          </div>
        )}
        {salary && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            <span>{salary}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>
            Posted {formatDistanceToNow(new Date(job.firstSeenAt), { addSuffix: true })}
            {" "}({format(new Date(job.firstSeenAt), "MMM d, yyyy")})
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onToggleArchive(job)}
        >
          {job.isArchived ? (
            <>
              <ArchiveRestore className="mr-1 h-4 w-4" />
              Unarchive
            </>
          ) : (
            <>
              <Archive className="mr-1 h-4 w-4" />
              Archive
            </>
          )}
        </Button>
        {job && importedJobIds.has(job.id) ? (
          <Button variant="outline" size="sm" disabled>
            <Check className="mr-1 h-4 w-4" />
            Already on Board
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={importing}
            onClick={async () => {
              if (!job) return;
              setImporting(true);
              try {
                const res = await fetch("/api/applications/import", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ scrapedJobId: job.id }),
                });
                if (res.status === 409) {
                  toast.info("You have already added this job to your board");
                  onImported(job.id);
                } else if (res.ok) {
                  toast.success(`Added ${job.company.name} - ${job.title} to your board`);
                  onImported(job.id);
                } else {
                  const err = await res.json().catch(() => ({}));
                  toast.error(err.error || "Failed to add job to board");
                }
              } catch {
                toast.error("Failed to add job to board");
              } finally {
                setImporting(false);
              }
            }}
          >
            {importing ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-1 h-4 w-4" />
            )}
            Add to Board
          </Button>
        )}
        <Button variant="outline" size="sm" asChild>
          <a href={job.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1 h-4 w-4" />
            View Original
          </a>
        </Button>
      </div>

      <div className="border-t pt-4">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{job.jobDescriptionMd}</ReactMarkdown>
        </div>
      </div>
    </div>
  ) : null;

  if (isMobile) {
    return (
      <Sheet open={!!jobId} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="bottom" className="h-[90vh] overflow-hidden p-0">
          <SheetHeader className="p-6 pb-2">
            <SheetTitle className="text-left">{job?.title ?? "Loading..."}</SheetTitle>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={!!jobId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>{job?.title ?? "Loading..."}</DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
