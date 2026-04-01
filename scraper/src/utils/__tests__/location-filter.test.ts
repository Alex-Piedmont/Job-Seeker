import { describe, it, expect } from "vitest";
import { isUSLocation, isLikelyUSLocation } from "../location-filter";

describe("isUSLocation", () => {
  const usCases = [
    "San Francisco, CA",
    "Remote",
    "United States",
    "New York, NY",
    "Remote - US",
    "Austin, TX",
    "Seattle, WA",
    "Chicago, IL",
    "USA",
  ];

  const nonUSCases = [
    "London, UK",
    "Toronto, Canada",
    "Berlin, Germany",
    "",
    "Tokyo, Japan",
    "Mumbai, India",
  ];

  it.each(usCases)('returns true for "%s"', (location) => {
    expect(isUSLocation(location)).toBe(true);
  });

  it.each(nonUSCases)('returns false for "%s"', (location) => {
    expect(isUSLocation(location)).toBe(false);
  });
});

describe("isLikelyUSLocation", () => {
  it("returns true for null", () => {
    expect(isLikelyUSLocation(null)).toBe(true);
  });

  it("returns true for undefined", () => {
    expect(isLikelyUSLocation(undefined)).toBe(true);
  });

  it("returns true for empty string", () => {
    expect(isLikelyUSLocation("")).toBe(true);
  });

  it("returns true for whitespace-only string", () => {
    expect(isLikelyUSLocation("   ")).toBe(true);
  });

  it('returns true for "San Francisco, CA"', () => {
    expect(isLikelyUSLocation("San Francisco, CA")).toBe(true);
  });

  it('returns true for "Remote"', () => {
    expect(isLikelyUSLocation("Remote")).toBe(true);
  });

  it('returns false for "London, UK"', () => {
    expect(isLikelyUSLocation("London, UK")).toBe(false);
  });

  it('returns false for "Mumbai, India"', () => {
    expect(isLikelyUSLocation("Mumbai, India")).toBe(false);
  });
});
