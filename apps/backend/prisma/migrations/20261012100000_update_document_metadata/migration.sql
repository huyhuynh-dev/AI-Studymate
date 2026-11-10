-- Rename the existing type column without losing stored MIME values.
ALTER TABLE "documents" RENAME COLUMN "file_type" TO "mime_type";

ALTER TABLE "documents"
  ALTER COLUMN "mime_type" TYPE VARCHAR(100),
  ADD COLUMN "processing_error" TEXT,
  ADD COLUMN "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
