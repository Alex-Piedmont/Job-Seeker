/**
 * Per-host cookie jar for persisting cookies across requests within a session.
 * Captures Set-Cookie headers from responses, injects Cookie headers into requests.
 * Also stores an optional User-Agent override per host (for browser cookie replay).
 */

interface StoredCookie {
  name: string;
  value: string;
  expires: number | null; // Unix timestamp in ms, null = session cookie
}

export class CookieJar {
  private cookies = new Map<string, StoredCookie[]>();
  private userAgents = new Map<string, string>();

  /** Store cookies parsed from Set-Cookie response headers. */
  setCookiesFromResponse(hostname: string, response: Response): void {
    const setCookieHeaders = response.headers.getSetCookie?.() ?? [];
    for (const header of setCookieHeaders) {
      const cookie = parseSetCookie(header);
      if (cookie) {
        this.setCookie(hostname, cookie);
      }
    }
  }

  /** Inject pre-harvested cookies (e.g., from Playwright). */
  injectCookies(hostname: string, cookies: { name: string; value: string; expires?: number }[]): void {
    for (const c of cookies) {
      this.setCookie(hostname, {
        name: c.name,
        value: c.value,
        // Playwright returns expires as Unix seconds; convert to ms
        expires: c.expires && c.expires > 0 ? c.expires * 1000 : null,
      });
    }
  }

  /** Build a Cookie header string for a request to the given hostname. */
  getCookieHeader(hostname: string): string | null {
    const stored = this.cookies.get(hostname);
    if (!stored || stored.length === 0) return null;

    const now = Date.now();
    const valid = stored.filter((c) => c.expires === null || c.expires > now);
    if (valid.length === 0) return null;

    return valid.map((c) => `${c.name}=${c.value}`).join("; ");
  }

  /** Store a User-Agent override for a hostname (used for browser cookie replay). */
  setUserAgent(hostname: string, ua: string): void {
    this.userAgents.set(hostname, ua);
  }

  /** Get the User-Agent override for a hostname, or null if none set. */
  getUserAgent(hostname: string): string | null {
    return this.userAgents.get(hostname) ?? null;
  }

  /** Clear all cookies and UA overrides for a hostname. */
  clear(hostname: string): void {
    this.cookies.delete(hostname);
    this.userAgents.delete(hostname);
  }

  private setCookie(hostname: string, cookie: StoredCookie): void {
    const existing = this.cookies.get(hostname) ?? [];
    // Replace existing cookie with same name
    const filtered = existing.filter((c) => c.name !== cookie.name);
    filtered.push(cookie);
    this.cookies.set(hostname, filtered);
  }
}

/** Parse a single Set-Cookie header string into a StoredCookie. */
function parseSetCookie(header: string): StoredCookie | null {
  const parts = header.split(";").map((p) => p.trim());
  if (parts.length === 0) return null;

  const [nameValue, ...attrs] = parts;
  const eqIdx = nameValue.indexOf("=");
  if (eqIdx < 1) return null;

  const name = nameValue.substring(0, eqIdx).trim();
  const value = nameValue.substring(eqIdx + 1).trim();

  let expires: number | null = null;

  for (const attr of attrs) {
    const lower = attr.toLowerCase();
    if (lower.startsWith("expires=")) {
      const dateStr = attr.substring("expires=".length).trim();
      const parsed = Date.parse(dateStr);
      if (!isNaN(parsed)) expires = parsed;
    } else if (lower.startsWith("max-age=")) {
      const seconds = parseInt(attr.substring("max-age=".length).trim(), 10);
      if (!isNaN(seconds)) {
        expires = Date.now() + seconds * 1000;
      }
    }
  }

  return { name, value, expires };
}
