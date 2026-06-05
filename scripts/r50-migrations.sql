-- R50 Migration: Add ValidationSession table + ensure User role/subscriptionPlan defaults
-- Safe for repeat execution (idempotent DDL)

-- 1. Ensure User table has role + subscriptionPlan with correct defaults
ALTER TABLE "User"
  ALTER COLUMN "role" SET DEFAULT 'customer',
  ALTER COLUMN "subscriptionPlan" SET DEFAULT 'BASIC';

-- Fill in any NULL roles
UPDATE "User" SET "role" = 'customer' WHERE "role" IS NULL;
UPDATE "User" SET "subscriptionPlan" = 'BASIC' WHERE "subscriptionPlan" IS NULL;

-- Make role NOT NULL now that defaults are set
ALTER TABLE "User" ALTER COLUMN "role" SET NOT NULL;

-- 2. Seed / restore demo users with correct roles
INSERT INTO "User" (email, name, role, "subscriptionPlan", "createdAt", "updatedAt")
VALUES
  ('admin@delegatecart.com',          'Rahul Singh',     'admin',               'AI_PLUS', NOW(), NOW()),
  ('analytics@delegatecart.com',      'Priya Sharma',    'analytics',            'BASIC',   NOW(), NOW()),
  ('aiplusdemo@delegatecart.com',     'Arjun Mehta',     'aiplus',               'AI_PLUS', NOW(), NOW()),
  ('observability@delegatecart.com',  'Vikram Patel',    'observability',        'BASIC',   NOW(), NOW()),
  ('reenforcedlearning@delegatecart.com', 'Neha Gupta',  'reinforced-learning',  'BASIC',   NOW(), NOW()),
  ('basicdemo@delegatecart.com',      'Amit Kumar',      'basic',                'BASIC',   NOW(), NOW())
ON CONFLICT (email)
DO UPDATE SET
  role             = EXCLUDED.role,
  "subscriptionPlan" = EXCLUDED."subscriptionPlan",
  name             = EXCLUDED.name,
  "updatedAt"      = NOW();

-- 3. Create ValidationSession table
CREATE TABLE IF NOT EXISTS "ValidationSession" (
  id              SERIAL PRIMARY KEY,
  "userId"        INTEGER REFERENCES "User"(id) ON DELETE SET NULL,
  "userExternalId" TEXT NOT NULL,
  "userEmail"     TEXT,
  "queryText"     TEXT NOT NULL,
  "sessionSource" TEXT NOT NULL DEFAULT 'smart-shopping-assistant',
  "productsJson"  JSONB NOT NULL DEFAULT '[]'::jsonb,
  "timelineJson"  JSONB,
  "feedbackJson"  JSONB NOT NULL DEFAULT '[]'::jsonb,
  "metricsJson"   JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vs_user_id_created
  ON "ValidationSession" ("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_vs_ext_id_created
  ON "ValidationSession" ("userExternalId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_vs_source_created
  ON "ValidationSession" ("sessionSource", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_vs_created
  ON "ValidationSession" ("createdAt" DESC);

-- 4. Also apply the smart_intent_validation_sessions migration (from 20260412)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.smart_intent_validation_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NULL REFERENCES "User"(id) ON DELETE SET NULL,
  user_external_id TEXT NOT NULL,
  user_email TEXT NULL,
  query_text TEXT NOT NULL,
  session_source TEXT NOT NULL DEFAULT 'smart-shopping-assistant',
  products_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  timeline_json JSONB NULL,
  feedback_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sivs_user_external_id
  ON public.smart_intent_validation_sessions(user_external_id);
CREATE INDEX IF NOT EXISTS idx_sivs_user_id
  ON public.smart_intent_validation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sivs_created_at
  ON public.smart_intent_validation_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sivs_query_text_trgm
  ON public.smart_intent_validation_sessions USING gin (query_text gin_trgm_ops);
