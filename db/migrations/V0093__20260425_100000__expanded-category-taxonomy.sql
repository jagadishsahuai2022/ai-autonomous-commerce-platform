-- ============================================================================
-- Migration V0093: Expanded Category & SubCategory Taxonomy
-- ============================================================================
--
-- PURPOSE:
--   1. Add missing ProductSubCategory rows referenced by IntentCategoryMap
--      (V0092) but not yet present as DB rows — fixes Strategy 1 searches.
--   2. Add granular subcategories (DSLR Cameras, Earbuds, Smart TV, etc.)
--      so products can be tagged precisely and filtered correctly.
--   3. Add 4 new parent ProductCategory rows for future catalog expansion:
--      Automotive & GPS, Sports & Outdoors, Musical Instruments, Toys & Kids.
--   4. Re-run the Product.category (text) → subCategoryId backfill so any
--      existing products with matching category names get properly linked.
--
-- BACKWARD COMPATIBLE:
--   • All INSERTs use ON CONFLICT DO NOTHING — idempotent, safe to re-run.
--   • Product.category (text) field is never modified.
--   • Existing foreign keys and constraints are untouched.
--
-- DEPLOYMENT:
--   GitHub Actions → "DB — Schema Sync & Migration (manual)"
--   → action: run-versioned-migrations → confirm: yes
--
-- PREREQUISITE: V0067, V0068, V0092 must be applied first.
-- ============================================================================

BEGIN;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION A: New Parent Categories                                        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO "ProductCategory" (name, slug, description, status, "sortOrder", "createdBy", "updatedAt")
VALUES
  ('Automotive & GPS',   'automotive-gps',       'Dashcams, GPS navigation, car electronics & accessories',         'ACTIVE',  9,  'system', NOW()),
  ('Sports & Outdoors',  'sports-outdoors',       'Exercise equipment, cycles, outdoor sports & sports accessories', 'ACTIVE',  10, 'system', NOW()),
  ('Musical Instruments','musical-instruments',   'Guitars, keyboards, drums, DJ equipment & music accessories',     'ACTIVE',  11, 'system', NOW()),
  ('Toys & Kids',        'toys-kids',             'Educational toys, action figures, board games & baby products',   'ACTIVE',  12, 'system', NOW())
ON CONFLICT (slug) DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION B: New SubCategories — Electronics & Mobile                    ║
-- ║  (slug: electronics-mobile)                                              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
--
-- Required by IntentCategoryMap V0092:
--   phone      → Mobile Phones, Feature Phones
--   laptop     → Notebooks, Ultrabooks
--   tablet     → E-Readers
--   camera     → DSLR Cameras, Action Cameras, Webcams

INSERT INTO "ProductSubCategory" (name, slug, description, "categoryId", "sortOrder", "createdBy", "updatedAt")
SELECT v.name, v.slug, v.description, pc.id, v.sort, 'system', NOW()
FROM (VALUES
  -- Phone variants
  ('Mobile Phones',    'mobile-phones',    'Feature-rich smartphones & mid-range mobiles',                           5 ),
  ('Feature Phones',   'feature-phones',   'Basic mobile phones, keypad phones & entry-level handsets',              6 ),
  -- Laptop variants
  ('Notebooks',        'notebooks',        'Everyday notebooks and mid-range laptops',                               7 ),
  ('Ultrabooks',       'ultrabooks',       'Ultra-thin premium laptops & ultrabooks',                                8 ),
  -- Tablet family
  ('E-Readers',        'e-readers',        'E-ink e-readers, Kindle & Kobo devices',                                 9 ),
  -- Camera family
  ('DSLR Cameras',     'dslr-cameras',     'Digital SLR cameras, lenses & accessories',                             10 ),
  ('Mirrorless Cameras','mirrorless-cameras','Compact mirrorless cameras & interchangeable lens systems',           11 ),
  ('Action Cameras',   'action-cameras',   'GoPro, action cams, waterproof & adventure cameras',                   12 ),
  ('Webcams',          'webcams',          'Desktop & laptop webcams for video calls & streaming',                  13 ),
  ('Drones',           'drones',           'Camera drones, racing drones & aerial photography equipment',           14 ),
  -- Accessories
  ('Mobile Accessories','mobile-accessories','Phone cases, screen protectors, charging docks & mounts',            15 ),
  ('Power Banks',      'power-banks',      'Portable chargers & power banks for mobiles & laptops',                16 ),
  ('Chargers & Cables','chargers-cables',  'USB-C / Lightning chargers, cables, adapters & fast chargers',         17 )
) AS v(name, slug, description, sort)
JOIN "ProductCategory" pc ON pc.slug = 'electronics-mobile'
ON CONFLICT (slug) DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION C: New SubCategories — Audio & Wearables                       ║
-- ║  (slug: audio-wearables)                                                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
--
-- Required by IntentCategoryMap V0092:
--   headphones → Earbuds, Earphones, Neckband
--   speaker    → Bluetooth Speakers, Soundbars
--   watch      → Fitness Trackers, Smart Bands

