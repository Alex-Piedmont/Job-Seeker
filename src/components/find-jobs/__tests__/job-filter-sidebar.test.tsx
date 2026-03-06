import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { JobFilterSidebar, emptyFilters } from "../job-filter-sidebar";

afterEach(() => cleanup());

const companies = [
  { id: "c1", name: "Stripe", jobCount: 152 },
  { id: "c2", name: "Google", jobCount: 340 },
];

describe("JobFilterSidebar", () => {
  it("renders all filter inputs", () => {
    render(
      <JobFilterSidebar
        filters={emptyFilters}
        companies={companies}
        onFilterChange={vi.fn()}
        onClearAll={vi.fn()}
      />
    );
    expect(document.getElementById("filter-title")).toBeInTheDocument();
    expect(document.getElementById("filter-location")).toBeInTheDocument();
    expect(screen.getByText("All companies")).toBeInTheDocument();
  });

  it("calls onFilterChange when title changes", () => {
    const onFilterChange = vi.fn();
    render(
      <JobFilterSidebar
        filters={emptyFilters}
        companies={companies}
        onFilterChange={onFilterChange}
        onClearAll={vi.fn()}
      />
    );
    const titleInput = document.getElementById("filter-title")!;
    fireEvent.change(titleInput, { target: { value: "Engineer" } });
    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ q: "Engineer" }));
  });

  it("calls onFilterChange when location changes", () => {
    const onFilterChange = vi.fn();
    render(
      <JobFilterSidebar
        filters={emptyFilters}
        companies={companies}
        onFilterChange={onFilterChange}
        onClearAll={vi.fn()}
      />
    );
    const locationInput = document.getElementById("filter-location")!;
    fireEvent.change(locationInput, { target: { value: "NYC" } });
    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ location: "NYC" }));
  });

  it("shows 'Clear all' when filters active and hides when empty", () => {
    const { unmount } = render(
      <JobFilterSidebar
        filters={{ ...emptyFilters, q: "test" }}
        companies={companies}
        onFilterChange={vi.fn()}
        onClearAll={vi.fn()}
      />
    );
    expect(screen.getByText("Clear all")).toBeInTheDocument();
    unmount();

    render(
      <JobFilterSidebar
        filters={emptyFilters}
        companies={companies}
        onFilterChange={vi.fn()}
        onClearAll={vi.fn()}
      />
    );
    expect(screen.queryByText("Clear all")).not.toBeInTheDocument();
  });

  it("calls onClearAll when Clear all is clicked", () => {
    const onClearAll = vi.fn();
    render(
      <JobFilterSidebar
        filters={{ ...emptyFilters, q: "test" }}
        companies={companies}
        onFilterChange={vi.fn()}
        onClearAll={onClearAll}
      />
    );
    fireEvent.click(screen.getByText("Clear all"));
    expect(onClearAll).toHaveBeenCalled();
  });

  it("toggles show archived switch", () => {
    const onFilterChange = vi.fn();
    render(
      <JobFilterSidebar
        filters={emptyFilters}
        companies={companies}
        onFilterChange={onFilterChange}
        onClearAll={vi.fn()}
      />
    );
    const switchEl = document.querySelector("[data-slot='switch']")!;
    fireEvent.click(switchEl);
    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ showArchived: true }));
  });
});
