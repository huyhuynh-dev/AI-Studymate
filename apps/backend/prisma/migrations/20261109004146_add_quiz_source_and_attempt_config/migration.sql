-- AlterTable
ALTER TABLE "quiz_attempts" ADD COLUMN     "config" JSONB NOT NULL DEFAULT '{}',
ALTER COLUMN "completed_at" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "quizzes" ADD COLUMN     "source" VARCHAR(20) NOT NULL DEFAULT 'manual';
