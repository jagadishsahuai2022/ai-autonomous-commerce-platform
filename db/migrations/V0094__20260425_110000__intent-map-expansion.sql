-- ============================================================================
-- Migration V0094: IntentCategoryMap Expansion
-- ============================================================================
--
-- PURPOSE:
--   1. UPDATE existing IntentCategoryMap rows (seeded by V0092) to include
--      the new subcategory names added by V0093 in their candidate arrays.
--      (V0092 used ON CONFLICT DO NOTHING, so stale arrays are in the DB.)
--   2. INSERT new intent entries for product types added in V0093 but not yet
--      in the intent taxonomy (monitor, drone, dashcam, projector, etc.).
--
-- WHY NOT JUST EDIT V0092?
--   The migration log (_migration_log) marks V0092 as already applied on the
--   VPS.  Adding rows via a new V0094 migration is idempotent and safe.
--
-- CACHE NOTE:
--   The web app caches taxonomy for up to 5 minutes (CACHE_TTL_MS).  After
--   this migration is applied on the VPS, the change is automatically picked
--   up within 5 minutes with no restart required.
--
-- DEPLOYMENT:
--   GitHub Actions → "DB — Schema Sync & Migration (manual)"
--   → action: run-versioned-migrations → confirm: yes
--
-- PREREQUISITE: V0092 and V0093 must be applied first.
-- ============================================================================

BEGIN;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  PART 1: UPDATE existing intents — add new subcategory candidates        ║
-- ║                                                                           ║
-- ║  V0092 seeded these arrays, but V0093 just added the subcategory rows.   ║
-- ║  We extend the arrays and refresh updatedAt so the cache TTL kicks in.   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- phone: add Mobile Phones, Feature Phones (V0093 created these rows)
UPDATE "IntentCategoryMap"
SET
  "subcategoryCandidates" = ARRAY[
    'Smartphones', 'Mobile Phones', 'Feature Phones'
  ],
  "genericNouns" = ARRAY[
    'Smartphone', 'Mobile Phone', 'Feature Phone', 'Android Phone'
  ],
  "updatedAt" = NOW()
WHERE intent = 'phone'
  AND NOT ('Mobile Phones' = ANY("subcategoryCandidates"));

-- laptop: add Notebooks, Ultrabooks, Gaming Laptops
UPDATE "IntentCategoryMap"
SET
  "subcategoryCandidates" = ARRAY[
    'Laptops', 'Notebooks', 'Ultrabooks', 'Gaming Laptops'
  ],
  "genericNouns" = ARRAY[
    'Laptop', 'Notebook', 'Ultrabook', 'Gaming Laptop', 'Chromebook'
  ],
  "updatedAt" = NOW()
WHERE intent = 'laptop'
  AND NOT ('Notebooks' = ANY("subcategoryCandidates"));

-- tablet: add E-Readers
UPDATE "IntentCategoryMap"
SET
  "subcategoryCandidates" = ARRAY['Tablets', 'E-Readers'],
  "genericNouns"          = ARRAY['Tablet', 'E-Reader', 'iPad', 'Android Tablet'],
  "updatedAt" = NOW()
WHERE intent = 'tablet'
  AND NOT ('E-Readers' = ANY("subcategoryCandidates"));

-- camera: add DSLR Cameras, Mirrorless Cameras, Action Cameras, Webcams
UPDATE "IntentCategoryMap"
SET
  "subcategoryCandidates" = ARRAY[
    'Cameras', 'DSLR Cameras', 'Mirrorless Cameras', 'Action Cameras', 'Webcams'
  ],
  "genericNouns" = ARRAY[
    'Camera', 'DSLR Camera', 'Mirrorless Camera', 'Action Camera',
    'Webcam', 'Digital Camera', 'Point and Shoot Camera'
  ],
  "updatedAt" = NOW()
WHERE intent = 'camera'
  AND NOT ('DSLR Cameras' = ANY("subcategoryCandidates"));

-- headphones: add Earbuds, Earphones, Neckband (V0093 created these rows)
UPDATE "IntentCategoryMap"
SET
  "subcategoryCandidates" = ARRAY[
    'Headphones', 'Earbuds', 'Earphones', 'Neckband', 'Audio Equipment'
  ],
  "genericNouns" = ARRAY[
    'Headphones', 'Earphones', 'TWS Earbuds', 'Neckband',
    'Earbuds', 'Over-Ear Headphones', 'In-Ear Headphones'
  ],
  "updatedAt" = NOW()
