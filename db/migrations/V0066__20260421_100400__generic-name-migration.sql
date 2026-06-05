-- ============================================================================
-- Migration r66: Add genericName column to Product table
-- Purpose: Enable search matching on human-readable product type names
--          (e.g. user types "Washing Machine" → matches products in DB by genericName)
--
-- Usage (local Docker):
--   docker exec -i dc-latest-postgres psql -U admin -d ai_commerce -f /scripts/r66-generic-name-migration.sql
-- Or via stdin:
--   Get-Content scripts/r66-generic-name-migration.sql | docker exec -i dc-latest-postgres psql -U admin -d ai_commerce
--
-- Usage (Hostinger VPS CI/CD pipeline):
--   psql $DATABASE_URL -f scripts/r66-generic-name-migration.sql
-- ============================================================================

BEGIN;

-- Step 1: Add genericName column (idempotent)
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "genericName" TEXT;

-- Step 2: Create index for fast genericName lookups
CREATE INDEX IF NOT EXISTS idx_product_generic_name
  ON "Product" (LOWER("genericName"));

-- Step 3: Create combined GIN full-text search index on name + genericName
-- Enables fast ts_vector search across both columns
CREATE INDEX IF NOT EXISTS idx_product_name_fts
  ON "Product" USING GIN (
    to_tsvector('english',
      COALESCE(name, '') || ' ' || COALESCE("genericName", '')
    )
  );

-- Step 4: Populate genericName from category + name-based pattern matching
-- ─────────────────────────────────────────────────────────────────────────────
-- NOTE: The seed data categories and what they actually contain:
--   Smartphones       → model codes like "Samsung Galaxy S24 Ultra 42"
--   Laptops           → model codes like "Dell XPS 15 Slim 7"
--   Headphones        → model codes like "Sony WH-1000XM5 Pro"
--   Televisions       → model codes like "LG OLED55C4 Sport"
--   Cameras           → model codes like "Canon EOS R50 Elite"
--   Tablets           → model codes like "Apple iPad Air Premium"
--   Smartwatches      → model codes like "Samsung Galaxy Watch 6 Neo"
--   Speakers          → model codes like "JBL Charge 5 Studio"
--   Gaming            → consoles & accessories (PS5, Xbox, Switch, etc.)
--   Home Appliances   → robot/vacuum cleaners (RoboVac, PowerBot, Roomba, etc.)
--   Kitchen Appliances→ air fryers, instant pots, blenders, coffee machines, etc.
--   Personal Care     → trimmers, hair dryers, IPL devices, etc.
--   Fitness Equipment → treadmills, spin bikes, kettlebells, etc.
--   Audio Equipment   → soundbars, turntables, studio monitors, DJ gear
--   Computer Accessories → mice, keyboards, monitors, webcams
--   Storage Devices   → SSDs, HDDs, NAS drives
--   Networking        → WiFi routers, mesh systems
--   Printers          → laser/inkjet printers
--   Office Supplies   → ergonomic chairs, standing desks, shredders
--   Furniture         → office chairs, standing desks (premium brands)
-- ─────────────────────────────────────────────────────────────────────────────

-- Simple category-to-genericName mapping for straightforward categories
UPDATE "Product" SET "genericName" = CASE category
  WHEN 'Smartphones'          THEN 'Smartphone'
  WHEN 'Laptops'              THEN 'Laptop'
  WHEN 'Headphones'           THEN 'Headphones'
  WHEN 'Televisions'          THEN 'Television'
  WHEN 'Cameras'              THEN 'Camera'
  WHEN 'Tablets'              THEN 'Tablet'
  WHEN 'Smartwatches'         THEN 'Smartwatch'
  WHEN 'Speakers'             THEN 'Bluetooth Speaker'
  WHEN 'Audio Equipment'      THEN 'Audio Equipment'
  WHEN 'Storage Devices'      THEN 'Storage Device'
  WHEN 'Networking'           THEN 'WiFi Router'
  WHEN 'Printers'             THEN 'Printer'
  ELSE NULL
END
WHERE "genericName" IS NULL
  AND category IN (
    'Smartphones', 'Laptops', 'Headphones', 'Televisions', 'Cameras',
    'Tablets', 'Smartwatches', 'Speakers', 'Audio Equipment',
    'Storage Devices', 'Networking', 'Printers'
  );

-- Gaming category: map based on product name patterns (console vs accessory)
UPDATE "Product" SET "genericName" = CASE
  WHEN name ILIKE '%PS5%' OR name ILIKE '%PlayStation%'  THEN 'PlayStation 5'
  WHEN name ILIKE '%Xbox%'                                THEN 'Xbox Console'
  WHEN name ILIKE '%Switch%'                              THEN 'Nintendo Switch'
  WHEN name ILIKE '%Steam Deck%'                          THEN 'Gaming Handheld'
  WHEN name ILIKE '%ROG Ally%' OR name ILIKE '%Legion Go%' THEN 'Gaming Handheld'
  WHEN name ILIKE '%DualSense%' OR name ILIKE '%Controller%' THEN 'Gaming Controller'
  WHEN name ILIKE '%Kishi%' OR name ILIKE '%Backbone%'   THEN 'Mobile Gaming Controller'
  ELSE 'Gaming Accessory'
