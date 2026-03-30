import { describe, it, expect, vi, beforeEach } from "vitest";
import { CookieJar } from "../cookie-jar";

function mockResponseWithCookies(status: number, cookies: string[]): Response {
  const headers = new Headers();
  for (const c of cookies) {
    headers.append("set-cookie", c);
  }
  return new Response(null, { status, headers });
}

describe("CookieJar", () => {
  let jar: CookieJar;

  beforeEach(() => {
    jar = new CookieJar();
  });

  // --- setCookiesFromResponse + getCookieHeader ---

  it("stores cookies from Set-Cookie headers and returns them", () => {
    const res = mockResponseWithCookies(200, [
      "__cf_bm=abc123; Path=/; Secure; HttpOnly",
      "wday_vps_cookie=456; Path=/; HttpOnly",
    ]);
    jar.setCookiesFromResponse("example.com", res);

    expect(jar.getCookieHeader("example.com")).toBe("__cf_bm=abc123; wday_vps_cookie=456");
  });

  it("isolates cookies by hostname", () => {
    const res1 = mockResponseWithCookies(200, ["a=1"]);
    const res2 = mockResponseWithCookies(200, ["b=2"]);
    jar.setCookiesFromResponse("host-a.com", res1);
    jar.setCookiesFromResponse("host-b.com", res2);

    expect(jar.getCookieHeader("host-a.com")).toBe("a=1");
    expect(jar.getCookieHeader("host-b.com")).toBe("b=2");
  });

  it("returns null when no cookies stored for hostname", () => {
    expect(jar.getCookieHeader("unknown.com")).toBeNull();
  });

  it("replaces cookie with same name on subsequent response", () => {
    jar.setCookiesFromResponse("example.com", mockResponseWithCookies(200, ["a=1"]));
    jar.setCookiesFromResponse("example.com", mockResponseWithCookies(200, ["a=2"]));

    expect(jar.getCookieHeader("example.com")).toBe("a=2");
  });

  it("accumulates different cookies across multiple responses", () => {
    jar.setCookiesFromResponse("example.com", mockResponseWithCookies(200, ["a=1"]));
    jar.setCookiesFromResponse("example.com", mockResponseWithCookies(200, ["b=2"]));

    expect(jar.getCookieHeader("example.com")).toBe("a=1; b=2");
  });

  // --- Expiry ---

  it("filters out expired cookies (Expires attribute)", () => {
    const pastDate = new Date(Date.now() - 60000).toUTCString();
    const res = mockResponseWithCookies(200, [
      `expired=old; Expires=${pastDate}`,
      "valid=new",
    ]);
    jar.setCookiesFromResponse("example.com", res);

    expect(jar.getCookieHeader("example.com")).toBe("valid=new");
  });

  it("filters out expired cookies (Max-Age=0)", () => {
    const res = mockResponseWithCookies(200, [
      "gone=deleted; Max-Age=0",
      "kept=alive; Max-Age=3600",
    ]);
    jar.setCookiesFromResponse("example.com", res);

    expect(jar.getCookieHeader("example.com")).toBe("kept=alive");
  });

  it("keeps session cookies (no Expires/Max-Age)", () => {
    const res = mockResponseWithCookies(200, ["session=abc; Path=/; HttpOnly"]);
    jar.setCookiesFromResponse("example.com", res);

    expect(jar.getCookieHeader("example.com")).toBe("session=abc");
  });

  // --- injectCookies ---

  it("injects pre-harvested cookies (Playwright format)", () => {
    jar.injectCookies("example.com", [
      { name: "__cf_bm", value: "abc", expires: (Date.now() / 1000) + 3600 },
      { name: "session", value: "xyz", expires: -1 },
    ]);

    const header = jar.getCookieHeader("example.com");
    expect(header).toContain("__cf_bm=abc");
    expect(header).toContain("session=xyz");
  });

  // --- User-Agent override ---

  it("stores and returns User-Agent override per hostname", () => {
    jar.setUserAgent("example.com", "Mozilla/5.0 Chrome/131");
    expect(jar.getUserAgent("example.com")).toBe("Mozilla/5.0 Chrome/131");
    expect(jar.getUserAgent("other.com")).toBeNull();
  });

  // --- clear ---

  it("clears cookies and UA for a hostname", () => {
    jar.setCookiesFromResponse("example.com", mockResponseWithCookies(200, ["a=1"]));
    jar.setUserAgent("example.com", "TestUA");
    jar.clear("example.com");

    expect(jar.getCookieHeader("example.com")).toBeNull();
    expect(jar.getUserAgent("example.com")).toBeNull();
  });
});
