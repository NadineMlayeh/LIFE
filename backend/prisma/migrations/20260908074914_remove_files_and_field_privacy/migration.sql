-- AlterEnum
BEGIN;
CREATE TYPE "ItemType_new" AS ENUM ('PERSON', 'PLACE', 'MEMORY', 'EVENT', 'ACHIEVEMENT', 'NOTE', 'PHOTO', 'CUSTOM');
ALTER TABLE "Item" ALTER COLUMN "type" TYPE "ItemType_new" USING ("type"::text::"ItemType_new");
ALTER TYPE "ItemType" RENAME TO "ItemType_old";
ALTER TYPE "ItemType_new" RENAME TO "ItemType";
DROP TYPE "public"."ItemType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_itemId_fkey";

-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_timelineEventId_fkey";

-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_userId_fkey";

-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "birthplaceVisibility",
DROP COLUMN "dobVisibility",
DROP COLUMN "fullNameVisibility",
DROP COLUMN "languagesVisibility",
DROP COLUMN "nationalityVisibility";

-- DropTable
DROP TABLE "File";

