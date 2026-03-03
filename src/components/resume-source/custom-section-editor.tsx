"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ResumeCustomSection } from "@/types/resume-source";

type CustomSectionEditorProps = {
  section: ResumeCustomSection;
  onUpdate: (updated: ResumeCustomSection) => void;
  onDelete: (id: string) => void;
};

export function CustomSectionEditor({
  section,
  onUpdate,
  onDelete,
}: CustomSectionEditorProps) {
  const [title, setTitle] = useState(section.title);
  const [content, setContent] = useState(section.content);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(section.title);
    setContent(section.content);
  }, [section.id, section.title, section.content]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const saveTitle = async () => {
    setIsEditingTitle(false);
    const trimmed = title.trim();
    if (!trimmed || trimmed === section.title) {
      setTitle(section.title);
      return;
    }

    try {
      const res = await fetch(`/api/resume-source/custom-sections/${section.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      onUpdate({ ...section, ...updated });
    } catch {
      toast.error("Failed to save title");
      setTitle(section.title);
    }
  };

  const saveContent = async () => {
    if (content === section.content) return;

    try {
      const res = await fetch(`/api/resume-source/custom-sections/${section.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      onUpdate({ ...section, ...updated });
    } catch {
      toast.error("Failed to save content");
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/resume-source/custom-sections/${section.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      onDelete(section.id);
      toast.success("Section deleted");
    } catch {
      toast.error("Failed to delete section");
    } finally {
      setIsDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between p-3">
          <div className="flex-1">
            {isEditingTitle ? (
              <Input
                ref={titleInputRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") {
                    setTitle(section.title);
                    setIsEditingTitle(false);
                  }
                }}
                className="h-8 text-sm font-medium"
              />
            ) : (
              <button
                onClick={() => setIsEditingTitle(true)}
                className="text-sm font-medium hover:underline cursor-pointer text-left"
              >
                {section.title}
              </button>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={saveContent}
            placeholder="Enter markdown content for this section..."
            rows={10}
            className="font-mono text-sm"
          />
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{section.title}&rdquo;?</DialogTitle>
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
              onClick={handleDelete}
              disabled={isDeleting}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
