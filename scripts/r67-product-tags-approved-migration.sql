-- ============================================================================
-- Migration r67c: ProductTag, ProductTagMap + approved flag on all mapping tables
-- Purpose: Structured tag-based search enrichment with admin approval workflow
--          for enterprise-grade product catalog management.
--
-- Usage (local Docker):
--   Get-Content scripts/r67-product-tags-approved-migration.sql | docker exec -i dc-latest-postgres psql -U admin -d ai_commerce
--
-- Usage (Hostinger VPS CI/CD pipeline):
--   psql $DATABASE_URL -f scripts/r67-product-tags-approved-migration.sql
--
-- PREREQUISITE: r67-category-subcategory-migration.sql & r67-many-to-many-category-map.sql
-- BACKWARD COMPATIBLE: All existing queries still work. New columns default to TRUE.
-- ============================================================================

BEGIN;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  Step 1: Add "approved" column to ProductCategoryMap                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE "ProductCategoryMap"
  ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT TRUE;

-- Index for filtering approved-only mappings in search (covers WHERE approved = TRUE)
CREATE INDEX IF NOT EXISTS idx_pcm_approved ON "ProductCategoryMap" (approved);

-- Composite index for the most common search query pattern
CREATE INDEX IF NOT EXISTS idx_pcm_product_approved ON "ProductCategoryMap" ("productId", approved);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  Step 2: Add "approved" column to ProductSubCategoryMap                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE "ProductSubCategoryMap"
  ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_pscm_approved ON "ProductSubCategoryMap" (approved);
CREATE INDEX IF NOT EXISTS idx_pscm_product_approved ON "ProductSubCategoryMap" ("productId", approved);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  Step 3: Create ProductTag table                                         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS "ProductTag" (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  description TEXT,
  "tagType"   TEXT NOT NULL DEFAULT 'FEATURE',
  status      TEXT NOT NULL DEFAULT 'ACTIVE',
  "sortOrder" INT NOT NULL DEFAULT 0,
  "createdBy" TEXT DEFAULT 'system',
  "modifiedBy" TEXT DEFAULT 'system',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ProductTag_name_key" UNIQUE (name),
  CONSTRAINT "ProductTag_slug_key" UNIQUE (slug),
  CONSTRAINT "ProductTag_status_check" CHECK (status IN ('ACTIVE', 'INACTIVE')),
  CONSTRAINT "ProductTag_tagType_check" CHECK ("tagType" IN (
    'FEATURE', 'TECHNOLOGY', 'PRICE_RANGE', 'USE_CASE', 'BRAND_TIER', 'QUALITY'
  ))
);

