-- AlterTable
ALTER TABLE "resume_sources" ADD COLUMN     "miscellaneous" TEXT;

-- CreateTable
CREATE TABLE "resume_custom_sections" (
    "id" TEXT NOT NULL,
    "resumeSourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resume_custom_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resume_custom_sections_resumeSourceId_idx" ON "resume_custom_sections"("resumeSourceId");

-- AddForeignKey
ALTER TABLE "resume_custom_sections" ADD CONSTRAINT "resume_custom_sections_resumeSourceId_fkey" FOREIGN KEY ("resumeSourceId") REFERENCES "resume_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
