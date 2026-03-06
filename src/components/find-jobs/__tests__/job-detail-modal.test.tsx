import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { JobDetailModal } from "../job-detail-modal";

// Mock useMediaQuery
vi.mock("@/hooks/use-media-query", () => ({
  useMediaQuery: () => false, // desktop by default
}));

const mockJob = {
  id: "job1",
  title: "Staff Engineer",
  url: "https://example.com/job/1",
  department: "Platform",
  locations: ["New York"],
  locationType: "Remote",
  salaryMin: 200000,
  salaryMax: 300000,
  salaryCurrency: "USD",
  firstSeenAt: new Date("2025-01-15").toISOString(),
  removedAt: null,
  archivedAt: null,
  company: { id: "c1", name: "TechCo" },
  isArchived: false,
  jobDescriptionMd: "# About the Role\n\nThis is a **great** opportunity.",
};

describe("JobDetailModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("does not render when jobId is null", () => {
    render(<JobDetailModal jobId={null} onClose={vi.fn()} onToggleArchive={vi.fn()} importedJobIds={new Set()} onImported={vi.fn()} />);
    expect(screen.queryByText("Staff Engineer")).not.toBeInTheDocument();
  });

  it("fetches and displays job details", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve(mockJob),
    });

    render(<JobDetailModal jobId="job1" onClose={vi.fn()} onToggleArchive={vi.fn()} importedJobIds={new Set()} onImported={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Staff Engineer")).toBeInTheDocument();
    });

    expect(screen.getByText("TechCo")).toBeInTheDocument();
    expect(screen.getByText("Hiring Org: Platform")).toBeInTheDocument();
    expect(screen.getByText("New York")).toBeInTheDocument();
    expect(screen.getByText("$200,000 - $300,000")).toBeInTheDocument();
    expect(screen.getByText("About the Role")).toBeInTheDocument();
  });

  it("shows removal warning for removed jobs", async () => {
    const removed = { ...mockJob, removedAt: new Date().toISOString() };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve(removed),
    });

    render(<JobDetailModal jobId="job1" onClose={vi.fn()} onToggleArchive={vi.fn()} importedJobIds={new Set()} onImported={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/no longer available on the company/)).toBeInTheDocument();
    });
    expect(screen.getByText("No longer available")).toBeInTheDocument();
  });

  it("shows archived message for user-archived jobs", async () => {
    const archived = { ...mockJob, isArchived: true };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve(archived),
    });

    render(<JobDetailModal jobId="job1" onClose={vi.fn()} onToggleArchive={vi.fn()} importedJobIds={new Set()} onImported={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("You archived this role.")).toBeInTheDocument();
    });
  });

  it("shows 'Add to Board' button that is clickable", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve(mockJob),
    });

    render(<JobDetailModal jobId="job1" onClose={vi.fn()} onToggleArchive={vi.fn()} importedJobIds={new Set()} onImported={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByText("Add to Board").length).toBeGreaterThan(0);
    });

    const addBtn = screen.getAllByText("Add to Board")[0].closest("button");
    expect(addBtn).not.toBeDisabled();
  });

  it("shows 'Already on Board' when job is imported", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve(mockJob),
    });

    render(<JobDetailModal jobId="job1" onClose={vi.fn()} onToggleArchive={vi.fn()} importedJobIds={new Set(["job1"])} onImported={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Already on Board")).toBeInTheDocument();
    });

    const btn = screen.getByText("Already on Board").closest("button");
    expect(btn).toBeDisabled();
  });
});
