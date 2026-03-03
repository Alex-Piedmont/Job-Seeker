"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FitAnalysisResult } from "@/lib/resume-prompts/fit-analysis";

interface StepFitAnalysisProps {
  jobApplicationId: string;
  onComplete: (analysis: FitAnalysisResult) => void;
}

export function StepFitAnalysis({
  jobApplicationId,
  onComplete,
}: StepFitAnalysisProps) {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<FitAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchAnalysis() {
      try {
        const res = await fetch("/api/resume/fit-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobApplicationId }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to analyze fit");
        }

        const data = await res.json();
        if (!cancelled) {
          setAnalysis(data.analysis);
          // Auto-advance if no questions
          if (data.analysis.questions.length === 0) {
            onComplete(data.analysis);
          }
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to analyze fit";
          setError(message);
          toast.error(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAnalysis();
    return () => { cancelled = true; };
  }, [jobApplicationId, onComplete]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Analyzing fit against job description...</p>
        <div className="space-y-2 w-full max-w-md">
          <div className="h-4 bg-muted rounded animate-pulse" />
          <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
          <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      {/* Relevant Roles */}
      {analysis.relevantRoles.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-sm font-medium">Relevant Experience</h4>
          <div className="space-y-1">
            {analysis.relevantRoles.map((role, i) => (
              <div key={i} className="text-sm rounded-md border p-2">
                <span className="font-medium">{role.title}</span>
                <span className="text-muted-foreground"> at {role.company}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{role.relevanceReason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills Match */}
      <div className="space-y-1.5">
        <h4 className="text-sm font-medium">Skills Match</h4>
        <div className="flex flex-wrap gap-1.5">
          {analysis.skillsMatch.strong.map((s) => (
            <Badge key={s} variant="default" className="text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {s}
            </Badge>
          ))}
          {analysis.skillsMatch.partial.map((s) => (
            <Badge key={s} variant="secondary" className="text-xs">
              {s}
            </Badge>
          ))}
          {analysis.skillsMatch.missing.map((s) => (
            <Badge key={s} variant="outline" className="text-xs text-muted-foreground">
              {s}
            </Badge>
          ))}
        </div>
      </div>

      {/* Aligned Wins */}
      {analysis.alignedWins.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-sm font-medium">Aligned Wins</h4>
          <ul className="text-sm space-y-0.5 list-disc pl-4">
            {analysis.alignedWins.map((win, i) => (
              <li key={i} className="text-muted-foreground">{win}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Gaps */}
      {analysis.gaps.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-sm font-medium">Gaps to Address</h4>
          <ul className="text-sm space-y-0.5 list-disc pl-4">
            {analysis.gaps.map((gap, i) => (
              <li key={i} className="text-muted-foreground">{gap}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Title Recommendations */}
      {analysis.titleRecommendations.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-sm font-medium">Recommended Titles</h4>
          <div className="flex flex-wrap gap-1.5">
            {analysis.titleRecommendations.map((title) => (
              <Badge key={title} variant="outline" className="text-xs">
                {title}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Continue Button */}
      <div className="flex justify-end pt-2">
        <Button onClick={() => onComplete(analysis)}>
          {analysis.questions.length > 0 ? (
            <>
              Continue
              <ArrowRight className="h-4 w-4 ml-1" />
            </>
          ) : (
            "Generate Resume"
          )}
        </Button>
      </div>
    </div>
  );
}
