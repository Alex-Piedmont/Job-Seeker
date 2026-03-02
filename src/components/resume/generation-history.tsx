"use client";

import { useState } from "react";
import { ChevronDown, Clock } from "lucide-react";
import { DownloadButton } from "./download-button";

interface Generation {
  id: string;
  markdownOutput: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
  createdAt: string;
}

interface GenerationHistoryProps {
  generations: Generation[];
  onSelect: (generation: Generation) => void;
}

export function GenerationHistory({
  generations,
  onSelect,
}: GenerationHistoryProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (generations.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">
        Past Generations ({generations.length})
      </h4>
      <div className="space-y-1">
        {generations.map((gen) => {
          const date = new Date(gen.createdAt);
          const isExpanded = expanded === gen.id;

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
                <span className="ml-auto text-xs text-muted-foreground">
                  ${gen.estimatedCost.toFixed(4)}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "" : "-rotate-90"}`}
                />
              </button>
              {isExpanded && (
                <div className="border-t p-2 space-y-2">
                  <div className="flex gap-2">
                    <button
                      className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                      onClick={() => onSelect(gen)}
                    >
                      View this version
                    </button>
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
