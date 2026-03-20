"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Copy, Trash2, ExternalLink, AlertTriangle, FileText, FileUser, Star, History } from "lucide-react";
import { GenerateButton } from "@/components/resume/generate-button";
import { ResumeEditor } from "@/components/resume/resume-editor";
import { DownloadButton } from "@/components/resume/download-button";
import { GenerationHistory } from "@/components/resume/generation-history";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { useResizableDrawer } from "@/hooks/use-resizable-drawer";
import { useAutoSave } from "@/hooks/use-auto-save";
import { SaveIndicator } from "@/components/resume-source/save-indicator";
import { fetchOrThrowSaveError } from "@/lib/fetch-with-save-error";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InterviewForm } from "./interview-form";
import { NotesSection } from "./notes-section";
import { computeOTE, formatCurrency } from "@/lib/kanban-utils";
import { GRADE_COLORS, type ReviewResult } from "@/lib/resume-prompts/review";
import { CheckCircle, ArrowRight } from "lucide-react";
import type { Column, ApplicationDetail } from "@/types/kanban";

interface ApplicationDetailDrawerProps {
  applicationId: string;
  columns: Column[];
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
  onDuplicated: (newId: string) => void;
}

export function ApplicationDetailDrawer({
  applicationId,
  columns,
  onClose,
  onUpdated,
  onDeleted,
  onDuplicated,
}: ApplicationDetailDrawerProps) {
  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [answersToShow, setAnswersToShow] = useState<Array<{ question: string; answer: string }> | null>(null);
  const [reviewToShow, setReviewToShow] = useState<ReviewResult | null>(null);
  const [jobDescriptionOpen, setJobDescriptionOpen] = useState(false);
  const [resumeModalOpen, setResumeModalOpen] = useState(false);
  const [pastResumesOpen, setPastResumesOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdates = useRef<Record<string, unknown>>({});

  const { drawerWidth, handleResizeStart } = useResizableDrawer();

  // Resume generation state
  const [hasResumeSource, setHasResumeSource] = useState(false);
  const [capReached, setCapReached] = useState(false);
  const [usageRefreshKey, setUsageRefreshKey] = useState(0);
  const [currentGeneration, setCurrentGeneration] = useState<{
    id: string;
    markdownOutput: string;
    originalMarkdown: string;
  } | null>(null);
  const [editedMarkdown, setEditedMarkdown] = useState("");
  const [generations, setGenerations] = useState<Array<{
    id: string;
    markdownOutput: string;
    editedMarkdown?: string | null;
    promptTokens: number;
    completionTokens: number;
    estimatedCost: number;
    reviewJson?: string | null;
    createdAt: string;
  }>>([]);

  // Auto-save resume edits
  const {
    status: resumeSaveStatus,
    trigger: triggerResumeSave,
    flush: flushResumeSave,
  } = useAutoSave<{ generationId: string; editedMarkdown: string }>({
    initialData: { generationId: "", editedMarkdown: "" },
    onSave: async (data) => {
      await fetchOrThrowSaveError(`/api/resume/${data.generationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editedMarkdown: data.editedMarkdown }),
      });
    },
    debounceMs: 1000,
  });

  const handleEditMarkdown = useCallback(
    (markdown: string) => {
      setEditedMarkdown((prev) => {
        if (prev === markdown) return prev;
        if (currentGeneration) {
          triggerResumeSave({
            generationId: currentGeneration.id,
            editedMarkdown: markdown,
          });
        }
        return markdown;
      });
    },
    [currentGeneration, triggerResumeSave]
  );

  const fetchApp = useCallback(async () => {
    try {
      const res = await fetch(`/api/kanban/applications/${applicationId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setApp(data);
    } catch {
      toast.error("Failed to load application");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    fetchApp();
  }, [fetchApp]);

  // Check if resume source exists
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/resume-source/compile");
        if (res.ok) {
          const data = await res.json();
          setHasResumeSource(!!data.markdown?.trim());
        }
      } catch { /* non-critical */ }
    })();
  }, []);

  // Fetch usage to check cap
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/resume/usage");
        if (res.ok) {
          const data = await res.json();
          setCapReached(!data.isAdmin && data.used >= data.cap);
        }
      } catch { /* non-critical */ }
    })();
  }, [usageRefreshKey]);

  // Fetch generation history
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/resume/history/${applicationId}`);
      if (res.ok) {
        const data = await res.json();
        setGenerations(data);
        // Auto-display most recent if no current generation
        if (data.length > 0 && !currentGeneration) {
          setCurrentGeneration({
            id: data[0].id,
            markdownOutput: data[0].markdownOutput,
            originalMarkdown: data[0].markdownOutput,
          });
          setEditedMarkdown(data[0].editedMarkdown ?? data[0].markdownOutput);
        }
      }
    } catch { /* non-critical */ }
  }, [applicationId, currentGeneration]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const flushUpdates = useCallback(async () => {
    const updates = { ...pendingUpdates.current };
    pendingUpdates.current = {};
    if (Object.keys(updates).length === 0) return;

    try {
      const res = await fetch(`/api/kanban/applications/${applicationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        toast.error("Failed to save changes");
        return;
      }
      toast.success("Changes saved");
      onUpdated();
    } catch {
      toast.error("Failed to save changes");
    }
  }, [applicationId, onUpdated]);

  const scheduleUpdate = useCallback(
    (field: string, value: unknown) => {
      pendingUpdates.current[field] = value;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(flushUpdates, 1000);
    },
    [flushUpdates]
  );

  const handleFieldBlur = (field: string, value: string) => {
    if (!app) return;
    const current = app[field as keyof ApplicationDetail];
    if (value === (current ?? "")) return;
    scheduleUpdate(field, value || null);
    setApp({ ...app, [field]: value || null } as ApplicationDetail);
  };

  const handleNumberBlur = (field: string, value: string) => {
    if (!app) return;
    const numVal = value ? Number(value) : null;
    const current = app[field as keyof ApplicationDetail];
    if (numVal === current) return;
    scheduleUpdate(field, numVal);
    setApp({ ...app, [field]: numVal } as ApplicationDetail);
  };

  const handleColumnChange = async (newColumnId: string) => {
    if (!app || newColumnId === app.columnId) return;

    // Check if target is closed column
    const targetCol = columns.find((c) => c.id === newColumnId);
    if (targetCol?.columnType === "CLOSED") {
      // For simplicity via drawer, just move without rejection dialog
      // The user can set the rejection date in the dates section
    }

    try {
      const res = await fetch("/api/kanban/applications/move", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: app.id,
          columnId: newColumnId,
          newOrder: 0,
        }),
      });
      if (!res.ok) throw new Error();
      setApp({ ...app, columnId: newColumnId });
      onUpdated();
    } catch {
      toast.error("Failed to move application");
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/kanban/applications/${applicationId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Application deleted");
      onDeleted();
    } catch {
      toast.error("Failed to delete application");
    }
  };

  const handleDuplicate = async () => {
    try {
      const res = await fetch(
        `/api/kanban/applications/${applicationId}/duplicate`,
        { method: "POST" }
      );
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to duplicate");
        return;
      }
      const newApp = await res.json();
      toast.success(`Application duplicated as #${newApp.serialNumber}`);
      onDuplicated(newApp.id);
    } catch {
      toast.error("Failed to duplicate application");
    }
  };

  const ote = app ? computeOTE(app) : null;

  const daysSincePosted = app?.datePosted
    ? Math.floor((Date.now() - new Date(app.datePosted).getTime()) / 86400000)
    : null;

  const daysInStage = app
    ? Math.floor(
        (Date.now() - new Date(app.statusLogs?.[0]?.movedAt ?? app.createdAt).getTime()) / 86400000
      )
    : null;

  // Get the latest review from the most recent generation that has one
  const latestReview = (() => {
    if (!generations.length) return null;
    for (const gen of generations) {
      if (gen.reviewJson) {
        try {
          return JSON.parse(gen.reviewJson) as ReviewResult;
        } catch {
          return null;
        }
      }
    }
    return null;
  })();

  return (
    <Sheet open={true} onOpenChange={(o) => { if (!o) { flushResumeSave(); onClose(); } }}>
      <SheetContent
        side="right"
        className="!max-w-none !p-0 !transition-none"
        style={{ width: drawerWidth ? `${drawerWidth}px` : undefined }}
      >
        {/* Resize drag handle — outside scroll container so overflow doesn't clip it */}
        <div
          onMouseDown={handleResizeStart}
          className="absolute -left-1 top-0 bottom-0 w-3 cursor-col-resize group z-50"
        >
          <div className="absolute left-1 top-0 bottom-0 w-1 rounded-full group-hover:bg-primary/40 group-active:bg-primary/60 transition-colors" />
        </div>
        <div className="overflow-y-auto h-full flex flex-col gap-4 p-4 pt-6">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {app ? (
              <>
                Application #{app.serialNumber}
                <Badge variant="outline" className="font-mono">
                  #{app.serialNumber}
                </Badge>
              </>
            ) : (
              "Application Details"
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Application detail panel
          </SheetDescription>
        </SheetHeader>

        {loading || !app ? (
          <div className="space-y-4 p-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <>

            <div className="space-y-4 mt-4">
              {/* Opportunity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Role</Label>
                  <Input
                    defaultValue={app.role}
                    onBlur={(e) => handleFieldBlur("role", e.target.value)}
                    maxLength={200}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Company</Label>
                  <Input
                    defaultValue={app.company}
                    onBlur={(e) => handleFieldBlur("company", e.target.value)}
                    maxLength={200}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Date Posted</Label>
                  <Input
                    type="date"
                    defaultValue={
                      app.datePosted
                        ? new Date(app.datePosted).toISOString().split("T")[0]
                        : ""
                    }
                    onBlur={(e) => handleFieldBlur("datePosted", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {daysSincePosted != null ? `${daysSincePosted} days ago` : "--"}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select value={app.columnId} onValueChange={handleColumnChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((col) => (
                        <SelectItem key={col.id} value={col.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: col.color }}
                            />
                            {col.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {daysInStage != null ? `${daysInStage} days in stage` : "--"}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Info Section */}
              <CollapsibleSection title="Info">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Posting #</Label>
                    <Input
                      defaultValue={app.postingNumber ?? ""}
                      onBlur={(e) =>
                        handleFieldBlur("postingNumber", e.target.value)
                      }
                      maxLength={200}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Hiring Manager</Label>
                    <Input
                      defaultValue={app.hiringManager ?? ""}
                      onBlur={(e) =>
                        handleFieldBlur("hiringManager", e.target.value)
                      }
                      maxLength={200}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Posting URL</Label>
                  {app.scrapedJobId ? (
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        asChild
                      >
                        <a
                          href={app.postingUrl ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="mr-1 h-4 w-4" />
                          Apply Here!
                        </a>
                      </Button>
                      {app.scrapedJob?.removedAt && (
                        <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2 text-xs text-amber-800 dark:text-amber-200">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>This job posting is no longer available on the company&apos;s careers page.</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Input
                      defaultValue={app.postingUrl ?? ""}
                      onBlur={(e) =>
                        handleFieldBlur("postingUrl", e.target.value)
                      }
                      maxLength={2000}
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hiring Org</Label>
                  <Input
                    defaultValue={app.hiringOrg ?? ""}
                    onBlur={(e) =>
                      handleFieldBlur("hiringOrg", e.target.value)
                    }
                    maxLength={200}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Referrals</Label>
                  <Textarea
                    defaultValue={app.referrals ?? ""}
                    onBlur={(e) =>
                      handleFieldBlur("referrals", e.target.value)
                    }
                    rows={2}
                    maxLength={50000}
                  />
                </div>
              </CollapsibleSection>

              <Separator />

              {/* Location */}
              <CollapsibleSection title="Location">
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={app.locationType ?? ""}
                    onValueChange={(v) => {
                      scheduleUpdate("locationType", v || null);
                      setApp({ ...app, locationType: v || null });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Remote">Remote</SelectItem>
                      <SelectItem value="Hybrid">Hybrid</SelectItem>
                      <SelectItem value="On-site">On-site</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Primary Location</Label>
                  <Input
                    defaultValue={app.primaryLocation ?? ""}
                    onBlur={(e) =>
                      handleFieldBlur("primaryLocation", e.target.value)
                    }
                    maxLength={500}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Additional Locations</Label>
                  <Input
                    defaultValue={app.additionalLocations ?? ""}
                    onBlur={(e) =>
                      handleFieldBlur("additionalLocations", e.target.value)
                    }
                    maxLength={500}
                  />
                </div>
              </CollapsibleSection>

              <Separator />

              {/* Compensation */}
              <CollapsibleSection title="Compensation">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Salary Min ($)</Label>
                    <Input
                      type="number"
                      defaultValue={app.salaryMin ?? ""}
                      onBlur={(e) =>
                        handleNumberBlur("salaryMin", e.target.value)
                      }
                      min={0}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Salary Max ($)</Label>
                    <Input
                      type="number"
                      defaultValue={app.salaryMax ?? ""}
                      onBlur={(e) =>
                        handleNumberBlur("salaryMax", e.target.value)
                      }
                      min={0}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Bonus Target (%)</Label>
                    <Input
                      type="number"
                      defaultValue={app.bonusTargetPct ?? ""}
                      onBlur={(e) =>
                        handleNumberBlur("bonusTargetPct", e.target.value)
                      }
                      min={0}
                      max={100}
                      step="0.1"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Variable Comp ($)</Label>
                    <Input
                      type="number"
                      defaultValue={app.variableComp ?? ""}
                      onBlur={(e) =>
                        handleNumberBlur("variableComp", e.target.value)
                      }
                      min={0}
                    />
                  </div>
                </div>
                {ote != null && (
                  <div className="rounded-md bg-muted p-2 text-sm">
                    <span className="text-muted-foreground">OTE: </span>
                    <span className="font-semibold">{formatCurrency(ote)}</span>
                  </div>
                )}
              </CollapsibleSection>

              <Separator />

              {/* Job Description & Your Fit */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Job Description & Your Fit</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="h-16 flex flex-col gap-1"
                    onClick={() => setJobDescriptionOpen(true)}
                  >
                    <FileText className="h-4 w-4" />
                    <span className="text-xs">Job Description</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-16 flex flex-col gap-1"
                    onClick={() => setResumeModalOpen(true)}
                  >
                    <FileUser className="h-4 w-4" />
                    <span className="text-xs">Your Resume</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-16 flex flex-col gap-1"
                    onClick={() => {
                      if (latestReview) setReviewToShow(latestReview);
                      else toast.info("No review available yet");
                    }}
                  >
                    <Star className="h-4 w-4" />
                    <span className="text-xs">View Review</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-16 flex flex-col gap-1"
                    onClick={() => setPastResumesOpen(true)}
                  >
                    <History className="h-4 w-4" />
                    <span className="text-xs">Past Resumes</span>
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Notes */}
              <CollapsibleSection
                title="Notes"
                badge={String(app.notes.length)}
              >
                <NotesSection
                  applicationId={app.id}
                  notes={app.notes}
                  onNoteAdded={fetchApp}
                  onNoteDeleted={fetchApp}
                />
              </CollapsibleSection>

              <Separator />

              {/* Interviews */}
              <CollapsibleSection
                title="Interviews"
                badge={String(app.interviews.length)}
              >
                <InterviewForm
                  applicationId={app.id}
                  interviews={app.interviews}
                  onUpdated={fetchApp}
                />
              </CollapsibleSection>

              <Separator />

              {/* Actions */}
              <div className="space-y-2 pb-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleDuplicate}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate Application
                </Button>
                {!confirmDelete ? (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Application
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={handleDelete}
                    >
                      Confirm Delete
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        </div>
      </SheetContent>

      <Dialog open={!!answersToShow} onOpenChange={(o) => !o && setAnswersToShow(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Answers to Questions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {answersToShow?.map((qa, i) => (
              <div key={i} className="space-y-1">
                <p className="text-sm font-semibold">{qa.question}</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{qa.answer}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reviewToShow} onOpenChange={(o) => !o && setReviewToShow(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Review Scorecard
              {reviewToShow && (
                <span className={`inline-flex items-center justify-center h-7 w-7 rounded-md text-sm font-bold ${GRADE_COLORS[reviewToShow.overallGrade] || ""}`}>
                  {reviewToShow.overallGrade}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {reviewToShow && (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">{reviewToShow.gradeJustification}</p>

              <div className="space-y-1">
                <h5 className="text-xs font-medium uppercase text-muted-foreground">Keywords</h5>
                <div className="flex flex-wrap gap-1">
                  {(reviewToShow.keywordAlignment?.matched ?? []).map((kw) => (
                    <Badge key={kw} variant="default" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-0.5" />
                      {kw}
                    </Badge>
                  ))}
                  {(reviewToShow.keywordAlignment?.missing ?? []).map((kw) => (
                    <Badge key={kw} variant="outline" className="text-xs text-muted-foreground">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <h5 className="text-xs font-medium uppercase text-muted-foreground">Narrative</h5>
                <p className="text-muted-foreground">{reviewToShow.narrativeCoherence}</p>
              </div>

              {Array.isArray(reviewToShow.bulletImprovements) && reviewToShow.bulletImprovements.length > 0 && (
                <div className="space-y-1.5">
                  <h5 className="text-xs font-medium uppercase text-muted-foreground">Bullet Improvements</h5>
                  {reviewToShow.bulletImprovements.map((bi, i) => (
                    <div key={i} className="rounded-md border p-2 space-y-1">
                      <p className="text-xs line-through text-muted-foreground">{bi.original}</p>
                      <div className="flex items-start gap-1">
                        <ArrowRight className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />
                        <p className="text-xs">{bi.suggested}</p>
                      </div>
                      <p className="text-xs text-muted-foreground italic">{bi.reason}</p>
                    </div>
                  ))}
                </div>
              )}

              {Array.isArray(reviewToShow.gapsAndRisks) && reviewToShow.gapsAndRisks.length > 0 && (
                <div className="space-y-1">
                  <h5 className="text-xs font-medium uppercase text-muted-foreground">Gaps & Risks</h5>
                  <ul className="text-xs text-muted-foreground space-y-0.5 list-disc pl-3">
                    {reviewToShow.gapsAndRisks.map((gap, i) => (
                      <li key={i}>{gap}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Job Description Modal */}
      <Dialog open={jobDescriptionOpen} onOpenChange={setJobDescriptionOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Job Description</DialogTitle>
          </DialogHeader>
          {app && (
            <Textarea
              defaultValue={app.jobDescription ?? ""}
              onBlur={(e) => handleFieldBlur("jobDescription", e.target.value)}
              rows={20}
              maxLength={50000}
              className="font-mono text-xs"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Your Resume Modal */}
      <Dialog open={resumeModalOpen} onOpenChange={(o) => { if (!o) flushResumeSave(); setResumeModalOpen(o); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Your Resume
              <SaveIndicator status={resumeSaveStatus} />
            </DialogTitle>
          </DialogHeader>
          {app && (
            <div className="space-y-3">
              <GenerateButton
                jobApplicationId={app.id}
                hasResumeSource={hasResumeSource}
                hasJobDescription={!!app.jobDescription?.trim()}
                capReached={capReached}
                onGenerated={(result) => {
                  setCurrentGeneration({
                    id: result.id,
                    markdownOutput: result.markdownOutput,
                    originalMarkdown: result.markdownOutput,
                  });
                  setEditedMarkdown(result.markdownOutput);
                  setUsageRefreshKey((k) => k + 1);
                  fetchHistory();
                }}
                onUsageChanged={() => setUsageRefreshKey((k) => k + 1)}
              />

              {currentGeneration && (
                <>
                  <div className="flex items-center gap-2">
                    <DownloadButton
                      generationId={currentGeneration.id}
                      editedMarkdown={editedMarkdown}
                      originalMarkdown={currentGeneration.originalMarkdown}
                    />
                  </div>
                  <ResumeEditor
                    originalMarkdown={currentGeneration.originalMarkdown}
                    editedMarkdown={editedMarkdown}
                    onEdit={handleEditMarkdown}
                  />
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Past Resumes Modal */}
      <Dialog open={pastResumesOpen} onOpenChange={setPastResumesOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Past Resumes</DialogTitle>
          </DialogHeader>
          <GenerationHistory
            generations={generations}
            onSelect={(gen) => {
              flushResumeSave();
              setCurrentGeneration({
                id: gen.id,
                markdownOutput: gen.markdownOutput,
                originalMarkdown: gen.markdownOutput,
              });
              setEditedMarkdown(gen.editedMarkdown ?? gen.markdownOutput);
              setPastResumesOpen(false);
              setResumeModalOpen(true);
            }}
            onViewAnswers={setAnswersToShow}
            onViewReview={setReviewToShow}
          />
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
