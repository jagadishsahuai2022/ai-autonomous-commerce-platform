-- V0099: Seed ProductBusinessMetrics
-- ─────────────────────────────────────────────────────────────────────────────
-- ProductBusinessMetrics table has 0 rows — this migration seeds realistic
-- engagement metrics for all 100,000 products so the ranking engine has data.
--
-- Actual schema: id, productId, marginPercentage, inventoryCount, salesVelocity,
--                conversionRate, returnRate, lastUpdated
--
-- Metric ranges per tier:
--   Featured products:  higher salesVelocity & conversionRate, lower returnRate
--   Normal products:    realistic random spread
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Insert metrics for all products that don't have a row yet
INSERT INTO "ProductBusinessMetrics" (
  "productId",
  "marginPercentage",
  "inventoryCount",
  "salesVelocity",
  "conversionRate",
  "returnRate",
  "lastUpdated"
)
SELECT
  p.id,
  -- marginPercentage: 8%–45% (featured products have slightly better margins)
  CASE WHEN p.featured
    THEN ROUND((15.0 + RANDOM() * 30.0)::NUMERIC, 2)
    ELSE ROUND(( 8.0 + RANDOM() * 37.0)::NUMERIC, 2)
  END,
  -- inventoryCount: 5–500 units
  CASE WHEN p.featured
    THEN (50  + (RANDOM() * 450)::INTEGER)
    ELSE (5   + (RANDOM() * 245)::INTEGER)
  END,
  -- salesVelocity: units sold per day (featured: higher)
  CASE WHEN p.featured
    THEN ROUND((2.0 + RANDOM() * 18.0)::NUMERIC, 4)
    ELSE ROUND((0.1 + RANDOM() *  4.9)::NUMERIC, 4)
  END,
  -- conversionRate: 0.01–0.18 (featured: slightly higher)
  CASE WHEN p.featured
    THEN ROUND((0.05 + RANDOM() * 0.13)::NUMERIC, 4)
    ELSE ROUND((0.01 + RANDOM() * 0.10)::NUMERIC, 4)
  END,
  -- returnRate: 0.01–0.15 (featured: lower returns)
  CASE WHEN p.featured
    THEN ROUND((0.01 + RANDOM() * 0.06)::NUMERIC, 4)
    ELSE ROUND((0.02 + RANDOM() * 0.13)::NUMERIC, 4)
  END,
  NOW()
FROM "Product" p
ON CONFLICT DO NOTHING;

-- ── Verify ────────────────────────────────────────────────────────────────────
SELECT
  count(*)                                            AS total_rows,
  round(avg("marginPercentage")::NUMERIC, 2)          AS avg_margin_pct,
  round(avg("inventoryCount"))                        AS avg_inventory,
  round(avg("salesVelocity")::NUMERIC, 4)             AS avg_sales_velocity,
  round(avg("conversionRate")::NUMERIC, 4)            AS avg_conversion,
  round(avg("returnRate")::NUMERIC, 4)                AS avg_return_rate
FROM "ProductBusinessMetrics";

COMMIT;
