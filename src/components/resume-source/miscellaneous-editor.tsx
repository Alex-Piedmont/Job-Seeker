"use client";

import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";

type MiscellaneousEditorProps = {
  content: string | null;
  onUpdate: (content: string | null) => void;
};

export function MiscellaneousEditor({
  content,
  onUpdate,
}: MiscellaneousEditorProps) {
  const [value, setValue] = useState(content ?? "");

  useEffect(() => {
    setValue(content ?? "");
  }, [content]);

  const save = async () => {
    const newContent = value.trim() || null;
    if (newContent === content) return;

    try {
      const res = await fetch("/api/resume-source/miscellaneous", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent }),
      });
      if (!res.ok) throw new Error();
      onUpdate(newContent);
    } catch {
      toast.error("Failed to save miscellaneous content");
    }
  };

  return (
    <Card>
      <CardHeader className="p-3">
        <h3 className="text-sm font-medium">Miscellaneous</h3>
        <p className="text-xs text-muted-foreground">
          Content that wasn&apos;t automatically categorized into a section.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          placeholder="Miscellaneous content..."
          rows={10}
          className="font-mono text-sm"
        />
      </CardContent>
    </Card>
  );
}
