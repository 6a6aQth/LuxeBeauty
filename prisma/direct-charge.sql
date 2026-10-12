-- Renames the customer ticket and adds the payments table.
-- Run this against Neon before `prisma db push` so existing ticket ids are kept.

ALTER TABLE "Booking" RENAME COLUMN "ticketId" TO "reference";

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "submitToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Booking_submitToken_key" ON "Booking"("submitToken");
ALTER TABLE "Booking" ALTER COLUMN "status" SET DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS "Payment" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "customerName" TEXT,
  "method" TEXT NOT NULL,
  "mobile" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "ids" JSONB,
  "bankDetails" JSONB,
  "note" TEXT,
  "lastVerifiedAt" TIMESTAMP(3),
  "finalizedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_bookingId_key" ON "Payment"("bookingId");
CREATE INDEX IF NOT EXISTS "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");
