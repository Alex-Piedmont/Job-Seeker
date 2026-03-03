-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "applicationCap" INTEGER NOT NULL DEFAULT 200,
    "resumeGenerationCap" INTEGER NOT NULL DEFAULT 5,
    "resumeGenerationsUsedThisMonth" INTEGER NOT NULL DEFAULT 0,
    "capResetAt" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "kanban_columns" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "columnType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kanban_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_applications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serialNumber" INTEGER NOT NULL,
    "columnId" TEXT NOT NULL,
    "columnOrder" INTEGER NOT NULL DEFAULT 0,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "hiringManager" TEXT,
    "hiringOrg" TEXT,
    "postingNumber" TEXT,
    "postingUrl" TEXT,
    "locationType" TEXT,
    "primaryLocation" TEXT,
    "additionalLocations" TEXT,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "bonusTargetPct" DOUBLE PRECISION,
    "variableComp" INTEGER,
    "referrals" TEXT,
    "datePosted" TIMESTAMP(3),
    "dateApplied" TIMESTAMP(3),
    "rejectionDate" TIMESTAMP(3),
    "jobDescription" TEXT,
    "closedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_records" (
    "id" TEXT NOT NULL,
    "jobApplicationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "people" TEXT,
    "date" TIMESTAMP(3),
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_status_logs" (
    "id" TEXT NOT NULL,
    "jobApplicationId" TEXT NOT NULL,
    "fromColumnId" TEXT,
    "toColumnId" TEXT NOT NULL,
    "movedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_notes" (
    "id" TEXT NOT NULL,
    "jobApplicationId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_sources" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resume_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_contacts" (
    "id" TEXT NOT NULL,
    "resumeSourceId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "location" TEXT,
    "linkedIn" TEXT,
    "website" TEXT,
    "summary" TEXT,

    CONSTRAINT "resume_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_education" (
    "id" TEXT NOT NULL,
    "resumeSourceId" TEXT NOT NULL,
    "institution" TEXT NOT NULL DEFAULT '',
    "degree" TEXT NOT NULL DEFAULT '',
    "fieldOfStudy" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "gpa" TEXT,
    "honors" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "resume_education_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_work_experiences" (
    "id" TEXT NOT NULL,
    "resumeSourceId" TEXT NOT NULL,
    "company" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "location" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "resume_work_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_work_subsections" (
    "id" TEXT NOT NULL,
    "workExperienceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "bullets" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "resume_work_subsections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_skills" (
    "id" TEXT NOT NULL,
    "resumeSourceId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "items" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "resume_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_publications" (
    "id" TEXT NOT NULL,
    "resumeSourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publisher" TEXT,
    "date" TEXT,
    "url" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "resume_publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_generations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobApplicationId" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "markdownOutput" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resume_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_lastActiveAt_idx" ON "users"("lastActiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "kanban_columns_userId_name_key" ON "kanban_columns"("userId", "name");

-- CreateIndex
CREATE INDEX "job_applications_columnId_idx" ON "job_applications"("columnId");

-- CreateIndex
CREATE INDEX "job_applications_userId_idx" ON "job_applications"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "job_applications_userId_serialNumber_key" ON "job_applications"("userId", "serialNumber");

-- CreateIndex
CREATE INDEX "interview_records_jobApplicationId_idx" ON "interview_records"("jobApplicationId");

-- CreateIndex
CREATE INDEX "application_status_logs_jobApplicationId_movedAt_idx" ON "application_status_logs"("jobApplicationId", "movedAt");

-- CreateIndex
CREATE INDEX "application_notes_jobApplicationId_idx" ON "application_notes"("jobApplicationId");

-- CreateIndex
CREATE UNIQUE INDEX "resume_sources_userId_key" ON "resume_sources"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "resume_contacts_resumeSourceId_key" ON "resume_contacts"("resumeSourceId");

-- CreateIndex
CREATE INDEX "resume_education_resumeSourceId_idx" ON "resume_education"("resumeSourceId");

-- CreateIndex
CREATE INDEX "resume_work_experiences_resumeSourceId_idx" ON "resume_work_experiences"("resumeSourceId");

-- CreateIndex
CREATE INDEX "resume_work_subsections_workExperienceId_idx" ON "resume_work_subsections"("workExperienceId");

-- CreateIndex
CREATE INDEX "resume_skills_resumeSourceId_idx" ON "resume_skills"("resumeSourceId");

-- CreateIndex
CREATE INDEX "resume_publications_resumeSourceId_idx" ON "resume_publications"("resumeSourceId");

-- CreateIndex
CREATE INDEX "resume_generations_userId_idx" ON "resume_generations"("userId");

-- CreateIndex
CREATE INDEX "resume_generations_jobApplicationId_idx" ON "resume_generations"("jobApplicationId");

-- CreateIndex
CREATE INDEX "resume_generations_createdAt_idx" ON "resume_generations"("createdAt");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_columns" ADD CONSTRAINT "kanban_columns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "kanban_columns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_records" ADD CONSTRAINT "interview_records_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_status_logs" ADD CONSTRAINT "application_status_logs_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_notes" ADD CONSTRAINT "application_notes_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_sources" ADD CONSTRAINT "resume_sources_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_contacts" ADD CONSTRAINT "resume_contacts_resumeSourceId_fkey" FOREIGN KEY ("resumeSourceId") REFERENCES "resume_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_education" ADD CONSTRAINT "resume_education_resumeSourceId_fkey" FOREIGN KEY ("resumeSourceId") REFERENCES "resume_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_work_experiences" ADD CONSTRAINT "resume_work_experiences_resumeSourceId_fkey" FOREIGN KEY ("resumeSourceId") REFERENCES "resume_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_work_subsections" ADD CONSTRAINT "resume_work_subsections_workExperienceId_fkey" FOREIGN KEY ("workExperienceId") REFERENCES "resume_work_experiences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_skills" ADD CONSTRAINT "resume_skills_resumeSourceId_fkey" FOREIGN KEY ("resumeSourceId") REFERENCES "resume_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_publications" ADD CONSTRAINT "resume_publications_resumeSourceId_fkey" FOREIGN KEY ("resumeSourceId") REFERENCES "resume_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_generations" ADD CONSTRAINT "resume_generations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_generations" ADD CONSTRAINT "resume_generations_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

