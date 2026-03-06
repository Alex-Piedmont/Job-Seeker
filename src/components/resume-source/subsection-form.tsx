"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAutoSave } from "@/hooks/use-auto-save";
import { SaveIndicator } from "./save-indicator";
import { fetchOrThrowSaveError } from "@/lib/fetch-with-save-error";
import { Trash2, Plus, X, GripVertical, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ResumeWorkSubsection } from "@/types/resume-source";

type SubsectionFormProps = {
  subsection: ResumeWorkSubsection;
  experienceId: string;
  onSaved: (updated: ResumeWorkSubsection) => void;
  onDelete: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragHandleProps?: any;
  initialExpanded?: boolean;
};

export function SubsectionForm({
  subsection,
  experienceId,
  onSaved,
  onDelete,
  dragHandleProps,
  initialExpanded,
}: SubsectionFormProps) {
  const [label, setLabel] = useState(subsection.label);
  const [bullets, setBullets] = useState(subsection.bullets);
  const [isCollapsed, setIsCollapsed] = useState(!initialExpanded);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const saveSubsection = useCallback(
    async (data: { label: string; bullets: string[] }) => {
      const res = await fetchOrThrowSaveError(
        `/api/resume-source/experience/${experienceId}/subsection/${subsection.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      const saved = await res.json();
      onSaved(saved);
    },
    [experienceId, subsection.id, onSaved]
  );

  const { status, trigger, flush } = useAutoSave({
    onSave: saveSubsection,
    initialData: { label: subsection.label, bullets: subsection.bullets },
    onRollback: (lastSaved) => {
      setLabel(lastSaved.label);
      setBullets(lastSaved.bullets);
    },
  });

  useEffect(() => () => flush(), [flush]);

  const labelRef = useRef(label);
  const bulletsRef = useRef(bullets);
  useEffect(() => { labelRef.current = label; }, [label]);
  useEffect(() => { bulletsRef.current = bullets; }, [bullets]);

  const handleBlur = useCallback(() => {
    trigger({ label: labelRef.current, bullets: bulletsRef.current });
  }, [trigger]);

  const autoResizeTextarea = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

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
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center justify-center h-8 w-8 shrink-0"
          aria-label={isCollapsed ? "Expand subsection" : "Collapse subsection"}
        >
          <ChevronRight
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              !isCollapsed ? "rotate-90" : ""
            }`}
          />
        </button>
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
        {isCollapsed && bullets.length > 0 && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {bullets.length} {bullets.length === 1 ? "bullet" : "bullets"}
          </span>
        )}
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

      {!isCollapsed && (
        <>
          {bullets.map((bullet, index) => {
            const isFirstEmpty = bullet === "" && bullets.findIndex((b) => b === "") === index;
            return (
            <div key={index} className="flex items-start gap-2 pl-6">
              <span className="text-muted-foreground mt-2">•</span>
              <Textarea
                value={bullet}
                onChange={(e) => {
                  updateBullet(index, e.target.value);
                  autoResizeTextarea(e.target);
                }}
                onBlur={handleBlur}
                onFocus={(e) => autoResizeTextarea(e.target)}
                ref={(el) => {
                  if (el) autoResizeTextarea(el);
                }}
                placeholder={
                  isFirstEmpty
                    ? "What did you do, why did it matter, and what was the result?"
                    : "Bullet point..."
                }
                className="flex-1 resize-none overflow-hidden min-h-[36px]"
                rows={1}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeBullet(index)}
                className="h-8 w-8 shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            );
          })}

          <Button
            variant="ghost"
            size="sm"
            onClick={addBullet}
            className="ml-6"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Bullet
          </Button>
        </>
      )}

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
