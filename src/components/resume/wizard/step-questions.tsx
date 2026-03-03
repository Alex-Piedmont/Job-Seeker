"use client";

import { useState } from "react";
import { ArrowRight, SkipForward, Sparkles } from "lucide-react";
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
  const [answers, setAnswers] = useState<Array<{ question: string; answer: string }>>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");

  const question = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;

  function handleNext() {
    const newAnswers = [
      ...answers,
      { question: question.question, answer: currentAnswer },
    ];
    setAnswers(newAnswers);
    setCurrentAnswer("");

    if (isLast) {
      onComplete(newAnswers.filter((a) => a.answer.trim() !== ""));
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  }

  function handleSkip() {
    if (isLast) {
      onComplete(answers.filter((a) => a.answer.trim() !== ""));
    } else {
      setCurrentIndex(currentIndex + 1);
      setCurrentAnswer("");
    }
  }

  if (!question) return null;

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Question {currentIndex + 1} of {questions.length}
        </span>
        <span>{question.purpose}</span>
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
        <Button variant="ghost" size="sm" onClick={handleSkip}>
          <SkipForward className="h-4 w-4 mr-1" />
          Skip
        </Button>
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
