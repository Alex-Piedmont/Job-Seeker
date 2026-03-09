"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
  arrayMove,
} from "@dnd-kit/sortable";
import {
  ChevronsUpDown,
  X,
  Plus,
  Info,
} from "lucide-react";
import { ExperienceCard } from "./experience-card";
import { fetchOrThrowSaveError } from "@/lib/fetch-with-save-error";
import type { ResumeWorkExperience } from "@/types/resume-source";
import { toast } from "sonner";

type ExperienceSectionProps = {
  experiences: ResumeWorkExperience[];
  onUpdate: (experiences: ResumeWorkExperience[]) => void;
  onOpenGuide?: () => void;
};

export function ExperienceSection({
  experiences,
  onUpdate,
  onOpenGuide,
}: ExperienceSectionProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [nudgeDismissed, setNudgeDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return !!localStorage.getItem("resume-source-nudge-dismissed");
    } catch {
      return true;
    }
  });

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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = experiences.findIndex((e) => e.id === active.id);
    const newIndex = experiences.findIndex((e) => e.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const previousOrder = [...experiences];
    const reordered = arrayMove(experiences, oldIndex, newIndex).map(
      (item, i) => ({ ...item, sortOrder: i })
    );
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

      {!nudgeDismissed &&
        experiences.length > 0 &&
        experiences.some((e) => e.subsections.length === 0) && (
          <div className="flex items-start gap-3 rounded-lg border bg-muted/50 p-3 text-sm">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-muted-foreground">
                Organize your experience into subsections (like &ldquo;Key
                Projects&rdquo; or &ldquo;Leadership&rdquo;) to help the AI
                generate more targeted resumes.{" "}
                {onOpenGuide && (
                  <button
                    type="button"
                    onClick={onOpenGuide}
                    className="text-primary underline underline-offset-2 hover:text-primary/80"
                  >
                    Learn more
                  </button>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setNudgeDismissed(true);
                try {
                  localStorage.setItem("resume-source-nudge-dismissed", "true");
                } catch {
                  // localStorage unavailable
                }
              }}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={experiences.map((e) => e.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {experiences.map((entry) => (
              <ExperienceCard
                key={entry.id}
                entry={entry}
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
          </div>
        </SortableContext>
      </DndContext>

      <Button onClick={handleAdd} variant="outline" className="w-full">
        <Plus className="mr-1 h-4 w-4" />
        Add Experience
      </Button>
    </div>
  );
}
