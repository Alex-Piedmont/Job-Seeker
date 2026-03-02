import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn(),
      },
    })),
  };
});

import { estimateCost, getModelId } from "../anthropic";

describe("estimateCost", () => {
  it("calculates cost from token counts", () => {
    // Default rates: $3/M input, $15/M output
    const cost = estimateCost(1_000_000, 1_000_000);
    expect(cost).toBe(18.0); // 3 + 15
  });

  it("handles small token counts", () => {
    const cost = estimateCost(1000, 500);
    // (1000/1M * 3) + (500/1M * 15) = 0.003 + 0.0075 = 0.0105
    expect(cost).toBeCloseTo(0.0105);
  });

  it("returns 0 for 0 tokens", () => {
    expect(estimateCost(0, 0)).toBe(0);
  });
});

describe("getModelId", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns default model when env var not set", () => {
    delete process.env.CLAUDE_MODEL;
    expect(getModelId()).toBe("claude-sonnet-4-6");
  });

  it("returns env var value when set", () => {
    vi.stubEnv("CLAUDE_MODEL", "claude-haiku-4-5-20251001");
    expect(getModelId()).toBe("claude-haiku-4-5-20251001");
  });
});
