-- CreateTable: ai_usage_logs for non-blocking AI token, cost, and latency telemetry
CREATE TABLE IF NOT EXISTS "ai_usage_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "feature_key" VARCHAR(60) NOT NULL,
    "profile" VARCHAR(30) NOT NULL,
    "model_name" VARCHAR(120) NOT NULL,
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "completion_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "estimated_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'success',
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_ai_usage_logs_created_at" ON "ai_usage_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_ai_usage_logs_feature_date" ON "ai_usage_logs"("feature_key", "created_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_ai_usage_logs_user_date" ON "ai_usage_logs"("user_id", "created_at" DESC);

-- AddForeignKey (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ai_usage_logs_user_id_fkey'
    ) THEN
        ALTER TABLE "ai_usage_logs"
            ADD CONSTRAINT "ai_usage_logs_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;
