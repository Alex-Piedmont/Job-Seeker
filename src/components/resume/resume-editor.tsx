"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { RotateCcw, Eye, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const DocxPreview = dynamic(
  () => import("@/components/resume/docx-preview").then((m) => ({ default: m.DocxPreview })),
  { loading: () => <div className="h-64 animate-pulse bg-muted rounded-md" /> }
);

interface ResumeEditorProps {
  originalMarkdown: string;
  editedMarkdown: string;
  onEdit: (markdown: string) => void;
}

export function ResumeEditor({
  originalMarkdown,
  editedMarkdown,
  onEdit,
}: ResumeEditorProps) {
  const [mode, setMode] = useState<"edit" | "preview">("preview");
  const isModified = editedMarkdown !== originalMarkdown;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          variant={mode === "preview" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setMode("preview")}
        >
          <Eye className="h-3.5 w-3.5 mr-1" />
          Preview
        </Button>
        <Button
          variant={mode === "edit" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setMode("edit")}
        >
          <Pencil className="h-3.5 w-3.5 mr-1" />
          Edit
        </Button>
        {isModified && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(originalMarkdown)}
            className="ml-auto text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Reset
          </Button>
        )}
      </div>

      {mode === "edit" ? (
        <Textarea
          value={editedMarkdown}
          onChange={(e) => onEdit(e.target.value)}
          rows={20}
          className="font-mono text-xs"
        />
      ) : (
        <DocxPreview markdown={editedMarkdown} />
      )}
    </div>
  );
}
