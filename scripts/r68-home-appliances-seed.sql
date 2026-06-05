-- ============================================================================
-- Migration r68: Home Appliances, Furniture & Kitchen Product Seed
-- Purpose: Add high-quality, searchable product data for Washing Machine,
--          Refrigerator, Microwave, Air Fryer, Air Conditioner, Water Cooler,
--          Water Purifier, Induction Cooktop, Bed, Sofa Set, Mattress —
--          enabling real Shopping List AI Search testing with DB-backed results.
--
-- Usage (local Docker):
--   Get-Content scripts/r68-home-appliances-seed.sql | docker exec -i dc-latest-postgres psql -U admin -d ai_commerce
--
-- Usage (Hostinger VPS):
--   psql $DATABASE_URL -f scripts/r68-home-appliances-seed.sql
--
-- SAFE TO RE-RUN: Uses ON CONFLICT DO NOTHING / DO UPDATE for idempotency.
-- PREREQUISITE: r67-category-subcategory-migration.sql + r67-many-to-many-category-map.sql
--               + r67-product-tags-approved-migration.sql must have run.
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 1: Ensure Home & Kitchen categories and subcategories exist
-- ════════════════════════════════════════════════════════════════════════════

-- Home & Kitchen parent category (slug: home-kitchen, id likely 5)
INSERT INTO "ProductCategory" (name, slug, description, status, "sortOrder", "createdBy")
VALUES ('Home & Kitchen', 'home-kitchen', 'Home appliances, kitchen equipment & furniture', 'ACTIVE', 5, 'system')
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  "updatedAt" = NOW();

-- Ensure subcategories exist
INSERT INTO "ProductSubCategory" (name, slug, description, "categoryId", "sortOrder", "createdBy")
SELECT 'Home Appliances', 'home-appliances', 'Washing machines, refrigerators, ACs, water purifiers & coolers', pc.id, 1, 'system'
FROM "ProductCategory" pc WHERE pc.slug = 'home-kitchen'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "ProductSubCategory" (name, slug, description, "categoryId", "sortOrder", "createdBy")
SELECT 'Kitchen Appliances', 'kitchen-appliances', 'Microwaves, air fryers, induction cooktops, ovens & blenders', pc.id, 2, 'system'
FROM "ProductCategory" pc WHERE pc.slug = 'home-kitchen'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "ProductSubCategory" (name, slug, description, "categoryId", "sortOrder", "createdBy")
SELECT 'Furniture', 'furniture', 'Beds, sofa sets, mattresses, dining sets & storage furniture', pc.id, 3, 'system'
FROM "ProductCategory" pc WHERE pc.slug = 'home-kitchen'
ON CONFLICT (slug) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 2: Insert real home appliance products with proper genericName
-- ════════════════════════════════════════════════════════════════════════════

-- Helper: get category IDs
DO $$
DECLARE
  cat_id         INT;
  subcat_home    INT;
  subcat_kitchen INT;
  subcat_furn    INT;

  -- Tag IDs (from r67c seed)
  tag_energy_efficient INT;
  tag_smart            INT;
  tag_wifi             INT;
  tag_budget_friendly  INT;
  tag_mid_range        INT;
  tag_premium          INT;
  tag_home_ent         INT;
  tag_best_seller      INT;
  tag_top_rated        INT;
  tag_new_arrival      INT;
  tag_inverter_tech    INT;

  prod_id INT;

