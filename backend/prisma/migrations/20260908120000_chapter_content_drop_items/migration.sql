-- A chapter is now written freely as one page. The `Item` level between chapter and content
-- was removed at the owner's direction: book > chapter > content.

ALTER TABLE "Chapter" ADD COLUMN "content" TEXT;

-- Fold any existing entries into their chapter's page so no writing is lost.
UPDATE "Chapter" c
SET "content" = sub.txt
FROM (
  SELECT "chapterId",
         string_agg(
           CASE WHEN "body" IS NULL OR "body" = ''
                THEN "title"
                ELSE "title" || E'\n' || "body"
           END,
           E'\n\n' ORDER BY "createdAt"
         ) AS txt
  FROM "Item"
  GROUP BY "chapterId"
) sub
WHERE c."id" = sub."chapterId";

-- Photos no longer hang off an item.
ALTER TABLE "Photo" DROP CONSTRAINT "Photo_itemId_fkey";
DROP INDEX "Photo_itemId_idx";
ALTER TABLE "Photo" DROP COLUMN "itemId";

DROP TABLE "Item";
DROP TYPE "ItemType";
