"use client";

import { useCallback, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronDown, ChevronRight, Trash2, Plus, ChevronsUpDown } from "lucide-react";
import { useAutoSave } from "@/hooks/use-auto-save";
import { SaveIndicator } from "./save-indicator";
import { DatePicker } from "./date-picker";
import { fetchOrThrowSaveError } from "@/lib/fetch-with-save-error";
import type { ResumeEducation } from "@/types/resume-source";
import { toast } from "sonner";

type EducationSectionProps = {
  education: ResumeEducation[];
  onUpdate: (education: ResumeEducation[]) => void;
};

function EducationCard({
  entry,
  isExpanded,
  onToggle,
  onSaved,
  onDelete,
}: {
  entry: ResumeEducation;
  isExpanded: boolean;
  onToggle: () => void;
  onSaved: (updated: ResumeEducation) => void;
  onDelete: () => void;
}) {
  const [fields, setFields] = useState(entry);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    setNodeRef,
    transform,
    transition,
    listeners,
    attributes,
  } = useSortable({ id: entry.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const saveEntry = useCallback(
    async (data: ResumeEducation) => {
      const res = await fetchOrThrowSaveError(`/api/resume-source/education/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institution: data.institution,
          degree: data.degree,
          fieldOfStudy: data.fieldOfStudy || null,
          startDate: data.startDate || null,
          endDate: data.endDate || null,
          gpa: data.gpa || null,
          honors: data.honors || null,
          notes: data.notes || null,
        }),
      });
      const saved = await res.json();
      onSaved(saved);
    },
    [onSaved]
  );

  const { status, trigger, flush } = useAutoSave({
    onSave: saveEntry,
    initialData: entry,
    onRollback: (lastSaved) => setFields(lastSaved),
  });

  useEffect(() => () => flush(), [flush]);

  const handleChange = (field: keyof ResumeEducation, value: string | null) => {
    const updated = { ...fields, [field]: value };
    setFields(updated);
  };

  const handleBlur = () => trigger(fields);

  const title =
    fields.institution && fields.degree
      ? `${fields.degree} — ${fields.institution}`
      : fields.institution || fields.degree || "New Education Entry";

  return (
    <div ref={setNodeRef} style={style}>
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 p-3">
          <div {...listeners} {...attributes} aria-label="Drag to reorder">
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
          </div>
          <button
            onClick={onToggle}
            className="flex flex-1 items-center gap-2 text-left text-sm font-medium"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            {title}
          </button>
          <SaveIndicator status={status} />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteOpen(true)}
            className="h-8 w-8"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardHeader>
        {isExpanded && (
          <CardContent className="space-y-3 pt-0">
            <div className="space-y-1.5">
              <Label>Institution</Label>
              <Input
                value={fields.institution}
                onChange={(e) => handleChange("institution", e.target.value)}
                onBlur={handleBlur}
                placeholder="MIT"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Degree</Label>
              <Input
                value={fields.degree}
                onChange={(e) => handleChange("degree", e.target.value)}
                onBlur={handleBlur}
                placeholder="Bachelor of Science"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Field of Study</Label>
              <Input
                value={fields.fieldOfStudy ?? ""}
                onChange={(e) => handleChange("fieldOfStudy", e.target.value)}
                onBlur={handleBlur}
                placeholder="Computer Science"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DatePicker
                label="Start Date"
                value={fields.startDate}
                onChange={(v) => {
                  handleChange("startDate", v);
                  trigger({ ...fields, startDate: v });
                }}
              />
              <DatePicker
                label="End Date"
                value={fields.endDate}
                onChange={(v) => {
                  handleChange("endDate", v);
                  trigger({ ...fields, endDate: v });
                }}
                showPresent
                isPresent={fields.endDate === null && !!fields.startDate}
                onPresentChange={(present) => {
                  const val = present ? null : "";
                  handleChange("endDate", val);
                  trigger({ ...fields, endDate: val });
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>GPA</Label>
                <Input
                  value={fields.gpa ?? ""}
                  onChange={(e) => handleChange("gpa", e.target.value)}
                  onBlur={handleBlur}
                  placeholder="3.8/4.0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Honors</Label>
                <Input
                  value={fields.honors ?? ""}
                  onChange={(e) => handleChange("honors", e.target.value)}
                  onBlur={handleBlur}
                  placeholder="magna cum laude"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={fields.notes ?? ""}
                onChange={(e) => handleChange("notes", e.target.value)}
                onBlur={handleBlur}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          </CardContent>
        )}
      </Card>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete education entry?</DialogTitle>
            <DialogDescription>
              Are you sure? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDeleteOpen(false);
                onDelete();
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function EducationSection({ education, onUpdate }: EducationSectionProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (expanded.size === education.length) {
      setExpanded(new Set());
    } else {
      setExpanded(new Set(education.map((e) => e.id)));
    }
  };

  const handleAdd = async () => {
    const res = await fetch("/api/resume-source/education", { method: "POST" });
    if (!res.ok) {
      toast.error("Failed to add education entry.");
      return;
    }
    const created = await res.json();
    onUpdate([...education, created]);
    setExpanded((prev) => new Set(prev).add(created.id));
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/resume-source/education/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Failed to delete.");
      return;
    }
    onUpdate(education.filter((e) => e.id !== id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = education.findIndex((e) => e.id === active.id);
    const newIndex = education.findIndex((e) => e.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const previousOrder = [...education];
    const reordered = arrayMove(education, oldIndex, newIndex).map(
      (item, i) => ({ ...item, sortOrder: i })
    );
    onUpdate(reordered);

    try {
      await fetchOrThrowSaveError("/api/resume-source/education/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: reordered.map((e) => e.id) }),
      });
    } catch {
      toast.error("Failed to reorder. Reverting.");
      onUpdate(previousOrder);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Education</h2>
        <div className="flex gap-2">
          {education.length >= 2 && (
            <Button variant="ghost" size="sm" onClick={toggleAll}>
              <ChevronsUpDown className="mr-1 h-4 w-4" />
              {expanded.size === education.length ? "Collapse All" : "Expand All"}
            </Button>
          )}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={education.map((e) => e.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {education.map((entry) => (
              <EducationCard
                key={entry.id}
                entry={entry}
                isExpanded={expanded.has(entry.id)}
                onToggle={() => toggleExpanded(entry.id)}
                onSaved={(updated) =>
                  onUpdate(
                    education.map((e) => (e.id === updated.id ? updated : e))
                  )
                }
                onDelete={() => handleDelete(entry.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button onClick={handleAdd} variant="outline" className="w-full">
        <Plus className="mr-1 h-4 w-4" />
        Add Education
      </Button>
    </div>
  );
}