END
WHERE category = 'Gaming' AND "genericName" IS NULL;

-- Home Appliances: seed data is ALL vacuum cleaners (RoboVac, PowerBot, Roomba, etc.)
UPDATE "Product" SET "genericName" = CASE
  WHEN name ILIKE '%RoboVac%' OR name ILIKE '%Roomba%' OR name ILIKE '%Deebot%'
    OR name ILIKE '%Robot%' OR name ILIKE '%Jet Bot%'               THEN 'Robot Vacuum Cleaner'
  WHEN name ILIKE '%V15%' OR name ILIKE '%SpeedPro%' OR name ILIKE '%PowerBot%'
    OR name ILIKE '%LaserSmart%'                                    THEN 'Vacuum Cleaner'
  WHEN name ILIKE '%AquaPure%' OR name ILIKE '%PureAir%'           THEN 'Air Purifier'
  ELSE 'Vacuum Cleaner'
END
WHERE category = 'Home Appliances' AND "genericName" IS NULL;

-- Kitchen Appliances: diverse product types — pattern match on seed model names
UPDATE "Product" SET "genericName" = CASE
  WHEN name ILIKE '%Air Fryer%'                                     THEN 'Air Fryer'
  WHEN name ILIKE '%Instant Pot%'                                   THEN 'Instant Pot'
  WHEN name ILIKE '%KitchenAid%' OR name ILIKE '%Artisan%'         THEN 'Stand Mixer'
  WHEN name ILIKE '%Ninja Foodi%'                                   THEN 'Multi Cooker'
  WHEN name ILIKE '%Vitamix%'                                       THEN 'Blender'
  WHEN name ILIKE '%Thermomix%'                                     THEN 'Multi Cooker'
  WHEN name ILIKE '%Barista%'                                       THEN 'Coffee Machine'
  WHEN name ILIKE '%Oven%' OR name ILIKE '%Toaster%'               THEN 'Oven Toaster Grill'
  WHEN name ILIKE '%Induction%'                                     THEN 'Induction Cooktop'
  WHEN name ILIKE '%Juicer%'                                        THEN 'Juicer'
  ELSE 'Kitchen Appliance'
END
WHERE category = 'Kitchen Appliances' AND "genericName" IS NULL;

-- Personal Care: trimmers, hair dryers, IPL, etc.
UPDATE "Product" SET "genericName" = CASE
  WHEN name ILIKE '%OneBlade%' OR name ILIKE '%Trimmer%'           THEN 'Beard Trimmer'
  WHEN name ILIKE '%Series 9%' OR name ILIKE '%Shaver%'            THEN 'Electric Shaver'
  WHEN name ILIKE '%Epilator%'                                      THEN 'Epilator'
  WHEN name ILIKE '%Satin Hair%' OR name ILIKE '%Hair%'            THEN 'Hair Straightener'
  WHEN name ILIKE '%AirWrap%'                                       THEN 'Hair Styler'
  WHEN name ILIKE '%Supersonic%'                                    THEN 'Hair Dryer'
  WHEN name ILIKE '%IPL%' OR name ILIKE '%Lumea%'                  THEN 'IPL Hair Removal'
  WHEN name ILIKE '%Flosser%'                                       THEN 'Water Flosser'
  WHEN name ILIKE '%Oral-B%' OR name ILIKE '%iO%'                  THEN 'Electric Toothbrush'
  ELSE 'Personal Care Device'
END
WHERE category = 'Personal Care' AND "genericName" IS NULL;

-- Fitness Equipment: diverse types
UPDATE "Product" SET "genericName" = CASE
  WHEN name ILIKE '%Treadmill%'                                     THEN 'Treadmill'
  WHEN name ILIKE '%Spin Bike%' OR name ILIKE '%S22i%'             THEN 'Exercise Bike'
  WHEN name ILIKE '%Rowing%'                                        THEN 'Rowing Machine'
  WHEN name ILIKE '%Yoga Mat%'                                      THEN 'Yoga Mat'
  WHEN name ILIKE '%Kettlebell%'                                    THEN 'Kettlebell'
  WHEN name ILIKE '%Resistance Band%'                               THEN 'Resistance Bands'
  WHEN name ILIKE '%Pull-Up%'                                       THEN 'Pull-Up Bar'
  WHEN name ILIKE '%Ab Roller%'                                     THEN 'Ab Roller'
  WHEN name ILIKE '%Jump Rope%'                                     THEN 'Jump Rope'
  WHEN name ILIKE '%Balance Board%'                                 THEN 'Balance Board'
  ELSE 'Fitness Equipment'
