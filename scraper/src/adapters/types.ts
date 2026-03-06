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
}

export interface AtsAdapter {
  listJobs(company: {
    id: string;
    name: string;
    baseUrl: string;
  }): Promise<ScrapedJobData[]>;
}
