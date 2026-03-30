import { config } from "../config.js";
import { delay } from "./delay.js";
import { logger } from "./logger.js";
import type { CookieJar } from "./cookie-jar.js";

export interface FetchRetryOptions {
  cookieJar?: CookieJar;
}

/**
 * Wrapper around fetch that retries on 429 (rate limit), 403 (WAF/bot block),
 * and 5xx (server error) responses.
 * Returns the response as-is for all other status codes — the caller handles non-OK responses.
 * If all retries are exhausted, returns the last failed response (does not throw).
 *
 * When a cookieJar is provided, cookies and User-Agent are injected into requests
 * and Set-Cookie headers are captured from responses.
 */
export async function fetchWithRetry(url: string, options?: RequestInit, extra?: FetchRetryOptions): Promise<Response> {
  const cookieJar = extra?.cookieJar;
  let lastResponse: Response;

  // Attempt with rate-limit retries
  let rateLimitAttempts = 0;
  while (true) {
    lastResponse = await fetchWithCookies(url, options, cookieJar);

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

    // 403 retry — WAF/bot detection blocks are often transient
    if (lastResponse.status === 403) {
      let forbiddenAttempts = 0;
      let backoffMs = config.delays.forbiddenBackoff;

      while (forbiddenAttempts < config.retries.forbidden) {
        forbiddenAttempts++;
        logger.warn("Forbidden (403), retrying with backoff", {
          url,
          attempt: forbiddenAttempts,
          maxAttempts: config.retries.forbidden,
          backoffMs,
        });
        await delay(backoffMs);
        lastResponse = await fetchWithCookies(url, options, cookieJar);

        if (lastResponse.status !== 403) {
          return lastResponse;
        }

        backoffMs *= 2;
      }

      // All 403 retries exhausted
      return lastResponse;
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
        lastResponse = await fetchWithCookies(url, options, cookieJar);

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

/**
 * Wraps fetch() with cookie jar integration.
 * Injects Cookie header and UA override before the request,
 * captures Set-Cookie headers from the response.
 */
async function fetchWithCookies(url: string, options: RequestInit | undefined, cookieJar: CookieJar | undefined): Promise<Response> {
  if (!cookieJar) return fetch(url, options);

  const hostname = new URL(url).hostname;
  const headers = new Headers(options?.headers);

  // Inject cookies
  const cookieHeader = cookieJar.getCookieHeader(hostname);
  if (cookieHeader) {
    headers.set("Cookie", cookieHeader);
  }

  // Inject UA override (must match the browser that earned the cookies)
  const uaOverride = cookieJar.getUserAgent(hostname);
  if (uaOverride) {
    headers.set("User-Agent", uaOverride);
  }

  const response = await fetch(url, { ...options, headers });

  // Capture cookies from response
  cookieJar.setCookiesFromResponse(hostname, response);

  return response;
}
