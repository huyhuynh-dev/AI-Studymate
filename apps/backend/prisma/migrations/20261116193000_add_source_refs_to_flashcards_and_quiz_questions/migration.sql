-- Add source_refs JSONB column to flashcards and quiz_questions for Chunk-Grounded references
ALTER TABLE "flashcards" ADD COLUMN IF NOT EXISTS "source_refs" JSONB;
ALTER TABLE "quiz_questions" ADD COLUMN IF NOT EXISTS "source_refs" JSONB;
