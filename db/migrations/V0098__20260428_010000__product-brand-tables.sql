-- V0098: ProductBrand & ProductBrandMap Tables
-- ─────────────────────────────────────────────────────────────────────────────
-- Creates ProductBrand and ProductBrandMap tables as requested.
-- ProductBrand stores brand metadata; ProductBrandMap links products to brands.
-- Brands are inferred from product names (first word = brand name convention
-- established in V0097 migration).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Create ProductBrand table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ProductBrand" (
  "id"          SERIAL PRIMARY KEY,
  "name"        TEXT        NOT NULL UNIQUE,
  "slug"        TEXT        NOT NULL UNIQUE,
  "description" TEXT,
  "logoUrl"     TEXT,
  "website"     TEXT,
  "country"     TEXT,
  "createdAt"   TIMESTAMP   NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ── Create ProductBrandMap table (many-to-many) ───────────────────────────────
CREATE TABLE IF NOT EXISTS "ProductBrandMap" (
  "id"        SERIAL PRIMARY KEY,
  "productId" INTEGER     NOT NULL,
  "brandId"   INTEGER     NOT NULL,
  "createdAt" TIMESTAMP   NOT NULL DEFAULT NOW(),
  CONSTRAINT "ProductBrandMap_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE,
  CONSTRAINT "ProductBrandMap_brandId_fkey"
    FOREIGN KEY ("brandId") REFERENCES "ProductBrand"("id") ON DELETE CASCADE,
  CONSTRAINT "ProductBrandMap_productId_brandId_unique"
    UNIQUE ("productId", "brandId")
);

CREATE INDEX IF NOT EXISTS "ProductBrandMap_productId_idx" ON "ProductBrandMap" ("productId");
CREATE INDEX IF NOT EXISTS "ProductBrandMap_brandId_idx"   ON "ProductBrandMap" ("brandId");

-- ── Seed ProductBrand table ───────────────────────────────────────────────────

