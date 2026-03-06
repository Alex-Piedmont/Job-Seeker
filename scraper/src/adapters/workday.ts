import type { AtsAdapter, ScrapedJobData } from "./types.js";
import { config } from "../config.js";
import { delay } from "../utils/delay.js";
import { isUSLocation } from "../utils/location-filter.js";
import { logger } from "../utils/logger.js";

export class WorkdayAdapter implements AtsAdapter {
  async listJobs(company: { id: string; name: string; baseUrl: string }): Promise<ScrapedJobData[]> {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });

    try {
      const context = await browser.newContext({
        userAgent: config.userAgent,
      });
      const page = await context.newPage();
      page.setDefaultTimeout(config.playwrightTimeout);

      logger.info("Navigating to Workday career site", { company: company.name, url: company.baseUrl });
      await page.goto(company.baseUrl, { waitUntil: "networkidle" });

      const jobs: ScrapedJobData[] = [];
      let hasMore = true;

      while (hasMore) {
        // Wait for job cards to render
        await page.waitForSelector('[data-automation-id="jobItem"], .css-1q2dra3, section[data-automation-id="jobResults"]', { timeout: config.playwrightTimeout })
          .catch(() => {
            throw new Error(`Workday adapter: expected selector 'jobItem' not found for ${company.name}`);
          });

        const jobCards = await page.$$('[data-automation-id="jobItem"], .css-1q2dra3 li');

        for (const card of jobCards) {
          const title = await card.$eval('a[data-automation-id="jobTitle"], h3 a', (el) => el.textContent?.trim() ?? "").catch(() => "");
          const linkEl = await card.$('a[data-automation-id="jobTitle"], h3 a');
          const href = linkEl ? await linkEl.getAttribute("href") ?? "" : "";
          const location = await card.$eval('[data-automation-id="locations"], .css-129m7dg', (el) => el.textContent?.trim() ?? "").catch(() => "");

          if (!title || !href) continue;
          if (!isUSLocation(location)) continue;

          const fullUrl = href.startsWith("http") ? href : new URL(href, company.baseUrl).toString();
          const externalJobId = href.match(/\/job\/([^/]+)/)?.[1] ?? href;

          // Navigate to detail page for full description
          const detailPage = await context.newPage();
          try {
            await detailPage.goto(fullUrl, { waitUntil: "networkidle" });
            await delay(config.delays.betweenPages);

            const descriptionHtml = await detailPage.$eval(
              '[data-automation-id="jobPostingDescription"], .css-1dbjc4n',
              (el) => el.innerHTML
            ).catch(() => "");

            const department = await detailPage.$eval(
              '[data-automation-id="jobPostingOrganization"], [data-automation-id="department"]',
              (el) => el.textContent?.trim() ?? null
            ).catch(() => null);

            const locationType = location.toLowerCase().includes("remote") ? "Remote" :
              location.toLowerCase().includes("hybrid") ? "Hybrid" : null;

            jobs.push({
              externalJobId,
              title,
              url: fullUrl,
              department,
              locations: [location].filter(Boolean),
              locationType,
              salaryMin: null,
              salaryMax: null,
              salaryCurrency: "USD",
              jobDescriptionHtml: descriptionHtml,
            });
          } finally {
            await detailPage.close();
          }
        }

        // Try pagination
        const showMore = await page.$('button[data-automation-id="showMore"], button[aria-label="next"]');
        if (showMore) {
          await showMore.click();
          await delay(config.delays.betweenPages);
        } else {
          hasMore = false;
        }
      }

      logger.info("Workday scrape complete", { company: company.name, jobCount: jobs.length });
      return jobs;
    } finally {
      await browser.close();
    }
  }
}
