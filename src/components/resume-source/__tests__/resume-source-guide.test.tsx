import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ResumeSourceGuide } from "../resume-source-guide";

describe("ResumeSourceGuide", () => {
  let onOpenChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onOpenChange = vi.fn();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders step 1 content on open", () => {
    render(<ResumeSourceGuide open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText("Why structure matters")).toBeInTheDocument();
  });

  it("navigates forward with Next button", () => {
    render(<ResumeSourceGuide open={true} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/Before & After/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText("How to get started")).toBeInTheDocument();
  });

  it("navigates back with Back button", () => {
    render(<ResumeSourceGuide open={true} onOpenChange={onOpenChange} />);

    // Go to step 2
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/Before & After/i)).toBeInTheDocument();

    // Go back to step 1
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByText("Why structure matters")).toBeInTheDocument();
  });

  it("Back button is disabled on step 1", () => {
    render(<ResumeSourceGuide open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByRole("button", { name: /back/i })).toBeDisabled();
  });

  it("shows Got it button on step 3 instead of Next", () => {
    render(<ResumeSourceGuide open={true} onOpenChange={onOpenChange} />);

    // Navigate to step 3
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /got it/i })).toBeInTheDocument();
  });

  it("Got it calls onOpenChange(false) and sets localStorage", () => {
    render(<ResumeSourceGuide open={true} onOpenChange={onOpenChange} />);

    // Navigate to step 3
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    fireEvent.click(screen.getByRole("button", { name: /got it/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(localStorage.getItem("resume-source-guide-seen")).toBe("true");
  });

  it("resets to step 1 when reopened after closing", () => {
    const { rerender } = render(
      <ResumeSourceGuide open={true} onOpenChange={onOpenChange} />
    );

    // Navigate to step 2
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/Before & After/i)).toBeInTheDocument();

    // Close via the X button (dialog close)
    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    // Simulate prop change: closed then reopened
    rerender(<ResumeSourceGuide open={false} onOpenChange={onOpenChange} />);
    rerender(<ResumeSourceGuide open={true} onOpenChange={onOpenChange} />);

    expect(screen.getByText("Why structure matters")).toBeInTheDocument();
  });
});
