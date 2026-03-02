"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { GripVertical, Trash2, Plus, X } from "lucide-react";
import type { ResumeSkill } from "@/types/resume-source";
import { toast } from "sonner";

type SkillsSectionProps = {
  skills: ResumeSkill[];
  onUpdate: (skills: ResumeSkill[]) => void;
};

function SkillCard({
  skill,
  index,
  onSaved,
  onDelete,
}: {
  skill: ResumeSkill;
  index: number;
  onSaved: (updated: ResumeSkill) => void;
  onDelete: () => void;
}) {
  const [category, setCategory] = useState(skill.category);
  const [items, setItems] = useState(skill.items);
  const [tagInput, setTagInput] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const saveSkill = useCallback(
    async (data: { category: string; items: string[] }) => {
      const res = await fetch(`/api/resume-source/skills/${skill.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        toast.error("Failed to save skill category.");
        throw new Error("Save failed");
      }
      const saved = await res.json();
      onSaved(saved);
    },
    [skill.id, onSaved]
  );

  const handleCategoryBlur = () => {
    saveSkill({ category, items });
  };

  const addTag = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || items.includes(trimmed)) return;
    const updated = [...items, trimmed];
    setItems(updated);
    setTagInput("");
    saveSkill({ category, items: updated });
  };

  const removeTag = (idx: number) => {
    const updated = items.filter((_, i) => i !== idx);
    setItems(updated);
    saveSkill({ category, items: updated });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    }
    if (e.key === "Backspace" && !tagInput && items.length > 0) {
      removeTag(items.length - 1);
    }
  };

  return (
    <Draggable draggableId={skill.id} index={index}>
      {(provided) => (
        <div ref={provided.innerRef} {...provided.draggableProps}>
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 p-3">
              <div {...provided.dragHandleProps} aria-label="Drag to reorder">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  onBlur={handleCategoryBlur}
                  placeholder="e.g., Programming Languages"
                  className="font-medium"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteOpen(true)}
                className="h-8 w-8"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              <Label className="sr-only">Skills</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {items.map((item, idx) => (
                  <Badge key={idx} variant="secondary" className="gap-1">
                    {item}
                    <button
                      onClick={() => removeTag(idx)}
                      className="ml-0.5 hover:text-destructive"
                      aria-label={`Remove ${item}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  if (tagInput.trim()) addTag(tagInput);
                }}
                placeholder="Type and press Enter or comma to add..."
                className="text-sm"
              />
            </CardContent>
          </Card>

          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete skill category?</DialogTitle>
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

export function SkillsSection({ skills, onUpdate }: SkillsSectionProps) {
  const handleAdd = async () => {
    const res = await fetch("/api/resume-source/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "New Category", items: [] }),
    });
    if (!res.ok) {
      toast.error("Failed to add skill category.");
      return;
    }
    const created = await res.json();
    onUpdate([...skills, created]);
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/resume-source/skills/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Failed to delete.");
      return;
    }
    onUpdate(skills.filter((s) => s.id !== id));
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(skills);
    const [removed] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, removed);
    const reordered = items.map((item, i) => ({ ...item, sortOrder: i }));
    onUpdate(reordered);

    await fetch("/api/resume-source/skills/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: reordered.map((s) => s.id) }),
    });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Skills</h2>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="skills">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="space-y-3"
            >
              {skills.map((skill, index) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  index={index}
                  onSaved={(updated) =>
                    onUpdate(
                      skills.map((s) => (s.id === updated.id ? updated : s))
                    )
                  }
                  onDelete={() => handleDelete(skill.id)}
                />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <Button onClick={handleAdd} variant="outline" className="w-full">
        <Plus className="mr-1 h-4 w-4" />
        Add Skill Category
      </Button>
    </div>
  );
}