END
WHERE category = 'Fitness Equipment' AND "genericName" IS NULL;

-- Computer Accessories: mice, keyboards, monitors, webcams
UPDATE "Product" SET "genericName" = CASE
  WHEN name ILIKE '%MX Master%' OR name ILIKE '%G502%' OR name ILIKE '%DeathAdder%'
    OR name ILIKE '%Mouse%'                                         THEN 'Gaming Mouse'
  WHEN name ILIKE '%Apex%' OR name ILIKE '%Huntsman%' OR name ILIKE '%K70%'
    OR name ILIKE '%Orion%' OR name ILIKE '%Keyboard%'             THEN 'Mechanical Keyboard'
  WHEN name ILIKE '%UltraSharp%' OR name ILIKE '%ProArt%' OR name ILIKE '%Monitor%' THEN 'Monitor'
  WHEN name ILIKE '%Webcam%' OR name ILIKE '%C920%'                THEN 'Webcam'
  ELSE 'Computer Accessory'
END
WHERE category = 'Computer Accessories' AND "genericName" IS NULL;

-- Office Supplies
UPDATE "Product" SET "genericName" = CASE
  WHEN name ILIKE '%Standing Desk%' OR name ILIKE '%E7%'           THEN 'Standing Desk'
  WHEN name ILIKE '%Monitor Arm%'                                   THEN 'Monitor Arm'
  WHEN name ILIKE '%Ergonomic Chair%' OR name ILIKE '%S1%'         THEN 'Ergonomic Chair'
  WHEN name ILIKE '%Desk Mat%'                                      THEN 'Desk Mat'
  WHEN name ILIKE '%Cable Tray%'                                    THEN 'Cable Management'
  WHEN name ILIKE '%Footrest%'                                      THEN 'Footrest'
  WHEN name ILIKE '%Scanner%'                                       THEN 'Document Scanner'
  WHEN name ILIKE '%Label Maker%'                                   THEN 'Label Maker'
  WHEN name ILIKE '%Shredder%'                                      THEN 'Paper Shredder'
  ELSE 'Office Equipment'
END
WHERE category = 'Office Supplies' AND "genericName" IS NULL;

-- Furniture: office chairs and standing desks (premium brands)
UPDATE "Product" SET "genericName" = CASE
  WHEN name ILIKE '%Aeron%' OR name ILIKE '%Leap%' OR name ILIKE '%ErgoChair%'
    OR name ILIKE '%Task Chair%' OR name ILIKE '%Ignition%' OR name ILIKE '%Markus%'
    OR name ILIKE '%Titan%'                                         THEN 'Ergonomic Chair'
  WHEN name ILIKE '%Standing Desk%' OR name ILIKE '%E7%' OR name ILIKE '%V2%'
    OR name ILIKE '%Jarvis%' OR name ILIKE '%Uplift%'              THEN 'Standing Desk'
  ELSE 'Furniture'
END
WHERE category = 'Furniture' AND "genericName" IS NULL;

-- Fallback: any remaining NULL genericNames get the category name as genericName
UPDATE "Product"
SET "genericName" = category
WHERE "genericName" IS NULL;

-- Step 5: Verify migration results
DO $$
DECLARE
  total_products INTEGER;
  products_with_generic INTEGER;
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_products FROM "Product";
  SELECT COUNT(*) INTO products_with_generic FROM "Product" WHERE "genericName" IS NOT NULL;
  SELECT COUNT(*) INTO null_count FROM "Product" WHERE "genericName" IS NULL;

  RAISE NOTICE '=== r66 Migration Summary ===';
  RAISE NOTICE 'Total products: %', total_products;
  RAISE NOTICE 'Products with genericName: %', products_with_generic;
  RAISE NOTICE 'Products without genericName: %', null_count;

  -- Show distribution by genericName
  RAISE NOTICE '--- genericName distribution (top 25) ---';
END $$;

-- Show top genericName values
SELECT "genericName", COUNT(*) as count
FROM "Product"
GROUP BY "genericName"
ORDER BY count DESC
LIMIT 25;

COMMIT;

-- ============================================================================
-- Post-migration notes for CI/CD:
-- 1. Run this script once per environment (local, staging, production)
-- 2. The migration is idempotent (uses ADD COLUMN IF NOT EXISTS + WHERE IS NULL)
-- 3. Re-running after initial run is safe — WHERE "genericName" IS NULL ensures
--    no data is overwritten
-- 4. For new products inserted after migration, genericName must be set at insert time
--    or via a trigger (future enhancement)
-- ============================================================================
