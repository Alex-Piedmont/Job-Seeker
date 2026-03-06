import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ExperienceSection } from "../experience-section";
import type { ResumeWorkExperience } from "@/types/resume-source";

// Mock sonner
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

// Mock dnd-kit to avoid jsdom issues
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PointerSensor: class {},
  useSensor: () => ({}),
  useSensors: () => [],
  closestCenter: () => null,
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: {},
  useSortable: () => ({
    setNodeRef: () => {},
    transform: null,
    transition: null,
    listeners: {},
    attributes: {},
  }),
  arrayMove: (arr: unknown[]) => arr,
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => "" } },
}));

// Mock auto-save hook
vi.mock("@/hooks/use-auto-save", () => ({
  useAutoSave: ({ initialData }: { initialData: unknown }) => ({
    status: "idle" as const,
    trigger: vi.fn(),
    flush: vi.fn(),
  }),
}));

// Mock save indicator
vi.mock("../save-indicator", () => ({
  SaveIndicator: () => null,
}));

// Mock date picker
vi.mock("../date-picker", () => ({
  DatePicker: () => null,
}));

// Mock SubsectionForm
vi.mock("../subsection-form", () => ({
  SubsectionForm: ({ subsection }: { subsection: { label: string } }) => (
    <div data-testid="subsection-form">{subsection.label}</div>
  ),
}));

// Mock fetch-with-save-error
vi.mock("@/lib/fetch-with-save-error", () => ({
  fetchOrThrowSaveError: vi.fn(),
}));

function makeExperience(overrides?: Partial<ResumeWorkExperience>): ResumeWorkExperience {
  return {
    id: "exp-1",
    userId: "user-1",
    company: "Acme Corp",
    title: "Senior PM",
    location: null,
    startDate: null,
    endDate: null,
    description: null,
    sortOrder: 0,
    alternateTitles: [],
    subsections: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Thinking Prompt Chips", () => {
  beforeEach(() => {
    localStorage.clear();
    // Set nudge as dismissed so it doesn't interfere
    localStorage.setItem("resume-source-nudge-dismissed", "true");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders chips when experience has no subsections", () => {
    const exp = makeExperience();
    render(
      <ExperienceSection experiences={[exp]} onUpdate={vi.fn()} />
    );

    // Expand the card
    fireEvent.click(screen.getByText("Senior PM"));

    expect(screen.getByText("Projects I Led")).toBeInTheDocument();
    expect(screen.getByText("Problems I Solved")).toBeInTheDocument();
    expect(screen.getByText("Growth & Impact")).toBeInTheDocument();
    expect(screen.getByText("Collaboration & Leadership")).toBeInTheDocument();
  });

  it("does not render chips when experience has subsections", () => {
    const exp = makeExperience({
      subsections: [
        {
          id: "sub-1",
          experienceId: "exp-1",
          label: "Existing",
          bullets: [],
          sortOrder: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    render(
      <ExperienceSection experiences={[exp]} onUpdate={vi.fn()} />
    );

    // Expand the card
    fireEvent.click(screen.getByText("Senior PM"));

    expect(screen.queryByText("Projects I Led")).not.toBeInTheDocument();
    expect(screen.queryByText("Problems I Solved")).not.toBeInTheDocument();
  });

  it("clicking a chip calls POST with the chip label", async () => {
    const onUpdate = vi.fn();
    const exp = makeExperience();

    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "sub-new",
        experienceId: "exp-1",
        label: "Projects I Led",
        bullets: [""],
        sortOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    })) as unknown as typeof fetch;

    render(
      <ExperienceSection experiences={[exp]} onUpdate={onUpdate} />
    );

    // Expand card
    fireEvent.click(screen.getByText("Senior PM"));

    // Click chip
    fireEvent.click(screen.getByText("Projects I Led"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/resume-source/experience/exp-1/subsection",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ label: "Projects I Led", bullets: [""] }),
        })
      );
    });
  });

  it("chips are disabled during POST", async () => {
    const exp = makeExperience();
    let resolveFetch: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    global.fetch = vi.fn(() => fetchPromise) as unknown as typeof fetch;

    render(
      <ExperienceSection experiences={[exp]} onUpdate={vi.fn()} />
    );

    // Expand card
    fireEvent.click(screen.getByText("Senior PM"));

    // Click chip (starts POST)
    fireEvent.click(screen.getByText("Projects I Led"));

    // All chips should be disabled
    await waitFor(() => {
      const chipButtons = screen
        .getAllByText(/Projects I Led|Problems I Solved|Growth & Impact|Collaboration & Leadership/)
        .map((el) => el.closest("button"));
      chipButtons.forEach((btn) => {
        if (btn) expect(btn).toBeDisabled();
      });
    });

    // Resolve the fetch to clean up
    resolveFetch!({
      ok: true,
      json: async () => ({
        id: "sub-new",
        experienceId: "exp-1",
        label: "Projects I Led",
        bullets: [""],
        sortOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    });
  });
});
