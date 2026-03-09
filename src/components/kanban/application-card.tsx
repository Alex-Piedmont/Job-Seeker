"use client";

import { GripVertical, Clock, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  getCompensationDisplay,
  getStalenessLevel,
  type StaleCheckInput,
} from "@/lib/kanban-utils";
import { GRADE_COLORS } from "@/lib/resume-prompts/review";
import type { ApplicationCardData, DragHandleProps } from "@/types/kanban";

export type { ApplicationCardData };

interface ApplicationCardProps {
  application: ApplicationCardData;
  columnColor: string;
  columnType: string | null;
  onClick: () => void;
  dragHandleProps?: DragHandleProps;
}

export function ApplicationCard({
  application,
  columnColor,
  columnType,
  onClick,
  dragHandleProps,
}: ApplicationCardProps) {
  const compensation = getCompensationDisplay(application);
  const interviewCount = application._count.interviews;
  const resumeGrade = (() => {
    const raw = application.resumeGenerations?.[0]?.reviewJson;
    if (!raw) return undefined;
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return (parsed as { overallGrade?: string })?.overallGrade;
    } catch {
      return undefined;
    }
  })();

  const staleInput: StaleCheckInput = {
    updatedAt: application.updatedAt,
    latestStatusLogAt: application.statusLogs[0]?.movedAt ?? null,
    latestInterviewAt: application.interviews[0]?.createdAt ?? null,
    latestNoteAt: application.notes[0]?.createdAt ?? null,
    columnType,
  };
  const staleness = getStalenessLevel(staleInput);

  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card p-4 shadow-sm cursor-grab hover:shadow-md hover:-translate-y-0.5 transition-[box-shadow,opacity] duration-200",
        staleness === "muted" && "opacity-60",
        staleness === "warning" && "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800"
      )}
      style={{ borderLeftWidth: 3, borderLeftColor: columnColor }}
      onClick={onClick}
      {...dragHandleProps?.listeners}
      {...dragHandleProps?.attributes}
    >
      <div className="flex items-start gap-2">
        <div
          className="mt-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-base break-words">
              {application.company}
            </span>
            <div className="flex items-center gap-1">
              {application.scrapedJob?.removedAt && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  </TooltipTrigger>
                  <TooltipContent>Posting no longer available</TooltipContent>
                </Tooltip>
              )}
              {staleness === "muted" && (
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              {staleness === "warning" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    No activity for 30+ days. Consider closing this application.
                  </TooltipContent>
                </Tooltip>
              )}
              {resumeGrade && (
                <span className={`inline-flex items-center justify-center h-5 w-5 rounded text-xs font-bold ${GRADE_COLORS[resumeGrade] || ""}`}>
                  {resumeGrade}
                </span>
              )}
              <Badge variant="secondary" className="text-xs font-mono">
                #{application.serialNumber}
              </Badge>
            </div>
          </div>

          <p className="text-sm text-muted-foreground break-words">
            {application.role}
          </p>

          {application.hiringManager && (
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              HM: {application.hiringManager}
            </p>
          )}

          <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground">
            {application.locationType && (
              <span>{application.locationType}</span>
            )}
            {application.locationType && compensation && (
              <span className="text-muted-foreground/50">|</span>
            )}
            {compensation && <span>{compensation}</span>}
          </div>

          {interviewCount > 0 && (
            <div className="mt-1.5">
              <Badge variant="outline" className="text-xs" aria-label={`${interviewCount} interview${interviewCount !== 1 ? "s" : ""} recorded`}>
                {interviewCount} interview{interviewCount !== 1 ? "s" : ""}
              </Badge>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
