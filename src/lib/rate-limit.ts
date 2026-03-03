import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
}

type RateLimitCategory = "resume-generate" | "export" | "api-default" | "feedback" | "fit-analysis" | "resume-review";

const CATEGORY_CONFIG: Record<RateLimitCategory, { requests: number; window: `${number} s` }> = {
  "resume-generate": { requests: 3, window: "60 s" },
  "export": { requests: 1, window: "300 s" },
  "api-default": { requests: 60, window: "60 s" },
  "feedback": { requests: 5, window: "600 s" },
  "fit-analysis": { requests: 5, window: "60 s" },
  "resume-review": { requests: 5, window: "60 s" },
};

let rateLimiters: Map<RateLimitCategory, Ratelimit> | null = null;

function getRateLimiters(): Map<RateLimitCategory, Ratelimit> | null {
  if (rateLimiters) return rateLimiters;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  const redis = new Redis({ url, token });
  rateLimiters = new Map();

  for (const [category, config] of Object.entries(CATEGORY_CONFIG)) {
    rateLimiters.set(
      category as RateLimitCategory,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(config.requests, config.window),
        prefix: `ratelimit:${category}`,
      })
    );
  }

  return rateLimiters;
}

/**
 * Check rate limit for an identifier and category.
 * Returns null if rate limiting is not configured (graceful degradation).
 */
export async function checkRateLimit(
  identifier: string,
  category: RateLimitCategory = "api-default"
): Promise<RateLimitResult | null> {
  const limiters = getRateLimiters();
  if (!limiters) return null;

  const limiter = limiters.get(category);
  if (!limiter) return null;

  const result = await limiter.limit(identifier);

  return {
    allowed: result.success,
    remaining: result.remaining,
    limit: CATEGORY_CONFIG[category].requests,
    resetAt: result.reset,
  };
}

/**
 * Generate standard rate limit headers from a result.
 */
export function rateLimitHeaders(
  result: RateLimitResult
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetAt),
  };
}
