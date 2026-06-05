-- R69b: Update Smart Intent Engine to 9 parameters
-- Changes from R69a:
--   • Added 9th parameter: emiOnly (5%)
--   • Revised weights: brand 5% (was 15%), quantity 10% (was 5%),
--     deliveryDays 10% (was 3%), budget 10% (was 20%), paymentMethod 5% (was 2%)
--   • Pass threshold updated to 80% (was 40%) for Smart Delegate display
-- Run after r69-search-weights-config.sql

-- Ensure tables exist (idempotent)
CREATE TABLE IF NOT EXISTS "SearchWeightConfig" (
  id             SERIAL PRIMARY KEY,
  "parameterName" VARCHAR(50) UNIQUE NOT NULL,
  "displayName"  VARCHAR(100) NOT NULL,
  "defaultWeight" DECIMAL(6,3) NOT NULL,
  "currentWeight" DECIMAL(6,3) NOT NULL,
  "description"  TEXT,
  "sortOrder"    INT DEFAULT 0,
  "isActive"     BOOLEAN DEFAULT TRUE,
  "updatedAt"    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "SearchPassThreshold" (
  id          SERIAL PRIMARY KEY,
  "threshold" DECIMAL(5,2) NOT NULL DEFAULT 80.00,
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Upsert all 9 parameters with corrected weights
INSERT INTO "SearchWeightConfig" ("parameterName", "displayName", "defaultWeight", "currentWeight", "description", "sortOrder", "isActive")
VALUES
  ('productName',   'Product Name Match', 40.000, 40.000, 'All search words must appear in order in product name or generic name (case-insensitive). Mandatory parameter.',                1, TRUE),
  ('tags',          'Tag Match',          10.000, 10.000, 'At least one tag must match; score = fraction of matching tags / total requested tags.',                                       2, TRUE),
  ('quantity',      'Stock Availability', 10.000, 10.000, 'Whether the product has sufficient inventory for the requested quantity. Mandatory parameter.',                                3, TRUE),
  ('deliveryDays',  'Delivery Speed',     10.000, 10.000, 'Estimated delivery time must be within the user''s preferred delivery window (user days >= product estimated days).',          4, TRUE),
  ('budget',        'Budget Fit',         10.000, 10.000, 'Product price must be strictly less than the specified budget.',                                                               5, TRUE),
  ('brand',         'Brand Match',         5.000,  5.000, 'All brand words must appear in the same order in product name (case-insensitive). Score: 1 if match, 0 otherwise.',           6, TRUE),
  ('attributes',    'Attribute Match',     5.000,  5.000, 'Fraction of user-specified key-value attributes found in the product text (ideally all should match).',                       7, TRUE),
  ('paymentMethod', 'Payment Method',      5.000,  5.000, 'Whether the requested payment type (UPI/Card/COD/Wallet) is supported. EMI requires price > ₹5,000.',                         8, TRUE),
  ('emiOnly',       'EMI Availability',    5.000,  5.000, 'Product must strictly support EMI. Available only for products priced above ₹5,000. Separate from payment method parameter.', 9, TRUE)
ON CONFLICT ("parameterName") DO UPDATE
  SET "displayName"  = EXCLUDED."displayName",
      "defaultWeight" = EXCLUDED."defaultWeight",
      "currentWeight" = EXCLUDED."currentWeight",
      "description"  = EXCLUDED."description",
      "sortOrder"    = EXCLUDED."sortOrder",
      "isActive"     = EXCLUDED."isActive",
      "updatedAt"    = NOW();

-- Update pass threshold to 80%
DELETE FROM "SearchPassThreshold";
INSERT INTO "SearchPassThreshold" ("threshold") VALUES (80.00);

-- Verify
SELECT "parameterName", "displayName", "currentWeight", "sortOrder"
FROM "SearchWeightConfig"
ORDER BY "sortOrder";

SELECT SUM("currentWeight") AS "totalWeight" FROM "SearchWeightConfig";

SELECT threshold FROM "SearchPassThreshold";