WHERE intent = 'headphones'
  AND NOT ('Earbuds' = ANY("subcategoryCandidates"));

-- speaker: add Bluetooth Speakers, Soundbars, Home Theatre Systems
UPDATE "IntentCategoryMap"
SET
  "subcategoryCandidates" = ARRAY[
    'Speakers', 'Bluetooth Speakers', 'Soundbars',
    'Home Theatre Systems', 'Audio Equipment'
  ],
  "genericNouns" = ARRAY[
    'Bluetooth Speaker', 'Speaker', 'Soundbar',
    'Home Theatre System', 'Party Speaker', 'Portable Speaker'
  ],
  "updatedAt" = NOW()
WHERE intent = 'speaker'
  AND NOT ('Bluetooth Speakers' = ANY("subcategoryCandidates"));

-- watch: add Fitness Trackers, Smart Bands
UPDATE "IntentCategoryMap"
SET
  "subcategoryCandidates" = ARRAY['Smartwatches', 'Fitness Trackers', 'Smart Bands'],
  "genericNouns"          = ARRAY['Smartwatch', 'Fitness Tracker', 'Smart Band', 'Smart Watch'],
  "updatedAt" = NOW()
WHERE intent = 'watch'
  AND NOT ('Fitness Trackers' = ANY("subcategoryCandidates"));

-- watches (alias)
UPDATE "IntentCategoryMap"
SET
  "subcategoryCandidates" = ARRAY['Smartwatches', 'Fitness Trackers', 'Smart Bands'],
  "genericNouns"          = ARRAY['Smartwatch', 'Fitness Tracker', 'Smart Band'],
  "updatedAt" = NOW()
WHERE intent = 'watches'
  AND NOT ('Fitness Trackers' = ANY("subcategoryCandidates"));

-- television: add Smart TV, LED TV, OLED TV, QLED TV
UPDATE "IntentCategoryMap"
SET
  "subcategoryCandidates" = ARRAY[
    'Televisions', 'Smart TV', 'OLED TV', 'QLED TV', 'LED TV'
  ],
  "genericNouns" = ARRAY[
    'Television', 'Smart TV', '4K TV', 'LED TV', 'OLED TV', 'QLED TV', 'Android TV'
  ],
  "updatedAt" = NOW()
WHERE intent = 'television'
  AND NOT ('Smart TV' = ANY("subcategoryCandidates"));

-- gaming: add Gaming Consoles, Gaming Accessories, Gaming Laptops
UPDATE "IntentCategoryMap"
SET
  "subcategoryCandidates" = ARRAY[
    'Gaming', 'Gaming Consoles', 'Gaming Accessories', 'Gaming Laptops'
  ],
  "genericNouns" = ARRAY[
    'Gaming Console', 'Gaming Laptop', 'Gaming Chair',
    'Gaming Headset', 'Gaming Controller', 'Gaming Mouse'
  ],
  "updatedAt" = NOW()
WHERE intent = 'gaming'
  AND NOT ('Gaming Consoles' = ANY("subcategoryCandidates"));

-- appliances: add Water Purifiers
UPDATE "IntentCategoryMap"
SET
  "subcategoryCandidates" = ARRAY[
    'Home Appliances', 'Kitchen Appliances', 'Water Purifiers'
  ],
  "genericNouns" = ARRAY[
    'Washing Machine', 'Refrigerator', 'Air Conditioner', 'Microwave',
    'Air Fryer', 'Dishwasher', 'Water Purifier', 'Vacuum Cleaner',
    'Induction Cooktop', 'Electric Kettle', 'Toaster', 'Mixer Grinder'
  ],
  "updatedAt" = NOW()
WHERE intent = 'appliances'
  AND NOT ('Water Purifiers' = ANY("subcategoryCandidates"));

