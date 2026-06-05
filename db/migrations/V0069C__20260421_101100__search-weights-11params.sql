-- ============================================================
-- R69c — Smart Intent Engine: 11 Parameters Migration
-- ============================================================
-- Replaces previous 9-param config with 11 params.
-- New weights: brand 10% (was 5%), tags 5% (was 10%),
--   deliveryDays 5% (was 10%), budget 5% (was 10%),
--   + category 5% (NEW), subCategory 5% (NEW)
-- Total must equal 100.
-- Run: psql -U admin -d ai_commerce -f scripts/r69c-search-weights-11params.sql
-- ============================================================

-- Ensure tables exist (idempotent)
CREATE TABLE IF NOT EXISTS "SearchWeightConfig" (
  id            SERIAL PRIMARY KEY,
  "parameterName"  VARCHAR(64)   NOT NULL UNIQUE,
  "displayName"    VARCHAR(128)  NOT NULL,
  "defaultWeight"  NUMERIC(6,3)  NOT NULL DEFAULT 0,
  "currentWeight"  NUMERIC(6,3)  NOT NULL DEFAULT 0,
  "description"    TEXT,
  "sortOrder"      INT           NOT NULL DEFAULT 99,
  "isActive"       BOOLEAN       NOT NULL DEFAULT TRUE,
  "createdAt"      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "SearchPassThreshold" (
  id          SERIAL PRIMARY KEY,
  "threshold" NUMERIC(6,2) NOT NULL DEFAULT 80,
  "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Replace all weight config rows (11 parameters, total = 100)
INSERT INTO "SearchWeightConfig"
  ("parameterName","displayName","defaultWeight","currentWeight","description","sortOrder","isActive")
VALUES
  ('productName',  'Product Name Match', 40, 40,
   'All search words must appear in order in product name or generic name (case-insensitive).', 1, TRUE),
  ('brand',        'Brand Match',        10, 10,
   'All brand words must appear in order in product name (case-insensitive). Strict sequential match.', 2, TRUE),
  ('quantity',     'Stock Availability', 10, 10,
   'Whether the product has sufficient inventory for the requested quantity.', 3, TRUE),
  ('tags',         'Tag Match',           5,  5,
   'At least one tag must match; score = fraction of matching tags / total requested tags.', 4, TRUE),
  ('attributes',   'Attribute Match',     5,  5,
   'Fraction of user-specified attributes found in the product (all should match for full score).', 5, TRUE),
  ('deliveryDays', 'Delivery Speed',      5,  5,
   'User requested delivery window must be >= estimated product delivery time.', 6, TRUE),
  ('paymentMethod','Payment Method',      5,  5,
   'Whether the requested payment type (UPI/Card/COD/Wallet/EMI) is supported by the product.', 7, TRUE),
  ('budget',       'Budget Fit',          5,  5,
   'Product price must be strictly less than the user specified budget. No buffer allowed.', 8, TRUE),
  ('emiOnly',      'EMI Availability',    5,  5,
   'Product must strictly support EMI (available for products priced above ₹5,000).', 9, TRUE),
  ('category',     'Category Match',      5,  5,
   'Product must belong to the user-selected category (strict match via ProductCategoryMap).', 10, TRUE),
  ('subCategory',  'Sub-Category Match',  5,  5,
   'Product must belong to the user-selected sub-category (strict match via ProductSubCategoryMap).', 11, TRUE)
ON CONFLICT ("parameterName")
  DO UPDATE SET
    "displayName"   = EXCLUDED."displayName",
    "defaultWeight" = EXCLUDED."defaultWeight",
    "currentWeight" = EXCLUDED."currentWeight",
    "description"   = EXCLUDED."description",
    "sortOrder"     = EXCLUDED."sortOrder",
    "isActive"      = EXCLUDED."isActive",
    "updatedAt"     = NOW();

-- Reset / upsert pass threshold to 80
DELETE FROM "SearchPassThreshold";
INSERT INTO "SearchPassThreshold" ("threshold") VALUES (80);

-- Verification
SELECT "parameterName", "displayName", "currentWeight", "sortOrder"
FROM "SearchWeightConfig"
ORDER BY "sortOrder";

SELECT SUM("currentWeight") AS "totalWeight" FROM "SearchWeightConfig";
SELECT "threshold" FROM "SearchPassThreshold";
