-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "content" TEXT NOT NULL,
    "source_chunks" UUID[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "summaries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "document_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "content_json" JSONB NOT NULL,
    "pdf_storage_key" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");
CREATE INDEX "summaries_conversation_id_idx" ON "summaries"("conversation_id");
CREATE INDEX "summaries_document_id_idx" ON "summaries"("document_id");

-- AddForeignKey
ALTER TABLE "messages"
ADD CONSTRAINT "messages_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "summaries"
ADD CONSTRAINT "summaries_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "summaries"
ADD CONSTRAINT "summaries_document_id_fkey"
FOREIGN KEY ("document_id") REFERENCES "documents"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

COMMENT ON COLUMN "messages"."role" IS '''user'' | ''assistant''';
COMMENT ON COLUMN "messages"."source_chunks" IS 'chunk IDs dùng làm context';
COMMENT ON COLUMN "summaries"."document_id" IS 'NULL = tóm tắt toàn bộ conversation';
COMMENT ON COLUMN "summaries"."content_json" IS 'BlockNote JSON format';
COMMENT ON COLUMN "summaries"."pdf_storage_key" IS 'key PDF đã export, NULL nếu chưa export';
