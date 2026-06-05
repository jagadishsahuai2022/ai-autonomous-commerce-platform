-- ============================================================================
-- V0096 (v2): Diversify genericName across all product categories
-- ============================================================================
-- Root cause of first attempt failure: Products in each category are seeded in
-- round-robin order across 20 categories (spacing=20). When using id%5 or id%4,
-- gcd(20,5)=5 and gcd(20,4)=4 cause ALL products in a category to share the
-- SAME modulo value â†’ all get identical genericName.
--
-- Fix: Use ROW_NUMBER() OVER (PARTITION BY category ORDER BY id) % N which
-- assigns sequential row numbers 1..5000 within each category partition.
-- This always distributes evenly regardless of the underlying ID pattern.
--
-- CRITICAL: genericName values here MUST match SPECIFIC_PRODUCT_TYPE_PATTERNS
-- in apps/web/lib/smart-intent/db-product-bridge.ts.
-- ============================================================================

BEGIN;

-- â”€â”€ Home Appliances: 5 types Ã— ~1000 products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
WITH numbered AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category ORDER BY id) - 1) % 5 AS bucket
  FROM "Product" WHERE category = 'Home Appliances'
)
UPDATE "Product" p
SET "genericName" = CASE n.bucket
  WHEN 0 THEN 'Washing Machine'
  WHEN 1 THEN 'Refrigerator'
  WHEN 2 THEN 'Air Conditioner'
  WHEN 3 THEN 'Microwave'
  WHEN 4 THEN 'Vacuum Cleaner'
END
FROM numbered n WHERE p.id = n.id;

-- â”€â”€ Kitchen Appliances: 5 types Ã— ~1000 products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
WITH numbered AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category ORDER BY id) - 1) % 5 AS bucket
  FROM "Product" WHERE category = 'Kitchen Appliances'
)
UPDATE "Product" p
SET "genericName" = CASE n.bucket
  WHEN 0 THEN 'Blender'
  WHEN 1 THEN 'Mixer Grinder'
  WHEN 2 THEN 'Food Processor'
  WHEN 3 THEN 'Coffee Maker'
  WHEN 4 THEN 'Induction Cooktop'
END
FROM numbered n WHERE p.id = n.id;

-- â”€â”€ Laptops: 4 types Ã— ~1250 products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
WITH numbered AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category ORDER BY id) - 1) % 4 AS bucket
  FROM "Product" WHERE category = 'Laptops'
)
UPDATE "Product" p
SET "genericName" = CASE n.bucket
  WHEN 0 THEN 'Laptop'
  WHEN 1 THEN 'Gaming Laptop'
  WHEN 2 THEN 'Ultrabook'
  WHEN 3 THEN 'Notebook'
END
FROM numbered n WHERE p.id = n.id;

-- â”€â”€ Smartphones: 5 types Ã— ~1000 products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
WITH numbered AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category ORDER BY id) - 1) % 5 AS bucket
  FROM "Product" WHERE category = 'Smartphones'
)
UPDATE "Product" p
SET "genericName" = CASE n.bucket
  WHEN 0 THEN 'Smartphone'
  WHEN 1 THEN 'Android Phone'
  WHEN 2 THEN '5G Phone'
  WHEN 3 THEN 'Mobile Phone'
  WHEN 4 THEN 'Smartphone'
END
FROM numbered n WHERE p.id = n.id;

-- â”€â”€ Televisions: 5 types Ã— ~1000 products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
WITH numbered AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category ORDER BY id) - 1) % 5 AS bucket
  FROM "Product" WHERE category = 'Televisions'
)
UPDATE "Product" p
SET "genericName" = CASE n.bucket
  WHEN 0 THEN 'Television'
  WHEN 1 THEN 'Smart TV'
  WHEN 2 THEN '4K TV'
  WHEN 3 THEN 'LED TV'
  WHEN 4 THEN 'OLED TV'
END
FROM numbered n WHERE p.id = n.id;

-- â”€â”€ Headphones: 4 types Ã— ~1250 products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
WITH numbered AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category ORDER BY id) - 1) % 4 AS bucket
  FROM "Product" WHERE category = 'Headphones'
)
UPDATE "Product" p
SET "genericName" = CASE n.bucket
  WHEN 0 THEN 'Headphones'
  WHEN 1 THEN 'TWS Earbuds'
  WHEN 2 THEN 'Neckband'
  WHEN 3 THEN 'Earphones'
END
FROM numbered n WHERE p.id = n.id;

-- â”€â”€ Speakers: 4 types Ã— ~1250 products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
WITH numbered AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category ORDER BY id) - 1) % 4 AS bucket
  FROM "Product" WHERE category = 'Speakers'
)
UPDATE "Product" p
SET "genericName" = CASE n.bucket
  WHEN 0 THEN 'Bluetooth Speaker'
  WHEN 1 THEN 'Soundbar'
  WHEN 2 THEN 'Smart Speaker'
  WHEN 3 THEN 'Portable Speaker'
