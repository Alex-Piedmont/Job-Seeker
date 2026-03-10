export interface ScrapedJobData {
  externalJobId: string;
  title: string;
  url: string;
  department: string | null;
  locations: string[];
  locationType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  jobDescriptionHtml: string;
  postedAt: string | null;       // ISO date string from ATS (e.g. "2026-03-08")
  postingEndDate: string | null;  // ISO date string when listing expires
}

export interface ExistingJobRecord {
  externalJobId: string;
  title: string;
  contentHash: string | null;
}

export interface AtsAdapter {
  listJobs(
    company: {
      id: string;
      name: string;
      baseUrl: string;
      atsPlatform: string;
      lastScrapeAt: Date | null;
    },
    existingJobs?: Map<string, ExistingJobRecord>,
  ): Promise<ScrapedJobData[]>;
}
