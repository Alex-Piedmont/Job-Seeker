"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Archive, ArchiveRestore, MapPin, Building2, DollarSign } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export interface ScrapedJob {
  id: string;
  title: string;
  url: string;
  department: string | null;
  locations: string[];
  locationType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  firstSeenAt: string;
  removedAt: string | null;
  archivedAt: string | null;
  company: { id: string; name: string };
  isArchived: boolean;
}

interface JobCardProps {
  job: ScrapedJob;
  onSelect: (job: ScrapedJob) => void;
  onToggleArchive: (job: ScrapedJob) => void;
}

function formatSalary(min: number | null, max: number | null, currency: string) {
  const fmt = (n: number) => {
    if (currency === "USD") return `$${(n / 1000).toFixed(0)}k`;
    return `${n.toLocaleString()} ${currency}`;
  };
  if (min && max) return `${fmt(min)} - ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  if (max) return `Up to ${fmt(max)}`;
  return null;
}

export function JobCard({ job, onSelect, onToggleArchive }: JobCardProps) {
  const isRemoved = !!job.removedAt;
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency);

  return (
    <Card
      className={cn(
        "cursor-pointer transition-shadow hover:shadow-md group relative",
        isRemoved && "opacity-60",
        job.isArchived && "opacity-60"
      )}
      onClick={() => onSelect(job)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm leading-tight truncate">{job.title}</h3>
            <div className="flex items-center gap-1 mt-1 text-muted-foreground text-xs">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{job.company.name}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 md:opacity-0 max-md:opacity-100 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggleArchive(job);
            }}
            title={job.isArchived ? "Unarchive" : "Archive"}
          >
            {job.isArchived ? (
              <ArchiveRestore className="h-4 w-4" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {job.locationType && (
            <Badge variant="secondary" className="text-xs">
              {job.locationType}
            </Badge>
          )}
          {isRemoved && (
            <Badge variant="destructive" className="text-xs">
              No longer available
            </Badge>
          )}
        </div>

        {job.locations.length > 0 && (
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{job.locations.join(", ")}</span>
          </div>
        )}

        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
          {salary ? (
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              <span>{salary}</span>
            </div>
          ) : (
            <span />
          )}
          <span>{formatDistanceToNow(new Date(job.firstSeenAt), { addSuffix: true })}</span>
        </div>
      </CardContent>
    </Card>
  );
}