END
FROM numbered n WHERE p.id = n.id;

-- â”€â”€ Cameras: 4 types Ã— ~1250 products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
WITH numbered AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category ORDER BY id) - 1) % 4 AS bucket
  FROM "Product" WHERE category = 'Cameras'
)
UPDATE "Product" p
SET "genericName" = CASE n.bucket
  WHEN 0 THEN 'Camera'
  WHEN 1 THEN 'DSLR Camera'
  WHEN 2 THEN 'Mirrorless Camera'
  WHEN 3 THEN 'Action Camera'
END
FROM numbered n WHERE p.id = n.id;

-- â”€â”€ Tablets: 3 types Ã— ~1667 products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
WITH numbered AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category ORDER BY id) - 1) % 3 AS bucket
  FROM "Product" WHERE category = 'Tablets'
)
UPDATE "Product" p
SET "genericName" = CASE n.bucket
  WHEN 0 THEN 'Tablet'
  WHEN 1 THEN 'Android Tablet'
  WHEN 2 THEN 'Tablet'
END
FROM numbered n WHERE p.id = n.id;

-- â”€â”€ Smartwatches: 3 types Ã— ~1667 products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
WITH numbered AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category ORDER BY id) - 1) % 3 AS bucket
  FROM "Product" WHERE category = 'Smartwatches'
)
UPDATE "Product" p
SET "genericName" = CASE n.bucket
  WHEN 0 THEN 'Smartwatch'
  WHEN 1 THEN 'Fitness Tracker'
  WHEN 2 THEN 'Smart Band'
END
FROM numbered n WHERE p.id = n.id;

-- â”€â”€ Computer Accessories: 5 types Ã— ~1000 products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
WITH numbered AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category ORDER BY id) - 1) % 5 AS bucket
  FROM "Product" WHERE category = 'Computer Accessories'
)
UPDATE "Product" p
SET "genericName" = CASE n.bucket
  WHEN 0 THEN 'Mechanical Keyboard'
  WHEN 1 THEN 'Gaming Mouse'
  WHEN 2 THEN 'Monitor'
  WHEN 3 THEN 'Webcam'
  WHEN 4 THEN 'USB Hub'
END
FROM numbered n WHERE p.id = n.id;

-- â”€â”€ Gaming: 5 types Ã— ~1000 products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
WITH numbered AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category ORDER BY id) - 1) % 5 AS bucket
  FROM "Product" WHERE category = 'Gaming'
)
UPDATE "Product" p
SET "genericName" = CASE n.bucket
  WHEN 0 THEN 'Gaming Console'
  WHEN 1 THEN 'Gaming Keyboard'
  WHEN 2 THEN 'Gaming Mouse'
  WHEN 3 THEN 'Gaming Headset'
  WHEN 4 THEN 'Gaming Chair'
END
FROM numbered n WHERE p.id = n.id;

-- â”€â”€ Furniture: 5 types Ã— ~1000 products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
WITH numbered AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category ORDER BY id) - 1) % 5 AS bucket
  FROM "Product" WHERE category = 'Furniture'
)
UPDATE "Product" p
SET "genericName" = CASE n.bucket
  WHEN 0 THEN 'Ergonomic Chair'
  WHEN 1 THEN 'Sofa'
  WHEN 2 THEN 'Bed Frame'
  WHEN 3 THEN 'Study Desk'
  WHEN 4 THEN 'Wardrobe'
END
FROM numbered n WHERE p.id = n.id;

-- â”€â”€ Fitness Equipment: 4 types Ã— ~1250 products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
WITH numbered AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category ORDER BY id) - 1) % 4 AS bucket
  FROM "Product" WHERE category = 'Fitness Equipment'
)
UPDATE "Product" p
SET "genericName" = CASE n.bucket
  WHEN 0 THEN 'Treadmill'
  WHEN 1 THEN 'Exercise Bike'
  WHEN 2 THEN 'Yoga Mat'
  WHEN 3 THEN 'Dumbbell Set'
END
FROM numbered n WHERE p.id = n.id;

-- â”€â”€ Personal Care: 4 types Ã— ~1250 products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
WITH numbered AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category ORDER BY id) - 1) % 4 AS bucket
  FROM "Product" WHERE category = 'Personal Care'
)
UPDATE "Product" p
SET "genericName" = CASE n.bucket
  WHEN 0 THEN 'Beard Trimmer'
  WHEN 1 THEN 'Electric Shaver'
  WHEN 2 THEN 'Hair Dryer'
  WHEN 3 THEN 'Hair Straightener'
END
FROM numbered n WHERE p.id = n.id;

-- â”€â”€ Networking: 4 types Ã— ~1250 products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
WITH numbered AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category ORDER BY id) - 1) % 4 AS bucket
  FROM "Product" WHERE category = 'Networking'
)
UPDATE "Product" p
SET "genericName" = CASE n.bucket
  WHEN 0 THEN 'WiFi Router'
  WHEN 1 THEN 'Mesh Router'
  WHEN 2 THEN 'Network Switch'
  WHEN 3 THEN 'WiFi Extender'
