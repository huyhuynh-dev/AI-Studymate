-- CreateEnum
CREATE TYPE "question_type_enum" AS ENUM ('single_choice', 'multiple_choice', 'true_false', 'short_answer', 'essay');

-- CreateEnum
CREATE TYPE "attempt_status_enum" AS ENUM ('in_progress', 'grading', 'submitted');

-- CreateEnum
CREATE TYPE "evaluation_status_enum" AS ENUM ('pending', 'correct', 'partial', 'incorrect');

-- CreateTable
CREATE TABLE "quizzes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source_deck_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "time_limit_sec" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quiz_id" UUID NOT NULL,
    "question_type" "question_type_enum" NOT NULL DEFAULT 'single_choice',
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "question_text" TEXT NOT NULL,
    "image_url" TEXT,
    "audio_url" TEXT,
    "points" REAL NOT NULL DEFAULT 1.0,
    "options" JSONB,
    "sample_answer" TEXT,
    "grading_criteria" JSONB NOT NULL DEFAULT '[]',
    "explanation" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quiz_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "attempt_status_enum" NOT NULL DEFAULT 'in_progress',
    "score" REAL NOT NULL DEFAULT 0,
    "max_score" REAL NOT NULL DEFAULT 0,
    "time_spent_sec" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempt_answers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "selected_option_ids" JSONB NOT NULL DEFAULT '[]',
    "text_answer" TEXT,
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "evaluation_status" "evaluation_status_enum" NOT NULL DEFAULT 'pending',
    "points_earned" REAL NOT NULL DEFAULT 0,
    "matched_points" JSONB NOT NULL DEFAULT '[]',
    "missing_points" JSONB NOT NULL DEFAULT '[]',
    "ai_feedback" TEXT,
    "answered_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_attempt_answers_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraints
ALTER TABLE "quizzes"
    ADD CONSTRAINT "quizzes_time_limit_sec_check"
    CHECK ("time_limit_sec" IS NULL OR "time_limit_sec" > 0);

ALTER TABLE "quiz_questions"
    ADD CONSTRAINT "quiz_questions_points_check"
    CHECK ("points" > 0);

ALTER TABLE "quiz_attempts"
    ADD CONSTRAINT "quiz_attempts_score_check"
    CHECK ("score" >= 0),
    ADD CONSTRAINT "quiz_attempts_max_score_check"
    CHECK ("max_score" >= 0),
    ADD CONSTRAINT "quiz_attempts_time_spent_sec_check"
    CHECK ("time_spent_sec" >= 0);

ALTER TABLE "quiz_attempt_answers"
    ADD CONSTRAINT "quiz_attempt_answers_points_earned_check"
    CHECK ("points_earned" >= 0);

-- CreateIndex
CREATE INDEX "idx_quizzes_conversation_id" ON "quizzes"("conversation_id");

-- CreateIndex
CREATE INDEX "idx_quizzes_user_id" ON "quizzes"("user_id");

-- CreateIndex
CREATE INDEX "idx_quizzes_source_deck_id" ON "quizzes"("source_deck_id");

-- CreateIndex
CREATE INDEX "idx_quiz_questions_quiz_order" ON "quiz_questions"("quiz_id", "order_index");

-- CreateIndex
CREATE INDEX "idx_quiz_attempts_user_quiz" ON "quiz_attempts"("quiz_id", "user_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "idx_attempt_answers_attempt_id" ON "quiz_attempt_answers"("attempt_id");

-- CreateIndex
CREATE INDEX "idx_attempt_answers_question_id" ON "quiz_attempt_answers"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_attempt_question" ON "quiz_attempt_answers"("attempt_id", "question_id");

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_source_deck_id_fkey" FOREIGN KEY ("source_deck_id") REFERENCES "flashcard_decks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempt_answers" ADD CONSTRAINT "quiz_attempt_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "quiz_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempt_answers" ADD CONSTRAINT "quiz_attempt_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
