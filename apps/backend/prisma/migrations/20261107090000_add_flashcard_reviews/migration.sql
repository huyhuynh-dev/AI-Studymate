-- CreateTable
CREATE TABLE "flashcard_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "flashcard_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,
    "state_before" "card_state_enum",
    "time_taken_ms" INTEGER,
    "reviewed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flashcard_reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "flashcard_reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 4)
);

-- CreateIndex
CREATE INDEX "idx_reviews_user_date" ON "flashcard_reviews"("user_id", "reviewed_at");

-- CreateIndex
CREATE INDEX "idx_reviews_flashcard_id" ON "flashcard_reviews"("flashcard_id");

-- AddForeignKey
ALTER TABLE "flashcard_reviews"
    ADD CONSTRAINT "flashcard_reviews_flashcard_id_fkey"
    FOREIGN KEY ("flashcard_id") REFERENCES "flashcards"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcard_reviews"
    ADD CONSTRAINT "flashcard_reviews_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
