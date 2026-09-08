-- Photograph bytes, for deployments with no object storage configured. Its own table so that
-- listing an album does not drag image data along with the captions.
CREATE TABLE "StoredFile" (
  "path" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("path")
);
