"use client";

import { useCallback, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { GripVertical, ChevronDown, ChevronRight, Trash2, Plus } from "lucide-react";
import { useAutoSave } from "@/hooks/use-auto-save";
import { SaveIndicator } from "./save-indicator";
import { DatePicker } from "./date-picker";
import { fetchOrThrowSaveError } from "@/lib/fetch-with-save-error";
import type { ResumePublication } from "@/types/resume-source";
import { toast } from "sonner";

const PUBLICATION_TYPES = [
  "Patent",
  "Peer-Reviewed Paper",
  "Book",
  "Magazine Article",
  "Substack",
  "Blog Post",
  "White Paper",
  "Other",
] as const;

type PublicationsSectionProps = {
  publications: ResumePublication[];
  onUpdate: (publications: ResumePublication[]) => void;
};

function PublicationCard({
  entry,
  index,
  isExpanded,
  onToggle,
  onSaved,
  onDelete,
}: {
  entry: ResumePublication;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onSaved: (updated: ResumePublication) => void;
  onDelete: () => void;
}) {
  const [fields, setFields] = useState(entry);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const saveEntry = useCallback(
    async (data: ResumePublication) => {
      const res = await fetchOrThrowSaveError(`/api/resume-source/publications/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          publicationType: data.publicationType || null,
          publisher: data.publisher || null,
          date: data.date || null,
          url: data.url || null,
          description: data.description || null,
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

  const handleChange = (field: keyof ResumePublication, value: string | null) => {
    const updated = { ...fields, [field]: value };
    setFields(updated);
  };

  const handleBlur = () => trigger(fields);

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
                className="flex flex-1 items-center gap-2 text-left text-sm"
              >
                <span className="shrink-0">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold leading-tight">
                    {fields.title || "New Publication"}
                  </span>
                  {(fields.publicationType || fields.date) && (
                    <span className="text-xs text-muted-foreground">
                      {[
                        fields.publicationType,
                        fields.date?.slice(0, 4),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                  {fields.publisher && (
                    <span className="text-xs text-muted-foreground">
                      {fields.publisher}
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
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input
                    value={fields.title}
                    onChange={(e) => handleChange("title", e.target.value)}
                    onBlur={handleBlur}
                    placeholder="Publication Title"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select
                    value={fields.publicationType ?? ""}
                    onValueChange={(v) => {
                      const val = v || null;
                      handleChange("publicationType", val);
                      trigger({ ...fields, publicationType: val });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PUBLICATION_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Publisher</Label>
                  <Input
                    value={fields.publisher ?? ""}
                    onChange={(e) => handleChange("publisher", e.target.value)}
                    onBlur={handleBlur}
                    placeholder="Publisher name"
                  />
                </div>
                <DatePicker
                  label="Date"
                  value={fields.date}
                  onChange={(v) => {
                    handleChange("date", v);
                    trigger({ ...fields, date: v });
                  }}
                />
                <div className="space-y-1.5">
                  <Label>URL</Label>
                  <Input
                    value={fields.url ?? ""}
                    onChange={(e) => handleChange("url", e.target.value)}
                    onBlur={handleBlur}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea
                    value={fields.description ?? ""}
                    onChange={(e) => handleChange("description", e.target.value)}
                    onBlur={handleBlur}
                    placeholder="Brief description..."
                    rows={3}
                  />
                </div>
              </CardContent>
            )}
          </Card>

          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete publication?</DialogTitle>
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
      )}
    </Draggable>
  );
}

export function PublicationsSection({
  publications,
  onUpdate,
}: PublicationsSectionProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    const res = await fetch("/api/resume-source/publications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Publication" }),
    });
    if (!res.ok) {
      toast.error("Failed to add publication.");
      return;
    }
    const created = await res.json();
    onUpdate([...publications, created]);
    setExpanded((prev) => new Set(prev).add(created.id));
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/resume-source/publications/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Failed to delete.");
      return;
    }
    onUpdate(publications.filter((p) => p.id !== id));
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const previousOrder = [...publications];
    const items = Array.from(publications);
    const [removed] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, removed);
    const reordered = items.map((item, i) => ({ ...item, sortOrder: i }));
    onUpdate(reordered);

    try {
      await fetchOrThrowSaveError("/api/resume-source/publications/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: reordered.map((p) => p.id) }),
      });
    } catch {
      toast.error("Failed to reorder. Reverting.");
      onUpdate(previousOrder);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Publications</h2>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="publications">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="space-y-3"
            >
              {publications.map((entry, index) => (
                <PublicationCard
                  key={entry.id}
                  entry={entry}
                  index={index}
                  isExpanded={expanded.has(entry.id)}
                  onToggle={() => toggleExpanded(entry.id)}
                  onSaved={(updated) =>
                    onUpdate(
                      publications.map((p) =>
                        p.id === updated.id ? updated : p
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
        Add Publication
      </Button>
    </div>
  );
}
