"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle, AlertTriangle, ArrowRight, ChevronRight, ChevronDown, Check, X } from "lucide-react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { FitAnalysisResult } from "@/lib/resume-prompts/fit-analysis";
import { GRADE_COLORS, type ReviewResult } from "@/lib/resume-prompts/review";

const DocxPreview = dynamic(
  () => import("@/components/resume/docx-preview").then((m) => ({ default: m.DocxPreview })),
  { loading: () => <div className="h-64 animate-pulse bg-muted rounded-md" /> }
);

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
  const [revisionNotes, setRevisionNotes] = useState("");
  const [revising, setRevising] = useState(false);
  const [reviewExpanded, setReviewExpanded] = useState(true);
  const [acceptedBullets, setAcceptedBullets] = useState<Set<number>>(new Set());
  const [rejectedBullets, setRejectedBullets] = useState<Set<number>>(new Set());

  const onUsageChangedRef = useRef(onUsageChanged);
  useEffect(() => {
    onUsageChangedRef.current = onUsageChanged;
  }, [onUsageChanged]);

  function toggleAccept(index: number) {
    setAcceptedBullets((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    setRejectedBullets((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }

  function toggleReject(index: number) {
    setRejectedBullets((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    setAcceptedBullets((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }

  const generateResume = useCallback(async (
    parentGenerationId?: string,
    revisionContext?: { reviewFeedback: string; userNotes?: string }
  ) => {
    setGenerating(true);
    setReview(null);
    setError(null);
    setAcceptedBullets(new Set());
    setRejectedBullets(new Set());

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
        if (res.status === 504) {
          throw new Error("Generation timed out. Please try again.");
        }
        const err = await res.json().catch(() => ({}));
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
            generationId: result.id,
          }),
        });

        if (reviewRes.ok) {
          const reviewData = await reviewRes.json();
          setReview(reviewData.review);
        } else {
          const status = reviewRes.status;
          const msg = status === 504
            ? "Review timed out"
            : `Review failed (${status})`;
          toast.error(`${msg} — you can still use the resume.`);
        }
      } catch {
        toast.error("Review failed — you can still use the resume.");
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

    const bulletFeedback: string[] = [];
    if (Array.isArray(review.bulletImprovements)) {
      review.bulletImprovements.forEach((bi, i) => {
        if (acceptedBullets.has(i)) {
          bulletFeedback.push(`APPLY: Replace "${bi.original}" with "${bi.suggested}" (${bi.reason})`);
        } else if (rejectedBullets.has(i)) {
          bulletFeedback.push(`KEEP ORIGINAL: "${bi.original}" — user rejected the suggestion`);
        }
      });
    }

    const feedbackParts: string[] = [];
    if (bulletFeedback.length > 0) {
      feedbackParts.push("Bullet changes:\n" + bulletFeedback.join("\n"));
    }
    feedbackParts.push(JSON.stringify(review));

    generateResume(generation.id, {
      reviewFeedback: feedbackParts.join("\n\n"),
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
    <div className="flex flex-col lg:flex-row gap-4 max-h-[70vh] min-w-0">
      {/* Left: Resume Preview */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <DocxPreview markdown={generation.markdownOutput} className="h-full" />
      </div>

      {/* Right: Review Scorecard */}
      <div className="w-full lg:w-80 flex-shrink-0 space-y-3 overflow-y-auto overflow-x-hidden">
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
              <span className={`inline-flex items-center justify-center h-8 w-8 rounded-md text-sm font-bold ${(review.overallGrade && GRADE_COLORS[review.overallGrade]) || ""}`}>
                {review.overallGrade ?? "–"}
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
                {review.gradeJustification && (
                  <p className="text-muted-foreground">{review.gradeJustification}</p>
                )}

                {/* Keywords */}
                <div className="space-y-1">
                  <h5 className="text-xs font-medium uppercase text-muted-foreground">Keywords</h5>
                  <div className="flex flex-wrap gap-1">
                    {(review.keywordAlignment?.matched ?? []).map((kw) => (
                      <Badge key={kw} variant="default" className="text-xs max-w-full whitespace-normal break-words">
                        <CheckCircle className="h-3 w-3 mr-0.5 flex-shrink-0" />
                        {kw}
                      </Badge>
                    ))}
                    {(review.keywordAlignment?.missing ?? []).map((kw) => (
                      <Badge key={kw} variant="outline" className="text-xs text-muted-foreground max-w-full whitespace-normal break-words">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Narrative */}
                {review.narrativeCoherence && (
                  <div className="space-y-1">
                    <h5 className="text-xs font-medium uppercase text-muted-foreground">Narrative</h5>
                    <p className="text-muted-foreground">{review.narrativeCoherence}</p>
                  </div>
                )}

                {/* Bullet Improvements */}
                {Array.isArray(review.bulletImprovements) && review.bulletImprovements.length > 0 && (
                  <div className="space-y-1.5">
                    <h5 className="text-xs font-medium uppercase text-muted-foreground">Bullet Improvements</h5>
                    {review.bulletImprovements.map((bi, i) => (
                      <div
                        key={i}
                        className={`rounded-md border p-2 space-y-1 transition-colors ${
                          acceptedBullets.has(i)
                            ? "border-l-2 border-l-green-500 bg-green-50/50 dark:bg-green-950/20"
                            : rejectedBullets.has(i)
                              ? "opacity-50"
                              : ""
                        }`}
                      >
                        <p className="text-xs line-through text-muted-foreground">{bi.original}</p>
                        <div className="flex items-start gap-1">
                          <ArrowRight className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />
                          <p className="text-xs">{bi.suggested}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground italic flex-1">{bi.reason}</p>
                          <div className="flex gap-1 ml-2 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleAccept(i)}
                              className={`p-0.5 rounded transition-colors ${
                                acceptedBullets.has(i)
                                  ? "text-green-600 bg-green-100 dark:bg-green-900/40"
                                  : "text-muted-foreground hover:text-green-600"
                              }`}
                              title="Accept suggestion"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleReject(i)}
                              className={`p-0.5 rounded transition-colors ${
                                rejectedBullets.has(i)
                                  ? "text-red-600 bg-red-100 dark:bg-red-900/40"
                                  : "text-muted-foreground hover:text-red-600"
                              }`}
                              title="Reject suggestion"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Gaps */}
                {Array.isArray(review.gapsAndRisks) && review.gapsAndRisks.length > 0 && (
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

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-2 border-t">
          {review && (
            <Textarea
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              placeholder="Additional revision notes (optional)"
              className="min-h-16 text-sm"
              maxLength={2000}
            />
          )}

          {acceptedBullets.size > 0 && (
            <Button
              onClick={handleRevise}
              disabled={revising || capReached}
              className="w-full"
            >
              {revising ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Applying changes...
                </>
              ) : (
                `Apply ${acceptedBullets.size} Accepted Change${acceptedBullets.size > 1 ? "s" : ""}`
              )}
            </Button>
          )}

          {acceptedBullets.size === 0 && revisionNotes.trim() && review && (
            <Button
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
                "Revise with Notes"
              )}
            </Button>
          )}

          <Button
            variant={acceptedBullets.size > 0 || revisionNotes.trim() ? "outline" : "default"}
            onClick={() => onUseResume(generation)}
            className="w-full"
          >
            Use As-Is
          </Button>

          {capReached && (
            <p className="text-xs text-destructive">Generation limit reached</p>
          )}
        </div>
      </div>
    </div>
  );
}
