-- AlterTable
ALTER TABLE "CustomerProfile" ADD COLUMN IF NOT EXISTS "blocked" BOOLEAN NOT NULL DEFAULT false;

