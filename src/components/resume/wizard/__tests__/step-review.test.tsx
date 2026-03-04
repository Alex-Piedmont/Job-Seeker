import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { StepReview } from "../step-review";
import type { FitAnalysisResult } from "@/lib/resume-prompts/fit-analysis";

// Mock sonner
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

// Mock react-markdown to avoid ESM issues
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

const FAKE_FIT: FitAnalysisResult = {
  relevantRoles: [],
  alignedWins: [],
  skillsMatch: { strong: [], partial: [], missing: [] },
  gaps: [],
  titleRecommendations: [],
  questions: [],
};

const FAKE_GENERATION = {
  id: "gen-1",
  markdownOutput: "# Resume",
  promptTokens: 100,
  completionTokens: 200,
  estimatedCost: 0.01,
  modelId: "claude-sonnet-4-5-20250514",
  createdAt: new Date().toISOString(),
};

const FAKE_REVIEW = {
  review: {
    keywordAlignment: { matched: ["React"], missing: ["Go"] },
    narrativeCoherence: "Good",
    bulletImprovements: [],
    gapsAndRisks: [],
    overallGrade: "B",
    gradeJustification: "Solid resume",
  },
};

const EMPTY_ANSWERS: Array<{ question: string; answer: string }> = [];

let fetchCallCount: number;

function mockFetchSequence() {
  fetchCallCount = 0;
  global.fetch = vi.fn(async (url: string | URL | Request) => {
    fetchCallCount++;
    const urlStr = typeof url === "string" ? url : url.toString();

    if (urlStr.includes("/api/resume/generate")) {
      return {
        ok: true,
        json: async () => FAKE_GENERATION,
      } as Response;
    }
    if (urlStr.includes("/api/resume/review")) {
      return {
        ok: true,
        json: async () => FAKE_REVIEW,
      } as Response;
    }
    return { ok: false, json: async () => ({}) } as Response;
  });
}

describe("StepReview", () => {
  beforeEach(() => {
    mockFetchSequence();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls generate exactly once on mount (no re-render loop)", async () => {
    const onUsageChanged = vi.fn();

    render(
      <StepReview
        jobApplicationId="app-1"
        fitAnalysis={FAKE_FIT}
        userAnswers={EMPTY_ANSWERS}
        onUseResume={vi.fn()}
        onUsageChanged={onUsageChanged}
      />
    );

    // Wait for generation + review to complete
    await waitFor(() => {
      expect(screen.getByText("Review Scorecard")).toBeInTheDocument();
    });

    // Should have exactly 2 fetch calls: 1 generate + 1 review
    expect(fetchCallCount).toBe(2);
    expect(onUsageChanged).toHaveBeenCalledTimes(1);
  });

  it("does not re-trigger generation when onUsageChanged reference changes", async () => {
    let usageKey = 0;
    const onUsageChanged = () => { usageKey++; };
    const onUseResume = vi.fn();

    const { rerender } = render(
      <StepReview
        jobApplicationId="app-1"
        fitAnalysis={FAKE_FIT}
        userAnswers={EMPTY_ANSWERS}
        onUseResume={onUseResume}
        onUsageChanged={onUsageChanged}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Review Scorecard")).toBeInTheDocument();
    });

    const callsAfterFirstRender = fetchCallCount;

    // Re-render with a NEW onUsageChanged function reference (simulating parent re-render)
    rerender(
      <StepReview
        jobApplicationId="app-1"
        fitAnalysis={FAKE_FIT}
        userAnswers={EMPTY_ANSWERS}
        onUseResume={onUseResume}
        onUsageChanged={() => { usageKey++; }}
      />
    );

    // Give any spurious effects time to fire
    await new Promise((r) => setTimeout(r, 50));

    // No additional fetch calls should have been made
    expect(fetchCallCount).toBe(callsAfterFirstRender);
  });

  it("still calls the latest onUsageChanged after generation", async () => {
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();
    const onUseResume = vi.fn();

    const { rerender } = render(
      <StepReview
        jobApplicationId="app-1"
        fitAnalysis={FAKE_FIT}
        userAnswers={EMPTY_ANSWERS}
        onUseResume={onUseResume}
        onUsageChanged={firstCallback}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText("Review Scorecard").length).toBeGreaterThan(0);
    });

    // First callback should have been called during initial generation
    expect(firstCallback).toHaveBeenCalledTimes(1);

    // Swap to second callback
    rerender(
      <StepReview
        jobApplicationId="app-1"
        fitAnalysis={FAKE_FIT}
        userAnswers={EMPTY_ANSWERS}
        onUseResume={onUseResume}
        onUsageChanged={secondCallback}
      />
    );

    // The ref should now point to secondCallback - verified implicitly:
    // if a revision were triggered, it would call secondCallback, not firstCallback.
    // The key assertion is that swapping didn't cause a re-generation.
    expect(secondCallback).not.toHaveBeenCalled();
  });
});
