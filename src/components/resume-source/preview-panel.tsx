"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Copy, Check } from "lucide-react";
import { compileResumeSource } from "@/lib/resume-compiler";
import type { ResumeSourceData } from "@/types/resume-source";
import { toast } from "sonner";

type PreviewPanelProps = {
  data: ResumeSourceData | null;
};

export function PreviewPanel({ data }: PreviewPanelProps) {
  const [copied, setCopied] = useState(false);

  const markdown = useMemo(() => {
    if (!data) return "";
    return compileResumeSource({
      contact: data.contact,
      education: data.education,
      experiences: data.experiences,
      skills: data.skills,
      publications: data.publications,
    });
  }, [data]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const lastSaved = data?.updatedAt
    ? new Date(data.updatedAt).toLocaleTimeString()
    : null;

  return (
    <Card className="sticky top-4">
      <CardHeader className="flex flex-row items-center justify-between p-3">
        <div className="space-y-0.5">
          <h3 className="text-sm font-medium">Preview</h3>
          {lastSaved && (
            <p className="text-xs text-muted-foreground">
              Last saved: {lastSaved}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          disabled={!markdown}
          className="gap-1.5"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied" : "Copy Markdown"}
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {markdown ? (
          <div className="prose prose-sm dark:prose-invert max-w-none overflow-y-auto max-h-[calc(100vh-12rem)]">
            <ReactMarkdown>{markdown}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Start entering data to see a preview of your compiled resume source.
          </p>
        )}
      </CardContent>
      <div aria-live="polite" className="sr-only">
        {copied && "Copied to clipboard"}
      </div>
    </Card>
  );
}
