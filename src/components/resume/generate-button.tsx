"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ResumeWizard } from "./wizard/resume-wizard";

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
  const [wizardOpen, setWizardOpen] = useState(false);

  const disabled = !hasResumeSource || !hasJobDescription || capReached;

  const tooltipText = !hasResumeSource
    ? "Add your resume source first"
    : !hasJobDescription
      ? "Add a job description first"
      : capReached
        ? "Monthly generation limit reached"
        : "Generate a tailored resume using AI";

  function handleGenerated(result: {
    id: string;
    markdownOutput: string;
    promptTokens: number;
    completionTokens: number;
    estimatedCost: number;
    modelId: string;
    createdAt: string;
  }) {
    onGenerated(result);
    toast.success("Resume generated successfully");
  }

  return (
    <>
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
                onClick={() => setWizardOpen(true)}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Tailored Resume
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent id="generate-tooltip">
            <p>{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <ResumeWizard
        jobApplicationId={jobApplicationId}
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onGenerated={handleGenerated}
        onUsageChanged={onUsageChanged}
        capReached={capReached}
      />
    </>
  );
}
