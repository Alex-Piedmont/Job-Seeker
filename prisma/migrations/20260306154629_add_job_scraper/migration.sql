-- CreateEnum
CREATE TYPE "AtsPlatform" AS ENUM ('GREENHOUSE', 'LEVER', 'WORKDAY', 'ICIMS');

-- CreateEnum
CREATE TYPE "ScrapeStatus" AS ENUM ('SUCCESS', 'PARTIAL_FAILURE', 'FAILURE', 'PENDING');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "atsPlatform" "AtsPlatform" NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastScrapeAt" TIMESTAMP(3),
    "scrapeStatus" "ScrapeStatus" NOT NULL DEFAULT 'PENDING',
    "scrapeError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraped_jobs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "externalJobId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "department" TEXT,
    "locations" JSONB NOT NULL DEFAULT '[]',
    "locationType" TEXT,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salaryCurrency" TEXT NOT NULL DEFAULT 'USD',
    "jobDescriptionMd" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "scraped_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_job_archives" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scrapedJobId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_job_archives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_name_key" ON "companies"("name");

-- CreateIndex
CREATE INDEX "companies_enabled_idx" ON "companies"("enabled");

-- CreateIndex
CREATE INDEX "scraped_jobs_companyId_idx" ON "scraped_jobs"("companyId");

-- CreateIndex
CREATE INDEX "scraped_jobs_removedAt_idx" ON "scraped_jobs"("removedAt");

-- CreateIndex
CREATE INDEX "scraped_jobs_archivedAt_idx" ON "scraped_jobs"("archivedAt");

-- CreateIndex
CREATE INDEX "scraped_jobs_firstSeenAt_idx" ON "scraped_jobs"("firstSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "scraped_jobs_companyId_externalJobId_key" ON "scraped_jobs"("companyId", "externalJobId");

-- CreateIndex
CREATE INDEX "user_job_archives_userId_idx" ON "user_job_archives"("userId");

-- CreateIndex
CREATE INDEX "user_job_archives_scrapedJobId_idx" ON "user_job_archives"("scrapedJobId");

-- CreateIndex
CREATE UNIQUE INDEX "user_job_archives_userId_scrapedJobId_key" ON "user_job_archives"("userId", "scrapedJobId");

-- AddForeignKey
ALTER TABLE "scraped_jobs" ADD CONSTRAINT "scraped_jobs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_job_archives" ADD CONSTRAINT "user_job_archives_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_job_archives" ADD CONSTRAINT "user_job_archives_scrapedJobId_fkey" FOREIGN KEY ("scrapedJobId") REFERENCES "scraped_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
