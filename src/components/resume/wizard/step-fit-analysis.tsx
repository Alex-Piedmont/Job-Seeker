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
          if (res.status === 504) {
            throw new Error("Analysis timed out. Please try again.");
          }
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to analyze fit");
        }

        const data = await res.json();
        if (!cancelled) {
          setAnalysis(data.analysis);
          // Auto-advance if no questions
          if ((data.analysis.questions ?? []).length === 0) {
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

  const roles = Array.isArray(analysis.relevantRoles) ? analysis.relevantRoles : [];
  const skills = analysis.skillsMatch ?? { strong: [], partial: [], missing: [] };
  const wins = Array.isArray(analysis.alignedWins) ? analysis.alignedWins : [];
  const gaps = Array.isArray(analysis.gaps) ? analysis.gaps : [];
  const titles = Array.isArray(analysis.titleRecommendations) ? analysis.titleRecommendations : [];

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      {/* Relevant Roles */}
      {roles.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-sm font-medium">Relevant Experience</h4>
          <div className="space-y-1">
            {roles.map((role, i) => (
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
          {(skills.strong ?? []).map((s) => (
            <Badge key={s} variant="default" className="text-xs max-w-full truncate">
              <CheckCircle2 className="h-3 w-3 mr-1 shrink-0" />
              {s}
            </Badge>
          ))}
          {(skills.partial ?? []).map((s) => (
            <Badge key={s} variant="secondary" className="text-xs max-w-full truncate">
              {s}
            </Badge>
          ))}
          {(skills.missing ?? []).map((s) => (
            <Badge key={s} variant="outline" className="text-xs max-w-full truncate text-muted-foreground">
              {s}
            </Badge>
          ))}
        </div>
      </div>

      {/* Aligned Wins */}
      {wins.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-sm font-medium">Aligned Wins</h4>
          <ul className="text-sm space-y-0.5 list-disc pl-4">
            {wins.map((win, i) => (
              <li key={i} className="text-muted-foreground">{win}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Gaps */}
      {gaps.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-sm font-medium">Gaps to Address</h4>
          <ul className="text-sm space-y-0.5 list-disc pl-4">
            {gaps.map((gap, i) => (
              <li key={i} className="text-muted-foreground">{gap}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Title Recommendations */}
      {titles.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-sm font-medium">Recommended Titles</h4>
          <div className="flex flex-wrap gap-1.5">
            {titles.map((title) => (
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
          {(analysis.questions ?? []).length > 0 ? (
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
