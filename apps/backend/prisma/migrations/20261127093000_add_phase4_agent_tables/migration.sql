-- Phase 4: User Preferences, Agent Action Audit Logs (HITL & Undo), Async Background Jobs, and Agent Traces

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferences" JSONB NOT NULL DEFAULT '{}';

DO $$ BEGIN
    CREATE TYPE "agent_action_risk_tier" AS ENUM ('tier_1', 'tier_2');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "agent_action_status" AS ENUM ('executed', 'undone', 'denied', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "agent_background_job_status" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "agent_action_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "conversation_id" UUID,
    "chat_session_id" UUID,
    "tool_call_id" VARCHAR(128),
    "tool_name" VARCHAR(80) NOT NULL,
    "action_name" VARCHAR(80) NOT NULL,
    "risk_tier" "agent_action_risk_tier" NOT NULL DEFAULT 'tier_1',
    "status" "agent_action_status" NOT NULL DEFAULT 'executed',
    "resource_type" VARCHAR(40) NOT NULL,
    "resource_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "summary_text" VARCHAR(500) NOT NULL,
    "before_state" JSONB,
    "after_state" JSONB,
    "undoable" BOOLEAN NOT NULL DEFAULT true,
    "undone_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_action_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "agent_action_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_agent_action_logs_user_date" ON "agent_action_logs"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_agent_action_logs_session" ON "agent_action_logs"("chat_session_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_agent_action_logs_conversation" ON "agent_action_logs"("conversation_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "agent_background_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "chat_session_id" UUID,
    "job_type" VARCHAR(60) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "status" "agent_background_job_status" NOT NULL DEFAULT 'queued',
    "progress_percent" INTEGER NOT NULL DEFAULT 0,
    "total_steps" INTEGER NOT NULL DEFAULT 1,
    "completed_steps" INTEGER NOT NULL DEFAULT 0,
    "step_logs" JSONB NOT NULL DEFAULT '[]',
    "payload_json" JSONB NOT NULL,
    "result_json" JSONB,
    "error_message" TEXT,
    "bullmq_job_id" VARCHAR(128),
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_background_jobs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "agent_background_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_agent_bg_jobs_user_date" ON "agent_background_jobs"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_agent_bg_jobs_conv_status" ON "agent_background_jobs"("conversation_id", "status");

CREATE TABLE IF NOT EXISTS "agent_traces" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trace_id" VARCHAR(64) NOT NULL,
    "user_id" UUID,
    "conversation_id" UUID,
    "chat_session_id" UUID,
    "model_name" VARCHAR(120) NOT NULL,
    "prompt_version" VARCHAR(40) NOT NULL,
    "ui_page_type" VARCHAR(40),
    "step_count" INTEGER NOT NULL DEFAULT 0,
    "tool_calls_count" INTEGER NOT NULL DEFAULT 0,
    "tool_errors_count" INTEGER NOT NULL DEFAULT 0,
    "hitl_approvals_count" INTEGER NOT NULL DEFAULT 0,
    "compacted" BOOLEAN NOT NULL DEFAULT false,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_read_tokens" INTEGER NOT NULL DEFAULT 0,
    "estimated_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'success',
    "spans_json" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_traces_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "agent_traces_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "agent_traces_trace_id_key" ON "agent_traces"("trace_id");
CREATE INDEX IF NOT EXISTS "idx_agent_traces_session" ON "agent_traces"("chat_session_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_agent_traces_created_at" ON "agent_traces"("created_at" DESC);