BEGIN
  -- Resolve category IDs
  SELECT id INTO cat_id      FROM "ProductCategory"    WHERE slug = 'home-kitchen';
  SELECT id INTO subcat_home FROM "ProductSubCategory" WHERE slug = 'home-appliances';
  SELECT id INTO subcat_kitchen FROM "ProductSubCategory" WHERE slug = 'kitchen-appliances';
  SELECT id INTO subcat_furn FROM "ProductSubCategory" WHERE slug = 'furniture';

  -- Resolve tag IDs (default 0 if not found — safe to skip tag mapping)
  SELECT COALESCE((SELECT id FROM "ProductTag" WHERE slug = 'energy-efficient'), 0) INTO tag_energy_efficient;
  SELECT COALESCE((SELECT id FROM "ProductTag" WHERE slug = 'smart'), 0) INTO tag_smart;
  SELECT COALESCE((SELECT id FROM "ProductTag" WHERE slug = 'wifi-6'), 0) INTO tag_wifi;
  SELECT COALESCE((SELECT id FROM "ProductTag" WHERE slug = 'budget-friendly'), 0) INTO tag_budget_friendly;
  SELECT COALESCE((SELECT id FROM "ProductTag" WHERE slug = 'mid-range'), 0) INTO tag_mid_range;
  SELECT COALESCE((SELECT id FROM "ProductTag" WHERE slug = 'premium'), 0) INTO tag_premium;
  SELECT COALESCE((SELECT id FROM "ProductTag" WHERE slug = 'home-entertainment'), 0) INTO tag_home_ent;
  SELECT COALESCE((SELECT id FROM "ProductTag" WHERE slug = 'best-seller'), 0) INTO tag_best_seller;
  SELECT COALESCE((SELECT id FROM "ProductTag" WHERE slug = 'top-rated'), 0) INTO tag_top_rated;
  SELECT COALESCE((SELECT id FROM "ProductTag" WHERE slug = 'new-arrival'), 0) INTO tag_new_arrival;

  RAISE NOTICE 'Category: %, HomeApp: %, KitchenApp: %, Furniture: %',
    cat_id, subcat_home, subcat_kitchen, subcat_furn;

  IF cat_id IS NULL THEN
    RAISE EXCEPTION 'Home & Kitchen category not found — run r67-category-subcategory-migration.sql first';
  END IF;

  -- ── A. WASHING MACHINES ───────────────────────────────────────────────────

  WITH ins AS (
    INSERT INTO "Product" (name, "genericName", price, category, description, "imageUrl",
                           "categoryId", "subCategoryId", featured, "createdAt", "updatedAt")
    VALUES
      ('LG 8 Kg 5-Star Front Load Washing Machine FHV1408Z2M', 'Washing Machine', 44990, 'Home Appliances',
       'LG 8 Kg 5-Star Front Load with AI Direct Drive, Steam Technology, TurboWash 360° for faster clean. Wi-Fi enabled, 10-year motor warranty.',
       '/images/products/home-appliances/lg-front-load-8kg.webp', cat_id, subcat_home, true, NOW(), NOW()),
      ('Samsung 7 Kg 5-Star Fully Automatic Front Load WW70T552DAT', 'Washing Machine', 36990, 'Home Appliances',
       'Samsung 7 Kg Front Load with EcoBubble technology, Digital Inverter motor, 5-star energy rating. Quiet operation.',
       '/images/products/home-appliances/samsung-frontload-7kg.webp', cat_id, subcat_home, false, NOW(), NOW()),
      ('Bosch 7 Kg 5-Star Front Load WAJ24262IN', 'Washing Machine', 34990, 'Home Appliances',
       'Bosch 7 Kg with EcoSilence Drive, Anti-Vibration sidewalls, SpeedPerfect, 15 wash programmes. German engineering.',
       '/images/products/home-appliances/bosch-frontload-7kg.webp', cat_id, subcat_home, false, NOW(), NOW()),
      ('IFB 6.5 Kg 5-Star Front Load DIVA AQUA SX 6510', 'Washing Machine', 29990, 'Home Appliances',
       'IFB 6.5 Kg Front Load with 3D Wash System, Aqua Energie, Crescent Moon Drum. 4-year comprehensive warranty.',
       '/images/products/home-appliances/ifb-frontload-6.5kg.webp', cat_id, subcat_home, false, NOW(), NOW()),
      ('Whirlpool 7.5 Kg 5-Star Semi-Automatic Superb Atom', 'Washing Machine', 11990, 'Home Appliances',
       'Whirlpool 7.5 Kg Semi-Automatic with ZPF Technology, Smart Scrub Station. Budget-friendly twin-tub design.',
       '/images/products/home-appliances/whirlpool-semiauto-7.5kg.webp', cat_id, subcat_home, false, NOW(), NOW()),
      ('Haier 8 Kg 5-Star Fully Automatic Top Load HWM80-1269S5', 'Washing Machine', 18490, 'Home Appliances',
       'Haier 8 Kg Top Load with Smart Check, Impeller Technology, 8 wash programmes. Inverter motor for energy efficiency.',
       '/images/products/home-appliances/haier-topload-8kg.webp', cat_id, subcat_home, false, NOW(), NOW()),
      ('Panasonic 8 Kg 5-Star Top Load NA-F80AH10RRB', 'Washing Machine', 16990, 'Home Appliances',
       'Panasonic 8 Kg Top Load with StainMaster, ActiveFoam System, Tangle Free Pulsator. Energy efficient.',
       '/images/products/home-appliances/panasonic-topload-8kg.webp', cat_id, subcat_home, false, NOW(), NOW()),
      ('Samsung 9 Kg Ecobubble Front Load WW90T554DAT', 'Washing Machine', 52990, 'Home Appliances',
       'Samsung 9 Kg EcoBubble with AI Control, StayClean Drawer, Digital Inverter Motor. Premium front loader.',
       '/images/products/home-appliances/samsung-frontload-9kg-eco.webp', cat_id, subcat_home, true, NOW(), NOW())
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  INSERT INTO "ProductCategoryMap" ("productId", "categoryId", "isPrimary", approved)
  SELECT ins.id, cat_id, TRUE, TRUE FROM ins
  ON CONFLICT DO NOTHING;

  INSERT INTO "ProductSubCategoryMap" ("productId", "subCategoryId", approved)
  SELECT p.id, subcat_home, TRUE
  FROM "Product" p WHERE p."genericName" = 'Washing Machine' AND p."subCategoryId" = subcat_home
  ON CONFLICT DO NOTHING;

  -- Tag mappings for Washing Machines
  IF tag_energy_efficient > 0 THEN
    INSERT INTO "ProductTagMap" ("productId", "tagId", approved)
    SELECT p.id, tag_energy_efficient, TRUE
    FROM "Product" p WHERE p."genericName" = 'Washing Machine' AND p."subCategoryId" = subcat_home
    ON CONFLICT DO NOTHING;
  END IF;

  IF tag_best_seller > 0 THEN
    INSERT INTO "ProductTagMap" ("productId", "tagId", approved)
    SELECT p.id, tag_best_seller, TRUE
    FROM "Product" p WHERE p.name LIKE '%LG%' AND p."genericName" = 'Washing Machine'
    ON CONFLICT DO NOTHING;
  END IF;

  -- ── B. REFRIGERATORS ─────────────────────────────────────────────────────

  WITH ins AS (
    INSERT INTO "Product" (name, "genericName", price, category, description, "imageUrl",
                           "categoryId", "subCategoryId", featured, "createdAt", "updatedAt")
    VALUES
      ('LG 260L 3-Star Frost-Free Double Door GL-S292RPZY', 'Refrigerator', 26990, 'Home Appliances',
       'LG 260L Frost-Free Double Door with Smart Inverter Compressor, Door Cooling+, Multi Air Flow. 10-year compressor warranty.',
       '/images/products/home-appliances/lg-fridge-260l.webp', cat_id, subcat_home, true, NOW(), NOW()),
      ('Samsung 253L 2-Star Frost Free Double Door RT28C3522S8', 'Refrigerator', 24990, 'Home Appliances',
       'Samsung 253L with Digital Inverter Technology, Cool Pack, Deodorizer. Energy efficient with 2-star rating.',
       '/images/products/home-appliances/samsung-fridge-253l.webp', cat_id, subcat_home, false, NOW(), NOW()),
      ('Whirlpool 265L 3-Star Frost Free Double Door IF278ELT3B', 'Refrigerator', 27990, 'Home Appliances',
       'Whirlpool 265L Intellifresh with 6th Sense ActiveFresh Technology, Honey Comb Moisture Lock. Longer food freshness.',
       '/images/products/home-appliances/whirlpool-fridge-265l.webp', cat_id, subcat_home, false, NOW(), NOW()),
      ('Haier 258L 3-Star Frost Free Bottom Mount HRB-2764BS-E', 'Refrigerator', 29990, 'Home Appliances',
       'Haier 258L Bottom Mount with Triple Inverter Compressor, Twin Inverter Technology, Convertible Zone.',
       '/images/products/home-appliances/haier-fridge-258l.webp', cat_id, subcat_home, false, NOW(), NOW()),
      ('Samsung 501L 2-Star Side-by-Side RS76CG8115SLTL', 'Refrigerator', 69990, 'Home Appliances',
       'Samsung 501L Side-by-Side with SpaceMax Technology, Convertible 5-in-1 mode, Twin Cooling Plus. Premium family refrigerator.',
       '/images/products/home-appliances/samsung-fridge-501l-sbs.webp', cat_id, subcat_home, true, NOW(), NOW()),
      ('Bosch 559L 2-Star Side-by-Side KAD93VIFPK', 'Refrigerator', 89990, 'Home Appliances',
       'Bosch 559L Side-by-Side with FreshProtect, NoFrost, LED lighting. Premium German-engineered refrigerator.',
       '/images/products/home-appliances/bosch-fridge-559l-sbs.webp', cat_id, subcat_home, false, NOW(), NOW()),
      ('Godrej 180L 5-Star Single Door RD EPRO 195 THF', 'Refrigerator', 13490, 'Home Appliances',
       'Godrej 180L Single Door with Inverter Technology, Fresh Zone Crisper, Jumbo Bottle Guard. Budget-friendly compact design.',
       '/images/products/home-appliances/godrej-fridge-180l.webp', cat_id, subcat_home, false, NOW(), NOW()),
      ('Panasonic 336L 3-Star Frost Free Double Door NR-BC36VSX2X', 'Refrigerator', 31990, 'Home Appliances',
       'Panasonic 336L with Prime Fresh+ Keep Fresh zone, Econavi sensor, Ag Clean filter. Japanese technology.',
       '/images/products/home-appliances/panasonic-fridge-336l.webp', cat_id, subcat_home, false, NOW(), NOW())
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  INSERT INTO "ProductCategoryMap" ("productId", "categoryId", "isPrimary", approved)
  SELECT ins.id, cat_id, TRUE, TRUE FROM ins
  ON CONFLICT DO NOTHING;

  INSERT INTO "ProductSubCategoryMap" ("productId", "subCategoryId", approved)
  SELECT p.id, subcat_home, TRUE
  FROM "Product" p WHERE p."genericName" = 'Refrigerator' AND p."subCategoryId" = subcat_home
  ON CONFLICT DO NOTHING;

  IF tag_energy_efficient > 0 THEN
    INSERT INTO "ProductTagMap" ("productId", "tagId", approved)
    SELECT p.id, tag_energy_efficient, TRUE
    FROM "Product" p WHERE p."genericName" = 'Refrigerator' AND p."subCategoryId" = subcat_home
    ON CONFLICT DO NOTHING;
  END IF;

  -- ── C. AIR CONDITIONERS ───────────────────────────────────────────────────

  WITH ins AS (
    INSERT INTO "Product" (name, "genericName", price, category, description, "imageUrl",
                           "categoryId", "subCategoryId", featured, "createdAt", "updatedAt")
    VALUES
      ('Daikin 1.5 Ton 5-Star Inverter Split AC FTKF50TV16U', 'Air Conditioner', 42990, 'Home Appliances',
       'Daikin 1.5 Ton 5-Star Inverter with Coanda Airflow, PM 2.5 Filter, Intelligent Eye, R-32 refrigerant. Whisper quiet operation.',
       '/images/products/home-appliances/daikin-ac-1.5t-5star.webp', cat_id, subcat_home, true, NOW(), NOW()),
      ('Voltas 1.5 Ton 5-Star Inverter Split AC 185V Vertis Emerald', 'Air Conditioner', 38990, 'Home Appliances',
       'Voltas 1.5 Ton 5-Star with All Weather Cooling, Adjustable Thermostat, Anti-Bacterial Filter, 4D cooling.',
       '/images/products/home-appliances/voltas-ac-1.5t-5star.webp', cat_id, subcat_home, false, NOW(), NOW()),
      ('Blue Star 1.5 Ton 5-Star Inverter Split AC IC518YNU', 'Air Conditioner', 39990, 'Home Appliances',
       'Blue Star 1.5 Ton 5-Star with Self-Cleaning, Precision Cooling, Energy Star rated. Ideal for hot climates.',
       '/images/products/home-appliances/bluestar-ac-1.5t-5star.webp', cat_id, subcat_home, false, NOW(), NOW()),
      ('Samsung 1.5 Ton 5-Star Wi-Fi Inverter WindFree AC AR18BYNZABB', 'Air Conditioner', 47990, 'Home Appliances',
       'Samsung WindFree 1.5 Ton 5-Star with AI Auto Mode, Wi-Fi control, Fast Cooling, SpaceMax indoor unit. Smart AC.',
       '/images/products/home-appliances/samsung-ac-1.5t-windfree.webp', cat_id, subcat_home, true, NOW(), NOW()),
      ('LG 1.5 Ton 5-Star AI Dual Inverter Split AC RS-Q18YNZE', 'Air Conditioner', 44990, 'Home Appliances',
       'LG 1.5 Ton 5-Star with AI Dual Inverter Compressor, ADU (Auto Dust Removal), Ocean Black Fin, Wi-Fi ThinQ.',
       '/images/products/home-appliances/lg-ac-1.5t-5star-ai.webp', cat_id, subcat_home, false, NOW(), NOW()),
      ('Carrier 1 Ton 5-Star Inverter Split AC ESTER CX 12K', 'Air Conditioner', 32990, 'Home Appliances',
       'Carrier 1 Ton 5-Star Inverter with Flexicool technology, PM 2.5 Filter, 100% copper tubing. 5-year warranty.',
       '/images/products/home-appliances/carrier-ac-1t-5star.webp', cat_id, subcat_home, false, NOW(), NOW()),
      ('Hitachi 2 Ton 5-Star Inverter Split AC RSOG524HEEA', 'Air Conditioner', 59990, 'Home Appliances',
       'Hitachi 2 Ton 5-Star Frost Wash with Stainless Clean, Dual Sensor, Eco Mode. Japanese cooling technology.',
       '/images/products/home-appliances/hitachi-ac-2t-5star.webp', cat_id, subcat_home, false, NOW(), NOW())
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  INSERT INTO "ProductCategoryMap" ("productId", "categoryId", "isPrimary", approved)
  SELECT ins.id, cat_id, TRUE, TRUE FROM ins
  ON CONFLICT DO NOTHING;

  INSERT INTO "ProductSubCategoryMap" ("productId", "subCategoryId", approved)
  SELECT p.id, subcat_home, TRUE
  FROM "Product" p WHERE p."genericName" = 'Air Conditioner' AND p."subCategoryId" = subcat_home
  ON CONFLICT DO NOTHING;

  IF tag_energy_efficient > 0 THEN
    INSERT INTO "ProductTagMap" ("productId", "tagId", approved)
    SELECT p.id, tag_energy_efficient, TRUE
    FROM "Product" p WHERE p."genericName" = 'Air Conditioner' AND p."subCategoryId" = subcat_home
    ON CONFLICT DO NOTHING;
  END IF;

  IF tag_smart > 0 THEN
    INSERT INTO "ProductTagMap" ("productId", "tagId", approved)
    SELECT p.id, tag_smart, TRUE
    FROM "Product" p WHERE p.name LIKE '%Wi-Fi%' AND p."genericName" = 'Air Conditioner'
    ON CONFLICT DO NOTHING;
  END IF;

  -- ── D. WATER PURIFIERS ────────────────────────────────────────────────────

  WITH ins AS (
    INSERT INTO "Product" (name, "genericName", price, category, description, "imageUrl",
                           "categoryId", "subCategoryId", featured, "createdAt", "updatedAt")
    VALUES
      ('Kent Grand Plus 11L RO+UV+UF Wall-Mountable Water Purifier', 'Water Purifier', 19999, 'Home Appliances',
       'Kent Grand Plus with Computer Controlled Operations, Zero Water Wastage, In-tank UV disinfection, 11L storage tank. ISI & CE certified.',
       '/images/products/home-appliances/kent-grandplus-ro.webp', cat_id, subcat_home, true, NOW(), NOW()),
      ('Aquaguard Marvel NXT RO+UV+SS 7L Water Purifier', 'Water Purifier', 17990, 'Home Appliances',
       'Aquaguard Marvel NXT with Active Copper Tech, UV e-Boiling, 5-in-1 purification, Auto-Clean Stainless Steel tank.',
       '/images/products/home-appliances/aquaguard-marvel-ro.webp', cat_id, subcat_home, false, NOW(), NOW()),
      ('AO Smith Z8 Green RO 10L Countertop Water Purifier', 'Water Purifier', 24990, 'Home Appliances',
       'AO Smith Z8 with 8-Stage Purification, Side Stream RO (up to 50% water saving), Hot & Cold water dispenser. USEPA certified.',
       '/images/products/home-appliances/aosmith-z8-ro.webp', cat_id, subcat_home, false, NOW(), NOW()),
      ('Livpure Bolt Plus RO+UV+Minerals 7L Water Purifier', 'Water Purifier', 12990, 'Home Appliances',
       'Livpure Bolt Plus with RO+UV+In-Tank UV purification, Smart LED display, Mineral enhancer, 7L tank capacity.',
       '/images/products/home-appliances/livpure-boltplus-ro.webp', cat_id, subcat_home, false, NOW(), NOW()),
      ('Pureit Eco Water Saver RO+UV+MF 10L Water Purifier', 'Water Purifier', 14990, 'Home Appliances',
       'Pureit Eco Water Saver — India''s first 60% water saving RO. Advanced Mineral Charge Technology, 10L storage.',
       '/images/products/home-appliances/pureit-eco-ro.webp', cat_id, subcat_home, false, NOW(), NOW()),
      ('Havells Diaz RO+UV 7L Water Purifier', 'Water Purifier', 11990, 'Home Appliances',
       'Havells Diaz with 7-Stage Purification, iProtect Purification Monitoring, Detachable Storage Tank, Auto Flush.',
       '/images/products/home-appliances/havells-diaz-ro.webp', cat_id, subcat_home, false, NOW(), NOW())
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  INSERT INTO "ProductCategoryMap" ("productId", "categoryId", "isPrimary", approved)
  SELECT ins.id, cat_id, TRUE, TRUE FROM ins
  ON CONFLICT DO NOTHING;

  INSERT INTO "ProductSubCategoryMap" ("productId", "subCategoryId", approved)
  SELECT p.id, subcat_home, TRUE
  FROM "Product" p WHERE p."genericName" = 'Water Purifier' AND p."subCategoryId" = subcat_home
  ON CONFLICT DO NOTHING;

  -- ── E. WATER COOLERS ──────────────────────────────────────────────────────

  WITH ins AS (
    INSERT INTO "Product" (name, "genericName", price, category, description, "imageUrl",
                           "categoryId", "subCategoryId", featured, "createdAt", "updatedAt")
    VALUES
      ('Blue Star Water Cooler cum Purifier BWCPAP Series 60L', 'Water Cooler', 11990, 'Home Appliances',
       'Blue Star 60L Water Cooler with Inbuilt UV Purifier, Stainless Steel Tank, Cooling Capacity 60L/hr. Suitable for offices.',
       '/images/products/home-appliances/bluestar-watercooler-60l.webp', cat_id, subcat_home, false, NOW(), NOW()),
      ('Voltas Minimagic Pure Water Cooler 45L VMCW45MHV', 'Water Cooler', 8990, 'Home Appliances',
       'Voltas 45L Water Cooler with inbuilt water purification, 8L/hr cooling, Hermetically sealed compressor. Compact design.',
       '/images/products/home-appliances/voltas-watercooler-45l.webp', cat_id, subcat_home, false, NOW(), NOW()),
      ('Usha Water Cooler Aquagenie 40L AQGN40', 'Water Cooler', 7490, 'Home Appliances',
       'Usha Aquagenie 40L with SS Tank, CFC free refrigerant, 3-tap design (cold, ambient, warm). Suitable for 20-25 persons.',
       '/images/products/home-appliances/usha-watercooler-40l.webp', cat_id, subcat_home, false, NOW(), NOW()),
      ('Atlantis Water Cooler ECO 80 Litres Stainless Steel', 'Water Cooler', 13990, 'Home Appliances',
       'Atlantis 80L commercial water cooler with pre-cooling, Anti-bacterial tank coating, High cooling capacity 100L/hr.',
       '/images/products/home-appliances/atlantis-watercooler-80l.webp', cat_id, subcat_home, false, NOW(), NOW())
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  INSERT INTO "ProductCategoryMap" ("productId", "categoryId", "isPrimary", approved)
  SELECT ins.id, cat_id, TRUE, TRUE FROM ins
  ON CONFLICT DO NOTHING;

  INSERT INTO "ProductSubCategoryMap" ("productId", "subCategoryId", approved)
  SELECT p.id, subcat_home, TRUE
  FROM "Product" p WHERE p."genericName" = 'Water Cooler' AND p."subCategoryId" = subcat_home
  ON CONFLICT DO NOTHING;

  -- ── F. MICROWAVES ─────────────────────────────────────────────────────────

  WITH ins AS (
    INSERT INTO "Product" (name, "genericName", price, category, description, "imageUrl",
                           "categoryId", "subCategoryId", featured, "createdAt", "updatedAt")
    VALUES
      ('Samsung 28L Convection Microwave with SlimFry MG28J5535US', 'Microwave', 14990, 'Kitchen Appliances',
       'Samsung 28L Convection with SlimFry Technology, Ceramic Inside, Tandoor function, Smart moisture sensor. 900W power.',
       '/images/products/kitchen-appliances/samsung-microwave-28l.webp', cat_id, subcat_kitchen, true, NOW(), NOW()),
      ('LG 28L All-in-One Convection Microwave MJEN286VF', 'Microwave', 17990, 'Kitchen Appliances',
       'LG 28L All-in-One with Charcoal Lighting Heater, Indian Roti Basket, Multi-cook recipes, NeoChef Inverter. 1000W.',
       '/images/products/kitchen-appliances/lg-microwave-28l.webp', cat_id, subcat_kitchen, false, NOW(), NOW()),
      ('IFB 25L Convection Microwave 25SC4', 'Microwave', 12990, 'Kitchen Appliances',
       'IFB 25L Convection with 24 Autocook menus, Express Cooking, Multi-stage cooking. Stainless Steel cavity, 900W.',
       '/images/products/kitchen-appliances/ifb-microwave-25l.webp', cat_id, subcat_kitchen, false, NOW(), NOW()),
      ('Panasonic 27L Convection Microwave NN-CD674MFDG', 'Microwave', 15990, 'Kitchen Appliances',
       'Panasonic 27L Convection with Grill + Convection combo, 100+ Autocook recipes, 5-stage cooking, 1000W.',
       '/images/products/kitchen-appliances/panasonic-microwave-27l.webp', cat_id, subcat_kitchen, false, NOW(), NOW()),
      ('Whirlpool 30L Crisp n Grill Convection Microwave Magicook Pro 30CE', 'Microwave', 16990, 'Kitchen Appliances',
       'Whirlpool 30L with Crisp n Grill technology, Cook Assist, Jet Defrost, 5 power levels. Stainless steel interior.',
       '/images/products/kitchen-appliances/whirlpool-microwave-30l.webp', cat_id, subcat_kitchen, false, NOW(), NOW()),
      ('Godrej 23L Solo Microwave GMX 23CA2 FIZ', 'Microwave', 7490, 'Kitchen Appliances',
       'Godrej 23L Solo Microwave with 11 Power levels, Auto Cook Menu, Child Lock, Jog Dial. Budget-friendly solo model.',
       '/images/products/kitchen-appliances/godrej-microwave-23l.webp', cat_id, subcat_kitchen, false, NOW(), NOW()),
      ('Bajaj 20L Grill Microwave 20 GTMI', 'Microwave', 6990, 'Kitchen Appliances',
       'Bajaj 20L Grill Microwave with 5 power levels, Defrost by weight, Multistage cooking, Memory function. 800W.',
       '/images/products/kitchen-appliances/bajaj-microwave-20l.webp', cat_id, subcat_kitchen, false, NOW(), NOW())
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  INSERT INTO "ProductCategoryMap" ("productId", "categoryId", "isPrimary", approved)
  SELECT ins.id, cat_id, TRUE, TRUE FROM ins
  ON CONFLICT DO NOTHING;

  INSERT INTO "ProductSubCategoryMap" ("productId", "subCategoryId", approved)
  SELECT p.id, subcat_kitchen, TRUE
  FROM "Product" p WHERE p."genericName" = 'Microwave' AND p."subCategoryId" = subcat_kitchen
  ON CONFLICT DO NOTHING;

  -- ── G. AIR FRYERS ────────────────────────────────────────────────────────

  WITH ins AS (
    INSERT INTO "Product" (name, "genericName", price, category, description, "imageUrl",
                           "categoryId", "subCategoryId", featured, "createdAt", "updatedAt")
    VALUES
      ('Philips Air Fryer XXL HD9270/90 1.2 Kg 2000W', 'Air Fryer', 12995, 'Kitchen Appliances',
       'Philips Air Fryer XXL with Twin TurboStar Technology, 1.2 Kg capacity, 2000W, Fat Removal Technology. Healthy frying with 90% less fat.',
       '/images/products/kitchen-appliances/philips-airfryer-xxl.webp', cat_id, subcat_kitchen, true, NOW(), NOW()),
      ('Instant Vortex Plus 6-in-1 Air Fryer 5.7L 1700W', 'Air Fryer', 9999, 'Kitchen Appliances',
       'Instant Vortex Plus with 6 Smart Programs (Air Fry, Roast, Broil, Bake, Reheat, Dehydrate), EvenCrisp Technology, 5.7L.',
       '/images/products/kitchen-appliances/instant-vortex-airfryer.webp', cat_id, subcat_kitchen, false, NOW(), NOW()),
      ('Ninja AF101 Air Fryer 3.8L 1550W Max Crisp', 'Air Fryer', 11490, 'Kitchen Appliances',
       'Ninja Air Fryer with Max Crisp Technology, Ceramic-coated basket, 4 cooking functions, DH Cyclonic Air Circulation. 3.8L.',
       '/images/products/kitchen-appliances/ninja-airfryer-3.8l.webp', cat_id, subcat_kitchen, false, NOW(), NOW()),
      ('Havells Prolife Digi Air Fryer 4L 1200W', 'Air Fryer', 6990, 'Kitchen Appliances',
       'Havells Prolife with Digital Touch Panel, 8 preset menus, Rotary Timer, Auto Shut-off. 4L capacity, 1200W.',
       '/images/products/kitchen-appliances/havells-prolife-airfryer.webp', cat_id, subcat_kitchen, false, NOW(), NOW()),
      ('Inalsa Easy Fry Grill Air Fryer 4.2L 1500W', 'Air Fryer', 4999, 'Kitchen Appliances',
       'Inalsa Air Fryer with Digital Display, 7 preset programs, Non-stick basket, Rapid Air Technology. 4.2L capacity.',
       '/images/products/kitchen-appliances/inalsa-easyfry-airfryer.webp', cat_id, subcat_kitchen, false, NOW(), NOW()),
      ('AGARO Regal Air Fryer 12L Oven with Rotisserie', 'Air Fryer', 7490, 'Kitchen Appliances',
       'AGARO Regal 12L Air Fryer Oven with Rotisserie, 10 cooking presets, Dehydrator, Digital control. Family-size capacity.',
       '/images/products/kitchen-appliances/agaro-regal-airfryer-oven.webp', cat_id, subcat_kitchen, false, NOW(), NOW()),
      ('Samsung Air Fryer 9L Smart Digital Display', 'Air Fryer', 8990, 'Kitchen Appliances',
       'Samsung Air Fryer 9L with 6 Smart Presets, Digital Display, Non-stick Basket, Rapid Air Technology. 1800W power.',
       '/images/products/kitchen-appliances/samsung-airfryer-9l.webp', cat_id, subcat_kitchen, false, NOW(), NOW())
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  INSERT INTO "ProductCategoryMap" ("productId", "categoryId", "isPrimary", approved)
  SELECT ins.id, cat_id, TRUE, TRUE FROM ins
  ON CONFLICT DO NOTHING;

  INSERT INTO "ProductSubCategoryMap" ("productId", "subCategoryId", approved)
  SELECT p.id, subcat_kitchen, TRUE
  FROM "Product" p WHERE p."genericName" = 'Air Fryer' AND p."subCategoryId" = subcat_kitchen
  ON CONFLICT DO NOTHING;

  -- ── H. INDUCTION COOKTOPS ─────────────────────────────────────────────────

  WITH ins AS (
    INSERT INTO "Product" (name, "genericName", price, category, description, "imageUrl",
                           "categoryId", "subCategoryId", featured, "createdAt", "updatedAt")
    VALUES
      ('Prestige PIC 6.0 V3 1600W Induction Cooktop', 'Induction Cooktop', 2495, 'Kitchen Appliances',
       'Prestige PIC 6.0 with feather touch control, 7 preset cooking menus, Keep Warm function, Voltage Surge Protection. 1600W.',
       '/images/products/kitchen-appliances/prestige-pic60-induction.webp', cat_id, subcat_kitchen, true, NOW(), NOW()),
      ('Philips Viva Collection HD4938/01 2100W Induction Cooktop', 'Induction Cooktop', 3595, 'Kitchen Appliances',
       'Philips 2100W Induction with Touch Control, 11 Power levels, Timer, Boost Function, Automatic Pan Detection. Scratch-resistant glass.',
       '/images/products/kitchen-appliances/philips-hd4938-induction.webp', cat_id, subcat_kitchen, false, NOW(), NOW()),
      ('Havells Insta Cook PT Induction Cooktop 1400W', 'Induction Cooktop', 2299, 'Kitchen Appliances',
       'Havells Insta Cook with 8 preset menus, Boil detection, Keep Warm, Child Lock. Feather touch control, 1400W.',
       '/images/products/kitchen-appliances/havells-instacook-induction.webp', cat_id, subcat_kitchen, false, NOW(), NOW()),
      ('Usha Cook Joy 3616 1600W Induction Cooktop', 'Induction Cooktop', 1899, 'Kitchen Appliances',
       'Usha Cook Joy with 7 preset cooking functions, Digital display, Auto Voltage cut-off, Anti-magnetic wall. 1600W.',
       '/images/products/kitchen-appliances/usha-cookjoy-induction.webp', cat_id, subcat_kitchen, false, NOW(), NOW()),
      ('Pigeon by Stovekraft Rapido DX 1800W Induction Cooktop', 'Induction Cooktop', 1499, 'Kitchen Appliances',
       'Pigeon Rapido DX with 7 preset programs, Smart touch control, Turbo cooking, Light Weight design. 1800W budget model.',
       '/images/products/kitchen-appliances/pigeon-rapido-induction.webp', cat_id, subcat_kitchen, false, NOW(), NOW()),
      ('Bosch PUE611BF1J 1800W Induction Cooktop', 'Induction Cooktop', 11990, 'Kitchen Appliances',
       'Bosch PUE611BF1J Premium Induction with DirectSelect, 17 power levels, QuickStart, Safety auto switch-off. Schott Ceran glass.',
       '/images/products/kitchen-appliances/bosch-pue611-induction.webp', cat_id, subcat_kitchen, false, NOW(), NOW()),
      ('Sunflame SF-IC 10 1600W Induction Cooktop', 'Induction Cooktop', 1299, 'Kitchen Appliances',
       'Sunflame SF-IC 10 with 8 power levels, Timer function, Auto cut-off safety. Crystal glass top, most affordable model.',
       '/images/products/kitchen-appliances/sunflame-sfic10-induction.webp', cat_id, subcat_kitchen, false, NOW(), NOW())
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  INSERT INTO "ProductCategoryMap" ("productId", "categoryId", "isPrimary", approved)
  SELECT ins.id, cat_id, TRUE, TRUE FROM ins
  ON CONFLICT DO NOTHING;

  INSERT INTO "ProductSubCategoryMap" ("productId", "subCategoryId", approved)
  SELECT p.id, subcat_kitchen, TRUE
  FROM "Product" p WHERE p."genericName" = 'Induction Cooktop' AND p."subCategoryId" = subcat_kitchen
  ON CONFLICT DO NOTHING;

  -- ── I. BEDS ───────────────────────────────────────────────────────────────

  WITH ins AS (
    INSERT INTO "Product" (name, "genericName", price, category, description, "imageUrl",
                           "categoryId", "subCategoryId", featured, "createdAt", "updatedAt")
    VALUES
      ('Wakefit Hydraulic Bed Queen Size with Headboard', 'Bed', 19999, 'Furniture',
       'Wakefit Hydraulic Bed with large storage space (350L), solid wood frame, engineered wood base, easy gas lift mechanism. Queen 78" x 60".',
       '/images/products/furniture/wakefit-hydraulic-bed-queen.webp', cat_id, subcat_furn, true, NOW(), NOW()),
      ('Urban Ladder Keats Queen Size Platform Bed Walnut', 'Bed', 18490, 'Furniture',
       'Urban Ladder Keats solid sheesham wood platform bed with Walnut finish, sturdy leg support, slat base. Queen 72" x 60".',
       '/images/products/furniture/urbanladder-keats-bed-queen.webp', cat_id, subcat_furn, false, NOW(), NOW()),
      ('Durian Fiona King Size Bed with Box Storage', 'Bed', 39990, 'Furniture',
       'Durian Fiona King Size Bed with ample box storage, leather upholstered headboard, engineered wood frame. King 78" x 72".',
       '/images/products/furniture/durian-fiona-king-bed.webp', cat_id, subcat_furn, false, NOW(), NOW()),
      ('Pepperfry Cassia Queen Size Hydraulic Bed', 'Bed', 24999, 'Furniture',
       'Pepperfry Cassia Queen Hydraulic Bed with gas lift storage, fabric headboard, engineered wood construction. 6-year warranty.',
       '/images/products/furniture/pepperfry-cassia-bed-queen.webp', cat_id, subcat_furn, false, NOW(), NOW()),
      ('Nilkamal Floyd Queen Bed with Hydraulic Storage Dark Walnut', 'Bed', 22999, 'Furniture',
       'Nilkamal Floyd Queen Hydraulic Bed with Dark Walnut finish, 400L storage, padded headboard. Easy assembly. 5-year warranty.',
       '/images/products/furniture/nilkamal-floyd-bed-queen.webp', cat_id, subcat_furn, false, NOW(), NOW()),
      ('Zuari King Size Solid Wood Bed with Storage Teak', 'Bed', 34990, 'Furniture',
       'Zuari King Size solid teak wood bed with 2 box drawers, dovetail joints, anti-termite treatment. Heritage craftsmanship.',
       '/images/products/furniture/zuari-solid-teak-king-bed.webp', cat_id, subcat_furn, false, NOW(), NOW()),
      ('IKEA SONGESAND Single Bed Frame', 'Bed', 7999, 'Furniture',
       'IKEA SONGESAND Single Bed with 4 large drawers for storage, solid pine + birch construction. Single 90 x 200 cm.',
       '/images/products/furniture/ikea-songesand-single-bed.webp', cat_id, subcat_furn, false, NOW(), NOW()),
      ('Godrej Interio Optima King Size Bed with Storage', 'Bed', 28990, 'Furniture',
       'Godrej Interio Optima King Bed with hydraulic storage, velvet upholstered headboard, metal framework. 3-year warranty.',
       '/images/products/furniture/godrej-optima-king-bed.webp', cat_id, subcat_furn, false, NOW(), NOW())
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  INSERT INTO "ProductCategoryMap" ("productId", "categoryId", "isPrimary", approved)
  SELECT ins.id, cat_id, TRUE, TRUE FROM ins
  ON CONFLICT DO NOTHING;

  INSERT INTO "ProductSubCategoryMap" ("productId", "subCategoryId", approved)
  SELECT p.id, subcat_furn, TRUE
  FROM "Product" p WHERE p."genericName" = 'Bed' AND p."subCategoryId" = subcat_furn
  ON CONFLICT DO NOTHING;

  -- ── J. SOFA SETS ─────────────────────────────────────────────────────────

  WITH ins AS (
    INSERT INTO "Product" (name, "genericName", price, category, description, "imageUrl",
                           "categoryId", "subCategoryId", featured, "createdAt", "updatedAt")
    VALUES
      ('Urban Ladder Eason 3-Seater Fabric Sofa Graphite Grey', 'Sofa Set', 29999, 'Furniture',
       'Urban Ladder Eason 3-Seater Sofa with high-density foam cushions, solid wood frame, Graphite Grey fabric. 500 kg load capacity.',
       '/images/products/furniture/urbanladder-eason-3seater-sofa.webp', cat_id, subcat_furn, true, NOW(), NOW()),
      ('Durian Reva 5-Seater L-Shape Sofa Set Leatherette', 'Sofa Set', 54999, 'Furniture',
       'Durian Reva L-Shaped 5-Seater Sofa Set in premium leatherette, 5-year warranty, hardwood frame. Recliner optional. Space-saving design.',
       '/images/products/furniture/durian-reva-lshape-sofa.webp', cat_id, subcat_furn, false, NOW(), NOW()),
      ('Pepperfry Madeira 3+1+1 Sofa Set Fabric', 'Sofa Set', 39999, 'Furniture',
       'Pepperfry Madeira 3+1+1 Sofa Set with solid wood frame, dense foam, back cushions, lifetime frame warranty. Customizable fabric.',
       '/images/products/furniture/pepperfry-madeira-311-sofa.webp', cat_id, subcat_furn, false, NOW(), NOW()),
      ('Wakefit Snooze Sofa Set 3+1+1 Fabric Charcoal', 'Sofa Set', 24999, 'Furniture',
       'Wakefit Snooze 3+1+1 Sofa Set with high-resilience foam, fabric upholstery, 10-year frame warranty. Hassle-free assembly.',
       '/images/products/furniture/wakefit-snooze-311-sofa.webp', cat_id, subcat_furn, false, NOW(), NOW()),
      ('HomeTown Orion 6-Seater Sectional Sofa Grey', 'Sofa Set', 44999, 'Furniture',
       'HomeTown Orion 6-Seater L-Shaped Sectional Sofa with chaise lounger, high-density foam, linen fabric. Modular design.',
       '/images/products/furniture/hometown-orion-sectional-sofa.webp', cat_id, subcat_furn, false, NOW(), NOW()),
      ('IKEA KIVIK 3-Seater Sofa with Chaise Lounge', 'Sofa Set', 34990, 'Furniture',
       'IKEA KIVIK 3-Seater Sofa with Chaise Lounge, removable covers, seat cushions with pocket springs. Modular & versatile.',
       '/images/products/furniture/ikea-kivik-3seater-chaise.webp', cat_id, subcat_furn, false, NOW(), NOW()),
      ('Godrej Interio Apex 3+1+1 Sofa Set Fabric', 'Sofa Set', 32990, 'Furniture',
       'Godrej Interio Apex 3+1+1 Sofa Set with springless base, antimicrobial fabric, 3-year warranty. Ergonomic design.',
       '/images/products/furniture/godrej-apex-311-sofa.webp', cat_id, subcat_furn, false, NOW(), NOW())
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  INSERT INTO "ProductCategoryMap" ("productId", "categoryId", "isPrimary", approved)
  SELECT ins.id, cat_id, TRUE, TRUE FROM ins
  ON CONFLICT DO NOTHING;

  INSERT INTO "ProductSubCategoryMap" ("productId", "subCategoryId", approved)
  SELECT p.id, subcat_furn, TRUE
  FROM "Product" p WHERE p."genericName" = 'Sofa Set' AND p."subCategoryId" = subcat_furn
  ON CONFLICT DO NOTHING;

  -- ── K. MATTRESSES ────────────────────────────────────────────────────────

  WITH ins AS (
    INSERT INTO "Product" (name, "genericName", price, category, description, "imageUrl",
                           "categoryId", "subCategoryId", featured, "createdAt", "updatedAt")
    VALUES
      ('Sleepwell Ortho Pro Profiled Foam Queen Mattress 6 inch', 'Mattress', 17990, 'Furniture',
       'Sleepwell Ortho Pro with Profiled Foam Technology, Airvent Design for airflow, Anti-Sag Tech. Queen 78" x 60" x 6". 5-year warranty.',
       '/images/products/furniture/sleepwell-ortho-queen-6inch.webp', cat_id, subcat_furn, true, NOW(), NOW()),
      ('Kurlon Neo Latex Mattress Queen Size 6 inch', 'Mattress', 12990, 'Furniture',
       'Kurlon Neo Latex with 100% Natural Latex core, Reactive Compression Technology, Anti-microbial treatment. Queen 78" x 60" x 6".',
       '/images/products/furniture/kurlon-neo-latex-queen-6inch.webp', cat_id, subcat_furn, false, NOW(), NOW()),
      ('Wakefit Dual Comfort Mattress Queen 6 inch', 'Mattress', 9999, 'Furniture',
       'Wakefit Dual Comfort (Medium + Firm) Mattress with HR Foam, High Density Base Foam. Queen 78" x 60" x 6". 100-night trial.',
       '/images/products/furniture/wakefit-dual-comfort-queen.webp', cat_id, subcat_furn, false, NOW(), NOW()),
      ('Sunday Ortho Memory Foam Mattress Queen 8 inch', 'Mattress', 14999, 'Furniture',
       'Sunday Ortho with 3-layer Memory Foam, Bamboo cover, Orthopedic support, Zero motion transfer. Queen 78" x 60" x 8". 10-year warranty.',
       '/images/products/furniture/sunday-ortho-memory-queen-8inch.webp', cat_id, subcat_furn, false, NOW(), NOW()),
      ('Emma Original Hybrid Spring Mattress Queen 25 cm', 'Mattress', 19999, 'Furniture',
       'Emma Original with multi-layer foam including Halo Memory Foam, Cold foam, Airgocell foam. Queen 160 x 200 cm. 10-year guarantee.',
       '/images/products/furniture/emma-original-queen-25cm.webp', cat_id, subcat_furn, false, NOW(), NOW()),
      ('Springfit Ortho Latex Mattress King 8 inch', 'Mattress', 22990, 'Furniture',
       'Springfit Ortho Latex with Pocketed Spring system + Natural Latex comfort layer. King 78" x 72" x 8". Orthopedic support.',
       '/images/products/furniture/springfit-ortho-latex-king.webp', cat_id, subcat_furn, false, NOW(), NOW()),
      ('Nilkamal Usha Shriram Foamex Single Mattress 4 inch', 'Mattress', 4990, 'Furniture',
       'Nilkamal Foamex Single Mattress, HD Foam, Anti-dust mite treated, washable cover. Single 72" x 36" x 4". Best budget mattress.',
       '/images/products/furniture/nilkamal-foamex-single-4inch.webp', cat_id, subcat_furn, false, NOW(), NOW()),
      ('Flo Mattress with 5 Zone Orthopedic Support Queen', 'Mattress', 16999, 'Furniture',
       'Flo 5-Zone Ortho Mattress with Ergonomic Zoned Support, Breathable Open Cell Memory Foam, Copper-infused gel. Queen 78" x 60". 365-night trial.',
       '/images/products/furniture/flo-5zone-ortho-queen.webp', cat_id, subcat_furn, false, NOW(), NOW())
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  INSERT INTO "ProductCategoryMap" ("productId", "categoryId", "isPrimary", approved)
  SELECT ins.id, cat_id, TRUE, TRUE FROM ins
  ON CONFLICT DO NOTHING;

  INSERT INTO "ProductSubCategoryMap" ("productId", "subCategoryId", approved)
  SELECT p.id, subcat_furn, TRUE
  FROM "Product" p WHERE p."genericName" = 'Mattress' AND p."subCategoryId" = subcat_furn
  ON CONFLICT DO NOTHING;

  -- ════════════════════════════════════════════════════════════════════════
  -- STEP 3: Update ProductCategoryMap for already-seeded products that
  --         match these categories by genericName (if any missing mappings)
  -- ════════════════════════════════════════════════════════════════════════

  INSERT INTO "ProductCategoryMap" ("productId", "categoryId", "isPrimary", approved)
  SELECT p.id, cat_id, TRUE, TRUE
  FROM "Product" p
  WHERE p."genericName" IN (
    'Washing Machine','Refrigerator','Air Conditioner','Water Purifier','Water Cooler',
    'Microwave','Air Fryer','Induction Cooktop','Bed','Sofa Set','Mattress'
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '=== r68 Home Appliances Seed Complete ===';
  RAISE NOTICE 'Categories: Home & Kitchen (%) / HomeApp (%) / KitchenApp (%) / Furniture (%)',
    cat_id, subcat_home, subcat_kitchen, subcat_furn;

END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 4: Verification — count new products per genericName
-- ════════════════════════════════════════════════════════════════════════════

SELECT
  p."genericName"         AS "Product Type",
  COUNT(p.id)             AS "Products",
  MIN(p.price)::INT       AS "Min Price (₹)",
  MAX(p.price)::INT       AS "Max Price (₹)",
  COUNT(pcm."productId")  AS "Category Mapped",
  COUNT(pscm."productId") AS "SubCategory Mapped"
FROM "Product" p
LEFT JOIN "ProductCategoryMap"    pcm  ON pcm."productId"  = p.id
LEFT JOIN "ProductSubCategoryMap" pscm ON pscm."productId" = p.id
WHERE p."genericName" IN (
  'Washing Machine','Refrigerator','Air Conditioner','Water Purifier','Water Cooler',
  'Microwave','Air Fryer','Induction Cooktop','Bed','Sofa Set','Mattress'
)
GROUP BY p."genericName"
ORDER BY p."genericName";

COMMIT;
