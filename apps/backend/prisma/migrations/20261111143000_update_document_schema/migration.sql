-- Normalize processing state columns to PostgreSQL enums.
DO $$ BEGIN
    CREATE TYPE "ProcessingStatus" AS ENUM ('pending', 'processing', 'done', 'failed');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "ChunkType" AS ENUM ('text', 'table', 'code', 'formula', 'image_desc', 'mixed');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "documents"
    ALTER COLUMN "ocr_status" DROP DEFAULT,
    ALTER COLUMN "ocr_status" TYPE "ProcessingStatus"
        USING "ocr_status"::text::"ProcessingStatus",
    ALTER COLUMN "ocr_status" SET DEFAULT 'pending',
    ALTER COLUMN "embed_status" DROP DEFAULT,
    ALTER COLUMN "embed_status" TYPE "ProcessingStatus"
        USING "embed_status"::text::"ProcessingStatus",
    ALTER COLUMN "embed_status" SET DEFAULT 'pending';

ALTER TABLE "documents"
    ADD COLUMN "file_hash" VARCHAR(64),
    ADD COLUMN "docling_json_key" VARCHAR(1000),
    ADD COLUMN "page_count" INTEGER,
    ADD COLUMN "doc_metadata" JSONB;

ALTER TABLE "document_chunks"
    ADD COLUMN "raw_content" TEXT,
    ADD COLUMN "token_count" INTEGER,
    ADD COLUMN "chunk_type" "ChunkType" NOT NULL DEFAULT 'text',
    ADD COLUMN "headings" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "has_image" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "has_table" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "bboxes" JSONB,
    ADD COLUMN "chunk_metadata" JSONB;

ALTER TABLE "document_chunks"
    ADD CONSTRAINT "document_chunks_document_id_chunk_index_key"
        UNIQUE ("document_id", "chunk_index");

CREATE INDEX "documents_conversation_id_embed_status_idx"
    ON "documents" ("conversation_id", "embed_status");
CREATE INDEX "documents_user_id_idx" ON "documents" ("user_id");
CREATE INDEX "documents_file_hash_idx" ON "documents" ("file_hash");
CREATE INDEX "document_chunks_page_numbers_idx"
    ON "document_chunks" USING GIN ("page_numbers");

CREATE TABLE "document_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "chunk_id" UUID,
    "asset_type" VARCHAR(50) NOT NULL,
    "self_ref" VARCHAR(100),
    "page_no" INTEGER,
    "bbox" JSONB,
    "storage_key" VARCHAR(1000) NOT NULL,
    "caption" TEXT,
    "vlm_description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_assets_document_id_page_no_idx"
    ON "document_assets" ("document_id", "page_no");
CREATE INDEX "document_assets_chunk_id_idx"
    ON "document_assets" ("chunk_id");

ALTER TABLE "document_assets"
    ADD CONSTRAINT "document_assets_document_id_fkey"
        FOREIGN KEY ("document_id") REFERENCES "documents"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "document_assets_chunk_id_fkey"
        FOREIGN KEY ("chunk_id") REFERENCES "document_chunks"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
