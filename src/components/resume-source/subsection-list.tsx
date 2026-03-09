"use client";

import { useState, useEffect } from "react";
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
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Rocket,
  Lightbulb,
  TrendingUp,
  Users,
} from "lucide-react";
import { SubsectionForm } from "./subsection-form";
import { fetchOrThrowSaveError } from "@/lib/fetch-with-save-error";
import type { ResumeWorkSubsection } from "@/types/resume-source";
import { toast } from "sonner";

const THINKING_PROMPTS = [
  { label: "Projects I Led", icon: Rocket },
  { label: "Problems I Solved", icon: Lightbulb },
  { label: "Growth & Impact", icon: TrendingUp },
  { label: "Collaboration & Leadership", icon: Users },
] as const;

type SubsectionListProps = {
  subsections: ResumeWorkSubsection[];
  experienceId: string;
  onSubsectionsChange: (subsections: ResumeWorkSubsection[]) => void;
};

function SortableSubsection({
  sub,
  experienceId,
  onSaved,
  onDelete,
  initialExpanded,
}: {
  sub: ResumeWorkSubsection;
  experienceId: string;
  onSaved: (updated: ResumeWorkSubsection) => void;
  onDelete: () => void;
  initialExpanded?: boolean;
}) {
  const { setNodeRef, transform, transition, listeners, attributes } =
    useSortable({ id: sub.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <SubsectionForm
        subsection={sub}
        experienceId={experienceId}
        onSaved={onSaved}
        onDelete={onDelete}
        dragHandleProps={{ ...listeners, ...attributes }}
        initialExpanded={initialExpanded}
      />
    </div>
  );
}

export function SubsectionList({
  subsections,
  experienceId,
  onSubsectionsChange,
}: SubsectionListProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newlyCreatedSubId, setNewlyCreatedSubId] = useState<string | null>(null);

  useEffect(() => {
    if (newlyCreatedSubId) setNewlyCreatedSubId(null);
  }, [newlyCreatedSubId]);

  const subsectionSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleAddSubsection = async (label = "New Subsection") => {
    const isChip = label !== "New Subsection";
    setIsCreating(true);
    try {
      const res = await fetch(
        `/api/resume-source/experience/${experienceId}/subsection`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label,
            bullets: isChip ? [""] : [],
          }),
        }
      );
      if (!res.ok) {
        toast.error("Failed to add subsection.");
        return;
      }
      const created = await res.json();
      if (isChip) setNewlyCreatedSubId(created.id);
      onSubsectionsChange([...subsections, created]);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSubsection = async (subId: string) => {
    const res = await fetch(
      `/api/resume-source/experience/${experienceId}/subsection/${subId}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      toast.error("Failed to delete subsection.");
      return;
    }
    onSubsectionsChange(subsections.filter((s) => s.id !== subId));
  };

  const handleSubsectionSaved = (sub: ResumeWorkSubsection) => {
    onSubsectionsChange(
      subsections.map((s) => (s.id === sub.id ? sub : s))
    );
  };

  const handleSubsectionDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = subsections.findIndex((s) => s.id === active.id);
    const newIndex = subsections.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const previousSubsections = [...subsections];
    const reordered = arrayMove(subsections, oldIndex, newIndex).map(
      (item, i) => ({ ...item, sortOrder: i })
    );
    onSubsectionsChange(reordered);

    try {
      await fetchOrThrowSaveError(
        `/api/resume-source/experience/${experienceId}/subsection/reorder`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: reordered.map((s) => s.id) }),
        }
      );
    } catch {
      toast.error("Failed to reorder subsections. Reverting.");
      onSubsectionsChange(previousSubsections);
    }
  };

  return (
    <div className="space-y-2 pt-2">
      <h4 className="text-sm font-medium text-muted-foreground">
        Subsections
      </h4>

      {subsections.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {THINKING_PROMPTS.map((prompt) => {
            const Icon = prompt.icon;
            return (
              <button
                key={prompt.label}
                type="button"
                disabled={isCreating}
                onClick={() => handleAddSubsection(prompt.label)}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm hover:bg-muted/80 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {prompt.label}
              </button>
            );
          })}
        </div>
      )}

      <DndContext
        sensors={subsectionSensors}
        collisionDetection={closestCenter}
        onDragEnd={handleSubsectionDragEnd}
      >
        <SortableContext
          items={subsections.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {subsections.map((sub) => (
              <SortableSubsection
                key={sub.id}
                sub={sub}
                experienceId={experienceId}
                onSaved={handleSubsectionSaved}
                onDelete={() => handleDeleteSubsection(sub.id)}
                initialExpanded={sub.id === newlyCreatedSubId}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleAddSubsection()}
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        Add Subsection
      </Button>
    </div>
  );
}
