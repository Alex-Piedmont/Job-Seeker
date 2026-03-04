"use client";

import { useEffect, useRef, useState } from "react";
import { markdownToDocxBlob } from "@/lib/docx-generator.client";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface DocxPreviewProps {
  markdown: string;
  className?: string;
}

export function DocxPreview({ markdown, className }: DocxPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const isInitialRender = useRef(true);

  useEffect(() => {
    if (!markdown.trim()) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const delay = isInitialRender.current ? 0 : 300;
    isInitialRender.current = false;

    const timeout = setTimeout(async () => {
      if (!containerRef.current) return;
      setLoading(true);
      setError(false);
      try {
        const blob = await markdownToDocxBlob(markdown);
        const { renderAsync } = await import("docx-preview");
        if (cancelled) return;
        // Clear previous render
        containerRef.current.innerHTML = "";
        // Create scoped style element
        if (!styleRef.current) {
          styleRef.current = document.createElement("style");
        }
        containerRef.current.appendChild(styleRef.current);
        await renderAsync(blob, containerRef.current, styleRef.current, {
          className: "docx-preview",
          inWrapper: true,
          ignoreHeight: true,
        });
      } catch (err) {
        console.error("Failed to render docx preview:", err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [markdown]);

  if (!markdown.trim()) {
    return (
      <div className={cn("rounded-md border bg-white p-4 text-sm text-muted-foreground", className)}>
        No content to preview
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("prose prose-sm max-w-none rounded-md border p-4 text-sm", className)}>
        <ReactMarkdown>{markdown}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className={cn("relative rounded-md border bg-white overflow-y-auto", className)}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      <div ref={containerRef} />
    </div>
  );
}
