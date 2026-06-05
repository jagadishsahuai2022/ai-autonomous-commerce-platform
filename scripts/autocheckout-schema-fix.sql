-- =============================================================================
-- Auto-Checkout Schema Fix Migration
-- Fixes all missing columns and tables required for the shopping-list
-- auto-checkout flow plus supporting features (cache, analytics, wallet, etc.)
-- All statements are idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- =============================================================================

-- ─── 1. Order table – add missing columns ────────────────────────────────────
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "aiAssisted"    BOOLEAN     NOT NULL DEFAULT FALSE;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "orderNumber"   TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT        DEFAULT 'cod';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingAddress" JSONB;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "notes"         TEXT;

-- Back-fill unique order numbers for any existing rows that have none
UPDATE "Order"
SET    "orderNumber" = 'ORD-LEGACY-' || id
WHERE  "orderNumber" IS NULL;

-- Make orderNumber unique going forward (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'Order' AND constraint_name = 'Order_orderNumber_key'
  ) THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_orderNumber_key" UNIQUE ("orderNumber");
  END IF;
END$$;

-- ─── 2. OrderItem table – add missing columns + relax not-null constraint ─────
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "productName" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "imageUrl"    TEXT;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "productSlug" TEXT;
-- productId can be NULL for catalog items that don't have a DB product record
ALTER TABLE "OrderItem" ALTER COLUMN "productId" DROP NOT NULL;

-- ─── 3. ShoppingListSearch table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ShoppingListSearch" (
  id          SERIAL PRIMARY KEY,
  "userId"    INTEGER REFERENCES "User"(id) ON DELETE SET NULL,
  "searchHash" TEXT   NOT NULL,
  items       JSONB  NOT NULL DEFAULT '[]',
  results     JSONB  NOT NULL DEFAULT '[]',
  summary     JSONB  NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expiresAt" TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 hours')
);
CREATE INDEX IF NOT EXISTS "ShoppingListSearch_searchHash_idx"
  ON "ShoppingListSearch"("searchHash");
CREATE INDEX IF NOT EXISTS "ShoppingListSearch_userId_idx"
  ON "ShoppingListSearch"("userId");
CREATE INDEX IF NOT EXISTS "ShoppingListSearch_expiresAt_idx"
  ON "ShoppingListSearch"("expiresAt");

-- ─── 4. MagicLink table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "MagicLink" (
  id        SERIAL PRIMARY KEY,
  "userId"  INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  token     TEXT NOT NULL UNIQUE,
  purpose   TEXT NOT NULL,
  payload   JSONB NOT NULL DEFAULT '{}',
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "usedAt"    TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "MagicLink_token_idx"    ON "MagicLink"(token);
CREATE INDEX IF NOT EXISTS "MagicLink_userId_idx"   ON "MagicLink"("userId");
CREATE INDEX IF NOT EXISTS "MagicLink_expiresAt_idx" ON "MagicLink"("expiresAt");

-- ─── 5. UserBehavior table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "UserBehavior" (
  id          SERIAL PRIMARY KEY,
  "userId"    INTEGER REFERENCES "User"(id) ON DELETE CASCADE,
  "productId" TEXT,
  action      TEXT NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "UserBehavior_userId_idx"    ON "UserBehavior"("userId");
CREATE INDEX IF NOT EXISTS "UserBehavior_productId_idx" ON "UserBehavior"("productId");
CREATE INDEX IF NOT EXISTS "UserBehavior_createdAt_idx" ON "UserBehavior"("createdAt");

-- ─── 6. AnalyticsEvent table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
  id           SERIAL PRIMARY KEY,
  "eventType"  TEXT NOT NULL,
  "userId"     INTEGER REFERENCES "User"(id) ON DELETE SET NULL,
  "productId"  TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}',
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_eventType_idx"  ON "AnalyticsEvent"("eventType");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_userId_idx"     ON "AnalyticsEvent"("userId");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_createdAt_idx"  ON "AnalyticsEvent"("createdAt");

-- ─── 7. UserPreference table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "UserPreference" (
  id                   SERIAL PRIMARY KEY,
  "userId"             INTEGER NOT NULL UNIQUE REFERENCES "User"(id) ON DELETE CASCADE,
  "preferredCategories" JSONB NOT NULL DEFAULT '[]',
  "priceRange"         JSONB,
  brands               JSONB NOT NULL DEFAULT '[]',
  "interactionHistory" JSONB NOT NULL DEFAULT '[]',
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "UserPreference_userId_idx" ON "UserPreference"("userId");

-- ─── 8. WishlistItem table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "WishlistItem" (
  id            SERIAL PRIMARY KEY,
  "userId"      INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "productId"   TEXT,
  "productName" TEXT NOT NULL,
  price         DOUBLE PRECISION,
  "imageUrl"    TEXT,
  url           TEXT,
  "addedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "WishlistItem_userId_productName_key"
  ON "WishlistItem"("userId", "productName");
CREATE INDEX IF NOT EXISTS "WishlistItem_userId_idx" ON "WishlistItem"("userId");

-- ─── 9. AdminWallet – ensure AI authorization for demo ────────────────────────
-- For ALL existing wallets: enable AI authorization if not already set,
-- ensure reasonable balance (add 500,000 if below 100,000),
-- set generous limits for testing.
-- This does NOT reduce existing balance or limits.
UPDATE "Wallet"
SET
  "isActive"       = TRUE,
  "isLocked"       = FALSE,
  "isAiAuthorized" = TRUE,
  balance          = GREATEST(balance, 500000.0),
  "dailySpentToday" = 0,
  "maxPerOrder"    = GREATEST(COALESCE("maxPerOrder", 0), 200000.0),
  "dailyLimit"     = GREATEST(COALESCE("dailyLimit", 0), 1000000.0),
  "aiSpendingLimit" = GREATEST(COALESCE("aiSpendingLimit", 0), 200000.0),
  "updatedAt"      = NOW()
WHERE id IN (
  SELECT w.id FROM "Wallet" w
  JOIN "User" u ON u.id = w."userId"
  WHERE u.email IN ('admin@delegatecart.com', 'demo@example.com',
                    'supervisedlearning@delegatecart.com', 'observability@delegatecart.com')
);

-- ─── 10. Report final state ───────────────────────────────────────────────────
SELECT 'Migration complete' AS status;
SELECT
  table_name,
  (SELECT count(*) FROM information_schema.columns c WHERE c.table_name = t.table_name) AS col_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN (
    'Order','OrderItem','ShoppingListSearch','MagicLink',
    'UserBehavior','AnalyticsEvent','UserPreference','WishlistItem','Wallet'
  )
ORDER BY table_name;
