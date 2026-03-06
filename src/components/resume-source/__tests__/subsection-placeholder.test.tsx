import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SubsectionForm } from "../subsection-form";
import type { ResumeWorkSubsection } from "@/types/resume-source";

// Mock sonner
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

// Mock auto-save hook
vi.mock("@/hooks/use-auto-save", () => ({
  useAutoSave: () => ({
    status: "idle" as const,
    trigger: vi.fn(),
    flush: vi.fn(),
  }),
}));

// Mock save indicator
vi.mock("../save-indicator", () => ({
  SaveIndicator: () => null,
}));

// Mock fetch-with-save-error
vi.mock("@/lib/fetch-with-save-error", () => ({
  fetchOrThrowSaveError: vi.fn(),
}));

function makeSub(overrides?: Partial<ResumeWorkSubsection>): ResumeWorkSubsection {
  return {
    id: "sub-1",
    experienceId: "exp-1",
    label: "Test Subsection",
    bullets: [""],
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("SubsectionForm placeholder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows coaching placeholder on first empty bullet", () => {
    const sub = makeSub({ bullets: [""] });
    render(
      <SubsectionForm
        subsection={sub}
        experienceId="exp-1"
        onSaved={vi.fn()}
        onDelete={vi.fn()}
        initialExpanded={true}
      />
    );

    const textarea = screen.getByPlaceholderText(
      "What did you do, why did it matter, and what was the result?"
    );
    expect(textarea).toBeInTheDocument();
  });

  it("shows standard placeholder on non-first empty bullets", () => {
    const sub = makeSub({ bullets: ["Existing bullet", ""] });
    render(
      <SubsectionForm
        subsection={sub}
        experienceId="exp-1"
        onSaved={vi.fn()}
        onDelete={vi.fn()}
        initialExpanded={true}
      />
    );

    // The first bullet has content, the second is empty and is the first empty one
    const coachingPlaceholder = screen.getByPlaceholderText(
      "What did you do, why did it matter, and what was the result?"
    );
    expect(coachingPlaceholder).toBeInTheDocument();
  });

  it("shows standard placeholder on second empty bullet when first is also empty", () => {
    const sub = makeSub({ bullets: ["", ""] });
    render(
      <SubsectionForm
        subsection={sub}
        experienceId="exp-1"
        onSaved={vi.fn()}
        onDelete={vi.fn()}
        initialExpanded={true}
      />
    );

    // First empty gets coaching, second gets standard
    expect(
      screen.getByPlaceholderText(
        "What did you do, why did it matter, and what was the result?"
      )
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Bullet point...")).toBeInTheDocument();
  });

  it("starts expanded when initialExpanded is true", () => {
    const sub = makeSub({ bullets: ["Some bullet"] });
    render(
      <SubsectionForm
        subsection={sub}
        experienceId="exp-1"
        onSaved={vi.fn()}
        onDelete={vi.fn()}
        initialExpanded={true}
      />
    );

    // Should see the bullet content (textarea visible means expanded)
    expect(screen.getByDisplayValue("Some bullet")).toBeInTheDocument();
  });

  it("starts collapsed when initialExpanded is not set", () => {
    const sub = makeSub({ bullets: ["Some bullet"] });
    render(
      <SubsectionForm
        subsection={sub}
        experienceId="exp-1"
        onSaved={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // Should NOT see the bullet textarea (collapsed)
    expect(screen.queryByDisplayValue("Some bullet")).not.toBeInTheDocument();
    // But should see collapsed bullet count
    expect(screen.getByText("1 bullet")).toBeInTheDocument();
  });
});
