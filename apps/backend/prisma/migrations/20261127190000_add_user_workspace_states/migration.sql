-- Create user_workspace_states table for cross-device account workspace state persistence
CREATE TABLE IF NOT EXISTS "user_workspace_states" (
    "user_id" UUID NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "location_json" JSONB,
    "location_source_id" VARCHAR(64),
    "location_seq" INTEGER NOT NULL DEFAULT 0,
    "location_updated_at" TIMESTAMPTZ(6),
    "layout_json" JSONB,
    "layout_source_id" VARCHAR(64),
    "layout_seq" INTEGER NOT NULL DEFAULT 0,
    "layout_updated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_workspace_states_pkey" PRIMARY KEY ("user_id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_workspace_states_user_id_fkey'
  ) THEN
    ALTER TABLE "user_workspace_states"
      ADD CONSTRAINT "user_workspace_states_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
