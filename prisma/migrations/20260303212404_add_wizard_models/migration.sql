-- AlterTable
ALTER TABLE "resume_generations" ADD COLUMN     "fitAnalysisJson" TEXT,
ADD COLUMN     "parentGenerationId" TEXT,
ADD COLUMN     "reviewJson" TEXT,
ADD COLUMN     "userAnswersJson" TEXT;

-- CreateTable
CREATE TABLE "resume_aux_calls" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobApplicationId" TEXT NOT NULL,
    "callType" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "modelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resume_aux_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fit_analysis_cache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobApplicationId" TEXT NOT NULL,
    "resumeSourceHash" TEXT NOT NULL,
    "jobDescriptionHash" TEXT NOT NULL,
    "analysisJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fit_analysis_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resume_aux_calls_userId_idx" ON "resume_aux_calls"("userId");

-- CreateIndex
CREATE INDEX "resume_aux_calls_jobApplicationId_idx" ON "resume_aux_calls"("jobApplicationId");

-- CreateIndex
CREATE UNIQUE INDEX "fit_analysis_cache_jobApplicationId_key" ON "fit_analysis_cache"("jobApplicationId");

-- CreateIndex
CREATE INDEX "fit_analysis_cache_userId_idx" ON "fit_analysis_cache"("userId");

-- AddForeignKey
ALTER TABLE "resume_generations" ADD CONSTRAINT "resume_generations_parentGenerationId_fkey" FOREIGN KEY ("parentGenerationId") REFERENCES "resume_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_aux_calls" ADD CONSTRAINT "resume_aux_calls_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_aux_calls" ADD CONSTRAINT "resume_aux_calls_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fit_analysis_cache" ADD CONSTRAINT "fit_analysis_cache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fit_analysis_cache" ADD CONSTRAINT "fit_analysis_cache_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
