-- AlterTable
ALTER TABLE "File" ADD COLUMN     "itemId" TEXT,
ADD COLUMN     "timelineEventId" TEXT;

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "bookId" TEXT,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "itemId" TEXT,
ADD COLUMN     "timelineEventId" TEXT;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "birthplaceVisibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
ADD COLUMN     "dobVisibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
ADD COLUMN     "fullNameVisibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
ADD COLUMN     "languagesVisibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
ADD COLUMN     "nationalityVisibility" "Visibility" NOT NULL DEFAULT 'PRIVATE';

-- CreateTable
CREATE TABLE "Letter" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Letter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Letter_recipientId_idx" ON "Letter"("recipientId");

-- CreateIndex
CREATE INDEX "Letter_senderId_idx" ON "Letter"("senderId");

-- CreateIndex
CREATE INDEX "File_timelineEventId_idx" ON "File"("timelineEventId");

-- CreateIndex
CREATE INDEX "File_itemId_idx" ON "File"("itemId");

-- CreateIndex
CREATE INDEX "Photo_timelineEventId_idx" ON "Photo"("timelineEventId");

-- CreateIndex
CREATE INDEX "Photo_bookId_idx" ON "Photo"("bookId");

-- CreateIndex
CREATE INDEX "Photo_itemId_idx" ON "Photo"("itemId");

-- AddForeignKey
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_timelineEventId_fkey" FOREIGN KEY ("timelineEventId") REFERENCES "TimelineEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_timelineEventId_fkey" FOREIGN KEY ("timelineEventId") REFERENCES "TimelineEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
