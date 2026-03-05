"use client";

import { useState } from "react";
import { ChevronDown, ClipboardCheck, Clock, FileText, MessageSquare, RotateCw } from "lucide-react";
import { DownloadButton } from "./download-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GRADE_COLORS, type ReviewResult } from "@/lib/resume-prompts/review";

interface Generation {
  id: string;
  markdownOutput: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
  parentGenerationId?: string | null;
  reviewJson?: string | null;
  userAnswersJson?: string | null;
  createdAt: string;
}

interface GenerationHistoryProps {
  generations: Generation[];
  onSelect: (generation: Generation) => void;
  onViewAnswers?: (answers: Array<{ question: string; answer: string }>) => void;
  onViewReview?: (review: ReviewResult) => void;
}

export function GenerationHistory({
  generations,
  onSelect,
  onViewAnswers,
  onViewReview,
}: GenerationHistoryProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (generations.length === 0) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <FileText className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">No resumes generated yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">
        Past Generations ({generations.length})
      </h4>
      <div className="space-y-1">
        {generations.map((gen) => {
          const date = new Date(gen.createdAt);
          const isExpanded = expanded === gen.id;
          const isRevision = !!gen.parentGenerationId;
          const grade = (() => {
            const raw = gen.reviewJson;
            if (!raw) return undefined;
            try {
              const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
              return (parsed as { overallGrade?: string })?.overallGrade;
            } catch {
              return undefined;
            }
          })();

          return (
            <div key={gen.id} className="rounded-md border text-sm">
              <button
                className="flex w-full items-center gap-2 p-2 hover:bg-muted/50"
                onClick={() => setExpanded(isExpanded ? null : gen.id)}
              >
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span>
                  {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                {isRevision && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    <RotateCw className="h-2.5 w-2.5 mr-0.5" />
                    Revision
                  </Badge>
                )}
                {grade && (
                  <span className={`inline-flex items-center justify-center h-5 w-5 rounded text-xs font-bold ${GRADE_COLORS[grade] || ""}`}>
                    {grade}
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  ${gen.estimatedCost.toFixed(4)}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "" : "-rotate-90"}`}
                />
              </button>
              {isExpanded && (
                <div className="border-t p-2 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelect(gen)}
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      View this version
                    </Button>
                    {gen.userAnswersJson && onViewAnswers && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          try {
                            const answers = JSON.parse(gen.userAnswersJson!);
                            onViewAnswers(answers);
                          } catch { /* malformed JSON */ }
                        }}
                      >
                        <MessageSquare className="h-3 w-3 mr-1" />
                        View Answers
                      </Button>
                    )}
                    {gen.reviewJson && onViewReview && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          try {
                            const parsed = typeof gen.reviewJson === "string"
                              ? JSON.parse(gen.reviewJson)
                              : gen.reviewJson;
                            onViewReview(parsed as ReviewResult);
                          } catch { /* malformed JSON */ }
                        }}
                      >
                        <ClipboardCheck className="h-3 w-3 mr-1" />
                        View Review
                      </Button>
                    )}
                    <DownloadButton generationId={gen.id} size="sm" />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Tokens: {gen.promptTokens.toLocaleString()} in / {gen.completionTokens.toLocaleString()} out
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