END
FROM numbered n WHERE p.id = n.id;

-- â”€â”€ Storage Devices: 5 types Ã— ~1000 products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
WITH numbered AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category ORDER BY id) - 1) % 5 AS bucket
  FROM "Product" WHERE category = 'Storage Devices'
)
UPDATE "Product" p
SET "genericName" = CASE n.bucket
  WHEN 0 THEN 'External SSD'
  WHEN 1 THEN 'Hard Drive'
  WHEN 2 THEN 'Pen Drive'
  WHEN 3 THEN 'SSD'
  WHEN 4 THEN 'Memory Card'
END
FROM numbered n WHERE p.id = n.id;

-- â”€â”€ Printers: 4 types Ã— ~1250 products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
WITH numbered AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category ORDER BY id) - 1) % 4 AS bucket
  FROM "Product" WHERE category = 'Printers'
)
UPDATE "Product" p
SET "genericName" = CASE n.bucket
  WHEN 0 THEN 'Laser Printer'
  WHEN 1 THEN 'Inkjet Printer'
  WHEN 2 THEN 'All-in-One Printer'
  WHEN 3 THEN 'Photo Printer'
END
FROM numbered n WHERE p.id = n.id;

-- â”€â”€ Office Supplies: 4 types Ã— ~1250 products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
WITH numbered AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category ORDER BY id) - 1) % 4 AS bucket
  FROM "Product" WHERE category = 'Office Supplies'
)
UPDATE "Product" p
SET "genericName" = CASE n.bucket
  WHEN 0 THEN 'Office Supplies'
  WHEN 1 THEN 'Label Maker'
  WHEN 2 THEN 'Paper Shredder'
  WHEN 3 THEN 'Calculator'
END
FROM numbered n WHERE p.id = n.id;

-- â”€â”€ Audio Equipment: 4 types Ã— ~1250 products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
WITH numbered AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category ORDER BY id) - 1) % 4 AS bucket
  FROM "Product" WHERE category = 'Audio Equipment'
)
UPDATE "Product" p
SET "genericName" = CASE n.bucket
  WHEN 0 THEN 'Bluetooth Speaker'
  WHEN 1 THEN 'Soundbar'
  WHEN 2 THEN 'Home Theater'
  WHEN 3 THEN 'Stereo System'
END
FROM numbered n WHERE p.id = n.id;

-- â”€â”€ Verification: Assert diversity was achieved â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DO $$
DECLARE
  home_wm_count   INT;
  home_fridge     INT;
  home_ac         INT;
  kitchen_blender INT;
  laptop_gaming   INT;
  smart_phone     INT;
  total_combos    INT;
BEGIN
  SELECT COUNT(*) INTO home_wm_count   FROM "Product" WHERE category = 'Home Appliances'   AND "genericName" = 'Washing Machine';
  SELECT COUNT(*) INTO home_fridge     FROM "Product" WHERE category = 'Home Appliances'   AND "genericName" = 'Refrigerator';
  SELECT COUNT(*) INTO home_ac         FROM "Product" WHERE category = 'Home Appliances'   AND "genericName" = 'Air Conditioner';
  SELECT COUNT(*) INTO kitchen_blender FROM "Product" WHERE category = 'Kitchen Appliances' AND "genericName" = 'Blender';
  SELECT COUNT(*) INTO laptop_gaming   FROM "Product" WHERE category = 'Laptops'           AND "genericName" = 'Gaming Laptop';
  SELECT COUNT(*) INTO smart_phone     FROM "Product" WHERE category = 'Smartphones'       AND "genericName" = 'Smartphone';
  SELECT COUNT(DISTINCT ("category", "genericName")) INTO total_combos FROM "Product";

  RAISE NOTICE '=== V0096 v2 Migration Summary ===';
  RAISE NOTICE 'Total distinct (category, genericName) combos: %', total_combos;
  RAISE NOTICE 'Home Appliances  / Washing Machine  : % products', home_wm_count;
  RAISE NOTICE 'Home Appliances  / Refrigerator     : % products', home_fridge;
  RAISE NOTICE 'Home Appliances  / Air Conditioner  : % products', home_ac;
  RAISE NOTICE 'Kitchen Appliances / Blender        : % products', kitchen_blender;
  RAISE NOTICE 'Laptops          / Gaming Laptop    : % products', laptop_gaming;
  RAISE NOTICE 'Smartphones      / Smartphone       : % products', smart_phone;

  IF home_wm_count < 900 OR home_fridge < 900 OR kitchen_blender < 900 OR laptop_gaming < 900 THEN
    RAISE EXCEPTION 'V0096: Diversity assertion failed â€” expected ~1000 per type';
  END IF;
  RAISE NOTICE 'V0096 v2 completed successfully â€” diversity verified.';
END;
$$;

COMMIT;