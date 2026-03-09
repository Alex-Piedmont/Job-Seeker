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
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAutoSave } from "@/hooks/use-auto-save";
import { SaveIndicator } from "./save-indicator";
import { DatePicker } from "./date-picker";
import { SubsectionList } from "./subsection-list";
import { fetchOrThrowSaveError } from "@/lib/fetch-with-save-error";
import type { ResumeWorkExperience, ResumeWorkSubsection } from "@/types/resume-source";

export type ExperienceCardProps = {
  entry: ResumeWorkExperience;
  isExpanded: boolean;
  onToggle: () => void;
  onSaved: (updated: ResumeWorkExperience) => void;
  onDelete: () => void;
};

export function ExperienceCard({
  entry,
  isExpanded,
  onToggle,
  onSaved,
  onDelete,
}: ExperienceCardProps) {
  const [fields, setFields] = useState({
    ...entry,
    alternateTitles: entry.alternateTitles ?? [],
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [altTitleInput, setAltTitleInput] = useState("");

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

  const handleSubsectionsChange = (subsections: ResumeWorkSubsection[]) => {
    const updated = { ...fields, subsections };
    setFields(updated);
    onSaved(updated);
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
    <div ref={setNodeRef} style={style}>
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 p-3">
          <div {...listeners} {...attributes} aria-label="Drag to reorder">
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
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

            <SubsectionList
              subsections={fields.subsections}
              experienceId={entry.id}
              onSubsectionsChange={handleSubsectionsChange}
            />
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
  );
}
