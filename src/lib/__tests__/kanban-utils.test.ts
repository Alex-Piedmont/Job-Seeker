import { describe, it, expect } from "vitest";
import {
  computeOTE,
  formatCurrency,
  formatCompactCurrency,
  getCompensationDisplay,
  matchesSearch,
  getStalenessLevel,
  getLastActivity,
  DEFAULT_COLUMNS,
} from "../kanban-utils";

describe("computeOTE", () => {
  it("computes full OTE with all components", () => {
    expect(
      computeOTE({ salaryMax: 150000, bonusTargetPct: 15, variableComp: 50000 })
    ).toBe(222500);
  });

  it("returns salaryMax when bonus and variable are null", () => {
    expect(
      computeOTE({ salaryMax: 200000, bonusTargetPct: null, variableComp: null })
    ).toBe(200000);
  });

  it("returns null when salaryMax is null", () => {
    expect(
      computeOTE({ salaryMax: null, bonusTargetPct: 15, variableComp: 50000 })
    ).toBeNull();
  });

  it("handles zero bonus and variable", () => {
    expect(
      computeOTE({ salaryMax: 100000, bonusTargetPct: 0, variableComp: 0 })
    ).toBe(100000);
  });

  it("handles bonus without variable comp", () => {
    expect(
      computeOTE({ salaryMax: 200000, bonusTargetPct: 20, variableComp: null })
    ).toBe(240000);
  });

  it("handles variable comp without bonus", () => {
    expect(
      computeOTE({ salaryMax: 150000, bonusTargetPct: null, variableComp: 30000 })
    ).toBe(180000);
  });
});

describe("formatCurrency", () => {
  it("formats whole dollar amounts", () => {
    expect(formatCurrency(222500)).toBe("$222,500");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0");
  });
});

describe("formatCompactCurrency", () => {
  it("formats thousands as k", () => {
    expect(formatCompactCurrency(150000)).toBe("$150k");
  });

  it("formats sub-thousand amounts fully", () => {
    expect(formatCompactCurrency(500)).toBe("$500");
  });
});

describe("getCompensationDisplay", () => {
  it("shows OTE when salaryMax exists", () => {
    const result = getCompensationDisplay({
      salaryMin: 180000,
      salaryMax: 220000,
      bonusTargetPct: 15,
      variableComp: 50000,
    });
    expect(result).toContain("OTE");
  });

  it("shows salary range when no OTE computable and both min/max present", () => {
    const result = getCompensationDisplay({
      salaryMin: 180000,
      salaryMax: null,
      bonusTargetPct: null,
      variableComp: null,
    });
    expect(result).toBe("$180k+");
  });

  it("returns null when no salary info", () => {
    expect(
      getCompensationDisplay({
        salaryMin: null,
        salaryMax: null,
        bonusTargetPct: null,
        variableComp: null,
      })
    ).toBeNull();
  });
});

describe("matchesSearch", () => {
  const app = {
    company: "Acme Corp",
    role: "Senior PM",
    hiringManager: "Jane Smith",
    referrals: "John Doe - VP Eng",
  };

  it("matches on company name", () => {
    expect(matchesSearch(app, "acme")).toBe(true);
  });

  it("matches on role", () => {
    expect(matchesSearch(app, "senior")).toBe(true);
  });

  it("matches on hiring manager", () => {
    expect(matchesSearch(app, "jane")).toBe(true);
  });

  it("matches on referrals", () => {
    expect(matchesSearch(app, "john doe")).toBe(true);
  });

  it("returns true for empty query", () => {
    expect(matchesSearch(app, "")).toBe(true);
    expect(matchesSearch(app, "  ")).toBe(true);
  });

  it("returns false for non-matching query", () => {
    expect(matchesSearch(app, "xyznotfound")).toBe(false);
  });

  it("handles null fields", () => {
    const appNulls = { company: "Acme", role: "PM", hiringManager: null, referrals: null };
    expect(matchesSearch(appNulls, "acme")).toBe(true);
    expect(matchesSearch(appNulls, "jane")).toBe(false);
  });
});

describe("getStalenessLevel", () => {
  const now = new Date("2026-03-01T12:00:00Z");

  it("returns 'none' for recently active cards", () => {
    expect(
      getStalenessLevel(
        { updatedAt: "2026-02-28T12:00:00Z", columnType: null },
        now
      )
    ).toBe("none");
  });

  it("returns 'muted' for 14+ day inactive cards", () => {
    expect(
      getStalenessLevel(
        { updatedAt: "2026-02-14T12:00:00Z", columnType: null },
        now
      )
    ).toBe("muted");
  });

  it("returns 'warning' for 30+ day inactive cards", () => {
    expect(
      getStalenessLevel(
        { updatedAt: "2026-01-15T12:00:00Z", columnType: null },
        now
      )
    ).toBe("warning");
  });

  it("returns 'none' for CLOSED column cards regardless of age", () => {
    expect(
      getStalenessLevel(
        { updatedAt: "2025-01-01T00:00:00Z", columnType: "CLOSED" },
        now
      )
    ).toBe("none");
  });

  it("returns 'none' for OFFER column cards regardless of age", () => {
    expect(
      getStalenessLevel(
        { updatedAt: "2025-01-01T00:00:00Z", columnType: "OFFER" },
        now
      )
    ).toBe("none");
  });

  it("uses most recent activity across all sources", () => {
    // updatedAt is old, but latestNoteAt is recent
    expect(
      getStalenessLevel(
        {
          updatedAt: "2025-01-01T00:00:00Z",
          latestStatusLogAt: "2025-01-01T00:00:00Z",
          latestInterviewAt: null,
          latestNoteAt: "2026-02-28T12:00:00Z",
          columnType: null,
        },
        now
      )
    ).toBe("none");
  });
});

describe("getLastActivity", () => {
  it("picks the latest date from all sources", () => {
    const result = getLastActivity({
      updatedAt: "2026-01-01T00:00:00Z",
      latestStatusLogAt: "2026-02-01T00:00:00Z",
      latestInterviewAt: "2026-03-01T00:00:00Z",
      latestNoteAt: "2026-02-15T00:00:00Z",
    });
    expect(result.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("handles null activity sources", () => {
    const result = getLastActivity({
      updatedAt: "2026-02-01T00:00:00Z",
      latestStatusLogAt: null,
      latestInterviewAt: null,
      latestNoteAt: null,
    });
    expect(result.toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });
});

describe("DEFAULT_COLUMNS", () => {
  it("has 6 default columns", () => {
    expect(DEFAULT_COLUMNS).toHaveLength(6);
  });

  it("has Offer with OFFER columnType", () => {
    const offer = DEFAULT_COLUMNS.find((c) => c.name === "Offer");
    expect(offer?.columnType).toBe("OFFER");
  });

  it("has Closed with CLOSED columnType", () => {
    const closed = DEFAULT_COLUMNS.find((c) => c.name === "Closed");
    expect(closed?.columnType).toBe("CLOSED");
  });

  it("has null columnType for non-special columns", () => {
    const saved = DEFAULT_COLUMNS.find((c) => c.name === "Saved");
    expect(saved?.columnType).toBeNull();
  });
});
