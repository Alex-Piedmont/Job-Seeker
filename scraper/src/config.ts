import "dotenv/config";

export const config = {
  databaseUrl: process.env.DATABASE_URL!,
  userAgent: "JobSeekerBot/1.0 (+https://jobseeker.app/bot)",
  delays: {
    rateLimitWait: 60000,     // 60s wait on 429
  },
  retries: {
    network: 3,
    rateLimit: 1,
    serverError: 2,
  },
  concurrency: {
    global: parseInt(process.env.SCRAPER_GLOBAL_CONCURRENCY ?? "8", 10),
    perAdapter: {
      GREENHOUSE: 8,
      LEVER: 8,
      SUCCESSFACTORS: 8,
      ICIMS: 4,
      WORKDAY: 2,
      ORACLE: 3,
      SMARTRECRUITERS: 5,
    } as Record<string, number>,
    jobDetailConcurrency: 5,
    minRequestIntervalMs: 100,
  },
  archiveAfterDays: 7,
  playwrightTimeout: 30000,
} as const;
