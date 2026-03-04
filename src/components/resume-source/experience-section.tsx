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
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  Trash2,
  Plus,
  ChevronsUpDown,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAutoSave } from "@/hooks/use-auto-save";
import { SaveIndicator } from "./save-indicator";
import { DatePicker } from "./date-picker";
import { SubsectionForm } from "./subsection-form";
import { fetchOrThrowSaveError } from "@/lib/fetch-with-save-error";
import type { ResumeWorkExperience, ResumeWorkSubsection } from "@/types/resume-source";
import { toast } from "sonner";

type ExperienceSectionProps = {
  experiences: ResumeWorkExperience[];
  onUpdate: (experiences: ResumeWorkExperience[]) => void;
};

function ExperienceCard({
  entry,
  index,
  isExpanded,
  onToggle,
  onSaved,
  onDelete,
}: {
  entry: ResumeWorkExperience;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onSaved: (updated: ResumeWorkExperience) => void;
  onDelete: () => void;
}) {
  const [fields, setFields] = useState({
    ...entry,
    alternateTitles: entry.alternateTitles ?? [],
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [altTitleInput, setAltTitleInput] = useState("");

  const saveEntry = useCallback(
    async (data: ResumeWorkExperience) => {
      const res = await fetchOrThrowSaveError(`/api/resume-source/experience/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: data.company,
          title: data.title,
          location: data.location || null,
          startDate: data.startDate || null,
          endDate: data.endDate || null,
          description: data.description || null,
          alternateTitles: data.alternateTitles ?? [],
        }),
      });
      const saved = await res.json();
      onSaved({ ...saved, subsections: data.subsections });
    },
    [onSaved]
  );

  const entryWithDefaults = { ...entry, alternateTitles: entry.alternateTitles ?? [] };

  const { status, trigger, flush } = useAutoSave({
    onSave: saveEntry,
    initialData: entryWithDefaults,
    onRollback: (lastSaved) =>
      setFields((prev) => ({ ...lastSaved, subsections: prev.subsections })),
  });

  useEffect(() => () => flush(), [flush]);

  const handleChange = (
    field: keyof ResumeWorkExperience,
    value: string | string[] | null
  ) => {
    const updated = { ...fields, [field]: value };
    setFields(updated);
  };

  const handleBlur = () => trigger(fields);

  const handleAddSubsection = async () => {
    const res = await fetch(
      `/api/resume-source/experience/${entry.id}/subsection`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "New Subsection", bullets: [] }),
      }
    );
    if (!res.ok) {
      toast.error("Failed to add subsection.");
      return;
    }
    const created = await res.json();
    const updated = { ...fields, subsections: [...fields.subsections, created] };
    setFields(updated);
    onSaved(updated);
  };

  const handleDeleteSubsection = async (subId: string) => {
    const res = await fetch(
      `/api/resume-source/experience/${entry.id}/subsection/${subId}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      toast.error("Failed to delete subsection.");
      return;
    }
    const updated = {
      ...fields,
      subsections: fields.subsections.filter((s) => s.id !== subId),
    };
    setFields(updated);
    onSaved(updated);
  };

  const handleSubsectionSaved = (sub: ResumeWorkSubsection) => {
    const updated = {
      ...fields,
      subsections: fields.subsections.map((s) => (s.id === sub.id ? sub : s)),
    };
    setFields(updated);
    onSaved(updated);
  };

  const handleSubsectionDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const previousSubsections = [...fields.subsections];
    const items = Array.from(fields.subsections);
    const [removed] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, removed);
    const reordered = items.map((item, i) => ({ ...item, sortOrder: i }));
    const updated = { ...fields, subsections: reordered };
    setFields(updated);
    onSaved(updated);

    try {
      await fetchOrThrowSaveError(
        `/api/resume-source/experience/${entry.id}/subsection/reorder`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: reordered.map((s) => s.id) }),
        }
      );
    } catch {
      toast.error("Failed to reorder subsections. Reverting.");
      const reverted = { ...fields, subsections: previousSubsections };
      setFields(reverted);
      onSaved(reverted);
    }
  };

  const displayTitle = fields.title || "New Experience";

  const formatYear = (date: string | null | undefined) => {
    if (!date) return null;
    const match = date.match(/(\d{4})/);
    return match ? match[1] : null;
  };

  const startYear = formatYear(fields.startDate);
  const endYear = formatYear(fields.endDate);
  const timeframe =
    startYear && endYear
      ? `${startYear} – ${endYear}`
      : startYear
        ? `${startYear} – Present`
        : null;

  return (
    <Draggable draggableId={entry.id} index={index}>
      {(provided) => (
        <div ref={provided.innerRef} {...provided.draggableProps}>
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 p-3">
              <div {...provided.dragHandleProps} aria-label="Drag to reorder">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
              <button
                onClick={onToggle}
                className="flex flex-1 items-start gap-2 text-left"
              >
                <span className="mt-0.5">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold leading-tight">
                    {displayTitle}
                  </span>
                  {fields.company && (
                    <span className="text-xs text-muted-foreground">
                      {fields.company}
                    </span>
                  )}
                  {timeframe && (
                    <span className="text-xs text-muted-foreground">
                      {timeframe}
                    </span>
                  )}
                </div>
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Company</Label>
                    <Input
                      value={fields.company}
                      onChange={(e) => handleChange("company", e.target.value)}
                      onBlur={handleBlur}
                      placeholder="Acme Corp"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <Input
                      value={fields.title}
                      onChange={(e) => handleChange("title", e.target.value)}
                      onBlur={handleBlur}
                      placeholder="Senior PM"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Alternate Titles</Label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {fields.alternateTitles.map((alt, idx) => (
                      <Badge key={idx} variant="secondary" className="gap-1">
                        {alt}
                        <button
                          onClick={() => {
                            const updated = fields.alternateTitles.filter(
                              (_, i) => i !== idx
                            );
                            const updatedFields = {
                              ...fields,
                              alternateTitles: updated,
                            };
                            setFields(updatedFields);
                            trigger(updatedFields);
                          }}
                          className="ml-0.5 hover:text-destructive"
                          aria-label={`Remove ${alt}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <Input
                    value={altTitleInput}
                    onChange={(e) => setAltTitleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        const trimmed = altTitleInput.trim();
                        if (
                          !trimmed ||
                          fields.alternateTitles.length >= 10 ||
                          fields.alternateTitles.some(
                            (t) => t.toLowerCase() === trimmed.toLowerCase()
                          ) ||
                          fields.title.toLowerCase() === trimmed.toLowerCase()
                        )
                          return;
                        const updated = [
                          ...fields.alternateTitles,
                          trimmed,
                        ];
                        const updatedFields = {
                          ...fields,
                          alternateTitles: updated,
                        };
                        setFields(updatedFields);
                        setAltTitleInput("");
                        trigger(updatedFields);
                      }
                      if (
                        e.key === "Backspace" &&
                        !altTitleInput &&
                        fields.alternateTitles.length > 0
                      ) {
                        const updated = fields.alternateTitles.slice(0, -1);
                        const updatedFields = {
                          ...fields,
                          alternateTitles: updated,
                        };
                        setFields(updatedFields);
                        trigger(updatedFields);
                      }
                    }}
                    onBlur={() => {
                      const trimmed = altTitleInput.trim();
                      if (
                        trimmed &&
                        fields.alternateTitles.length < 10 &&
                        !fields.alternateTitles.some(
                          (t) => t.toLowerCase() === trimmed.toLowerCase()
                        ) &&
                        fields.title.toLowerCase() !== trimmed.toLowerCase()
                      ) {
                        const updated = [
                          ...fields.alternateTitles,
                          trimmed,
                        ];
                        const updatedFields = {
                          ...fields,
                          alternateTitles: updated,
                        };
                        setFields(updatedFields);
                        setAltTitleInput("");
                        trigger(updatedFields);
                      }
                    }}
                    placeholder="Type alternate title and press Enter to add..."
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Location</Label>
                  <Input
                    value={fields.location ?? ""}
                    onChange={(e) => handleChange("location", e.target.value)}
                    onBlur={handleBlur}
                    placeholder="San Francisco, CA"
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
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea
                    value={fields.description ?? ""}
                    onChange={(e) => handleChange("description", e.target.value)}
                    onBlur={handleBlur}
                    placeholder="Led product strategy..."
                    rows={3}
                  />
                </div>

                {/* Subsections */}
                <div className="space-y-2 pt-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Subsections
                  </h4>
                  <DragDropContext onDragEnd={handleSubsectionDragEnd}>
                    <Droppable droppableId={`subsections-${entry.id}`}>
                      {(subProvided) => (
                        <div
                          ref={subProvided.innerRef}
                          {...subProvided.droppableProps}
                          className="space-y-2"
                        >
                          {fields.subsections.map((sub, subIndex) => (
                            <Draggable
                              key={sub.id}
                              draggableId={sub.id}
                              index={subIndex}
                            >
                              {(subDragProvided) => (
                                <div
                                  ref={subDragProvided.innerRef}
                                  {...subDragProvided.draggableProps}
                                >
                                  <SubsectionForm
                                    subsection={sub}
                                    experienceId={entry.id}
                                    onSaved={handleSubsectionSaved}
                                    onDelete={() =>
                                      handleDeleteSubsection(sub.id)
                                    }
                                    dragHandleProps={
                                      subDragProvided.dragHandleProps
                                    }
                                  />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {subProvided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAddSubsection}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add Subsection
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete work experience?</DialogTitle>
                <DialogDescription>
                  Are you sure? This will also delete all subsections. This
                  cannot be undone.
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
      )}
    </Draggable>
  );
}

export function ExperienceSection({
  experiences,
  onUpdate,
}: ExperienceSectionProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (expanded.size === experiences.length) {
      setExpanded(new Set());
    } else {
      setExpanded(new Set(experiences.map((e) => e.id)));
    }
  };

  const handleAdd = async () => {
    const res = await fetch("/api/resume-source/experience", { method: "POST" });
    if (!res.ok) {
      toast.error("Failed to add experience.");
      return;
    }
    const created = await res.json();
    onUpdate([...experiences, created]);
    setExpanded((prev) => new Set(prev).add(created.id));
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/resume-source/experience/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Failed to delete.");
      return;
    }
    onUpdate(experiences.filter((e) => e.id !== id));
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const previousOrder = [...experiences];
    const items = Array.from(experiences);
    const [removed] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, removed);
    const reordered = items.map((item, i) => ({ ...item, sortOrder: i }));
    onUpdate(reordered);

    try {
      await fetchOrThrowSaveError("/api/resume-source/experience/reorder", {
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
        <h2 className="text-lg font-semibold">Work Experience</h2>
        <div className="flex gap-2">
          {experiences.length >= 2 && (
            <Button variant="ghost" size="sm" onClick={toggleAll}>
              <ChevronsUpDown className="mr-1 h-4 w-4" />
              {expanded.size === experiences.length
                ? "Collapse All"
                : "Expand All"}
            </Button>
          )}
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="experiences">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="space-y-3"
            >
              {experiences.map((entry, index) => (
                <ExperienceCard
                  key={entry.id}
                  entry={entry}
                  index={index}
                  isExpanded={expanded.has(entry.id)}
                  onToggle={() => toggleExpanded(entry.id)}
                  onSaved={(updated) =>
                    onUpdate(
                      experiences.map((e) =>
                        e.id === updated.id ? updated : e
                      )
                    )
                  }
                  onDelete={() => handleDelete(entry.id)}
                />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <Button onClick={handleAdd} variant="outline" className="w-full">
        <Plus className="mr-1 h-4 w-4" />
        Add Experience
      </Button>
    </div>
  );
}
