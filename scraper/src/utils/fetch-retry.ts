import { config } from "../config.js";
import { delay } from "./delay.js";
import { logger } from "./logger.js";

/**
 * Wrapper around fetch that retries on 429 (rate limit) and 5xx (server error) responses.
 * Returns the response as-is for all other status codes — the caller handles non-OK responses.
 * If all retries are exhausted, returns the last failed response (does not throw).
 */
export async function fetchWithRetry(url: string, options?: RequestInit): Promise<Response> {
  let lastResponse: Response;

  // Attempt with rate-limit retries
  let rateLimitAttempts = 0;
  while (true) {
    lastResponse = await fetch(url, options);

    if (lastResponse.status === 429 && rateLimitAttempts < config.retries.rateLimit) {
      rateLimitAttempts++;
      logger.warn("Rate limited (429), retrying after wait", {
        url,
        attempt: rateLimitAttempts,
        maxAttempts: config.retries.rateLimit,
        waitMs: config.delays.rateLimitWait,
      });
      await delay(config.delays.rateLimitWait);
      continue;
    }

    if (lastResponse.status >= 500 && lastResponse.status < 600) {
      let serverErrorAttempts = 0;
      let backoffMs = 2000;

      while (serverErrorAttempts < config.retries.serverError) {
        serverErrorAttempts++;
        logger.warn("Server error, retrying with backoff", {
          url,
          status: lastResponse.status,
          attempt: serverErrorAttempts,
          maxAttempts: config.retries.serverError,
          backoffMs,
        });
        await delay(backoffMs);
        lastResponse = await fetch(url, options);

        if (lastResponse.status < 500 || lastResponse.status >= 600) {
          return lastResponse;
        }

        backoffMs *= 2;
      }

      // All server error retries exhausted
      return lastResponse;
    }

    // Success or non-retryable status — return as-is
    return lastResponse;
  }
}
