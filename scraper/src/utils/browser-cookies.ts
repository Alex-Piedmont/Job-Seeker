/**
 * Headless browser cookie harvesting utility.
 * Launches Playwright, navigates to a URL, waits for Cloudflare cookies,
 * and returns them for replay via fetch().
 *
 * Adapter-agnostic: any adapter can call harvestCookies(url) to get past
 * Cloudflare Bot Management challenges.
 */

import { config } from "../config.js";
import { logger } from "./logger.js";

export interface HarvestedCookies {
  cookies: { name: string; value: string; expires: number }[];
  userAgent: string;
}

/**
 * Launch a headless browser, navigate to the given URL, wait for Cloudflare
 * cookies to appear, and return them along with the browser's User-Agent.
 *
 * Returns null if cookie harvesting fails or times out.
 */
export async function harvestCookies(url: string): Promise<HarvestedCookies | null> {
  const startMs = Date.now();
  let browser;

  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({
      headless: true,
      args: ["--disable-blink-features=AutomationControlled"],
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: config.playwrightTimeout,
    });

    // Poll for Cloudflare cookies (cf_clearance or __cf_bm)
    const pollDeadline = Date.now() + 15000;
    let cookies: { name: string; value: string; domain: string; expires: number }[] = [];
    while (Date.now() < pollDeadline) {
      cookies = (await context.cookies(url)) as any;
      if (cookies.some((c) => c.name === "cf_clearance" || c.name === "__cf_bm")) {
        break;
      }
      await page.waitForTimeout(500);
    }

    if (cookies.length === 0) {
      logger.warn("Browser cookie harvest timed out -- no cookies received", {
        url,
        durationMs: Date.now() - startMs,
      });
      return null;
    }

    const userAgent = await page.evaluate(() => navigator.userAgent);

    logger.info("Browser cookie harvest succeeded", {
      url,
      cookieCount: cookies.length,
      cookieNames: cookies.map((c) => c.name),
      durationMs: Date.now() - startMs,
    });

    return {
      cookies: cookies.map((c) => ({
        name: c.name,
        value: c.value,
        expires: c.expires,
      })),
      userAgent,
    };
  } catch (err) {
    logger.warn("Browser cookie harvest failed", {
      url,
      reason: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startMs,
    });
    return null;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
