import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock delay to avoid real waits
vi.mock("../delay.js", () => ({
  delay: vi.fn().mockResolvedValue(undefined),
}));

// Mock logger to suppress output
vi.mock("../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { fetchWithRetry } from "../fetch-retry";
import { delay } from "../delay.js";
import { CookieJar } from "../cookie-jar";

function mockResponse(status: number): Response {
  return new Response(null, { status });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  vi.mocked(delay).mockClear();
});

describe("fetchWithRetry", () => {
  // --- 200 (success) ---

  it("returns 200 immediately without retrying", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockResponse(200));

    const res = await fetchWithRetry("https://example.com");
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
  });

  // --- 403 retry ---

  it("retries 403 with backoff then returns 200", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(mockResponse(403))
      .mockResolvedValueOnce(mockResponse(200));

    const res = await fetchWithRetry("https://example.com");
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledTimes(1);
    expect(delay).toHaveBeenCalledWith(5000); // forbiddenBackoff
  });

  it("exhausts 403 retries and returns final 403", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(mockResponse(403))  // initial
      .mockResolvedValueOnce(mockResponse(403))  // retry 1
      .mockResolvedValueOnce(mockResponse(403)); // retry 2

    const res = await fetchWithRetry("https://example.com");
    expect(res.status).toBe(403);
    // 1 initial + 2 retries = 3 total
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenNthCalledWith(1, 5000);
    expect(delay).toHaveBeenNthCalledWith(2, 10000); // doubled
  });

  it("returns 429 when 403 retry produces 429 (does not re-enter 429 loop)", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(mockResponse(403))
      .mockResolvedValueOnce(mockResponse(429));

    const res = await fetchWithRetry("https://example.com");
    expect(res.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // --- 429 retry ---

  it("retries 429 with fixed delay then returns 200", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(mockResponse(429))
      .mockResolvedValueOnce(mockResponse(200));

    const res = await fetchWithRetry("https://example.com");
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledWith(60000); // rateLimitWait
  });

  it("exhausts 429 retries and returns final 429", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(mockResponse(429))  // initial
      .mockResolvedValueOnce(mockResponse(429)); // retry 1 — exhausted (rateLimit: 1)

    // After exhausting 429 retries, the 429 falls through to the next checks
    // (not 403, not 5xx), so it returns as-is
    const res = await fetchWithRetry("https://example.com");
    expect(res.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // --- 5xx retry ---

  it("retries 500 with exponential backoff then returns 200", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(mockResponse(500))
      .mockResolvedValueOnce(mockResponse(200));

    const res = await fetchWithRetry("https://example.com");
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledWith(2000);
  });

  it("exhausts 5xx retries and returns final 500", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(mockResponse(500))  // initial
      .mockResolvedValueOnce(mockResponse(502))  // retry 1
      .mockResolvedValueOnce(mockResponse(503)); // retry 2

    const res = await fetchWithRetry("https://example.com");
    expect(res.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenNthCalledWith(1, 2000);
    expect(delay).toHaveBeenNthCalledWith(2, 4000); // doubled
  });

  // --- Non-retryable statuses ---

  it("returns 404 immediately without retrying", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockResponse(404));

    const res = await fetchWithRetry("https://example.com");
    expect(res.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
  });

  // --- Cookie jar integration ---

  it("injects Cookie header from jar into requests", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockResponse(200));

    const jar = new CookieJar();
    jar.injectCookies("example.com", [{ name: "__cf_bm", value: "abc123" }]);

    await fetchWithRetry("https://example.com/api", { headers: { "Content-Type": "application/json" } }, { cookieJar: jar });

    const calledHeaders = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(calledHeaders.get("Cookie")).toBe("__cf_bm=abc123");
    expect(calledHeaders.get("Content-Type")).toBe("application/json");
  });

  it("injects UA override from jar into requests", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockResponse(200));

    const jar = new CookieJar();
    jar.setUserAgent("example.com", "Mozilla/5.0 Chrome/131");

    await fetchWithRetry("https://example.com/api", { headers: { "User-Agent": "OldBot/1.0" } }, { cookieJar: jar });

    const calledHeaders = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(calledHeaders.get("User-Agent")).toBe("Mozilla/5.0 Chrome/131");
  });

  it("captures Set-Cookie from response into jar", async () => {
    const fetchMock = vi.mocked(fetch);
    const resHeaders = new Headers();
    resHeaders.append("set-cookie", "token=xyz; Path=/");
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200, headers: resHeaders }));

    const jar = new CookieJar();
    await fetchWithRetry("https://example.com/api", undefined, { cookieJar: jar });

    expect(jar.getCookieHeader("example.com")).toBe("token=xyz");
  });

  it("accumulates cookies across multiple fetchWithRetry calls", async () => {
    const fetchMock = vi.mocked(fetch);

    const res1Headers = new Headers();
    res1Headers.append("set-cookie", "a=1");
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200, headers: res1Headers }));

    const res2Headers = new Headers();
    res2Headers.append("set-cookie", "b=2");
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200, headers: res2Headers }));

    const jar = new CookieJar();
    await fetchWithRetry("https://example.com/page1", undefined, { cookieJar: jar });
    await fetchWithRetry("https://example.com/page2", undefined, { cookieJar: jar });

    expect(jar.getCookieHeader("example.com")).toBe("a=1; b=2");
  });

  it("behaves identically without cookieJar (no regression)", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockResponse(200));

    const res = await fetchWithRetry("https://example.com", { headers: { "User-Agent": "Bot/1.0" } });
    expect(res.status).toBe(200);
    // fetch called directly with original headers
    const calledHeaders = fetchMock.mock.calls[0][1]?.headers;
    expect(new Headers(calledHeaders).get("User-Agent")).toBe("Bot/1.0");
  });
});
