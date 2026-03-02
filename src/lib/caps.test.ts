import { describe, it, expect, vi, afterEach } from "vitest";
import { shouldResetCap, getNextCapResetDate, hasRemainingGenerations } from "./caps";

describe("shouldResetCap", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true when capResetAt is null", () => {
    expect(shouldResetCap(null)).toBe(true);
  });

  it("returns true when current date is past reset date", () => {
    const pastDate = new Date("2025-01-01T00:00:00Z");
    expect(shouldResetCap(pastDate)).toBe(true);
  });

  it("returns false when reset date is in the future", () => {
    const futureDate = new Date("2099-01-01T00:00:00Z");
    expect(shouldResetCap(futureDate)).toBe(false);
  });
});

describe("getNextCapResetDate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns first of next month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00Z"));

    const result = getNextCapResetDate();
    expect(result.toISOString()).toBe("2026-04-01T00:00:00.000Z");

    vi.useRealTimers();
  });

  it("rolls over to January of next year in December", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-15T12:00:00Z"));

    const result = getNextCapResetDate();
    expect(result.toISOString()).toBe("2027-01-01T00:00:00.000Z");

    vi.useRealTimers();
  });
});

describe("hasRemainingGenerations", () => {
  it("returns true when used is less than cap", () => {
    expect(hasRemainingGenerations(2, 5)).toBe(true);
  });

  it("returns false when used equals cap", () => {
    expect(hasRemainingGenerations(5, 5)).toBe(false);
  });

  it("returns false when used exceeds cap", () => {
    expect(hasRemainingGenerations(6, 5)).toBe(false);
  });

  it("returns true when nothing used", () => {
    expect(hasRemainingGenerations(0, 5)).toBe(true);
  });
});