INSERT INTO "ProductSubCategory" (name, slug, description, "categoryId", "sortOrder", "createdBy", "updatedAt")
SELECT v.name, v.slug, v.description, pc.id, v.sort, 'system', NOW()
FROM (VALUES
  ('Earbuds',              'earbuds',              'True wireless stereo (TWS) earbuds',                                5 ),
  ('Earphones',            'earphones',            'Wired earphones, in-ear monitors & IEM buds',                       6 ),
  ('Neckband',             'neckband',             'Neckband-style Bluetooth wireless earphones',                        7 ),
  ('Bluetooth Speakers',   'bluetooth-speakers',   'Portable Bluetooth speakers & outdoor speakers',                    8 ),
  ('Soundbars',            'soundbars',            'TV soundbars, home cinema bars & wired speakers',                   9 ),
  ('Home Theatre Systems', 'home-theatre-systems', 'Home theatre sets, AV receivers & surround systems',               10 ),
  ('Fitness Trackers',     'fitness-trackers',     'Activity trackers, step counters & health monitors',               11 ),
  ('Smart Bands',          'smart-bands',          'Smart fitness bands, sleep trackers & wellness wearables',          12 )
) AS v(name, slug, description, sort)
JOIN "ProductCategory" pc ON pc.slug = 'audio-wearables'
ON CONFLICT (slug) DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION D: New SubCategories — TV & Display                            ║
-- ║  (slug: tv-display)                                                      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
--
-- Required by IntentCategoryMap V0092:
--   television → Smart TV, OLED TV, QLED TV, LED TV
-- New additions: Monitors, Gaming Monitors, Projectors

INSERT INTO "ProductSubCategory" (name, slug, description, "categoryId", "sortOrder", "createdBy", "updatedAt")
SELECT v.name, v.slug, v.description, pc.id, v.sort, 'system', NOW()
FROM (VALUES
  ('Smart TV',        'smart-tv',         'Android TV, Google TV & WebOS smart televisions',                           2 ),
  ('LED TV',          'led-tv',           'LED backlit televisions (Full HD, HD Ready)',                               3 ),
  ('OLED TV',         'oled-tv',          'OLED televisions with self-lit pixels & infinite contrast',                  4 ),
  ('QLED TV',         'qled-tv',          'Quantum-dot LED televisions with vivid colour',                              5 ),
  ('Monitors',        'monitors',         'Desktop monitors — Full HD, QHD, 4K & ultrawide',                           6 ),
  ('Gaming Monitors', 'gaming-monitors',  'High-refresh-rate gaming monitors (144 Hz, 240 Hz, 1 ms)',                  7 ),
  ('Projectors',      'projectors',       'Home cinema, business & portable mini projectors',                          8 )
) AS v(name, slug, description, sort)
JOIN "ProductCategory" pc ON pc.slug = 'tv-display'
ON CONFLICT (slug) DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION E: New SubCategories — Gaming                                  ║
-- ║  (slug: gaming)                                                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
--
-- Required by IntentCategoryMap V0092:
--   gaming → Gaming Consoles, Gaming Accessories

