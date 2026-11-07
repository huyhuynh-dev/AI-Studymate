/*
  Warnings:

  - The primary key for the `messages` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `content` on the `messages` table. All the data in the column will be lost.
  - Added the required column `message_json` to the `messages` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "card_state_enum" ADD VALUE 'relearning';

-- DropIndex
DROP INDEX "document_chunks_content_pgroonga_idx";

-- AlterTable
ALTER TABLE "messages" DROP CONSTRAINT "messages_pkey",
DROP COLUMN "content",
ADD COLUMN     "message_json" JSONB NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE VARCHAR(255),
ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");
