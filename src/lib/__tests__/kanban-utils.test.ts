import { describe, it, expect } from "vitest";
import {
  computeOTE,
  formatCurrency,
  formatCompactCurrency,
  getCompensationDisplay,
  matchesSearch,
  getStalenessLevel,
  DEFAULT_COLUMNS,
} from "../kanban-utils";

describe("computeOTE", () => {
  it("computes full OTE using midpoint: (75k+125k)/2=100k + 25% bonus=25k + 25k variable = 150k", () => {
    expect(
      computeOTE({ salaryMin: 75000, salaryMax: 125000, bonusTargetPct: 25, variableComp: 25000 })
    ).toBe(150000);
  });

  it("computes OTE with all components using midpoint", () => {
    // midpoint = (120k+180k)/2 = 150k, bonus = 150k*15% = 22.5k, variable = 50k → 222.5k
    expect(
      computeOTE({ salaryMin: 120000, salaryMax: 180000, bonusTargetPct: 15, variableComp: 50000 })
    ).toBe(222500);
  });

  it("returns midpoint when bonus and variable are null", () => {
    // midpoint = (150k+250k)/2 = 200k
    expect(
      computeOTE({ salaryMin: 150000, salaryMax: 250000, bonusTargetPct: null, variableComp: null })
    ).toBe(200000);
  });

  it("returns null when salaryMin is null", () => {
    expect(
      computeOTE({ salaryMin: null, salaryMax: 200000, bonusTargetPct: 15, variableComp: 50000 })
    ).toBeNull();
  });

  it("returns null when salaryMax is null", () => {
    expect(
      computeOTE({ salaryMin: 100000, salaryMax: null, bonusTargetPct: 15, variableComp: 50000 })
    ).toBeNull();
  });

  it("handles zero bonus and variable", () => {
    // midpoint = (80k+120k)/2 = 100k
    expect(
      computeOTE({ salaryMin: 80000, salaryMax: 120000, bonusTargetPct: 0, variableComp: 0 })
    ).toBe(100000);
  });

  it("handles bonus without variable comp", () => {
    // midpoint = (160k+240k)/2 = 200k, bonus = 200k*20% = 40k → 240k
    expect(
      computeOTE({ salaryMin: 160000, salaryMax: 240000, bonusTargetPct: 20, variableComp: null })
    ).toBe(240000);
  });

  it("handles variable comp without bonus", () => {
    // midpoint = (100k+200k)/2 = 150k, variable = 30k → 180k
    expect(
      computeOTE({ salaryMin: 100000, salaryMax: 200000, bonusTargetPct: null, variableComp: 30000 })
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

  it("shows salary range when no OTE computable (missing salaryMin)", () => {
    const result = getCompensationDisplay({
      salaryMin: null,
      salaryMax: 220000,
      bonusTargetPct: null,
      variableComp: null,
    });
    expect(result).toBe("up to $220k");
  });

  it("shows salary min+ when only min present", () => {
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

  it("returns 'none' when card recently entered current stage", () => {
    expect(
      getStalenessLevel(
        {
          createdAt: "2026-01-01T00:00:00Z",
          latestStatusLogAt: "2026-02-28T12:00:00Z",
          columnName: "Applied",
          columnType: null,
        },
        now
      )
    ).toBe("none");
  });

  it("returns 'muted' at 14+ days in stage", () => {
    expect(
      getStalenessLevel(
        {
          createdAt: "2026-01-01T00:00:00Z",
          latestStatusLogAt: "2026-02-14T12:00:00Z",
          columnName: "Applied",
          columnType: null,
        },
        now
      )
    ).toBe("muted");
  });

  it("returns 'warning' at 30+ days in stage", () => {
    expect(
      getStalenessLevel(
        {
          createdAt: "2026-01-01T00:00:00Z",
          latestStatusLogAt: "2026-01-15T12:00:00Z",
          columnName: "Applied",
          columnType: null,
        },
        now
      )
    ).toBe("warning");
  });

  it("falls back to createdAt when card has never moved columns", () => {
    expect(
      getStalenessLevel(
        {
          createdAt: "2026-01-15T12:00:00Z",
          latestStatusLogAt: null,
          columnName: "Saved",
          columnType: null,
        },
        now
      )
    ).toBe("warning");
  });

  it("returns 'none' for CLOSED column cards regardless of age", () => {
    expect(
      getStalenessLevel(
        {
          createdAt: "2025-01-01T00:00:00Z",
          latestStatusLogAt: "2025-01-01T00:00:00Z",
          columnName: "Closed",
          columnType: "CLOSED",
        },
        now
      )
    ).toBe("none");
  });

  it("returns 'none' for OFFER column cards regardless of age", () => {
    expect(
      getStalenessLevel(
        {
          createdAt: "2025-01-01T00:00:00Z",
          latestStatusLogAt: "2025-01-01T00:00:00Z",
          columnName: "Offer",
          columnType: "OFFER",
        },
        now
      )
    ).toBe("none");
  });

  it("Applied column ignores notes and interviews — only stage time matters", () => {
    // Card has been in Applied for 35 days; a recent note must NOT reset it.
    expect(
      getStalenessLevel(
        {
          createdAt: "2026-01-01T00:00:00Z",
          latestStatusLogAt: "2026-01-25T00:00:00Z",
          latestNoteAt: "2026-02-28T12:00:00Z",
          latestInterviewAt: "2026-02-28T12:00:00Z",
          columnName: "Applied",
          columnType: null,
        },
        now
      )
    ).toBe("warning");
  });

  it("Saved column also ignores notes/interviews", () => {
    expect(
      getStalenessLevel(
        {
          createdAt: "2026-01-01T00:00:00Z",
          latestStatusLogAt: "2026-01-25T00:00:00Z",
          latestNoteAt: "2026-02-28T12:00:00Z",
          columnName: "Saved",
          columnType: null,
        },
        now
      )
    ).toBe("warning");
  });

  it("custom user-named columns ignore notes/interviews (Applied semantics)", () => {
    expect(
      getStalenessLevel(
        {
          createdAt: "2026-01-01T00:00:00Z",
          latestStatusLogAt: "2026-01-25T00:00:00Z",
          latestNoteAt: "2026-02-28T12:00:00Z",
          columnName: "Follow-Up",
          columnType: null,
        },
        now
      )
    ).toBe("warning");
  });

  it("Screening column refreshes staleness when a note arrives", () => {
    // 35 days in stage but a note 1 day ago — still fresh.
    expect(
      getStalenessLevel(
        {
          createdAt: "2026-01-01T00:00:00Z",
          latestStatusLogAt: "2026-01-25T00:00:00Z",
          latestNoteAt: "2026-02-28T12:00:00Z",
          columnName: "Screening",
          columnType: null,
        },
        now
      )
    ).toBe("none");
  });

  it("Interview column refreshes staleness when an interview is logged", () => {
    expect(
      getStalenessLevel(
        {
          createdAt: "2026-01-01T00:00:00Z",
          latestStatusLogAt: "2026-01-25T00:00:00Z",
          latestInterviewAt: "2026-02-25T12:00:00Z",
          columnName: "Interview",
          columnType: null,
        },
        now
      )
    ).toBe("none");
  });

  it("Screening goes muted when notes/interviews also age past 14 days", () => {
    expect(
      getStalenessLevel(
        {
          createdAt: "2026-01-01T00:00:00Z",
          latestStatusLogAt: "2026-01-15T00:00:00Z",
          latestNoteAt: "2026-02-15T12:00:00Z",
          columnName: "Screening",
          columnType: null,
        },
        now
      )
    ).toBe("muted");
  });

  it("Screening goes warning when last engagement was 30+ days ago", () => {
    expect(
      getStalenessLevel(
        {
          createdAt: "2026-01-01T00:00:00Z",
          latestStatusLogAt: "2026-01-15T00:00:00Z",
          latestNoteAt: "2026-01-20T00:00:00Z",
          latestInterviewAt: "2026-01-25T00:00:00Z",
          columnName: "Screening",
          columnType: null,
        },
        now
      )
    ).toBe("warning");
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