INSERT INTO "ProductSubCategory" (name, slug, description, "categoryId", "sortOrder", "createdBy", "updatedAt")
SELECT v.name, v.slug, v.description, pc.id, v.sort, 'system', NOW()
FROM (VALUES
  ('Gaming Consoles',  'gaming-consoles',  'PlayStation, Xbox, Nintendo Switch & gaming consoles',                    2 ),
  ('Gaming Accessories','gaming-accessories','Controllers, headsets, charging docks & gaming peripherals',           3 ),
  ('Gaming Chairs',    'gaming-chairs',    'Ergonomic gaming chairs & racing-style PC chairs',                        4 ),
  ('Gaming Headsets',  'gaming-headsets',  'Wired & wireless gaming headsets with surround sound',                    5 ),
  ('VR Headsets',      'vr-headsets',      'Virtual reality headsets, VR accessories & mixed-reality devices',        6 ),
  ('Gaming Laptops',   'gaming-laptops',   'High-performance gaming laptops with dedicated GPU',                      7 )
) AS v(name, slug, description, sort)
JOIN "ProductCategory" pc ON pc.slug = 'gaming'
ON CONFLICT (slug) DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION F: New SubCategories — Home & Kitchen                          ║
-- ║  (slug: home-kitchen)                                                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO "ProductSubCategory" (name, slug, description, "categoryId", "sortOrder", "createdBy", "updatedAt")
SELECT v.name, v.slug, v.description, pc.id, v.sort, 'system', NOW()
FROM (VALUES
  ('Smart Home Devices', 'smart-home-devices', 'Smart bulbs, plugs, doorbells, security cameras & hubs',              4 ),
  ('Water Purifiers',    'water-purifiers',    'RO water purifiers, UV filters & water dispensers',                    5 ),
  ('Lighting & Fans',    'lighting-fans',      'LED bulbs, ceiling fans, smart lights & decorative lighting',          6 ),
  ('Inverters & UPS',    'inverters-ups',      'Home inverters, UPS systems & solar backup solutions',                 7 )
) AS v(name, slug, description, sort)
JOIN "ProductCategory" pc ON pc.slug = 'home-kitchen'
ON CONFLICT (slug) DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION G: New SubCategories — Computer & Peripherals                  ║
-- ║  (slug: computer-peripherals)                                            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO "ProductSubCategory" (name, slug, description, "categoryId", "sortOrder", "createdBy", "updatedAt")
SELECT v.name, v.slug, v.description, pc.id, v.sort, 'system', NOW()
FROM (VALUES
  ('UPS & Power Protection', 'ups-power-protection', 'UPS units, surge protectors & power conditioners',              5 ),
  ('Cables & Adapters',      'cables-adapters',      'USB, HDMI, DisplayPort, Thunderbolt cables & adapters',         6 ),
  ('Scanners',               'scanners',             'Document scanners, photo scanners & multi-function peripherals', 7 )
) AS v(name, slug, description, sort)
JOIN "ProductCategory" pc ON pc.slug = 'computer-peripherals'
ON CONFLICT (slug) DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION H: New SubCategories — Health & Wellness                       ║
-- ║  (slug: health-wellness)                                                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO "ProductSubCategory" (name, slug, description, "categoryId", "sortOrder", "createdBy", "updatedAt")
SELECT v.name, v.slug, v.description, pc.id, v.sort, 'system', NOW()
FROM (VALUES
  ('Medical Devices',     'medical-devices',     'BP monitors, glucometers, pulse oximeters & digital thermometers',  3 ),
  ('Massage & Relaxation','massage-relaxation',  'Massage guns, foot massagers & relaxation devices',                 4 )
) AS v(name, slug, description, sort)
JOIN "ProductCategory" pc ON pc.slug = 'health-wellness'
ON CONFLICT (slug) DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION I: New SubCategories — Office & Workspace                      ║
-- ║  (slug: office-workspace)                                                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO "ProductSubCategory" (name, slug, description, "categoryId", "sortOrder", "createdBy", "updatedAt")
SELECT v.name, v.slug, v.description, pc.id, v.sort, 'system', NOW()
FROM (VALUES
  ('Ergonomic Furniture',       'ergonomic-furniture',       'Standing desks, ergonomic chairs & monitor arms',          2 ),
  ('Whiteboards & Presentation','whiteboards-presentation',  'Whiteboards, projector screens & presentation tools',       3 ),
  ('Label Printers & Scanners', 'label-printers-scanners',   'Barcode label printers & handheld document scanners',       4 )
) AS v(name, slug, description, sort)
JOIN "ProductCategory" pc ON pc.slug = 'office-workspace'
ON CONFLICT (slug) DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION J: SubCategories — Automotive & GPS (new parent)               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO "ProductSubCategory" (name, slug, description, "categoryId", "sortOrder", "createdBy", "updatedAt")
SELECT v.name, v.slug, v.description, pc.id, v.sort, 'system', NOW()
FROM (VALUES
  ('Dashcams',         'dashcams',         'Front & rear-view dashcams, parking mode cameras',                         1 ),
  ('GPS & Navigation', 'gps-navigation',   'Standalone GPS devices & vehicle navigation systems',                      2 ),
  ('Car Audio',        'car-audio',        'Car speakers, subwoofers, amplifiers & head units',                        3 ),
  ('Car Electronics',  'car-electronics',  'OBD scanners, car chargers, inverters & reverse cameras',                  4 ),
  ('Car Accessories',  'car-accessories',  'Car vacuum cleaners, seat covers, mats & organizers',                      5 )
) AS v(name, slug, description, sort)
JOIN "ProductCategory" pc ON pc.slug = 'automotive-gps'
ON CONFLICT (slug) DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION K: SubCategories — Sports & Outdoors (new parent)              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO "ProductSubCategory" (name, slug, description, "categoryId", "sortOrder", "createdBy", "updatedAt")
SELECT v.name, v.slug, v.description, pc.id, v.sort, 'system', NOW()
FROM (VALUES
  ('Cycles & Accessories', 'cycles-accessories', 'Bicycles, helmets, cycle locks & accessories',                       1 ),
  ('Outdoor Sports',       'outdoor-sports',     'Cricket, football, badminton, tennis & outdoor gear',                2 ),
  ('Gym & Fitness',        'gym-fitness',        'Dumbbells, barbells, gym bags & strength equipment',                 3 ),
  ('Yoga & Pilates',       'yoga-pilates',       'Yoga mats, resistance bands & stretching equipment',                 4 ),
  ('Water Sports',         'water-sports',       'Swimming goggles, floats, surfboards & diving gear',                 5 ),
  ('Sports Accessories',   'sports-accessories', 'Shoe soles, sport socks, support braces & hydration gear',          6 )
) AS v(name, slug, description, sort)
JOIN "ProductCategory" pc ON pc.slug = 'sports-outdoors'
ON CONFLICT (slug) DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION L: SubCategories — Musical Instruments (new parent)            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO "ProductSubCategory" (name, slug, description, "categoryId", "sortOrder", "createdBy", "updatedAt")
SELECT v.name, v.slug, v.description, pc.id, v.sort, 'system', NOW()
FROM (VALUES
  ('Guitars',            'guitars',            'Acoustic, electric & bass guitars',                                     1 ),
  ('Keyboards & Pianos', 'keyboards-pianos',   'Digital pianos, MIDI keyboards & synthesizers',                        2 ),
  ('Drums & Percussion', 'drums-percussion',   'Electronic drum kits, hand drums & percussion instruments',            3 ),
  ('DJ & Music Production','dj-music-production','DJ controllers, audio interfaces, mixers & studio monitors',          4 ),
  ('Musical Accessories','musical-accessories','Strings, picks, cases, tuners & music stands',                         5 )
) AS v(name, slug, description, sort)
JOIN "ProductCategory" pc ON pc.slug = 'musical-instruments'
ON CONFLICT (slug) DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION M: SubCategories — Toys & Kids (new parent)                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO "ProductSubCategory" (name, slug, description, "categoryId", "sortOrder", "createdBy", "updatedAt")
SELECT v.name, v.slug, v.description, pc.id, v.sort, 'system', NOW()
FROM (VALUES
  ('Educational Toys',        'educational-toys',        'STEM kits, building blocks & learning toys',                  1 ),
  ('Action Figures',          'action-figures',          'Action figures, collectibles & superhero toys',                2 ),
  ('Board Games & Puzzles',   'board-games-puzzles',     'Board games, card games & jigsaw puzzles',                    3 ),
  ('RC Toys',                 'rc-toys',                 'Remote-control cars, boats, helicopters & drones',            4 ),
  ('Baby Products',           'baby-products',           'Baby monitors, prams, feeding sets & nursery essentials',     5 )
) AS v(name, slug, description, sort)
JOIN "ProductCategory" pc ON pc.slug = 'toys-kids'
ON CONFLICT (slug) DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION N: Backfill Product.subCategoryId & categoryId                 ║
-- ║  for products whose category text now matches a new subcategory row.     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Case-insensitive match: Product.category text → ProductSubCategory.name
-- Only updates rows where subCategoryId IS NULL (never overwrites an existing link).
UPDATE "Product" p
SET
  "subCategoryId" = sc.id,
  "categoryId"    = sc."categoryId"
