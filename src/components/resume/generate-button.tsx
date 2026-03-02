"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface GenerateButtonProps {
  jobApplicationId: string;
  hasResumeSource: boolean;
  hasJobDescription: boolean;
  capReached: boolean;
  onGenerated: (result: {
    id: string;
    markdownOutput: string;
    promptTokens: number;
    completionTokens: number;
    estimatedCost: number;
    modelId: string;
    createdAt: string;
  }) => void;
  onUsageChanged?: () => void;
}

export function GenerateButton({
  jobApplicationId,
  hasResumeSource,
  hasJobDescription,
  capReached,
  onGenerated,
  onUsageChanged,
}: GenerateButtonProps) {
  const [loading, setLoading] = useState(false);

  const disabled = !hasResumeSource || !hasJobDescription || capReached || loading;

  const tooltipText = !hasResumeSource
    ? "Add your resume source first"
    : !hasJobDescription
      ? "Add a job description first"
      : capReached
        ? "Monthly generation limit reached"
        : "Generate a tailored resume using AI";

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/resume/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobApplicationId }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to generate resume");
        return;
      }

      const result = await res.json();
      onGenerated(result);
      onUsageChanged?.();
      toast.success("Resume generated successfully");
    } catch {
      toast.error("Failed to generate resume");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <Button
              variant="default"
              className="w-full"
              disabled={disabled}
              aria-disabled={disabled}
              aria-describedby="generate-tooltip"
              onClick={handleGenerate}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Tailored Resume
                </>
              )}
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent id="generate-tooltip">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
