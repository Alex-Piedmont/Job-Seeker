"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, ArrowRight, SkipForward, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Question {
  question: string;
  type: "text" | "select";
  options?: string[];
  purpose: string;
}

interface StepQuestionsProps {
  questions: Question[];
  onComplete: (answers: Array<{ question: string; answer: string }>) => void;
}

export function StepQuestions({ questions, onComplete }: StepQuestionsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentAnswer, setCurrentAnswer] = useState("");

  const question = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const isFirst = currentIndex === 0;

  function saveCurrentAnswer() {
    setAnswers((prev) => ({ ...prev, [currentIndex]: currentAnswer }));
  }

  function navigateTo(index: number) {
    saveCurrentAnswer();
    setCurrentIndex(index);
    setCurrentAnswer(answers[index] ?? "");
  }

  function handleNext() {
    const updatedAnswers = { ...answers, [currentIndex]: currentAnswer };
    setAnswers(updatedAnswers);

    if (isLast) {
      const result = questions
        .map((q, i) => ({ question: q.question, answer: updatedAnswers[i] ?? "" }))
        .filter((a) => a.answer.trim() !== "");
      onComplete(result);
    } else {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setCurrentAnswer(updatedAnswers[nextIndex] ?? "");
    }
  }

  function handlePrev() {
    if (isFirst) return;
    navigateTo(currentIndex - 1);
  }

  function handleSkip() {
    // Clear the current answer (skip means leave blank)
    const updatedAnswers = { ...answers };
    delete updatedAnswers[currentIndex];
    setAnswers(updatedAnswers);

    if (isLast) {
      const result = questions
        .map((q, i) => ({ question: q.question, answer: updatedAnswers[i] ?? "" }))
        .filter((a) => a.answer.trim() !== "");
      onComplete(result);
    } else {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setCurrentAnswer(updatedAnswers[nextIndex] ?? "");
    }
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't intercept arrow keys when typing in a textarea
      if (
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLInputElement
      ) {
        return;
      }

      if (e.key === "ArrowLeft" && !isFirst) {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight" && !isLast) {
        e.preventDefault();
        handleNext();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentIndex, currentAnswer, isFirst, isLast]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!question) return null;

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Question {currentIndex + 1} of {questions.length}
        </span>
        <span>{question.purpose}</span>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5">
        {questions.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => navigateTo(i)}
            className={`h-2 w-2 rounded-full transition-colors ${
              i === currentIndex
                ? "bg-primary"
                : answers[i]?.trim()
                  ? "bg-primary/40"
                  : "bg-muted-foreground/20"
            }`}
            aria-label={`Go to question ${i + 1}`}
          />
        ))}
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">{question.question}</Label>

        {question.type === "select" && question.options ? (
          <div className="space-y-1.5">
            {question.options.map((option) => (
              <button
                key={option}
                type="button"
                className={`w-full text-left text-sm rounded-md border p-2.5 transition-colors ${
                  currentAnswer === option
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
                onClick={() => setCurrentAnswer(option)}
              >
                {option}
              </button>
            ))}
          </div>
        ) : (
          <Textarea
            value={currentAnswer}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            placeholder="Type your answer..."
            className="min-h-24"
          />
        )}
      </div>

      <div className="flex justify-between pt-2">
        <div className="flex gap-2">
          {!isFirst && (
            <Button variant="ghost" size="sm" onClick={handlePrev}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            <SkipForward className="h-4 w-4 mr-1" />
            Skip
          </Button>
        </div>
        <Button onClick={handleNext} disabled={question.type === "select" && !currentAnswer}>
          {isLast ? (
            <>
              <Sparkles className="h-4 w-4 mr-1" />
              Generate Resume
            </>
          ) : (
            <>
              Next
              <ArrowRight className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
