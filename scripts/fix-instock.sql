-- Populate inStock from real inventoryCount data in ProductBusinessMetrics.
-- Products with inventoryCount > 0 are in-stock; those with 0 are out-of-stock.
-- Products without a metrics row keep the schema default (true = in-stock).
UPDATE "Product" p
SET "inStock" = (
  SELECT m."inventoryCount" > 0
  FROM "ProductBusinessMetrics" m
  WHERE m."productId" = p.id
)
WHERE EXISTS (
  SELECT 1 FROM "ProductBusinessMetrics" m WHERE m."productId" = p.id
);

-- Verify result
SELECT
  COUNT(*) AS total_products,
  SUM(CASE WHEN "inStock" THEN 1 ELSE 0 END) AS in_stock,
  SUM(CASE WHEN NOT "inStock" THEN 1 ELSE 0 END) AS out_of_stock
FROM "Product";
