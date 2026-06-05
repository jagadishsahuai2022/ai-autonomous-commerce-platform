-- ============================================================
-- DelegateCart: Full Profile & Address Schema Migration
-- Adds all missing User profile columns + creates UserAddress table
-- Safe to re-run (idempotent: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- ============================================================

BEGIN;

-- ── Extend User table with all profile fields ─────────────────────────────────

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "whatsappNumber"              TEXT,
  ADD COLUMN IF NOT EXISTS "notificationEmail"           TEXT,
  ADD COLUMN IF NOT EXISTS "avatarUrl"                   TEXT,
  ADD COLUMN IF NOT EXISTS "autoPurchaseEnabled"         BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "autoPurchaseThreshold"       INTEGER   NOT NULL DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS "displayName"                 TEXT,
  ADD COLUMN IF NOT EXISTS "aliasName"                   TEXT,
  ADD COLUMN IF NOT EXISTS "preferredCommunicationEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "defaultBillingAddressId"     INTEGER,
  ADD COLUMN IF NOT EXISTS "defaultShippingAddressId"    INTEGER,
  ADD COLUMN IF NOT EXISTS "subscriptionPlan"            TEXT      NOT NULL DEFAULT 'BASIC',
  ADD COLUMN IF NOT EXISTS "preferredModel"              TEXT      NOT NULL DEFAULT 'gpt-4o-mini',
  ADD COLUMN IF NOT EXISTS "monthlyAiBudget"             NUMERIC(12,2) NOT NULL DEFAULT 50000,
  ADD COLUMN IF NOT EXISTS "defaultDeliveryDays"         INTEGER   NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS "defaultPaymentMethod"        TEXT      NOT NULL DEFAULT 'cod';

-- ── Create UserAddress table if it doesn't exist ──────────────────────────────

CREATE TABLE IF NOT EXISTS "UserAddress" (
  id          SERIAL        PRIMARY KEY,
  "userId"    INTEGER       NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  name        TEXT          NOT NULL,
  phone       TEXT,
  line1       TEXT          NOT NULL,
  line2       TEXT,
  city        TEXT          NOT NULL,
  state       TEXT          NOT NULL,
  pincode     TEXT          NOT NULL,
  "isDefault" BOOLEAN       NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_address_userid ON "UserAddress"("userId");

-- ── Ensure UserSession table exists (login dependency) ────────────────────────

CREATE TABLE IF NOT EXISTS "UserSession" (
  id             SERIAL       PRIMARY KEY,
  "userId"       INTEGER      NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "sessionToken" TEXT         NOT NULL UNIQUE,
  "expiresAt"    TIMESTAMPTZ  NOT NULL,
  "createdAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_session_token  ON "UserSession"("sessionToken");
CREATE INDEX IF NOT EXISTS idx_user_session_userid ON "UserSession"("userId");

COMMIT;

-- Confirm
SELECT
  (SELECT count(*) FROM information_schema.columns
   WHERE table_name = 'User' AND table_schema = 'public') AS user_col_count,
  (SELECT count(*) FROM information_schema.tables
   WHERE table_name = 'UserAddress' AND table_schema = 'public') AS user_address_exists,
  (SELECT count(*) FROM information_schema.tables
   WHERE table_name = 'UserSession' AND table_schema = 'public') AS user_session_exists;
