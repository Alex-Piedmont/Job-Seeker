"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { ChevronDown, Copy, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { InterviewForm } from "./interview-form";
import { NotesSection } from "./notes-section";
import { computeOTE, formatCurrency } from "@/lib/kanban-utils";

interface Column {
  id: string;
  name: string;
  color: string;
  columnType: string | null;
}

interface ApplicationDetail {
  id: string;
  serialNumber: number;
  columnId: string;
  company: string;
  role: string;
  hiringManager: string | null;
  hiringOrg: string | null;
  postingNumber: string | null;
  postingUrl: string | null;
  locationType: string | null;
  primaryLocation: string | null;
  additionalLocations: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  bonusTargetPct: number | null;
  variableComp: number | null;
  referrals: string | null;
  datePosted: string | null;
  dateApplied: string | null;
  rejectionDate: string | null;
  closedReason: string | null;
  jobDescription: string | null;
  createdAt: string;
  updatedAt: string;
  interviews: Array<{
    id: string;
    type: string;
    format: string;
    people: string | null;
    date: string | null;
    notes: string | null;
    sortOrder: number;
  }>;
  notes: Array<{ id: string; content: string; createdAt: string }>;
  column: { id: string; name: string; columnType: string | null };
}

interface ApplicationDetailDrawerProps {
  applicationId: string;
  columns: Column[];
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
  onDuplicated: (newId: string) => void;
}

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  badge?: string;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  defaultOpen = true,
  badge,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        className="flex items-center gap-2 w-full py-2 text-sm font-medium hover:text-foreground/80"
        onClick={() => setOpen(!open)}
      >
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`}
        />
        {title}
        {badge && (
          <Badge variant="secondary" className="text-xs ml-1">
            {badge}
          </Badge>
        )}
      </button>
      {open && <div className="pl-6 space-y-3 pb-2">{children}</div>}
    </div>
  );
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdates = useRef<Record<string, unknown>>({});

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

  return (
    <Sheet open={true} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:w-[60%] sm:max-w-2xl overflow-y-auto"
      >
        {loading || !app ? (
          <div className="space-y-4 p-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                Application #{app.serialNumber}
                <Badge variant="outline" className="font-mono">
                  #{app.serialNumber}
                </Badge>
              </SheetTitle>
            </SheetHeader>

            <div className="space-y-4 mt-4">
              {/* Status */}
              <div className="space-y-2">
                <Label>Status</Label>
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
              </div>

              {/* Core Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Company</Label>
                  <Input
                    defaultValue={app.company}
                    onBlur={(e) => handleFieldBlur("company", e.target.value)}
                    maxLength={200}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Role</Label>
                  <Input
                    defaultValue={app.role}
                    onBlur={(e) => handleFieldBlur("role", e.target.value)}
                    maxLength={200}
                  />
                </div>
              </div>

              <Separator />

              {/* Info Section */}
              <CollapsibleSection title="Info">
                <div className="grid grid-cols-2 gap-3">
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
                  <Input
                    defaultValue={app.postingUrl ?? ""}
                    onBlur={(e) =>
                      handleFieldBlur("postingUrl", e.target.value)
                    }
                    maxLength={2000}
                  />
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
                <div className="grid grid-cols-2 gap-3">
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
                <div className="grid grid-cols-2 gap-3">
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

              {/* Dates */}
              <CollapsibleSection title="Dates">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Date Posted</Label>
                    <Input
                      type="date"
                      defaultValue={
                        app.datePosted
                          ? new Date(app.datePosted)
                              .toISOString()
                              .split("T")[0]
                          : ""
                      }
                      onBlur={(e) =>
                        handleFieldBlur("datePosted", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Date Applied</Label>
                    <Input
                      type="date"
                      defaultValue={
                        app.dateApplied
                          ? new Date(app.dateApplied)
                              .toISOString()
                              .split("T")[0]
                          : ""
                      }
                      onBlur={(e) =>
                        handleFieldBlur("dateApplied", e.target.value)
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Rejection Date</Label>
                    <Input
                      type="date"
                      defaultValue={
                        app.rejectionDate
                          ? new Date(app.rejectionDate)
                              .toISOString()
                              .split("T")[0]
                          : ""
                      }
                      onBlur={(e) =>
                        handleFieldBlur("rejectionDate", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Closed Reason</Label>
                    <div className="flex items-center gap-2 h-9">
                      {app.closedReason ? (
                        <Badge
                          variant={
                            app.closedReason === "ghosted"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {app.closedReason === "ghosted"
                            ? "Ghosted"
                            : "Rejected"}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          --
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              <Separator />

              {/* Job Description */}
              <CollapsibleSection title="Job Description" defaultOpen={false}>
                <Textarea
                  defaultValue={app.jobDescription ?? ""}
                  onBlur={(e) =>
                    handleFieldBlur("jobDescription", e.target.value)
                  }
                  rows={10}
                  maxLength={50000}
                  className="font-mono text-xs"
                />
              </CollapsibleSection>

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
                <Button variant="outline" disabled className="w-full">
                  Generate Resume (Coming Soon)
                </Button>
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
      </SheetContent>
    </Sheet>
  );
}
