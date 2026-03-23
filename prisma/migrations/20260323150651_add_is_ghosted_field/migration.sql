-- AlterTable
ALTER TABLE "job_applications" ADD COLUMN     "isGhosted" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: sync isGhosted with existing closedReason='ghosted' records
UPDATE "job_applications" SET "isGhosted" = true WHERE "closedReason" = 'ghosted';
