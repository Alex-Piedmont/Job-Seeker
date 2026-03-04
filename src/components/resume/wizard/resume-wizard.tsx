"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { WizardStepIndicator } from "./wizard-step-indicator";
import { StepFitAnalysis } from "./step-fit-analysis";
import { StepQuestions } from "./step-questions";
import { StepReview } from "./step-review";
import type { FitAnalysisResult } from "@/lib/resume-prompts/fit-analysis";

interface GenerationResult {
  id: string;
  markdownOutput: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
  modelId: string;
  createdAt: string;
}

interface ResumeWizardProps {
  jobApplicationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: (result: GenerationResult) => void;
  onUsageChanged?: () => void;
  capReached?: boolean;
}

export function ResumeWizard({
  jobApplicationId,
  open,
  onOpenChange,
  onGenerated,
  onUsageChanged,
  capReached,
}: ResumeWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fitAnalysis, setFitAnalysis] = useState<FitAnalysisResult | null>(null);
  const [userAnswers, setUserAnswers] = useState<Array<{ question: string; answer: string }>>([]);

  const handleFitAnalysisComplete = useCallback((analysis: FitAnalysisResult) => {
    setFitAnalysis(analysis);
    if ((analysis.questions ?? []).length > 0) {
      setStep(2);
    } else {
      setStep(3);
    }
  }, []);

  function handleQuestionsComplete(answers: Array<{ question: string; answer: string }>) {
    setUserAnswers(answers);
    setStep(3);
  }

  function handleUseResume(result: GenerationResult) {
    onGenerated(result);
    onOpenChange(false);
    // Reset state for next open
    setStep(1);
    setFitAnalysis(null);
    setUserAnswers([]);
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      // Reset state when closing
      setStep(1);
      setFitAnalysis(null);
      setUserAnswers([]);
    }
    onOpenChange(isOpen);
  }

  const dialogWidth = step === 3 ? "sm:!max-w-5xl" : "sm:!max-w-2xl";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={dialogWidth}>
        <DialogHeader>
          <DialogTitle>Generate Tailored Resume</DialogTitle>
          <DialogDescription>
            {step === 1 && "Analyzing your fit for this position..."}
            {step === 2 && "Help us tailor your resume with a few quick questions."}
            {step === 3 && "Review your generated resume and scorecard."}
          </DialogDescription>
        </DialogHeader>

        <WizardStepIndicator currentStep={step} />

        {step === 1 && (
          <StepFitAnalysis
            jobApplicationId={jobApplicationId}
            onComplete={handleFitAnalysisComplete}
          />
        )}

        {step === 2 && fitAnalysis && (
          <StepQuestions
            questions={fitAnalysis.questions}
            onComplete={handleQuestionsComplete}
          />
        )}

        {step === 3 && fitAnalysis && (
          <StepReview
            jobApplicationId={jobApplicationId}
            fitAnalysis={fitAnalysis}
            userAnswers={userAnswers}
            onUseResume={handleUseResume}
            onUsageChanged={onUsageChanged}
            capReached={capReached}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