INSERT INTO "ProductBrand" ("name", "slug", "description", "country") VALUES
  -- Electronics & Mobiles
  ('Apple',          'apple',          'Consumer electronics, software and services', 'USA'),
  ('Samsung',        'samsung',        'Smartphones, tablets, TVs & home appliances', 'South Korea'),
  ('OnePlus',        'oneplus',        'Premium Android smartphones', 'China'),
  ('Xiaomi',         'xiaomi',         'Smartphones, IoT devices & ecosystem', 'China'),
  ('Google',         'google',         'Pixel smartphones, Nest smart home devices', 'USA'),
  ('Nothing',        'nothing',        'Transparent-design smartphones & earbuds', 'UK'),
  ('Motorola',       'motorola',       'Android smartphones from entry to premium', 'USA'),
  ('Vivo',           'vivo',           'Camera-focused Android smartphones', 'China'),
  ('Oppo',           'oppo',           'Smartphones with fast-charging technology', 'China'),
  ('Realme',         'realme',         'Value-for-money smartphones & accessories', 'China'),
  ('iQOO',           'iqoo',           'Gaming-focused smartphones by Vivo', 'China'),
  ('Tecno',          'tecno',          'Budget Android smartphones for emerging markets', 'China'),
  ('Infinix',        'infinix',        'Affordable smartphones & laptops', 'China'),
  ('Nokia',          'nokia',          'Durable Android smartphones', 'Finland'),
  ('Lava',           'lava',           'Made-in-India smartphones', 'India'),
  -- Laptops & Computing
  ('HP',             'hp',             'Laptops, printers & enterprise computing', 'USA'),
  ('Dell',           'dell',           'Laptops, desktops & servers', 'USA'),
  ('Lenovo',         'lenovo',         'ThinkPad, IdeaPad, Legion laptops & tablets', 'China'),
  ('ASUS',           'asus',           'Laptops, motherboards & gaming peripherals', 'Taiwan'),
  ('ASUS ROG',       'asus-rog',       'Republic of Gamers — premium gaming laptops & accessories', 'Taiwan'),
  ('Lenovo Legion',  'lenovo-legion',  'High-performance gaming laptops by Lenovo', 'China'),
  ('HP OMEN',        'hp-omen',        'Gaming laptops and desktops by HP', 'USA'),
  ('Dell Alienware', 'dell-alienware', 'Premium gaming laptops by Dell', 'USA'),
  ('Acer',           'acer',           'Laptops, desktops & monitors', 'Taiwan'),
  ('Acer Nitro',     'acer-nitro',     'Gaming laptops and monitors by Acer', 'Taiwan'),
  ('MSI',            'msi',            'Gaming laptops, desktops & peripherals', 'Taiwan'),
  ('Razer',          'razer',          'Premium gaming laptops & peripherals', 'USA'),
  ('Microsoft',      'microsoft',      'Surface laptops, tablets & Xbox', 'USA'),
  ('LG',             'lg',             'TVs, home appliances, laptops & monitors', 'South Korea'),
  -- Home Appliances
  ('Whirlpool',      'whirlpool',      'Home appliances — washers, fridges, ACs', 'USA'),
  ('Bosch',          'bosch',          'Premium home appliances & power tools', 'Germany'),
  ('Haier',          'haier',          'Refrigerators, ACs & washing machines', 'China'),
  ('IFB',            'ifb',            'Front-load washing machines & microwaves', 'India'),
  ('Panasonic',      'panasonic',      'Home appliances, electronics & batteries', 'Japan'),
  ('Voltas',         'voltas',         'Air conditioners & refrigerators by TATA', 'India'),
  ('Godrej',         'godrej',         'Home appliances, security & interiors', 'India'),
  ('Siemens',        'siemens',        'Premium home appliances & industrial equipment', 'Germany'),
  ('Hitachi',        'hitachi',        'ACs, refrigerators & industrial electronics', 'Japan'),
  ('Dyson',          'dyson',          'Vacuum cleaners, hair care & air purifiers', 'UK'),
  ('Daikin',         'daikin',         'World leader in air conditioning technology', 'Japan'),
  ('Blue Star',      'blue-star',      'Commercial & residential air conditioners', 'India'),
  ('Carrier',        'carrier',        'HVAC & cooling solutions', 'USA'),
  ('Eureka Forbes',  'eureka-forbes',  'Water purifiers, vacuum cleaners & security', 'India'),
  ('iRobot',         'irobot',         'Roomba robot vacuum cleaners', 'USA'),
  -- Kitchen Appliances
  ('Preethi',        'preethi',        'Mixer grinders, blenders & kitchen appliances', 'India'),
  ('Philips',        'philips',        'Health, lighting & home appliances', 'Netherlands'),
  ('Bajaj',          'bajaj',          'Electrical appliances & consumer electronics', 'India'),
  ('Prestige',       'prestige',       'Kitchen appliances, cookware & appliances', 'India'),
  ('Butterfly',      'butterfly',      'Kitchen appliances & cookware', 'India'),
  ('Crompton',       'crompton',       'Fans, lighting & kitchen appliances', 'India'),
  ('Morphy Richards','morphy-richards', 'Premium kitchen & personal care appliances', 'UK'),
  ('Nespresso',      'nespresso',      'Premium capsule coffee machines', 'Switzerland'),
  ('DeLonghi',       'delonghi',       'Espresso machines & kitchen appliances', 'Italy'),
  -- Audio
  ('Sony',           'sony',           'Electronics, gaming & entertainment', 'Japan'),
  ('Bose',           'bose',           'Premium headphones & speakers', 'USA'),
  ('JBL',            'jbl',            'Bluetooth speakers, headphones & soundbars', 'USA'),
  ('Sennheiser',     'sennheiser',     'Professional audio & headphones', 'Germany'),
  ('boAt',           'boat',           'Audio products & wearables for India', 'India'),
  ('Jabra',          'jabra',          'Professional headsets & earbuds', 'Denmark'),
  ('Marshall',       'marshall',       'Music amplifiers, headphones & speakers', 'UK'),
  ('Noise',          'noise',          'Smartwatches, earbuds & fitness trackers', 'India'),
  -- Gaming
  ('Corsair',        'corsair',        'PC components, peripherals & gaming gear', 'USA'),
  ('Logitech',       'logitech',       'Keyboards, mice, webcams & speakers', 'Switzerland'),
  ('Keychron',       'keychron',       'Mechanical keyboards for Mac & Windows', 'China'),
  ('HyperX',         'hyperx',         'Gaming headsets, keyboards & mouse pads', 'USA'),
  ('SteelSeries',    'steelseries',    'Gaming keyboards, mice & headsets', 'Denmark'),
  ('Nintendo',       'nintendo',       'Gaming consoles — Switch, Mario & Zelda', 'Japan'),
  -- Storage & Networking
  ('Western Digital','western-digital','Hard drives, SSDs & network storage', 'USA'),
  ('Seagate',        'seagate',        'HDDs, SSDs & data storage solutions', 'USA'),
  ('SanDisk',        'sandisk',        'Flash storage, SSDs & memory cards', 'USA'),
  ('Kingston',       'kingston',       'RAM modules, SSDs & flash storage', 'USA'),
  ('TP-Link',        'tp-link',        'WiFi routers, mesh systems & smart home', 'China'),
  ('Netgear',        'netgear',        'Networking equipment & WiFi solutions', 'USA'),
  ('D-Link',         'd-link',         'Networking products & smart home devices', 'Taiwan'),
  ('Garmin',         'garmin',         'GPS devices, smartwatches & fitness trackers', 'USA'),
  ('Fitbit',         'fitbit',         'Fitness trackers & smartwatches by Google', 'USA'),
  ('Amazfit',        'amazfit',        'Smart sports watches & fitness bands', 'China')
ON CONFLICT ("name") DO NOTHING;

-- ── Populate ProductBrandMap from product names ───────────────────────────────
-- Extract brand from product name: compare start of name against known brands
-- Order matters: longer/more-specific brand names checked first

INSERT INTO "ProductBrandMap" ("productId", "brandId")
SELECT DISTINCT p.id, b.id
FROM "Product" p
JOIN "ProductBrand" b ON p.name ILIKE b.name || ' %'
ON CONFLICT ("productId", "brandId") DO NOTHING;

-- ── Verify ────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  brand_cnt  INTEGER;
  map_cnt    INTEGER;
BEGIN
  SELECT count(*) INTO brand_cnt FROM "ProductBrand";
  SELECT count(*) INTO map_cnt   FROM "ProductBrandMap";
  RAISE NOTICE 'ProductBrand rows: %, ProductBrandMap rows: %', brand_cnt, map_cnt;
END $$;

COMMIT;