-- fitness: add Gym & Fitness, Yoga & Pilates subcategories
UPDATE "IntentCategoryMap"
SET
  "subcategoryCandidates" = ARRAY['Fitness Equipment', 'Gym & Fitness', 'Yoga & Pilates'],
  "genericNouns"          = ARRAY[
    'Treadmill', 'Exercise Bike', 'Yoga Mat', 'Dumbbell Set',
    'Resistance Band', 'Pull-Up Bar', 'Kettlebell', 'Jump Rope'
  ],
  "updatedAt" = NOW()
WHERE intent = 'fitness'
  AND NOT ('Gym & Fitness' = ANY("subcategoryCandidates"));

-- grooming: add Medical Devices, Massage & Relaxation candidates
UPDATE "IntentCategoryMap"
SET
  "subcategoryCandidates" = ARRAY['Personal Care', 'Medical Devices'],
  "genericNouns"          = ARRAY[
    'Trimmer', 'Electric Shaver', 'Hair Dryer', 'IPL Hair Removal Device',
    'Hair Straightener', 'Epilator', 'Beard Trimmer', 'Electric Toothbrush'
  ],
  "updatedAt" = NOW()
WHERE intent = 'grooming'
  AND NOT ('Medical Devices' = ANY("subcategoryCandidates"));

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  PART 2: INSERT new intent entries (V0093 product types)                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO "IntentCategoryMap"
  (intent, "subcategoryCandidates", "parentBroadeningKeyword", "genericNouns", "sortOrder")
