-- ============================================================================
-- Migration r67: Add ProductCategory & ProductSubCategory tables
-- Purpose: Structured category hierarchy for better product organization,
--          search quality, and admin management.
--
-- Usage (local Docker):
--   Get-Content scripts/r67-category-subcategory-migration.sql | docker exec -i dc-latest-postgres psql -U admin -d ai_commerce
--
-- Usage (Hostinger VPS CI/CD pipeline):
--   psql $DATABASE_URL -f scripts/r67-category-subcategory-migration.sql
--
-- BACKWARD COMPATIBLE: Product.category (text) column is PRESERVED.
--   New categoryId / subCategoryId are nullable FKs — old code still works.
-- ============================================================================

BEGIN;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  Step 1: Create ProductCategory table                                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS "ProductCategory" (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  description TEXT,
  "imageUrl"  TEXT,
  status      TEXT NOT NULL DEFAULT 'ACTIVE',
  "sortOrder" INT NOT NULL DEFAULT 0,
  "createdBy" TEXT DEFAULT 'system',
  "modifiedBy" TEXT DEFAULT 'system',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ProductCategory_name_key" UNIQUE (name),
  CONSTRAINT "ProductCategory_slug_key" UNIQUE (slug),
  CONSTRAINT "ProductCategory_status_check" CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  Step 2: Create ProductSubCategory table                                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS "ProductSubCategory" (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL,
  description   TEXT,
  "imageUrl"    TEXT,
  "categoryId"  INT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'ACTIVE',
  "sortOrder"   INT NOT NULL DEFAULT 0,
  "createdBy"   TEXT DEFAULT 'system',
  "modifiedBy"  TEXT DEFAULT 'system',
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ProductSubCategory_slug_key" UNIQUE (slug),
  CONSTRAINT "ProductSubCategory_name_category_key" UNIQUE (name, "categoryId"),
  CONSTRAINT "ProductSubCategory_status_check" CHECK (status IN ('ACTIVE', 'INACTIVE')),
  CONSTRAINT "ProductSubCategory_categoryId_fkey" FOREIGN KEY ("categoryId")
    REFERENCES "ProductCategory"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subcategory_category_id ON "ProductSubCategory" ("categoryId");
CREATE INDEX IF NOT EXISTS idx_subcategory_status ON "ProductSubCategory" (status);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  Step 3: Add FK columns to Product table (nullable for backward compat)  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "categoryId" INT;

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "subCategoryId" INT;

-- Add foreign key constraints (idempotent check via pg_constraint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Product_categoryId_fkey'
  ) THEN
    ALTER TABLE "Product"
      ADD CONSTRAINT "Product_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Product_subCategoryId_fkey'
  ) THEN
    ALTER TABLE "Product"
      ADD CONSTRAINT "Product_subCategoryId_fkey"
      FOREIGN KEY ("subCategoryId") REFERENCES "ProductSubCategory"(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_category_id ON "Product" ("categoryId");
CREATE INDEX IF NOT EXISTS idx_product_subcategory_id ON "Product" ("subCategoryId");

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  Step 4: Seed ProductCategory data (8 main categories)                   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO "ProductCategory" (name, slug, description, "sortOrder", "createdBy")
VALUES
  ('Electronics & Mobile', 'electronics-mobile', 'Smartphones, laptops, tablets, cameras & mobile devices', 1, 'system'),
  ('Audio & Wearables', 'audio-wearables', 'Headphones, speakers, audio equipment & smartwatches', 2, 'system'),
  ('TV & Display', 'tv-display', 'Televisions, monitors & display technology', 3, 'system'),
  ('Gaming', 'gaming', 'Gaming consoles, accessories & peripherals', 4, 'system'),
  ('Home & Kitchen', 'home-kitchen', 'Home appliances, kitchen appliances & furniture', 5, 'system'),
  ('Computer & Peripherals', 'computer-peripherals', 'Computer accessories, storage, networking & printers', 6, 'system'),
  ('Health & Wellness', 'health-wellness', 'Personal care devices & fitness equipment', 7, 'system'),
  ('Office & Workspace', 'office-workspace', 'Office supplies, ergonomic furniture & workspace equipment', 8, 'system')
ON CONFLICT (name) DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  Step 5: Seed ProductSubCategory data (20 subcategories)                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Electronics & Mobile
INSERT INTO "ProductSubCategory" (name, slug, description, "categoryId", "sortOrder", "createdBy")
VALUES
  ('Smartphones', 'smartphones', 'Mobile phones & smartphones', (SELECT id FROM "ProductCategory" WHERE slug = 'electronics-mobile'), 1, 'system'),
  ('Laptops', 'laptops', 'Laptops, notebooks & ultrabooks', (SELECT id FROM "ProductCategory" WHERE slug = 'electronics-mobile'), 2, 'system'),
  ('Tablets', 'tablets', 'Tablets & e-readers', (SELECT id FROM "ProductCategory" WHERE slug = 'electronics-mobile'), 3, 'system'),
  ('Cameras', 'cameras', 'Digital cameras, DSLRs & mirrorless', (SELECT id FROM "ProductCategory" WHERE slug = 'electronics-mobile'), 4, 'system')
ON CONFLICT (slug) DO NOTHING;

-- Audio & Wearables
INSERT INTO "ProductSubCategory" (name, slug, description, "categoryId", "sortOrder", "createdBy")
VALUES
  ('Headphones', 'headphones', 'Over-ear, on-ear & in-ear headphones', (SELECT id FROM "ProductCategory" WHERE slug = 'audio-wearables'), 1, 'system'),
  ('Speakers', 'speakers', 'Bluetooth speakers & portable audio', (SELECT id FROM "ProductCategory" WHERE slug = 'audio-wearables'), 2, 'system'),
  ('Audio Equipment', 'audio-equipment', 'Soundbars, turntables & studio monitors', (SELECT id FROM "ProductCategory" WHERE slug = 'audio-wearables'), 3, 'system'),
  ('Smartwatches', 'smartwatches', 'Smartwatches & fitness trackers', (SELECT id FROM "ProductCategory" WHERE slug = 'audio-wearables'), 4, 'system')
ON CONFLICT (slug) DO NOTHING;

-- TV & Display
INSERT INTO "ProductSubCategory" (name, slug, description, "categoryId", "sortOrder", "createdBy")
VALUES
  ('Televisions', 'televisions', 'LED, OLED, QLED & Smart TVs', (SELECT id FROM "ProductCategory" WHERE slug = 'tv-display'), 1, 'system')
ON CONFLICT (slug) DO NOTHING;

-- Gaming
INSERT INTO "ProductSubCategory" (name, slug, description, "categoryId", "sortOrder", "createdBy")
VALUES
  ('Gaming', 'gaming', 'Gaming consoles, controllers & accessories', (SELECT id FROM "ProductCategory" WHERE slug = 'gaming'), 1, 'system')
ON CONFLICT (slug) DO NOTHING;

-- Home & Kitchen
INSERT INTO "ProductSubCategory" (name, slug, description, "categoryId", "sortOrder", "createdBy")
VALUES
  ('Home Appliances', 'home-appliances', 'Vacuum cleaners, air purifiers & home devices', (SELECT id FROM "ProductCategory" WHERE slug = 'home-kitchen'), 1, 'system'),
  ('Kitchen Appliances', 'kitchen-appliances', 'Air fryers, blenders, coffee machines & cooktops', (SELECT id FROM "ProductCategory" WHERE slug = 'home-kitchen'), 2, 'system'),
  ('Furniture', 'furniture', 'Ergonomic chairs, standing desks & office furniture', (SELECT id FROM "ProductCategory" WHERE slug = 'home-kitchen'), 3, 'system')
ON CONFLICT (slug) DO NOTHING;

-- Computer & Peripherals
INSERT INTO "ProductSubCategory" (name, slug, description, "categoryId", "sortOrder", "createdBy")
VALUES
  ('Computer Accessories', 'computer-accessories', 'Keyboards, mice, monitors & webcams', (SELECT id FROM "ProductCategory" WHERE slug = 'computer-peripherals'), 1, 'system'),
  ('Storage Devices', 'storage-devices', 'SSDs, HDDs, NAS drives & external storage', (SELECT id FROM "ProductCategory" WHERE slug = 'computer-peripherals'), 2, 'system'),
  ('Networking', 'networking', 'WiFi routers, mesh systems & network switches', (SELECT id FROM "ProductCategory" WHERE slug = 'computer-peripherals'), 3, 'system'),
  ('Printers', 'printers', 'Laser, inkjet & multi-function printers', (SELECT id FROM "ProductCategory" WHERE slug = 'computer-peripherals'), 4, 'system')
ON CONFLICT (slug) DO NOTHING;

-- Health & Wellness
INSERT INTO "ProductSubCategory" (name, slug, description, "categoryId", "sortOrder", "createdBy")
VALUES
  ('Personal Care', 'personal-care', 'Trimmers, hair dryers, IPL devices & grooming', (SELECT id FROM "ProductCategory" WHERE slug = 'health-wellness'), 1, 'system'),
  ('Fitness Equipment', 'fitness-equipment', 'Treadmills, exercise bikes, yoga mats & weights', (SELECT id FROM "ProductCategory" WHERE slug = 'health-wellness'), 2, 'system')
ON CONFLICT (slug) DO NOTHING;

-- Office & Workspace
INSERT INTO "ProductSubCategory" (name, slug, description, "categoryId", "sortOrder", "createdBy")
VALUES
  ('Office Supplies', 'office-supplies', 'Ergonomic chairs, standing desks, shredders & desk accessories', (SELECT id FROM "ProductCategory" WHERE slug = 'office-workspace'), 1, 'system')
ON CONFLICT (slug) DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  Step 6: Populate Product.categoryId & subCategoryId from existing       ║
-- ║          Product.category text values                                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Map Product.category (text) → ProductSubCategory → ProductCategory
UPDATE "Product" p
SET
  "subCategoryId" = sc.id,
  "categoryId"    = sc."categoryId"
FROM "ProductSubCategory" sc
WHERE LOWER(p.category) = LOWER(sc.name)
  AND p."subCategoryId" IS NULL;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  Step 7: Verification                                                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

DO $$
DECLARE
  cat_count INTEGER;
  subcat_count INTEGER;
  product_count INTEGER;
  mapped_count INTEGER;
  unmapped_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO cat_count FROM "ProductCategory";
  SELECT COUNT(*) INTO subcat_count FROM "ProductSubCategory";
  SELECT COUNT(*) INTO product_count FROM "Product";
  SELECT COUNT(*) INTO mapped_count FROM "Product" WHERE "categoryId" IS NOT NULL;
  SELECT COUNT(*) INTO unmapped_count FROM "Product" WHERE "categoryId" IS NULL;

  RAISE NOTICE '=== r67 Migration Summary ===';
  RAISE NOTICE 'ProductCategory rows: %', cat_count;
  RAISE NOTICE 'ProductSubCategory rows: %', subcat_count;
  RAISE NOTICE 'Total products: %', product_count;
  RAISE NOTICE 'Products with categoryId mapped: %', mapped_count;
  RAISE NOTICE 'Products without categoryId (unmapped): %', unmapped_count;
END $$;

-- Show category → subcategory → product count
SELECT
  pc.name AS "Category",
  psc.name AS "SubCategory",
  COUNT(p.id) AS "Products"
FROM "ProductCategory" pc
LEFT JOIN "ProductSubCategory" psc ON psc."categoryId" = pc.id
LEFT JOIN "Product" p ON p."subCategoryId" = psc.id
GROUP BY pc.name, psc.name, pc."sortOrder", psc."sortOrder"
ORDER BY pc."sortOrder", psc."sortOrder";

COMMIT;
