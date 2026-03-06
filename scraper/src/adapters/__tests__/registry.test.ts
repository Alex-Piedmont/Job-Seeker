import { describe, it, expect, vi } from "vitest";

vi.mock("../greenhouse", () => ({
  GreenhouseAdapter: class { listJobs = vi.fn(); },
}));
vi.mock("../lever", () => ({
  LeverAdapter: class { listJobs = vi.fn(); },
}));
vi.mock("../workday", () => ({
  WorkdayAdapter: class { listJobs = vi.fn(); },
}));
vi.mock("../icims", () => ({
  ICIMSAdapter: class { listJobs = vi.fn(); },
}));

import { getAdapter } from "../registry";

describe("getAdapter", () => {
  it("returns an adapter for GREENHOUSE", () => {
    expect(getAdapter("GREENHOUSE")).toBeTruthy();
  });

  it("returns an adapter for LEVER", () => {
    expect(getAdapter("LEVER")).toBeTruthy();
  });

  it("returns an adapter for WORKDAY", () => {
    expect(getAdapter("WORKDAY")).toBeTruthy();
  });

  it("returns an adapter for ICIMS", () => {
    expect(getAdapter("ICIMS")).toBeTruthy();
  });

  it("throws for unsupported platform", () => {
    expect(() => getAdapter("UNKNOWN")).toThrow(
      "Unsupported ATS platform: UNKNOWN"
    );
  });
});
