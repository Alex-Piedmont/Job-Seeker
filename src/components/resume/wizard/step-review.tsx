"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle, AlertTriangle, ArrowRight, ChevronRight, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { FitAnalysisResult } from "@/lib/resume-prompts/fit-analysis";
import type { ReviewResult } from "@/lib/resume-prompts/review";

interface GenerationResult {
  id: string;
  markdownOutput: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
  modelId: string;
  createdAt: string;
}

interface StepReviewProps {
  jobApplicationId: string;
  fitAnalysis: FitAnalysisResult;
  userAnswers: Array<{ question: string; answer: string }>;
  onUseResume: (result: GenerationResult) => void;
  onUsageChanged?: () => void;
  capReached?: boolean;
}

const GRADE_COLORS: Record<string, string> = {
  A: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  B: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  C: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  D: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  F: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export function StepReview({
  jobApplicationId,
  fitAnalysis,
  userAnswers,
  onUseResume,
  onUsageChanged,
  capReached,
}: StepReviewProps) {
  const [generation, setGeneration] = useState<GenerationResult | null>(null);
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [generating, setGenerating] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRevise, setShowRevise] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [revising, setRevising] = useState(false);
  const [reviewExpanded, setReviewExpanded] = useState(true);

  const onUsageChangedRef = useRef(onUsageChanged);
  useEffect(() => {
    onUsageChangedRef.current = onUsageChanged;
  }, [onUsageChanged]);

  const generateResume = useCallback(async (
    parentGenerationId?: string,
    revisionContext?: { reviewFeedback: string; userNotes?: string }
  ) => {
    setGenerating(true);
    setReview(null);
    setError(null);
    setShowRevise(false);

    try {
      const body: Record<string, unknown> = {
        jobApplicationId,
        fitAnalysis: JSON.stringify(fitAnalysis),
        userAnswers,
      };
      if (parentGenerationId) body.parentGenerationId = parentGenerationId;
      if (revisionContext) body.revisionContext = revisionContext;

      const res = await fetch("/api/resume/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate resume");
      }

      const result = await res.json();
      setGeneration(result);
      onUsageChangedRef.current?.();

      // Auto-trigger review
      setReviewing(true);
      try {
        const reviewRes = await fetch("/api/resume/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobApplicationId,
            resumeMarkdown: result.markdownOutput,
          }),
        });

        if (reviewRes.ok) {
          const reviewData = await reviewRes.json();
          setReview(reviewData.review);
        }
      } catch {
        // Review failure is non-fatal
      } finally {
        setReviewing(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      setError(message);
      toast.error(message);
    } finally {
      setGenerating(false);
      setRevising(false);
    }
  }, [jobApplicationId, fitAnalysis, userAnswers]);

  useEffect(() => {
    generateResume();
  }, [generateResume]);

  function handleRevise() {
    if (!generation || !review) return;
    setRevising(true);
    generateResume(generation.id, {
      reviewFeedback: JSON.stringify(review),
      userNotes: revisionNotes.trim() || undefined,
    });
    setRevisionNotes("");
  }

  if (generating && !generation) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          {revising ? "Revising resume..." : "Generating tailored resume..."}
        </p>
      </div>
    );
  }

  if (error && !generation) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!generation) return null;

  return (
    <div className="flex flex-col lg:flex-row gap-4 max-h-[70vh]">
      {/* Left: Resume Preview */}
      <div className="flex-1 min-w-0 overflow-y-auto rounded-md border p-4">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{generation.markdownOutput}</ReactMarkdown>
        </div>
      </div>

      {/* Right: Review Scorecard */}
      <div className="w-full lg:w-80 flex-shrink-0 space-y-3 overflow-y-auto">
        {reviewing ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Reviewing...
          </div>
        ) : review ? (
          <>
            {/* Grade */}
            <button
              className="flex items-center gap-2 w-full"
              onClick={() => setReviewExpanded(!reviewExpanded)}
            >
              <span className={`inline-flex items-center justify-center h-8 w-8 rounded-md text-sm font-bold ${GRADE_COLORS[review.overallGrade] || ""}`}>
                {review.overallGrade}
              </span>
              <span className="text-sm font-medium flex-1 text-left">Review Scorecard</span>
              {reviewExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {reviewExpanded && (
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">{review.gradeJustification}</p>

                {/* Keywords */}
                <div className="space-y-1">
                  <h5 className="text-xs font-medium uppercase text-muted-foreground">Keywords</h5>
                  <div className="flex flex-wrap gap-1">
                    {review.keywordAlignment.matched.map((kw) => (
                      <Badge key={kw} variant="default" className="text-xs">
                        <CheckCircle className="h-3 w-3 mr-0.5" />
                        {kw}
                      </Badge>
                    ))}
                    {review.keywordAlignment.missing.map((kw) => (
                      <Badge key={kw} variant="outline" className="text-xs text-muted-foreground">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Narrative */}
                <div className="space-y-1">
                  <h5 className="text-xs font-medium uppercase text-muted-foreground">Narrative</h5>
                  <p className="text-muted-foreground">{review.narrativeCoherence}</p>
                </div>

                {/* Bullet Improvements */}
                {review.bulletImprovements.length > 0 && (
                  <div className="space-y-1.5">
                    <h5 className="text-xs font-medium uppercase text-muted-foreground">Bullet Improvements</h5>
                    {review.bulletImprovements.map((bi, i) => (
                      <div key={i} className="rounded-md border p-2 space-y-1">
                        <p className="text-xs line-through text-muted-foreground">{bi.original}</p>
                        <div className="flex items-start gap-1">
                          <ArrowRight className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />
                          <p className="text-xs">{bi.suggested}</p>
                        </div>
                        <p className="text-xs text-muted-foreground italic">{bi.reason}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Gaps */}
                {review.gapsAndRisks.length > 0 && (
                  <div className="space-y-1">
                    <h5 className="text-xs font-medium uppercase text-muted-foreground">Gaps & Risks</h5>
                    <ul className="text-xs text-muted-foreground space-y-0.5 list-disc pl-3">
                      {review.gapsAndRisks.map((gap, i) => (
                        <li key={i}>{gap}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        ) : null}

        {/* Revision area */}
        {showRevise && (
          <div className="space-y-2 pt-2 border-t">
            <Textarea
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              placeholder="Optional: What should be changed? (max 2000 chars)"
              className="min-h-20 text-sm"
              maxLength={2000}
            />
            <Button
              size="sm"
              onClick={handleRevise}
              disabled={revising || capReached}
              className="w-full"
            >
              {revising ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Revising...
                </>
              ) : (
                "Submit Revision"
              )}
            </Button>
            {capReached && (
              <p className="text-xs text-destructive">Generation limit reached</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-2 border-t">
          <Button onClick={() => onUseResume(generation)}>
            Use This Resume
          </Button>
          {review && !showRevise && (
            <Button
              variant="outline"
              onClick={() => setShowRevise(true)}
              disabled={capReached}
            >
              Revise
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
