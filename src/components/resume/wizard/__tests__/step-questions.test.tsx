import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { StepQuestions } from "../step-questions";

const QUESTIONS = [
  { question: "What is your top skill?", type: "text" as const, purpose: "Skills" },
  { question: "Describe a project.", type: "text" as const, purpose: "Experience" },
  { question: "Preferred role?", type: "select" as const, options: ["Frontend", "Backend", "Fullstack"], purpose: "Role" },
];

function renderQuestions(onComplete = vi.fn()) {
  return { onComplete, ...render(<StepQuestions questions={QUESTIONS} onComplete={onComplete} />) };
}

function typeInTextarea(text: string) {
  const textarea = screen.getByPlaceholderText("Type your answer...");
  fireEvent.change(textarea, { target: { value: text } });
}

describe("StepQuestions", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the first question", () => {
    renderQuestions();
    expect(screen.getByText("What is your top skill?")).toBeInTheDocument();
    expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();
  });

  it("does not show Previous button on first question", () => {
    renderQuestions();
    expect(screen.queryByText("Previous")).not.toBeInTheDocument();
  });

  it("navigates forward and shows Previous button", () => {
    renderQuestions();

    typeInTextarea("React");
    fireEvent.click(screen.getByText("Next"));

    expect(screen.getByText("Describe a project.")).toBeInTheDocument();
    expect(screen.getByText("Question 2 of 3")).toBeInTheDocument();
    expect(screen.getByText("Previous")).toBeInTheDocument();
  });

  it("navigates back and preserves answer", () => {
    renderQuestions();

    typeInTextarea("React");
    fireEvent.click(screen.getByText("Next"));

    // Go back
    fireEvent.click(screen.getByText("Previous"));

    expect(screen.getByText("What is your top skill?")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Type your answer...")).toHaveValue("React");
  });

  it("skip clears the answer and moves forward", () => {
    renderQuestions();

    typeInTextarea("Something");
    fireEvent.click(screen.getByText("Skip"));

    expect(screen.getByText("Describe a project.")).toBeInTheDocument();

    // Go back — skipped answer should be cleared
    fireEvent.click(screen.getByText("Previous"));
    expect(screen.getByPlaceholderText("Type your answer...")).toHaveValue("");
  });

  it("submits all answered questions on last question", () => {
    const { onComplete } = renderQuestions();

    // Q1
    typeInTextarea("React");
    fireEvent.click(screen.getByText("Next"));

    // Q2 — skip
    fireEvent.click(screen.getByText("Skip"));

    // Q3 — select
    fireEvent.click(screen.getByText("Frontend"));
    fireEvent.click(screen.getByText("Generate Resume"));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith([
      { question: "What is your top skill?", answer: "React" },
      { question: "Preferred role?", answer: "Frontend" },
    ]);
  });

  it("navigates back and forth preserving all answers", () => {
    const { onComplete } = renderQuestions();

    // Q1
    typeInTextarea("React");
    fireEvent.click(screen.getByText("Next"));

    // Q2
    typeInTextarea("Built an app");
    fireEvent.click(screen.getByText("Next"));

    // Q3 — go back to Q1
    fireEvent.click(screen.getByText("Previous"));
    fireEvent.click(screen.getByText("Previous"));
    expect(screen.getByPlaceholderText("Type your answer...")).toHaveValue("React");

    // Edit Q1
    typeInTextarea("TypeScript");
    fireEvent.click(screen.getByText("Next"));

    // Q2 should still have its answer
    expect(screen.getByPlaceholderText("Type your answer...")).toHaveValue("Built an app");
    fireEvent.click(screen.getByText("Next"));

    // Q3 — select and submit
    fireEvent.click(screen.getByText("Fullstack"));
    fireEvent.click(screen.getByText("Generate Resume"));

    expect(onComplete).toHaveBeenCalledWith([
      { question: "What is your top skill?", answer: "TypeScript" },
      { question: "Describe a project.", answer: "Built an app" },
      { question: "Preferred role?", answer: "Fullstack" },
    ]);
  });

  it("arrow key navigation works when not focused on textarea", () => {
    renderQuestions();

    // Go to Q2
    typeInTextarea("React");
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Question 2 of 3")).toBeInTheDocument();

    // Press ArrowLeft on window (not textarea)
    fireEvent.keyDown(window, { key: "ArrowLeft" });

    expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Type your answer...")).toHaveValue("React");
  });

  it("arrow keys do NOT navigate when textarea is focused", () => {
    renderQuestions();

    // Go to Q2
    typeInTextarea("React");
    fireEvent.click(screen.getByText("Next"));

    // Press ArrowLeft on the textarea element itself
    const textarea = screen.getByPlaceholderText("Type your answer...");
    fireEvent.keyDown(textarea, { key: "ArrowLeft" });

    // Should still be on Q2
    expect(screen.getByText("Question 2 of 3")).toBeInTheDocument();
  });

  it("dot indicators are clickable for navigation", () => {
    renderQuestions();

    // Type answer for Q1
    typeInTextarea("React");

    // Click dot for Q3
    fireEvent.click(screen.getByLabelText("Go to question 3"));
    expect(screen.getByText("Preferred role?")).toBeInTheDocument();

    // Click dot for Q1 — answer should be preserved
    fireEvent.click(screen.getByLabelText("Go to question 1"));
    expect(screen.getByPlaceholderText("Type your answer...")).toHaveValue("React");
  });
});
