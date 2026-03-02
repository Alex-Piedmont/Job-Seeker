"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { RotateCcw, Eye, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
        <div className="prose prose-sm dark:prose-invert max-w-none rounded-md border p-4 text-sm">
          <ReactMarkdown>{editedMarkdown}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
