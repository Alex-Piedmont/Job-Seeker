import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock environment before importing
beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("rate-limit", () => {
  describe("checkRateLimit", () => {
    it("returns null when UPSTASH_REDIS_REST_URL is not set", async () => {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

      const { checkRateLimit } = await import("../rate-limit");
      const result = await checkRateLimit("user-1", "api-default");
      expect(result).toBeNull();
    });

    it("returns null when UPSTASH_REDIS_REST_TOKEN is not set", async () => {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

      const { checkRateLimit } = await import("../rate-limit");
      const result = await checkRateLimit("user-1", "api-default");
      expect(result).toBeNull();
    });
  });

  describe("rateLimitHeaders", () => {
    it("formats headers correctly", async () => {
      const { rateLimitHeaders } = await import("../rate-limit");
      const result = rateLimitHeaders({
        allowed: true,
        remaining: 5,
        limit: 10,
        resetAt: 1700000000000,
      });

      expect(result).toEqual({
        "X-RateLimit-Limit": "10",
        "X-RateLimit-Remaining": "5",
        "X-RateLimit-Reset": "1700000000000",
      });
    });

    it("formats headers for denied request", async () => {
      const { rateLimitHeaders } = await import("../rate-limit");
      const result = rateLimitHeaders({
        allowed: false,
        remaining: 0,
        limit: 3,
        resetAt: 1700000060000,
      });

      expect(result).toEqual({
        "X-RateLimit-Limit": "3",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": "1700000060000",
      });
    });
  });
});
