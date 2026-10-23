-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- Create one default chat session for every existing conversation so that
-- existing messages can be preserved during the relationship migration.
INSERT INTO "chat_sessions" ("conversation_id", "title", "created_at")
SELECT "id", "title", "created_at"
FROM "conversations";

-- Add the new relationship column before removing the old one.
ALTER TABLE "messages"
ADD COLUMN "chat_session_id" UUID;

UPDATE "messages" AS m
SET "chat_session_id" = cs."id"
FROM "chat_sessions" AS cs
WHERE cs."conversation_id" = m."conversation_id";

ALTER TABLE "messages"
ALTER COLUMN "chat_session_id" SET NOT NULL;

-- Replace the old foreign key and index with the chat-session relationship.
ALTER TABLE "messages"
DROP CONSTRAINT "messages_conversation_id_fkey";

DROP INDEX "messages_conversation_id_idx";

ALTER TABLE "messages"
DROP COLUMN "conversation_id";

-- CreateIndex
CREATE INDEX "chat_sessions_conversation_id_idx" ON "chat_sessions"("conversation_id");
CREATE INDEX "messages_chat_session_id_idx" ON "messages"("chat_session_id");

-- AddForeignKey
ALTER TABLE "chat_sessions"
ADD CONSTRAINT "chat_sessions_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messages"
ADD CONSTRAINT "messages_chat_session_id_fkey"
FOREIGN KEY ("chat_session_id") REFERENCES "chat_sessions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
