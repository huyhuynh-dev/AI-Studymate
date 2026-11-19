-- Add daily_goal_minutes to users and exam_date, target_score to subjects for Study Coach & Exam Readiness analytics
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "daily_goal_minutes" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "subjects" ADD COLUMN IF NOT EXISTS "exam_date" DATE;
ALTER TABLE "subjects" ADD COLUMN IF NOT EXISTS "target_score" SMALLINT;
