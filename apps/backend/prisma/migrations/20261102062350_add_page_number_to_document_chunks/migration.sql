-- DropIndex
DROP INDEX "document_chunks_embedding_idx";

-- AlterTable
ALTER TABLE "document_chunks" ADD COLUMN     "page_number" INTEGER;
