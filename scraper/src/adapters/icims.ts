import type { AtsAdapter, ScrapedJobData } from "./types.js";
import { config } from "../config.js";
import { delay } from "../utils/delay.js";
import { isUSLocation } from "../utils/location-filter.js";
import { logger } from "../utils/logger.js";

export class ICIMSAdapter implements AtsAdapter {
  async listJobs(company: { id: string; name: string; baseUrl: string }): Promise<ScrapedJobData[]> {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });

    try {
      const context = await browser.newContext({
        userAgent: config.userAgent,
      });
      const page = await context.newPage();
      page.setDefaultTimeout(config.playwrightTimeout);

      logger.info("Navigating to iCIMS career site", { company: company.name, url: company.baseUrl });
      await page.goto(company.baseUrl, { waitUntil: "networkidle" });

      const jobs: ScrapedJobData[] = [];
      let hasMore = true;

      while (hasMore) {
        await page.waitForSelector('.iCIMS_JobsTable .row, .iCIMS_MainWrapper .iCIMS_InfoMsg_Job', { timeout: config.playwrightTimeout })
          .catch(() => {
            throw new Error(`iCIMS adapter: expected selector 'iCIMS_JobsTable' not found for ${company.name}`);
          });

        const jobRows = await page.$$('.iCIMS_JobsTable .row, [class*="JobRow"], .iCIMS_MainWrapper .iCIMS_InfoMsg_Job');

        for (const row of jobRows) {
          const title = await row.$eval('a.iCIMS_Anchor, .title a, a[class*="JobTitle"]', (el) => el.textContent?.trim() ?? "").catch(() => "");
          const linkEl = await row.$('a.iCIMS_Anchor, .title a, a[class*="JobTitle"]');
          const href = linkEl ? await linkEl.getAttribute("href") ?? "" : "";
          const location = await row.$eval('.iCIMS_JobHeaderData, .location, [class*="Location"]', (el) => el.textContent?.trim() ?? "").catch(() => "");

          if (!title || !href) continue;
          if (!isUSLocation(location)) continue;

          const fullUrl = href.startsWith("http") ? href : new URL(href, company.baseUrl).toString();
          const externalJobId = href.match(/(?:job|jobs|id)[=/](\d+)/i)?.[1] ?? href;

          // Navigate to detail page
          const detailPage = await context.newPage();
          try {
            await detailPage.goto(fullUrl, { waitUntil: "networkidle" });
            await delay(config.delays.betweenPages);

            const descriptionHtml = await detailPage.$eval(
              '.iCIMS_InfoMsg_Job .iCIMS_InfoMsg, .iCIMS_JobDescription, [class*="JobBody"]',
              (el) => el.innerHTML
            ).catch(() => "");

            const department = await detailPage.$eval(
              '.iCIMS_JobHeaderData .iCIMS_InfoMsg:first-child, [class*="Department"]',
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

        // Try next page
        const nextButton = await page.$('a.iCIMS_Paging_Next, [class*="PagingNext"], a[aria-label="Next"]');
        if (nextButton) {
          await nextButton.click();
          await page.waitForLoadState("networkidle");
          await delay(config.delays.betweenPages);
        } else {
          hasMore = false;
        }
      }

      logger.info("iCIMS scrape complete", { company: company.name, jobCount: jobs.length });
      return jobs;
    } finally {
      await browser.close();
    }
  }
}
