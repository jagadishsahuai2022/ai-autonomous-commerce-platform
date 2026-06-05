-- R69: Smart Intent Engine — Search Weight Configuration Tables
-- Creates SearchWeightConfig (8 parameters) and SearchPassThreshold tables
-- Run: Get-Content scripts/r69-search-weights-config.sql | docker exec -i dc-latest-postgres psql -U admin -d ai_commerce

-- ── SearchWeightConfig: per-parameter weight storage ─────────────────────────
CREATE TABLE IF NOT EXISTS "SearchWeightConfig" (
  id               SERIAL PRIMARY KEY,
  "parameterName"  VARCHAR(50)  UNIQUE NOT NULL,   -- productName | brand | budget | tags | attributes | quantity | deliveryDays | paymentMethod
  "displayName"    VARCHAR(100) NOT NULL,
  "defaultWeight"  DECIMAL(6,3) NOT NULL,           -- original default (never changes)
  "currentWeight"  DECIMAL(6,3) NOT NULL,           -- admin-configurable live weight
  "description"    TEXT,
  "sortOrder"      INT          DEFAULT 0,
  "isActive"       BOOLEAN      DEFAULT TRUE,
  "updatedAt"      TIMESTAMP    DEFAULT NOW()
);

-- ── SearchPassThreshold: minimum score to include a product in results ────────
CREATE TABLE IF NOT EXISTS "SearchPassThreshold" (
  id          SERIAL PRIMARY KEY,
  "threshold" DECIMAL(5,2) NOT NULL DEFAULT 40.00,  -- 0-100; products below this are excluded
  "updatedAt" TIMESTAMP    DEFAULT NOW()
);

-- ── Seed: 8 default weight parameters (total = 100) ──────────────────────────
INSERT INTO "SearchWeightConfig"
  ("parameterName", "displayName", "defaultWeight", "currentWeight", "description", "sortOrder")
VALUES
  ('productName',   'Product Name Match',    40.0, 40.0,
   'How well the product name and generic name match the user''s search query. Uses anchor term + coverage scoring.',
   1),
  ('budget',        'Budget Fit',            20.0, 20.0,
   'Whether the product price is within the specified budget. Strict: price ≤ budget scores 1.0; 0-20% over = 0.6; >20% over = 0.0.',
   2),
  ('brand',         'Brand Match',           15.0, 15.0,
   'Whether the product brand matches the preferred brand specified by the user.',
   3),
  ('tags',          'Tag Match',             10.0, 10.0,
   'Fraction of user-selected tags that match the product''s assigned tags in the database.',
   4),
  ('attributes',    'Attribute Match',        5.0,  5.0,
   'Fraction of user-specified key-value attributes found in the product name and description.',
   5),
  ('quantity',      'Stock Availability',     5.0,  5.0,
   'Whether the product has sufficient inventory to fulfil the requested quantity.',
   6),
  ('deliveryDays',  'Delivery Speed',         3.0,  3.0,
   'Whether the estimated delivery time fits within the user''s preferred delivery window. Estimated from product price tier.',
   7),
  ('paymentMethod', 'Payment Method',         2.0,  2.0,
   'Whether the product supports the user''s preferred payment method (EMI / Card / UPI / COD / Wallet).',
   8)
ON CONFLICT ("parameterName") DO UPDATE
  SET "displayName"   = EXCLUDED."displayName",
      "defaultWeight" = EXCLUDED."defaultWeight",
      "description"   = EXCLUDED."description",
      "sortOrder"     = EXCLUDED."sortOrder",
      "isActive"      = EXCLUDED."isActive",
      "updatedAt"     = NOW();

-- ── Seed: default pass threshold ─────────────────────────────────────────────
INSERT INTO "SearchPassThreshold" ("threshold")
SELECT 40.0
WHERE NOT EXISTS (SELECT 1 FROM "SearchPassThreshold");

-- ── Verification ─────────────────────────────────────────────────────────────
SELECT "parameterName", "displayName", "currentWeight", "sortOrder"
FROM "SearchWeightConfig"
ORDER BY "sortOrder";

SELECT "threshold" FROM "SearchPassThreshold";
