-- Books are for writing only. Photos no longer hang off a book; the gallery is the one place
-- images live.
ALTER TABLE "Photo" DROP CONSTRAINT "Photo_bookId_fkey";
DROP INDEX "Photo_bookId_idx";
ALTER TABLE "Photo" DROP COLUMN "bookId";
