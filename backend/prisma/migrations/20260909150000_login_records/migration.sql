-- Record when an account last signed in, and how often it ever has.
-- Both are nullable or defaulted, so this applies to existing rows without a backfill.
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "loginCount" INTEGER NOT NULL DEFAULT 0;
