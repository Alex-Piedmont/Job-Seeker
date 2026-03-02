"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DownloadButtonProps {
  generationId: string;
  editedMarkdown?: string;
  originalMarkdown?: string;
  size?: "default" | "sm";
}

export function DownloadButton({
  generationId,
  editedMarkdown,
  originalMarkdown,
  size = "default",
}: DownloadButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      let url = `/api/resume/${generationId}/download`;

      // If user edited the markdown, send it as base64
      if (editedMarkdown && originalMarkdown && editedMarkdown !== originalMarkdown) {
        const encoded = btoa(
          new TextEncoder()
            .encode(editedMarkdown)
            .reduce((s, b) => s + String.fromCharCode(b), "")
        );
        url += `?markdown=${encodeURIComponent(encoded)}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        toast.error("Failed to download resume");
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] ?? "Resume.docx";

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error("Failed to download resume");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size={size}
      onClick={handleDownload}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-2" />
      )}
      Download .docx
    </Button>
  );
}
