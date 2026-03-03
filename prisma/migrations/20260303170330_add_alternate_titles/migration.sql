-- AlterTable
ALTER TABLE "resume_work_experiences" ADD COLUMN     "alternateTitles" TEXT[] DEFAULT ARRAY[]::TEXT[];
