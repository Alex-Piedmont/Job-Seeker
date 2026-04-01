import "dotenv/config";

export const config = {
  databaseUrl: process.env.DATABASE_URL!,
  userAgent: "JobSeekerBot/1.0 (+https://jobseeker.app/bot)",
  delays: {
    rateLimitWait: 60000,     // 60s wait on 429
    forbiddenBackoff: 5000,   // 5s initial backoff on 403 (doubles each retry)
  },
  retries: {
    network: 3,
    rateLimit: 1,
    serverError: 2,
    forbidden: 2,             // retry 403 twice (5s + 10s backoff)
  },
  concurrency: {
    global: parseInt(process.env.SCRAPER_GLOBAL_CONCURRENCY ?? "8", 10),
    perAdapter: {
      GREENHOUSE: 8,
      LEVER: 8,
      SUCCESSFACTORS: 8,
      ICIMS: 4,
      WORKDAY: 3,
      ORACLE: 3,
      SMARTRECRUITERS: 5,
      EIGHTFOLD: 5,
    } as Record<string, number>,
    jobDetailConcurrency: 5,
    minRequestIntervalMs: 100,
    workdayMinIntervalMs: parseInt(process.env.SCRAPER_WORKDAY_INTERVAL_MS ?? "300", 10),
    workdayMaxJobsNoCountryFacet: parseInt(process.env.SCRAPER_WORKDAY_MAX_JOBS_NO_FACET ?? "5000", 10),
  },
  archiveAfterDays: 7,
  playwrightTimeout: 30000,
} as const;
