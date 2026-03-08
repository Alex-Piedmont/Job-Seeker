import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JobCard, type ScrapedJob } from "../job-card";

const baseJob: ScrapedJob = {
  id: "job1",
  title: "Senior Software Engineer",
  url: "https://example.com/job/1",
  department: "Engineering",
  locations: ["San Francisco, CA", "Remote"],
  locationType: "Hybrid",
  salaryMin: 150000,
  salaryMax: 200000,
  salaryCurrency: "USD",
  firstSeenAt: new Date().toISOString(),
  postingEndDate: null,
  removedAt: null,
  archivedAt: null,
  company: { id: "c1", name: "Acme Corp" },
  isArchived: false,
};

describe("JobCard", () => {
  it("renders job title and company", () => {
    render(<JobCard job={baseJob} onSelect={vi.fn()} onToggleArchive={vi.fn()} />);
    expect(screen.getByText("Senior Software Engineer")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("renders location type badge", () => {
    render(<JobCard job={baseJob} onSelect={vi.fn()} onToggleArchive={vi.fn()} />);
    expect(screen.getAllByText("Hybrid").length).toBeGreaterThan(0);
  });

  it("renders locations", () => {
    render(<JobCard job={baseJob} onSelect={vi.fn()} onToggleArchive={vi.fn()} />);
    expect(screen.getAllByText("San Francisco, CA, Remote").length).toBeGreaterThan(0);
  });

  it("renders salary range", () => {
    render(<JobCard job={baseJob} onSelect={vi.fn()} onToggleArchive={vi.fn()} />);
    expect(screen.getAllByText("$150k - $200k").length).toBeGreaterThan(0);
  });

  it("shows 'No longer available' badge when removed", () => {
    const removed = { ...baseJob, removedAt: new Date().toISOString() };
    render(<JobCard job={removed} onSelect={vi.fn()} onToggleArchive={vi.fn()} />);
    expect(screen.getAllByText("No longer available").length).toBeGreaterThan(0);
  });

  it("calls onSelect when card is clicked", () => {
    const onSelect = vi.fn();
    const { container } = render(<JobCard job={baseJob} onSelect={onSelect} onToggleArchive={vi.fn()} />);
    fireEvent.click(container.querySelector("[data-slot='card']")!);
    expect(onSelect).toHaveBeenCalledWith(baseJob);
  });

  it("calls onToggleArchive when archive button is clicked", () => {
    const onToggleArchive = vi.fn();
    const onSelect = vi.fn();
    const { container } = render(<JobCard job={baseJob} onSelect={onSelect} onToggleArchive={onToggleArchive} />);
    const archiveBtn = container.querySelector("button[title='Archive']")!;
    fireEvent.click(archiveBtn);
    expect(onToggleArchive).toHaveBeenCalledWith(baseJob);
    // Should not trigger onSelect
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows unarchive button when job is archived", () => {
    const archived = { ...baseJob, isArchived: true };
    render(<JobCard job={archived} onSelect={vi.fn()} onToggleArchive={vi.fn()} />);
    expect(screen.getByTitle("Unarchive")).toBeInTheDocument();
  });

  it("renders without salary when not provided", () => {
    const noSalary = { ...baseJob, salaryMin: null, salaryMax: null };
    const { container } = render(<JobCard job={noSalary} onSelect={vi.fn()} onToggleArchive={vi.fn()} />);
    // DollarSign icon should not be present
    expect(container.querySelector(".lucide-dollar-sign")).not.toBeInTheDocument();
  });

  it("renders without locations when empty", () => {
    const noLocations = { ...baseJob, locations: [] };
    const { container } = render(<JobCard job={noLocations} onSelect={vi.fn()} onToggleArchive={vi.fn()} />);
    expect(container.querySelector(".lucide-map-pin")).not.toBeInTheDocument();
  });
});
