-- 20260412_validation_analytics
-- Purpose: persist per-query validation artifacts for historical analytics and trust auditing.
-- Safe for repeat execution in production (idempotent DDL).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.smart_intent_validation_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NULL REFERENCES "User"(id) ON DELETE SET NULL,
  user_external_id TEXT NOT NULL,
  user_email TEXT NULL,
  query_text TEXT NOT NULL,
  session_source TEXT NOT NULL DEFAULT 'smart-shopping-assistant',
  products_json JSONB NOT NULL,
  timeline_json JSONB NULL,
  feedback_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validation_sessions_user_external_id
  ON public.smart_intent_validation_sessions(user_external_id);

CREATE INDEX IF NOT EXISTS idx_validation_sessions_user_id
  ON public.smart_intent_validation_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_validation_sessions_created_at
  ON public.smart_intent_validation_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_validation_sessions_query_text_trgm
  ON public.smart_intent_validation_sessions USING gin (query_text gin_trgm_ops);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_validation_sessions_updated_at'
  ) THEN
    CREATE FUNCTION public.set_validation_sessions_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $func$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $func$;

    CREATE TRIGGER trg_validation_sessions_updated_at
      BEFORE UPDATE ON public.smart_intent_validation_sessions
      FOR EACH ROW
      EXECUTE FUNCTION public.set_validation_sessions_updated_at();
  END IF;
END $$;
