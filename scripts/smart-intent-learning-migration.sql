-- SmartIntentEngineResponse migration
-- Self-learning & reinforcement learning system for Smart Assistant

-- Create the SmartIntentEngineResponse table
CREATE TABLE IF NOT EXISTS "SmartIntentEngineResponse" (
  id              SERIAL PRIMARY KEY,
  "userId"        INT REFERENCES "User"(id) ON DELETE SET NULL,
  "queryBy"       TEXT NOT NULL DEFAULT 'anonymous',
  "queryText"     TEXT NOT NULL,
  "initialProductSuggestionText" TEXT,
  "intentEngineResponse"  JSONB NOT NULL DEFAULT '{}',
  "supervisedResponse"    JSONB NOT NULL DEFAULT '{}',
  "aiEnrichedResponse"    JSONB,
  "enhancedByAI"          BOOLEAN NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sier_query_text ON "SmartIntentEngineResponse" USING gin (to_tsvector('english', "queryText"));
CREATE INDEX IF NOT EXISTS idx_sier_user_id ON "SmartIntentEngineResponse" ("userId");
CREATE INDEX IF NOT EXISTS idx_sier_enhanced ON "SmartIntentEngineResponse" ("enhancedByAI");
CREATE INDEX IF NOT EXISTS idx_sier_created ON "SmartIntentEngineResponse" ("createdAt" DESC);

-- Observability metrics table (persistent storage for admin dashboard)
CREATE TABLE IF NOT EXISTS "ObservabilityMetric" (
  id              SERIAL PRIMARY KEY,
  "metricType"    TEXT NOT NULL,  -- 'http_request', 'order', 'ai_request', 'wallet', 'error'
  "metricName"    TEXT NOT NULL,
  "metricValue"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "labels"        JSONB DEFAULT '{}',
  "timestamp"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_obs_type ON "ObservabilityMetric" ("metricType", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_obs_name ON "ObservabilityMetric" ("metricName", "timestamp" DESC);

-- WalletTransactionLog for persistent wallet transactions (moves from localStorage to DB)
CREATE TABLE IF NOT EXISTS "WalletTransactionLog" (
  id              TEXT PRIMARY KEY,
  "idempotencyKey" TEXT NOT NULL,
  "userId"        INT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "orderId"       TEXT,
  amount          DOUBLE PRECISION NOT NULL,
  state           TEXT NOT NULL DEFAULT 'initiated',
  "stateHistory"  JSONB NOT NULL DEFAULT '[]',
  "retryCount"    INT NOT NULL DEFAULT 0,
  "maxRetries"    INT NOT NULL DEFAULT 3,
  "failureReason" TEXT,
  "refundAmount"  DOUBLE PRECISION,
  "refundedAt"    TIMESTAMP WITH TIME ZONE,
  metadata        JSONB,
  "createdAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wtl_user ON "WalletTransactionLog" ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_wtl_state ON "WalletTransactionLog" (state);
CREATE INDEX IF NOT EXISTS idx_wtl_idempotency ON "WalletTransactionLog" ("idempotencyKey");

-- AuditLog table for persistent audit entries
CREATE TABLE IF NOT EXISTS "AuditLog" (
  id              TEXT PRIMARY KEY,
  "transactionId" TEXT,
  "userId"        INT REFERENCES "User"(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,
  "previousState" TEXT,
  "newState"      TEXT,
  amount          DOUBLE PRECISION NOT NULL DEFAULT 0,
  source          TEXT NOT NULL DEFAULT 'system',
  metadata        JSONB,
  suspicious      BOOLEAN NOT NULL DEFAULT false,
  reason          TEXT,
  "timestamp"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON "AuditLog" ("userId", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_suspicious ON "AuditLog" (suspicious) WHERE suspicious = true;
