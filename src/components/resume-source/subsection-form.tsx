"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAutoSave } from "@/hooks/use-auto-save";
import { SaveIndicator } from "./save-indicator";
import { Trash2, Plus, X, GripVertical } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import type { ResumeWorkSubsection } from "@/types/resume-source";
import { toast } from "sonner";

type SubsectionFormProps = {
  subsection: ResumeWorkSubsection;
  experienceId: string;
  onSaved: (updated: ResumeWorkSubsection) => void;
  onDelete: () => void;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
};

export function SubsectionForm({
  subsection,
  experienceId,
  onSaved,
  onDelete,
  dragHandleProps,
}: SubsectionFormProps) {
  const [label, setLabel] = useState(subsection.label);
  const [bullets, setBullets] = useState(subsection.bullets);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const saveSubsection = useCallback(
    async (data: { label: string; bullets: string[] }) => {
      const res = await fetch(
        `/api/resume-source/experience/${experienceId}/subsection/${subsection.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) {
        toast.error("Failed to save subsection.");
        throw new Error("Save failed");
      }
      const saved = await res.json();
      onSaved(saved);
    },
    [experienceId, subsection.id, onSaved]
  );

  const { status, trigger } = useAutoSave({ onSave: saveSubsection });

  const handleBlur = () => trigger({ label, bullets });

  const addBullet = () => {
    const updated = [...bullets, ""];
    setBullets(updated);
  };

  const removeBullet = (index: number) => {
    const updated = bullets.filter((_, i) => i !== index);
    setBullets(updated);
    trigger({ label, bullets: updated });
  };

  const updateBullet = (index: number, value: string) => {
    const updated = bullets.map((b, i) => (i === index ? value : b));
    setBullets(updated);
  };

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center gap-2">
        {dragHandleProps && (
          <div {...dragHandleProps} aria-label="Drag to reorder subsection">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1">
          <Label className="sr-only">Subsection Label</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleBlur}
            placeholder="e.g., Key Accomplishments"
            className="font-medium"
          />
        </div>
        <SaveIndicator status={status} />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDeleteOpen(true)}
          className="h-8 w-8"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {bullets.map((bullet, index) => (
        <div key={index} className="flex items-center gap-2 pl-6">
          <span className="text-muted-foreground">•</span>
          <Input
            value={bullet}
            onChange={(e) => updateBullet(index, e.target.value)}
            onBlur={handleBlur}
            placeholder="Bullet point..."
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeBullet(index)}
            className="h-8 w-8"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      <Button
        variant="ghost"
        size="sm"
        onClick={addBullet}
        className="ml-6"
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        Add Bullet
      </Button>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete subsection?</DialogTitle>
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
