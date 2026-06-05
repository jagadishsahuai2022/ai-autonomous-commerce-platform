-- ============================================================================
-- Migration r67b: Add many-to-many mapping tables for Product ↔ Category
-- Purpose: Products can belong to MULTIPLE categories & subcategories
--          for flexible admin organization and better search quality.
--
-- PREREQUISITE: r67-category-subcategory-migration.sql must have already run.
--
-- Usage (local Docker):
--   Get-Content scripts/r67-many-to-many-category-map.sql | docker exec -i dc-latest-postgres psql -U admin -d ai_commerce
--
-- Usage (Hostinger VPS CI/CD pipeline):
--   psql $DATABASE_URL -f scripts/r67-many-to-many-category-map.sql
--
-- BACKWARD COMPATIBLE:
--   Product.categoryId / subCategoryId (single FK) are PRESERVED as "primary" assignment.
--   Mapping tables allow ADDITIONAL category/subcategory assignments.
--   Existing search logic (Strategies 1-4) is untouched.
-- ============================================================================

BEGIN;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  Step 1: Create ProductCategoryMap (many-to-many junction table)          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS "ProductCategoryMap" (
  "productId"   INT NOT NULL,
  "categoryId"  INT NOT NULL,
  "isPrimary"   BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("productId", "categoryId"),
  CONSTRAINT "pcm_product_fk" FOREIGN KEY ("productId")
    REFERENCES "Product"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "pcm_category_fk" FOREIGN KEY ("categoryId")
    REFERENCES "ProductCategory"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pcm_category ON "ProductCategoryMap" ("categoryId");
CREATE INDEX IF NOT EXISTS idx_pcm_primary ON "ProductCategoryMap" ("isPrimary") WHERE "isPrimary" = TRUE;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  Step 2: Create ProductSubCategoryMap (many-to-many junction table)       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS "ProductSubCategoryMap" (
  "productId"      INT NOT NULL,
  "subCategoryId"  INT NOT NULL,
  "isPrimary"      BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("productId", "subCategoryId"),
  CONSTRAINT "pscm_product_fk" FOREIGN KEY ("productId")
    REFERENCES "Product"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "pscm_subcategory_fk" FOREIGN KEY ("subCategoryId")
    REFERENCES "ProductSubCategory"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pscm_subcategory ON "ProductSubCategoryMap" ("subCategoryId");
CREATE INDEX IF NOT EXISTS idx_pscm_primary ON "ProductSubCategoryMap" ("isPrimary") WHERE "isPrimary" = TRUE;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  Step 3: Seed mapping tables from existing Product.categoryId/subCategoryId║
-- ║  Every product's current single assignment becomes the "primary" mapping   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Populate ProductCategoryMap from Product.categoryId
INSERT INTO "ProductCategoryMap" ("productId", "categoryId", "isPrimary")
SELECT id, "categoryId", TRUE
FROM "Product"
WHERE "categoryId" IS NOT NULL
ON CONFLICT ("productId", "categoryId") DO NOTHING;

-- Populate ProductSubCategoryMap from Product.subCategoryId
INSERT INTO "ProductSubCategoryMap" ("productId", "subCategoryId", "isPrimary")
SELECT id, "subCategoryId", TRUE
FROM "Product"
WHERE "subCategoryId" IS NOT NULL
ON CONFLICT ("productId", "subCategoryId") DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  Step 4: Add cross-category mappings for enhanced search                  ║
-- ║  Some products naturally belong to multiple categories.                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Smartwatches → also in Health & Wellness (fitness tracking)
INSERT INTO "ProductCategoryMap" ("productId", "categoryId", "isPrimary")
SELECT p.id, pc.id, FALSE
FROM "Product" p
CROSS JOIN "ProductCategory" pc
WHERE LOWER(p.category) = 'smartwatches'
  AND pc.slug = 'health-wellness'
ON CONFLICT ("productId", "categoryId") DO NOTHING;

-- Fitness Equipment → also in Home & Kitchen (home gym)
INSERT INTO "ProductCategoryMap" ("productId", "categoryId", "isPrimary")
SELECT p.id, pc.id, FALSE
FROM "Product" p
CROSS JOIN "ProductCategory" pc
WHERE LOWER(p.category) = 'fitness equipment'
  AND pc.slug = 'home-kitchen'
ON CONFLICT ("productId", "categoryId") DO NOTHING;

-- Gaming → also in Computer & Peripherals
INSERT INTO "ProductCategoryMap" ("productId", "categoryId", "isPrimary")
SELECT p.id, pc.id, FALSE
FROM "Product" p
CROSS JOIN "ProductCategory" pc
WHERE LOWER(p.category) = 'gaming'
  AND pc.slug = 'computer-peripherals'
ON CONFLICT ("productId", "categoryId") DO NOTHING;

-- Computer Accessories → also in Office & Workspace
INSERT INTO "ProductCategoryMap" ("productId", "categoryId", "isPrimary")
SELECT p.id, pc.id, FALSE
FROM "Product" p
CROSS JOIN "ProductCategory" pc
WHERE LOWER(p.category) = 'computer accessories'
  AND pc.slug = 'office-workspace'
ON CONFLICT ("productId", "categoryId") DO NOTHING;

-- Tablets → also in Computer & Peripherals
INSERT INTO "ProductCategoryMap" ("productId", "categoryId", "isPrimary")
SELECT p.id, pc.id, FALSE
FROM "Product" p
CROSS JOIN "ProductCategory" pc
WHERE LOWER(p.category) = 'tablets'
  AND pc.slug = 'computer-peripherals'
ON CONFLICT ("productId", "categoryId") DO NOTHING;

-- Furniture → also in Office & Workspace
INSERT INTO "ProductCategoryMap" ("productId", "categoryId", "isPrimary")
SELECT p.id, pc.id, FALSE
FROM "Product" p
CROSS JOIN "ProductCategory" pc
WHERE LOWER(p.category) = 'furniture'
  AND pc.slug = 'office-workspace'
ON CONFLICT ("productId", "categoryId") DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  Step 5: Create high-performance search view                              ║
-- ║  Materializes all category names for each product for fast text search     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Create or replace a function to get all category names for a product
CREATE OR REPLACE FUNCTION product_all_category_names(p_id INT)
RETURNS TEXT AS $$
  SELECT STRING_AGG(DISTINCT pc.name, ' | ')
  FROM "ProductCategoryMap" pcm
  JOIN "ProductCategory" pc ON pc.id = pcm."categoryId"
  WHERE pcm."productId" = p_id AND pc.status = 'ACTIVE';
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION product_all_subcategory_names(p_id INT)
RETURNS TEXT AS $$
  SELECT STRING_AGG(DISTINCT psc.name, ' | ')
  FROM "ProductSubCategoryMap" pscm
  JOIN "ProductSubCategory" psc ON psc.id = pscm."subCategoryId"
  WHERE pscm."productId" = p_id AND psc.status = 'ACTIVE';
$$ LANGUAGE SQL STABLE;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  Step 6: Verification                                                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

DO $$
DECLARE
  pcm_count INTEGER;
  pscm_count INTEGER;
  multi_cat_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO pcm_count FROM "ProductCategoryMap";
  SELECT COUNT(*) INTO pscm_count FROM "ProductSubCategoryMap";
  SELECT COUNT(*) INTO multi_cat_count FROM (
    SELECT "productId" FROM "ProductCategoryMap" GROUP BY "productId" HAVING COUNT(*) > 1
  ) t;

  RAISE NOTICE '=== r67b Many-to-Many Migration Summary ===';
  RAISE NOTICE 'ProductCategoryMap rows: %', pcm_count;
  RAISE NOTICE 'ProductSubCategoryMap rows: %', pscm_count;
  RAISE NOTICE 'Products with multiple categories: %', multi_cat_count;
END $$;

-- Show category assignments distribution
SELECT
  pc.name AS "Category",
  COUNT(pcm."productId") AS "ProductCount",
  SUM(CASE WHEN pcm."isPrimary" THEN 1 ELSE 0 END) AS "PrimaryCount",
  SUM(CASE WHEN NOT pcm."isPrimary" THEN 1 ELSE 0 END) AS "SecondaryCount"
FROM "ProductCategory" pc
LEFT JOIN "ProductCategoryMap" pcm ON pcm."categoryId" = pc.id
GROUP BY pc.name, pc."sortOrder"
ORDER BY pc."sortOrder";

COMMIT;
