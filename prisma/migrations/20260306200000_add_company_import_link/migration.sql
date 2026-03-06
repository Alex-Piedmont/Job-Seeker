-- AlterTable
ALTER TABLE "companies" ADD COLUMN "isRemoved" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "job_applications" ADD COLUMN "scrapedJobId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "job_applications_userId_scrapedJobId_key" ON "job_applications"("userId", "scrapedJobId");

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_scrapedJobId_fkey" FOREIGN KEY ("scrapedJobId") REFERENCES "scraped_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