CREATE INDEX IF NOT EXISTS idx_product_tag_type ON "ProductTag" ("tagType");
CREATE INDEX IF NOT EXISTS idx_product_tag_status ON "ProductTag" (status);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  Step 4: Create ProductTagMap (Product ↔ Tag many-to-many)               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS "ProductTagMap" (
  "productId" INT NOT NULL,
  "tagId"     INT NOT NULL,
  approved    BOOLEAN NOT NULL DEFAULT FALSE,
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ProductTagMap_pkey" PRIMARY KEY ("productId", "tagId"),
  CONSTRAINT "ProductTagMap_productId_fkey" FOREIGN KEY ("productId")
    REFERENCES "Product"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductTagMap_tagId_fkey" FOREIGN KEY ("tagId")
    REFERENCES "ProductTag"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ptm_tag ON "ProductTagMap" ("tagId");
CREATE INDEX IF NOT EXISTS idx_ptm_approved ON "ProductTagMap" (approved);
CREATE INDEX IF NOT EXISTS idx_ptm_product_approved ON "ProductTagMap" ("productId", approved);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  Step 5: Seed ProductTag data (curated tag taxonomy)                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- FEATURE tags (product capabilities)
INSERT INTO "ProductTag" (name, slug, description, "tagType", "sortOrder")
VALUES
  ('Wireless', 'wireless', 'Wireless connectivity (WiFi, Bluetooth, etc.)', 'FEATURE', 1),
  ('Bluetooth', 'bluetooth', 'Bluetooth enabled device', 'FEATURE', 2),
  ('Noise Cancelling', 'noise-cancelling', 'Active or passive noise cancellation', 'FEATURE', 3),
  ('Waterproof', 'waterproof', 'Water resistant or waterproof rated', 'FEATURE', 4),
  ('Portable', 'portable', 'Lightweight and portable design', 'FEATURE', 5),
  ('Smart', 'smart', 'Smart/connected device with app integration', 'FEATURE', 6),
  ('Touchscreen', 'touchscreen', 'Touchscreen display', 'FEATURE', 7),
  ('Fast Charging', 'fast-charging', 'Quick charge / fast charging support', 'FEATURE', 8),
  ('High Resolution', 'high-resolution', '4K, 8K, or high-resolution display', 'FEATURE', 9),
  ('Foldable', 'foldable', 'Foldable or flexible form factor', 'FEATURE', 10),
  ('Ergonomic', 'ergonomic', 'Ergonomic design for comfort', 'FEATURE', 11),
  ('Energy Efficient', 'energy-efficient', 'Energy star or power-efficient design', 'FEATURE', 12)
ON CONFLICT (name) DO NOTHING;

-- TECHNOLOGY tags
INSERT INTO "ProductTag" (name, slug, description, "tagType", "sortOrder")
VALUES
  ('5G', '5g', '5G network capable', 'TECHNOLOGY', 1),
  ('WiFi 6', 'wifi-6', 'WiFi 6 / 6E support', 'TECHNOLOGY', 2),
  ('OLED', 'oled', 'OLED display technology', 'TECHNOLOGY', 3),
  ('USB-C', 'usb-c', 'USB Type-C connectivity', 'TECHNOLOGY', 4),
  ('AI Powered', 'ai-powered', 'AI/ML enhanced features', 'TECHNOLOGY', 5),
  ('NFC', 'nfc', 'Near-field communication', 'TECHNOLOGY', 6),
  ('Dolby Atmos', 'dolby-atmos', 'Dolby Atmos audio support', 'TECHNOLOGY', 7),
  ('HDR', 'hdr', 'High Dynamic Range display', 'TECHNOLOGY', 8)
ON CONFLICT (name) DO NOTHING;

-- PRICE_RANGE tags
INSERT INTO "ProductTag" (name, slug, description, "tagType", "sortOrder")
VALUES
  ('Budget Friendly', 'budget-friendly', 'Price under ₹5,000', 'PRICE_RANGE', 1),
  ('Mid Range', 'mid-range', 'Price ₹5,000 - ₹25,000', 'PRICE_RANGE', 2),
  ('Premium', 'premium', 'Price ₹25,000 - ₹75,000', 'PRICE_RANGE', 3),
  ('Ultra Premium', 'ultra-premium', 'Price above ₹75,000', 'PRICE_RANGE', 4)
ON CONFLICT (name) DO NOTHING;

-- USE_CASE tags
INSERT INTO "ProductTag" (name, slug, description, "tagType", "sortOrder")
VALUES
  ('Work From Home', 'work-from-home', 'Ideal for remote work setup', 'USE_CASE', 1),
  ('Gaming', 'gaming-use', 'Optimized for gaming', 'USE_CASE', 2),
  ('Fitness', 'fitness', 'Health and fitness tracking', 'USE_CASE', 3),
  ('Travel', 'travel', 'Travel-friendly and portable', 'USE_CASE', 4),
  ('Student', 'student', 'Student-friendly / educational', 'USE_CASE', 5),
  ('Professional', 'professional', 'Professional / business grade', 'USE_CASE', 6),
  ('Home Entertainment', 'home-entertainment', 'Home theater and entertainment', 'USE_CASE', 7),
  ('Outdoor', 'outdoor', 'Outdoor and adventure use', 'USE_CASE', 8)
ON CONFLICT (name) DO NOTHING;

-- QUALITY tags
INSERT INTO "ProductTag" (name, slug, description, "tagType", "sortOrder")
VALUES
  ('Best Seller', 'best-seller', 'Top selling product', 'QUALITY', 1),
  ('Top Rated', 'top-rated', 'Highly rated by customers', 'QUALITY', 2),
  ('Editor Choice', 'editor-choice', 'Recommended by editors', 'QUALITY', 3),
  ('New Arrival', 'new-arrival', 'Recently launched product', 'QUALITY', 4)
ON CONFLICT (name) DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  Step 6: Auto-tag products based on name/category patterns               ║
-- ║  Tags are auto-approved for systematic assignments                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Tag products by price range
INSERT INTO "ProductTagMap" ("productId", "tagId", approved, "approvedBy", "approvedAt")
SELECT p.id, t.id, TRUE, 'system', NOW()
FROM "Product" p
CROSS JOIN "ProductTag" t
WHERE t.slug = 'budget-friendly' AND p.price < 5000
ON CONFLICT DO NOTHING;

INSERT INTO "ProductTagMap" ("productId", "tagId", approved, "approvedBy", "approvedAt")
SELECT p.id, t.id, TRUE, 'system', NOW()
FROM "Product" p
CROSS JOIN "ProductTag" t
WHERE t.slug = 'mid-range' AND p.price >= 5000 AND p.price < 25000
ON CONFLICT DO NOTHING;

INSERT INTO "ProductTagMap" ("productId", "tagId", approved, "approvedBy", "approvedAt")
SELECT p.id, t.id, TRUE, 'system', NOW()
FROM "Product" p
CROSS JOIN "ProductTag" t
WHERE t.slug = 'premium' AND p.price >= 25000 AND p.price < 75000
ON CONFLICT DO NOTHING;

INSERT INTO "ProductTagMap" ("productId", "tagId", approved, "approvedBy", "approvedAt")
SELECT p.id, t.id, TRUE, 'system', NOW()
FROM "Product" p
CROSS JOIN "ProductTag" t
WHERE t.slug = 'ultra-premium' AND p.price >= 75000
ON CONFLICT DO NOTHING;

-- Tag wireless products (headphones, speakers, smartwatches, bluetooth keyword)
INSERT INTO "ProductTagMap" ("productId", "tagId", approved, "approvedBy", "approvedAt")
SELECT DISTINCT p.id, t.id, TRUE, 'system', NOW()
FROM "Product" p
CROSS JOIN "ProductTag" t
WHERE t.slug = 'wireless'
  AND (LOWER(p.category) IN ('headphones', 'speakers', 'smartwatches', 'audio equipment')
       OR LOWER(p.name) LIKE '%wireless%'
       OR LOWER(p.name) LIKE '%bluetooth%')
ON CONFLICT DO NOTHING;

-- Tag Bluetooth products
INSERT INTO "ProductTagMap" ("productId", "tagId", approved, "approvedBy", "approvedAt")
SELECT DISTINCT p.id, t.id, TRUE, 'system', NOW()
FROM "Product" p
CROSS JOIN "ProductTag" t
WHERE t.slug = 'bluetooth'
  AND (LOWER(p.category) IN ('headphones', 'speakers', 'smartwatches')
       OR LOWER(p.name) LIKE '%bluetooth%')
ON CONFLICT DO NOTHING;

-- Tag Smart products
INSERT INTO "ProductTagMap" ("productId", "tagId", approved, "approvedBy", "approvedAt")
SELECT DISTINCT p.id, t.id, TRUE, 'system', NOW()
FROM "Product" p
CROSS JOIN "ProductTag" t
WHERE t.slug = 'smart'
  AND (LOWER(p.category) IN ('smartphones', 'smartwatches', 'televisions')
       OR LOWER(p.name) LIKE '%smart%')
ON CONFLICT DO NOTHING;

-- Tag portable products
INSERT INTO "ProductTagMap" ("productId", "tagId", approved, "approvedBy", "approvedAt")
SELECT DISTINCT p.id, t.id, TRUE, 'system', NOW()
FROM "Product" p
CROSS JOIN "ProductTag" t
WHERE t.slug = 'portable'
  AND LOWER(p.category) IN ('laptops', 'tablets', 'headphones', 'speakers', 'smartphones')
ON CONFLICT DO NOTHING;

-- Tag touchscreen products
INSERT INTO "ProductTagMap" ("productId", "tagId", approved, "approvedBy", "approvedAt")
SELECT DISTINCT p.id, t.id, TRUE, 'system', NOW()
FROM "Product" p
CROSS JOIN "ProductTag" t
WHERE t.slug = 'touchscreen'
  AND LOWER(p.category) IN ('smartphones', 'tablets', 'laptops', 'smartwatches')
ON CONFLICT DO NOTHING;

-- Tag gaming products
INSERT INTO "ProductTagMap" ("productId", "tagId", approved, "approvedBy", "approvedAt")
SELECT DISTINCT p.id, t.id, TRUE, 'system', NOW()
FROM "Product" p
CROSS JOIN "ProductTag" t
WHERE t.slug = 'gaming-use'
  AND (LOWER(p.category) = 'gaming'
       OR LOWER(p.name) LIKE '%gaming%'
       OR LOWER(p."genericName") LIKE '%gaming%')
ON CONFLICT DO NOTHING;

-- Tag fitness products
INSERT INTO "ProductTagMap" ("productId", "tagId", approved, "approvedBy", "approvedAt")
SELECT DISTINCT p.id, t.id, TRUE, 'system', NOW()
FROM "Product" p
CROSS JOIN "ProductTag" t
WHERE t.slug = 'fitness'
  AND (LOWER(p.category) IN ('smartwatches', 'fitness equipment')
       OR LOWER(p.name) LIKE '%fitness%'
       OR LOWER(p."genericName") LIKE '%fitness%')
ON CONFLICT DO NOTHING;

-- Tag work-from-home products
INSERT INTO "ProductTagMap" ("productId", "tagId", approved, "approvedBy", "approvedAt")
SELECT DISTINCT p.id, t.id, TRUE, 'system', NOW()
FROM "Product" p
CROSS JOIN "ProductTag" t
WHERE t.slug = 'work-from-home'
  AND LOWER(p.category) IN ('laptops', 'computer accessories', 'networking', 'printers', 'furniture', 'office supplies')
ON CONFLICT DO NOTHING;

-- Tag home entertainment products
INSERT INTO "ProductTagMap" ("productId", "tagId", approved, "approvedBy", "approvedAt")
SELECT DISTINCT p.id, t.id, TRUE, 'system', NOW()
FROM "Product" p
CROSS JOIN "ProductTag" t
WHERE t.slug = 'home-entertainment'
  AND LOWER(p.category) IN ('televisions', 'speakers', 'audio equipment', 'gaming')
ON CONFLICT DO NOTHING;

-- Tag ergonomic products
INSERT INTO "ProductTagMap" ("productId", "tagId", approved, "approvedBy", "approvedAt")
SELECT DISTINCT p.id, t.id, TRUE, 'system', NOW()
FROM "Product" p
CROSS JOIN "ProductTag" t
WHERE t.slug = 'ergonomic'
  AND (LOWER(p.category) IN ('furniture', 'office supplies')
       OR LOWER(p.name) LIKE '%ergonomic%'
       OR LOWER(p."genericName") LIKE '%ergonomic%')
ON CONFLICT DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  Step 7: Create GIN trgm index for fast fuzzy text search on tags        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Ensure pg_trgm extension is available (for future fuzzy matching)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN index on Product.name for fast ILIKE queries
CREATE INDEX IF NOT EXISTS idx_product_name_trgm ON "Product" USING gin (LOWER(name) gin_trgm_ops);

-- GIN index on Product.genericName for fast ILIKE queries
CREATE INDEX IF NOT EXISTS idx_product_generic_name_trgm ON "Product" USING gin (LOWER(COALESCE("genericName", '')) gin_trgm_ops);

-- GIN index on ProductTag.name for tag search
CREATE INDEX IF NOT EXISTS idx_tag_name_trgm ON "ProductTag" USING gin (LOWER(name) gin_trgm_ops);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  Step 8: Verification                                                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

DO $$
DECLARE
  tag_count INTEGER;
  tag_map_count INTEGER;
  tag_approved_count INTEGER;
  pcm_approved INTEGER;
  pscm_approved INTEGER;
BEGIN
  SELECT COUNT(*) INTO tag_count FROM "ProductTag";
  SELECT COUNT(*) INTO tag_map_count FROM "ProductTagMap";
  SELECT COUNT(*) INTO tag_approved_count FROM "ProductTagMap" WHERE approved = TRUE;
  SELECT COUNT(*) INTO pcm_approved FROM "ProductCategoryMap" WHERE approved = TRUE;
  SELECT COUNT(*) INTO pscm_approved FROM "ProductSubCategoryMap" WHERE approved = TRUE;

  RAISE NOTICE '=== r67c Tags & Approved Migration Summary ===';
  RAISE NOTICE 'ProductTag rows: %', tag_count;
  RAISE NOTICE 'ProductTagMap total rows: %', tag_map_count;
  RAISE NOTICE 'ProductTagMap approved rows: %', tag_approved_count;
  RAISE NOTICE 'ProductCategoryMap approved rows: %', pcm_approved;
  RAISE NOTICE 'ProductSubCategoryMap approved rows: %', pscm_approved;
END $$;

-- Tag distribution summary
SELECT
  t."tagType" AS "Type",
  t.name AS "Tag",
  COUNT(ptm."productId") AS "Products",
  COUNT(ptm."productId") FILTER (WHERE ptm.approved) AS "Approved"
FROM "ProductTag" t
LEFT JOIN "ProductTagMap" ptm ON ptm."tagId" = t.id
GROUP BY t."tagType", t.name, t."sortOrder"
ORDER BY t."tagType", t."sortOrder";

COMMIT;
