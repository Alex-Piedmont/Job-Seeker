-- CreateTable
CREATE TABLE "scrape_logs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "ScrapeStatus" NOT NULL,
    "error" TEXT,
    "durationMs" INTEGER,
    "jobsFound" INTEGER,
    "jobsAdded" INTEGER,
    "jobsUpdated" INTEGER,
    "jobsRemoved" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scrape_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scrape_logs_companyId_idx" ON "scrape_logs"("companyId");

-- CreateIndex
CREATE INDEX "scrape_logs_status_idx" ON "scrape_logs"("status");

-- CreateIndex
CREATE INDEX "scrape_logs_createdAt_idx" ON "scrape_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "scrape_logs" ADD CONSTRAINT "scrape_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
