-- Drop existing ivfflat index before altering vector dimension
DROP INDEX IF EXISTS "document_chunks_embedding_idx";

-- Update embedding column dimension from vector(1536) to vector(768) for Gemini text-embedding-004
ALTER TABLE "document_chunks"
  ALTER COLUMN "embedding" TYPE vector(768) USING NULL;

-- Recreate ivfflat index for cosine similarity search
CREATE INDEX "document_chunks_embedding_idx"
ON "document_chunks"
USING ivfflat ("embedding" vector_cosine_ops)
WITH (lists = 100);
