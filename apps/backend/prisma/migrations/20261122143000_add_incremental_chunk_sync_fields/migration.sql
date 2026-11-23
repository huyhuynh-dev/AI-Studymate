-- Add version tracking and sync error fields to documents for Option 2 incremental re-chunking & re-embedding
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "content_version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "indexed_version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "sync_error" TEXT;

-- Backfill already-indexed documents so indexed_version matches content_version
UPDATE "documents"
SET "indexed_version" = "content_version"
WHERE "ocr_status" = 'done' AND "embed_status" = 'done' AND "indexed_version" = 0;

-- Add content_hash to document_chunks for content-addressed incremental chunk diffing
ALTER TABLE "document_chunks" ADD COLUMN IF NOT EXISTS "content_hash" VARCHAR(64);
CREATE INDEX IF NOT EXISTS "document_chunks_document_id_content_hash_idx"
  ON "document_chunks" ("document_id", "content_hash");
