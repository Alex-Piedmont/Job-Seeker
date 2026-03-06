import { describe, it, expect } from "vitest";
import { isUSLocation } from "../location-filter";

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