FROM "ProductSubCategory" sc
WHERE LOWER(p.category) = LOWER(sc.name)
  AND p."subCategoryId" IS NULL;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION O: Verification                                                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

DO $$
DECLARE
  cat_count    INTEGER;
  subcat_count INTEGER;
  mapped       INTEGER;
  unmapped     INTEGER;
BEGIN
  SELECT COUNT(*) INTO cat_count    FROM "ProductCategory"    WHERE status = 'ACTIVE';
  SELECT COUNT(*) INTO subcat_count FROM "ProductSubCategory" WHERE status = 'ACTIVE';
  SELECT COUNT(*) INTO mapped       FROM "Product"            WHERE "categoryId" IS NOT NULL;
  SELECT COUNT(*) INTO unmapped     FROM "Product"            WHERE "categoryId" IS NULL;

  RAISE NOTICE '=== V0093 Migration Summary ===';
  RAISE NOTICE 'Active parent categories  : %', cat_count;
  RAISE NOTICE 'Active subcategories      : %', subcat_count;
  RAISE NOTICE 'Products linked to category  : %', mapped;
  RAISE NOTICE 'Products without category link: %', unmapped;

  IF subcat_count < 20 THEN
    RAISE EXCEPTION 'V0093: Expected at least 20 subcategories, got %', subcat_count;
  END IF;
END $$;

-- Show final category → subcategory distribution
SELECT
  pc.name AS "Category",
  COUNT(psc.id) AS "SubCategories"
FROM "ProductCategory" pc
LEFT JOIN "ProductSubCategory" psc ON psc."categoryId" = pc.id AND psc.status = 'ACTIVE'
WHERE pc.status = 'ACTIVE'
GROUP BY pc.name, pc."sortOrder"
ORDER BY pc."sortOrder";

COMMIT;
