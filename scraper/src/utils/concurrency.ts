import { config } from "../config.js";
import { delay } from "./delay.js";

// p-limit v6 is ESM-only; use dynamic import for CJS compatibility (tsx handles this at runtime)
type LimitFunction = {
  <T>(fn: () => Promise<T> | T): Promise<T>;
  readonly activeCount: number;
  readonly pendingCount: number;
};

async function importPLimit(): Promise<(concurrency: number) => LimitFunction> {
  const mod = await import("p-limit");
  return mod.default;
}

/**
 * Creates nested concurrency limiters: a global limit and per-adapter limits.
 * Each company scrape acquires a global slot first, then a per-adapter slot.
 */
export async function createConcurrencyLimiters(): Promise<{
  globalLimit: LimitFunction;
  adapterLimits: Record<string, LimitFunction>;
}> {
  const pLimit = await importPLimit();

  const globalLimit = pLimit(config.concurrency.global);

  const adapterLimits: Record<string, LimitFunction> = {};
  for (const [platform, limit] of Object.entries(config.concurrency.perAdapter)) {
    adapterLimits[platform] = pLimit(limit as number);
  }

  return { globalLimit, adapterLimits };
}

/**
 * Per-host rate limiter that enforces a minimum gap between requests to the same hostname.
 * Uses promise-chain serialization to prevent race conditions with concurrent callers.
 */
export class HostRateLimiter {
  private locks = new Map<string, Promise<void>>();
  private lastRequestTime = new Map<string, number>();

  async acquire(hostname: string): Promise<void> {
    const prev = this.locks.get(hostname) ?? Promise.resolve();
    const current = prev.then(async () => {
      const now = Date.now();
      const lastTime = this.lastRequestTime.get(hostname) ?? 0;
      const wait = Math.max(0, config.concurrency.minRequestIntervalMs - (now - lastTime));
      if (wait > 0) await delay(wait);
      this.lastRequestTime.set(hostname, Date.now());
    });
    this.locks.set(hostname, current);
    await current;
  }
}

/** Singleton host rate limiter shared across all adapters */
export const hostRateLimiter = new HostRateLimiter();