VALUES

  -- ── Electronics & Mobile ──────────────────────────────────────────────────
  ('powerbank',
   ARRAY['Power Banks'],
   'power',
   ARRAY['Power Bank', 'Portable Charger', 'Powerbank'],
   22),

  ('charger',
   ARRAY['Chargers & Cables', 'Mobile Accessories'],
   'charge',
   ARRAY['Fast Charger', 'USB-C Charger', 'Wireless Charger', 'Wall Charger'],
   23),

  ('drone',
   ARRAY['Drones'],
   'drone',
   ARRAY['Drone', 'Quadcopter', 'Camera Drone', 'FPV Drone'],
   24),

  ('mobileaccessory',
   ARRAY['Mobile Accessories', 'Chargers & Cables'],
   'mobile',
   ARRAY['Phone Case', 'Screen Protector', 'Phone Cover', 'Mobile Stand'],
   25),

  -- ── TV & Display ──────────────────────────────────────────────────────────
  ('monitor',
   ARRAY['Monitors', 'Gaming Monitors'],
   'monitor',
   ARRAY['Monitor', 'Display', 'LED Monitor', 'IPS Monitor', '4K Monitor'],
   30),

  ('projector',
   ARRAY['Projectors'],
   'projector',
   ARRAY['Projector', 'Mini Projector', 'Home Cinema Projector', '4K Projector'],
   31),

  -- ── Gaming ────────────────────────────────────────────────────────────────
  ('gamingchair',
   ARRAY['Gaming Chairs', 'Ergonomic Furniture'],
   'chair',
   ARRAY['Gaming Chair', 'Ergonomic Chair', 'Racing Chair'],
   35),

  ('vr',
   ARRAY['VR Headsets'],
   'vr',
   ARRAY['VR Headset', 'Virtual Reality Headset', 'Meta Quest', 'VR Glasses'],
   36),

  -- ── Home & Kitchen ────────────────────────────────────────────────────────
  ('smarthome',
   ARRAY['Smart Home Devices'],
   'smart',
   ARRAY['Smart Bulb', 'Smart Plug', 'Smart Doorbell', 'Smart Lock', 'Smart Hub'],
   40),

  ('waterpurifier',
   ARRAY['Water Purifiers', 'Home Appliances'],
   'water',
   ARRAY['Water Purifier', 'RO Water Purifier', 'UV Water Purifier', 'Water Filter'],
   41),

  ('airconditioner',
   ARRAY['Home Appliances'],
   'conditioner',
   ARRAY['Air Conditioner', 'Split AC', 'Window AC', 'Portable AC', 'Inverter AC'],
   42),

  ('refrigerator',
   ARRAY['Home Appliances'],
   'fridge',
   ARRAY['Refrigerator', 'Fridge', 'Double Door Fridge', 'Side by Side Refrigerator'],
   43),

  ('washingmachine',
   ARRAY['Home Appliances'],
   'wash',
   ARRAY['Washing Machine', 'Front Load Washing Machine', 'Top Load Washing Machine',
         'Fully Automatic Washing Machine'],
   44),

  ('microwave',
   ARRAY['Kitchen Appliances'],
   'microwave',
   ARRAY['Microwave', 'Microwave Oven', 'Solo Microwave', 'Convection Microwave'],
   45),

  ('airfryer',
   ARRAY['Kitchen Appliances'],
   'fryer',
   ARRAY['Air Fryer', 'Digital Air Fryer', 'Air Fryer Oven'],
   46),

  -- ── Computer & Peripherals ────────────────────────────────────────────────
  ('ups',
   ARRAY['UPS & Power Protection', 'Inverters & UPS'],
   'ups',
   ARRAY['UPS', 'Uninterruptible Power Supply', 'Home Inverter', 'Power Backup'],
   50),

  -- ── Automotive & GPS ──────────────────────────────────────────────────────
  ('dashcam',
   ARRAY['Dashcams'],
   'dashcam',
   ARRAY['Dashcam', 'Dash Cam', 'Car Camera', 'Front Camera', 'Parking Camera'],
   60),

  ('gps',
   ARRAY['GPS & Navigation'],
   'gps',
   ARRAY['GPS Device', 'GPS Navigator', 'Car GPS', 'Navigation System'],
   61),

  ('caraudio',
   ARRAY['Car Audio', 'Car Electronics'],
   'car',
   ARRAY['Car Speaker', 'Car Subwoofer', 'Car Stereo', 'Car Amplifier'],
   62),

  -- ── Sports & Outdoors ─────────────────────────────────────────────────────
  ('cycle',
   ARRAY['Cycles & Accessories'],
   'cycle',
   ARRAY['Bicycle', 'Cycle', 'Mountain Bike', 'Road Bike', 'Electric Cycle'],
   70),

  ('cricket',
   ARRAY['Outdoor Sports', 'Sports Accessories'],
   'sport',
   ARRAY['Cricket Bat', 'Cricket Kit', 'Cricket Helmet', 'Cricket Gloves'],
   71),

  -- ── Health & Wellness ─────────────────────────────────────────────────────
  ('massager',
   ARRAY['Massage & Relaxation', 'Personal Care'],
   'massage',
   ARRAY['Massage Gun', 'Foot Massager', 'Back Massager', 'Neck Massager'],
   80),

  ('bpmonitor',
   ARRAY['Medical Devices'],
   'monitor',
   ARRAY['Blood Pressure Monitor', 'BP Machine', 'Digital BP Monitor',
         'Automatic BP Monitor'],
   81),

  ('glucometer',
   ARRAY['Medical Devices'],
   'glucose',
   ARRAY['Glucometer', 'Blood Glucose Monitor', 'Blood Sugar Monitor',
         'Glucose Meter'],
   82),

  -- ── Musical Instruments ───────────────────────────────────────────────────
  ('guitar',
   ARRAY['Guitars', 'Musical Accessories'],
   'guitar',
   ARRAY['Guitar', 'Acoustic Guitar', 'Electric Guitar', 'Bass Guitar'],
   90),

  ('keyboard',
   ARRAY['Keyboards & Pianos'],
   'keyboard',
   ARRAY['Digital Piano', 'MIDI Keyboard', 'Keyboard Piano', 'Synthesizer'],
   91)

ON CONFLICT (intent) DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  PART 3: Verification                                                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

DO $$
DECLARE
  icm_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO icm_count FROM "IntentCategoryMap" WHERE status = 'ACTIVE';
  RAISE NOTICE '=== V0094 Migration Summary ===';
  RAISE NOTICE 'Total active IntentCategoryMap entries: %', icm_count;
  IF icm_count < 20 THEN
    RAISE EXCEPTION 'V0094: Expected at least 20 intent entries, got %', icm_count;
  END IF;
  RAISE NOTICE 'V0094 completed successfully.';
END $$;

-- Show all active intents (informational)
SELECT intent, "subcategoryCandidates", array_length("genericNouns", 1) AS noun_count
FROM   "IntentCategoryMap"
WHERE  status = 'ACTIVE'
ORDER  BY "sortOrder", intent;

COMMIT;
