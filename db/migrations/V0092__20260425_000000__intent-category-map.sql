-- ============================================================================
-- Migration V0092: IntentCategoryMap — DB-driven intent taxonomy
--
-- Purpose:
--   Replaces hardcoded category/noun maps in the Smart Intent Engine with an
--   admin-editable DB table.  The web app loads this table at runtime (cached
--   5 min) and merges it with live Product.genericName values so the taxonomy
--   grows automatically as new products are added — no redeploy needed.
--
-- Admin usage examples:
--   -- Add a new noun without touching code:
--   UPDATE "IntentCategoryMap"
--   SET    "genericNouns" = "genericNouns" || ARRAY['Chromebook'], "updatedAt" = NOW()
--   WHERE  intent = 'laptop';
--
--   -- Add a new intent entirely:
--   INSERT INTO "IntentCategoryMap" (intent, "subcategoryCandidates",
--     "parentBroadeningKeyword", "genericNouns", "sortOrder")
--   VALUES ('smartspeaker', ARRAY['Smart Speakers'], 'speaker',
--           ARRAY['Smart Speaker', 'Voice Assistant'], 100);
--
-- Backward compatible: the web app falls back to static defaults when this
-- table is empty or unreachable.
-- ============================================================================

BEGIN;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  Step 1: Create IntentCategoryMap table                                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS "IntentCategoryMap" (
  id                        SERIAL      PRIMARY KEY,

  -- Canonical intent slug used by the entity extractor (e.g. 'phone', 'laptop')
  intent                    TEXT        NOT NULL,

  -- Ordered list of exact Product.category values to try in Strategy 1.
  -- Try the most specific / most common alias first.
  "subcategoryCandidates"   TEXT[]      NOT NULL DEFAULT '{}',

  -- Short substring for Strategy 2a ILIKE broadening (nullable = skip 2a).
  -- Example: 'appliances' → matches "Home Appliances" AND "Kitchen Appliances".
  "parentBroadeningKeyword" TEXT,

  -- Canonical Product.genericName values for Strategy 3 noun-only search.
  -- Live values from the actual product catalog are merged in at load time.
  "genericNouns"            TEXT[]      NOT NULL DEFAULT '{}',

  status                    TEXT        NOT NULL DEFAULT 'ACTIVE',
  "sortOrder"               INT         NOT NULL DEFAULT 0,
  "createdBy"               TEXT        DEFAULT 'system',
  "modifiedBy"              TEXT        DEFAULT 'system',
  "createdAt"               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "IntentCategoryMap_intent_key" UNIQUE (intent),
  CONSTRAINT "IntentCategoryMap_status_check" CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX IF NOT EXISTS idx_icm_status    ON "IntentCategoryMap" (status);
CREATE INDEX IF NOT EXISTS idx_icm_sort      ON "IntentCategoryMap" ("sortOrder", intent);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  Step 2: Seed initial taxonomy                                           ║
-- ║  (matches the previous hardcoded maps; update via SQL going forward)    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Electronics & Mobile
INSERT INTO "IntentCategoryMap"
  (intent, "subcategoryCandidates", "parentBroadeningKeyword", "genericNouns", "sortOrder")
VALUES
  ('phone',
   ARRAY['Smartphones', 'Mobile Phones', 'Feature Phones'],
   'phone',
   ARRAY['Smartphone', 'Mobile Phone'],
   10),
  ('laptop',
   ARRAY['Laptops', 'Notebooks', 'Ultrabooks'],
   'laptop',
   ARRAY['Laptop', 'Notebook', 'Ultrabook'],
   20),
  ('tablet',
   ARRAY['Tablets', 'E-Readers'],
   'tablet',
   ARRAY['Tablet'],
   30),
  ('camera',
   ARRAY['Cameras', 'DSLR Cameras', 'Action Cameras', 'Webcams'],
   'camera',
   ARRAY['Camera', 'DSLR Camera', 'Mirrorless Camera', 'Action Camera'],
   40)
ON CONFLICT (intent) DO NOTHING;

-- Audio & Wearables
INSERT INTO "IntentCategoryMap"
  (intent, "subcategoryCandidates", "parentBroadeningKeyword", "genericNouns", "sortOrder")
VALUES
  ('headphones',
   ARRAY['Headphones', 'Earbuds', 'Earphones', 'Neckband', 'Audio Equipment'],
   'headphone',
   ARRAY['Headphones', 'Earphones', 'TWS Earbuds', 'Neckband', 'Earbuds'],
   50),
  ('speaker',
   ARRAY['Speakers', 'Bluetooth Speakers', 'Soundbars', 'Audio Equipment'],
   'speaker',
   ARRAY['Bluetooth Speaker', 'Speaker', 'Soundbar'],
   60),
  ('watch',
   ARRAY['Smartwatches', 'Fitness Trackers', 'Smart Bands'],
   'watch',
   ARRAY['Smartwatch', 'Fitness Tracker', 'Smart Band'],
   70),
  ('watches',
   ARRAY['Smartwatches', 'Fitness Trackers', 'Smart Bands'],
   'watch',
   ARRAY['Smartwatch', 'Fitness Tracker'],
   71)
ON CONFLICT (intent) DO NOTHING;

-- TV & Display
INSERT INTO "IntentCategoryMap"
  (intent, "subcategoryCandidates", "parentBroadeningKeyword", "genericNouns", "sortOrder")
VALUES
  ('television',
   ARRAY['Televisions', 'Smart TV', 'OLED TV', 'QLED TV', 'LED TV'],
   'telev',
   ARRAY['Television', 'Smart TV', '4K TV', 'LED TV'],
   80)
ON CONFLICT (intent) DO NOTHING;

-- Gaming
INSERT INTO "IntentCategoryMap"
  (intent, "subcategoryCandidates", "parentBroadeningKeyword", "genericNouns", "sortOrder")
VALUES
  ('gaming',
   ARRAY['Gaming', 'Gaming Consoles', 'Gaming Accessories'],
   'gaming',
   ARRAY['Gaming Console', 'Gaming Laptop', 'Gaming Chair', 'Gaming Headset'],
   90)
ON CONFLICT (intent) DO NOTHING;

-- Home & Kitchen
INSERT INTO "IntentCategoryMap"
  (intent, "subcategoryCandidates", "parentBroadeningKeyword", "genericNouns", "sortOrder")
VALUES
  ('appliances',
   ARRAY['Home Appliances', 'Kitchen Appliances'],
   'appliances',
   ARRAY['Washing Machine', 'Refrigerator', 'Air Conditioner', 'Microwave',
         'Air Fryer', 'Dishwasher', 'Water Purifier', 'Vacuum Cleaner'],
   100),
  ('furniture',
   ARRAY['Furniture'],
   'furniture',
   ARRAY['Sofa', 'Bed', 'Mattress', 'Ergonomic Chair', 'Standing Desk'],
   110)
ON CONFLICT (intent) DO NOTHING;

-- Computer & Peripherals
INSERT INTO "IntentCategoryMap"
  (intent, "subcategoryCandidates", "parentBroadeningKeyword", "genericNouns", "sortOrder")
VALUES
  ('accessories',
   ARRAY['Computer Accessories'],
   'accessories',
   ARRAY['Keyboard', 'Mouse', 'Monitor', 'Webcam', 'USB Hub'],
   120),
  ('storage',
   ARRAY['Storage Devices'],
   'storage',
   ARRAY['SSD', 'Hard Drive', 'External SSD', 'Pen Drive', 'NAS Drive'],
   130),
  ('networking',
   ARRAY['Networking'],
   'network',
   ARRAY['WiFi Router', 'Mesh Router', 'Router', 'Network Switch'],
   140),
  ('printer',
   ARRAY['Printers'],
   'printer',
   ARRAY['Laser Printer', 'Inkjet Printer', 'All-in-One Printer'],
   150)
ON CONFLICT (intent) DO NOTHING;

-- Health & Wellness
INSERT INTO "IntentCategoryMap"
  (intent, "subcategoryCandidates", "parentBroadeningKeyword", "genericNouns", "sortOrder")
VALUES
  ('grooming',
   ARRAY['Personal Care'],
   'care',
   ARRAY['Trimmer', 'Electric Shaver', 'Hair Dryer', 'IPL Hair Removal Device'],
   160),
  ('fitness',
   ARRAY['Fitness Equipment'],
   'fitness',
   ARRAY['Treadmill', 'Exercise Bike', 'Yoga Mat', 'Dumbbell Set'],
   170)
ON CONFLICT (intent) DO NOTHING;

-- Office & Workspace
INSERT INTO "IntentCategoryMap"
  (intent, "subcategoryCandidates", "parentBroadeningKeyword", "genericNouns", "sortOrder")
VALUES
  ('stationery',
   ARRAY['Office Supplies'],
   'office',
   ARRAY['Office Supplies', 'Paper Shredder', 'Calculator'],
   180),
  ('office',
   ARRAY['Office Supplies'],
   'office',
   ARRAY['Ergonomic Chair', 'Standing Desk', 'Office Supplies'],
   181)
ON CONFLICT (intent) DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  Step 3: Verification                                                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

DO $$
DECLARE
  row_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO row_count FROM "IntentCategoryMap" WHERE status = 'ACTIVE';
  IF row_count = 0 THEN
    RAISE EXCEPTION 'IntentCategoryMap seed failed — table is empty';
  END IF;
  RAISE NOTICE 'IntentCategoryMap: % active intents seeded.', row_count;
END $$;

COMMIT;
