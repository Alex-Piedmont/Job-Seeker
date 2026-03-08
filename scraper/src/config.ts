import "dotenv/config";

export const config = {
  databaseUrl: process.env.DATABASE_URL!,
  userAgent: "JobSeekerBot/1.0 (+https://jobseeker.app/bot)",
  delays: {
    betweenRequests: 500,     // 500ms between API requests
    betweenPages: 2500,       // 2.5s between Playwright page navigations
    rateLimitWait: 60000,     // 60s wait on 429
  },
  retries: {
    network: 3,
    rateLimit: 1,
    serverError: 2,
  },
  archiveAfterDays: 7,
  playwrightTimeout: 30000,
} as const;
