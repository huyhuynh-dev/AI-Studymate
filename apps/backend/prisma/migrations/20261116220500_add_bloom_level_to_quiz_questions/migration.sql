-- Add nullable bloom_level column to quiz_questions for Bloom's Taxonomy tracking
ALTER TABLE "quiz_questions" ADD COLUMN IF NOT EXISTS "bloom_level" VARCHAR(20);
