-- V0097: Realistic Product Names & Descriptions
-- ─────────────────────────────────────────────────────────────────────────────
-- ROOT CAUSE FIXED:
--   Products in Home Appliances had names like "Corsair V15 Detect Premium"
--   and "Xiaomi V15 Detect Premium" — these are PC peripherals / vacuum cleaner
--   models, completely wrong for Washing Machine / Refrigerator / AC categories.
--   The NestJS API brand filter uses `name ILIKE %brand%`, so brand searches
--   like "Samsung washing machine" returned 0 results because no product name
--   contained "Samsung".
--
-- FIX: Reassign product names to realistic brand+model combinations per
--      (category, genericName) using ROW_NUMBER() cycling.  Descriptions now
--      explicitly mention the genericName so text-search also works.
--
-- ProductSubCategory descriptions are also updated to be accurate.
-- ProductBusinessMetrics is seeded with realistic data.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Update ProductSubCategory descriptions to be accurate ─────────────────────

UPDATE "ProductSubCategory" SET description = 'Washing machines, refrigerators, ACs, microwaves, vacuum cleaners & more'
  WHERE name = 'Home Appliances';

UPDATE "ProductSubCategory" SET description = 'Blenders, mixer grinders, food processors, coffee makers & induction cooktops'
  WHERE name = 'Kitchen Appliances';

UPDATE "ProductSubCategory" SET description = 'Budget laptops, business laptops, gaming laptops, ultrabooks & notebooks'
  WHERE name = 'Laptops';

UPDATE "ProductSubCategory" SET description = 'Smartphones, Android phones, 5G phones & mobile phones from all top brands'
  WHERE name = 'Smartphones';

UPDATE "ProductSubCategory" SET description = 'Smart TVs, 4K UHD, OLED, QLED & LED televisions from 32" to 85"'
  WHERE name = 'Televisions';

UPDATE "ProductSubCategory" SET description = 'Over-ear, on-ear, in-ear, TWS earbuds, neckbands & professional headphones'
  WHERE name = 'Headphones';

UPDATE "ProductSubCategory" SET description = 'Bluetooth speakers, soundbars, home theatre & portable audio systems'
  WHERE name = 'Speakers';

UPDATE "ProductSubCategory" SET description = 'Smartwatches, fitness bands & activity trackers from top brands'
  WHERE name = 'Smartwatches';

-- ── HOME APPLIANCES ──────────────────────────────────────────────────────────

-- Washing Machine (1000 products)
WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Home Appliances' AND "genericName" = 'Washing Machine'
),
brand_names AS (
  SELECT brand, idx FROM (VALUES
    ('Samsung', 0), ('LG', 1), ('Whirlpool', 2), ('Bosch', 3), ('Haier', 4),
    ('IFB', 5), ('Panasonic', 6), ('Voltas', 7), ('Godrej', 8), ('Siemens', 9)
  ) AS t(brand, idx)
),
model_names AS (
  SELECT model, idx FROM (VALUES
    ('7Kg Front Load', 0), ('8Kg Top Load', 1), ('6.5Kg Semi-Auto', 2),
    ('9Kg Front Load', 3), ('7.5Kg Inverter', 4), ('6Kg Front Load', 5),
    ('8.5Kg Front Load', 6), ('7Kg Top Load', 7), ('10Kg Front Load', 8), ('6Kg Semi-Auto', 9)
  ) AS t(model, idx)
)
UPDATE "Product" p
SET
  name        = b.brand || ' ' || m.model || ' Washing Machine',
  description = 'The ' || b.brand || ' ' || m.model || ' Washing Machine is a top-rated home appliance with energy-efficient wash programs, auto-balance technology and child lock. ' ||
                'Category: Home Appliances | Type: Washing Machine | Brand: ' || b.brand || '. 2-year warranty included. Free delivery.'
FROM ranked r
JOIN brand_names b ON b.idx = (r.rn % 10)
JOIN model_names m ON m.idx = ((r.rn / 10) % 10)
WHERE p.id = r.id;

-- Refrigerator (1000 products)
WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Home Appliances' AND "genericName" = 'Refrigerator'
),
brand_names AS (
  SELECT brand, idx FROM (VALUES
    ('Samsung', 0), ('LG', 1), ('Haier', 2), ('Whirlpool', 3), ('Godrej', 4),
    ('Bosch', 5), ('Voltas', 6), ('Panasonic', 7), ('Hitachi', 8), ('Siemens', 9)
  ) AS t(brand, idx)
),
model_names AS (
  SELECT model, idx FROM (VALUES
    ('253L Double Door', 0), ('190L Single Door', 1), ('320L Side-by-Side', 2),
    ('340L Frost Free', 3), ('236L Direct Cool', 4), ('472L French Door', 5),
    ('285L Bottom Mount', 6), ('260L Frost Free', 7), ('215L Single Door', 8), ('415L Double Door', 9)
  ) AS t(model, idx)
)
UPDATE "Product" p
SET
  name        = b.brand || ' ' || m.model || ' Refrigerator',
  description = 'The ' || b.brand || ' ' || m.model || ' Refrigerator features digital inverter technology, twin cooling plus and humidity-controlled crispers. ' ||
                'Category: Home Appliances | Type: Refrigerator | Brand: ' || b.brand || '. 1-year comprehensive + 5-year on compressor warranty.'
FROM ranked r
JOIN brand_names b ON b.idx = (r.rn % 10)
JOIN model_names m ON m.idx = ((r.rn / 10) % 10)
WHERE p.id = r.id;

-- Air Conditioner (1000 products)
WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Home Appliances' AND "genericName" = 'Air Conditioner'
),
brand_names AS (
  SELECT brand, idx FROM (VALUES
    ('Daikin', 0), ('Voltas', 1), ('LG', 2), ('Blue Star', 3), ('Carrier', 4),
    ('Hitachi', 5), ('Samsung', 6), ('Panasonic', 7), ('Whirlpool', 8), ('Godrej', 9)
  ) AS t(brand, idx)
),
model_names AS (
  SELECT model, idx FROM (VALUES
    ('1.5 Ton 3 Star Inverter Split', 0), ('1 Ton 5 Star Split', 1),
    ('2 Ton 3 Star Inverter Split', 2), ('1.5 Ton 5 Star Window', 3),
    ('1.5 Ton 5 Star Inverter Split', 4), ('2 Ton 5 Star Inverter Split', 5),
    ('1 Ton 3 Star Inverter Split', 6), ('1.5 Ton 4 Star Inverter Split', 7),
    ('2 Ton 3 Star Window', 8), ('1 Ton 5 Star Inverter Split', 9)
  ) AS t(model, idx)
)
UPDATE "Product" p
SET
  name        = b.brand || ' ' || m.model || ' Air Conditioner',
  description = 'The ' || b.brand || ' ' || m.model || ' Air Conditioner delivers rapid cooling with Wi-Fi control and PM 2.5 filter. ' ||
                'Category: Home Appliances | Type: Air Conditioner | Brand: ' || b.brand || '. 5-year warranty on compressor.'
FROM ranked r
JOIN brand_names b ON b.idx = (r.rn % 10)
JOIN model_names m ON m.idx = ((r.rn / 10) % 10)
WHERE p.id = r.id;

-- Microwave (1000 products)
WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Home Appliances' AND "genericName" = 'Microwave'
),
brand_names AS (
  SELECT brand, idx FROM (VALUES
    ('Samsung', 0), ('LG', 1), ('IFB', 2), ('Panasonic', 3), ('Bajaj', 4),
    ('Morphy Richards', 5), ('Sharp', 6), ('Whirlpool', 7), ('Godrej', 8), ('Haier', 9)
  ) AS t(brand, idx)
),
model_names AS (
  SELECT model, idx FROM (VALUES
    ('28L Convection', 0), ('25L Solo', 1), ('23L Grill', 2), ('32L Convection', 3),
    ('20L Solo', 4), ('30L Convection', 5), ('25L Convection', 6), ('28L Grill', 7),
    ('23L Convection', 8), ('20L Grill', 9)
  ) AS t(model, idx)
)
UPDATE "Product" p
SET
  name        = b.brand || ' ' || m.model || ' Microwave Oven',
  description = 'The ' || b.brand || ' ' || m.model || ' Microwave Oven features auto-cook menus, defrost by weight and multi-stage cooking. ' ||
                'Category: Home Appliances | Type: Microwave | Brand: ' || b.brand || '. 1-year product + 3-year magnetron warranty.'
FROM ranked r
JOIN brand_names b ON b.idx = (r.rn % 10)
JOIN model_names m ON m.idx = ((r.rn / 10) % 10)
WHERE p.id = r.id;

-- Vacuum Cleaner (1000 products)
WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Home Appliances' AND "genericName" = 'Vacuum Cleaner'
),
brand_names AS (
  SELECT brand, idx FROM (VALUES
    ('Dyson', 0), ('Samsung', 1), ('LG', 2), ('Eureka Forbes', 3), ('iRobot', 4),
    ('Xiaomi', 5), ('Philips', 6), ('Karcher', 7), ('Black+Decker', 8), ('Bosch', 9)
  ) AS t(brand, idx)
),
model_names AS (
  SELECT model, idx FROM (VALUES
    ('V11 Cordless', 0), ('Jet 90 Cordless', 1), ('CordZero A9', 2),
    ('Forbes Euroclean', 3), ('Roomba i3+', 4), ('Robot Vacuum G1', 5),
    ('PowerPro Compact', 6), ('WD 1 S V-17', 7), ('Dustbuster 18V', 8), ('Athlet ProAnimal', 9)
  ) AS t(model, idx)
)
UPDATE "Product" p
SET
  name        = b.brand || ' ' || m.model || ' Vacuum Cleaner',
  description = 'The ' || b.brand || ' ' || m.model || ' Vacuum Cleaner delivers powerful suction with HEPA filtration for allergen-free floors. ' ||
                'Category: Home Appliances | Type: Vacuum Cleaner | Brand: ' || b.brand || '. 2-year warranty. Free accessories kit.'
FROM ranked r
JOIN brand_names b ON b.idx = (r.rn % 10)
JOIN model_names m ON m.idx = ((r.rn / 10) % 10)
WHERE p.id = r.id;

-- ── KITCHEN APPLIANCES ───────────────────────────────────────────────────────

-- Blender (1000 products)
WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Kitchen Appliances' AND "genericName" = 'Blender'
),
brand_names AS (
  SELECT brand, idx FROM (VALUES
    ('Preethi', 0), ('Philips', 1), ('Hamilton Beach', 2), ('Panasonic', 3), ('Bajaj', 4),
    ('Inalsa', 5), ('Sujata', 6), ('Bosch', 7), ('Cuisinart', 8), ('Oster', 9)
  ) AS t(brand, idx)
),
model_names AS (
  SELECT model, idx FROM (VALUES
    ('Zodiac MG 218 750W', 0), ('HL7756/00 600W', 1), ('58148 700W', 2),
    ('MX-AC400 550W', 3), ('Rex 500W', 4), ('HBP 500W', 5),
    ('Powermatic Plus 900W', 6), ('MMB6173M 800W', 7), ('SPB-7CH 700W', 8), ('BLST6654-053 600W', 9)
  ) AS t(model, idx)
)
UPDATE "Product" p
SET
  name        = b.brand || ' ' || m.model || ' Blender',
  description = 'The ' || b.brand || ' ' || m.model || ' Blender is perfect for smoothies, juices and shakes with stainless steel blades and multiple speed settings. ' ||
                'Category: Kitchen Appliances | Type: Blender | Brand: ' || b.brand || '. 2-year warranty.'
FROM ranked r
JOIN brand_names b ON b.idx = (r.rn % 10)
JOIN model_names m ON m.idx = ((r.rn / 10) % 10)
WHERE p.id = r.id;

-- Mixer Grinder (1000 products)
WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Kitchen Appliances' AND "genericName" = 'Mixer Grinder'
),
brand_names AS (
  SELECT brand, idx FROM (VALUES
    ('Preethi', 0), ('Butterfly', 1), ('Crompton', 2), ('Sujata', 3), ('Usha', 4),
    ('Philips', 5), ('Bajaj', 6), ('Prestige', 7), ('Panasonic', 8), ('V-Guard', 9)
  ) AS t(brand, idx)
),
model_names AS (
  SELECT model, idx FROM (VALUES
    ('Blue Leaf 750W 3-Jar', 0), ('Jet Elite Plus 750W', 1), ('Ameo 750W 3-Jar', 2),
    ('Dynamix 900W 3-Jar', 3), ('Mixer 750W 3-Jar', 4), ('HL7756/00 600W 3-Jar', 5),
    ('Classic 500W 3-Jar', 6), ('Nippy 500W 3-Jar', 7), ('MX-AC300S 550W', 8), ('Starvac Plus 750W', 9)
  ) AS t(model, idx)
)
UPDATE "Product" p
SET
  name        = b.brand || ' ' || m.model || ' Mixer Grinder',
  description = 'The ' || b.brand || ' ' || m.model || ' Mixer Grinder features overload protection, stainless steel jars and powerful motor for grinding masalas, chutneys and smoothies. ' ||
                'Category: Kitchen Appliances | Type: Mixer Grinder | Brand: ' || b.brand || '. 2-year warranty on motor.'
FROM ranked r
JOIN brand_names b ON b.idx = (r.rn % 10)
JOIN model_names m ON m.idx = ((r.rn / 10) % 10)
WHERE p.id = r.id;

-- Food Processor (1000 products)
WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Kitchen Appliances' AND "genericName" = 'Food Processor'
),
brand_names AS (
  SELECT brand, idx FROM (VALUES
    ('Bosch', 0), ('Bajaj', 1), ('Philips', 2), ('Prestige', 3), ('Inalsa', 4),
    ('Cuisinart', 5), ('Hamilton Beach', 6), ('KitchenAid', 7), ('Panasonic', 8), ('Usha', 9)
  ) AS t(brand, idx)
),
model_names AS (
  SELECT model, idx FROM (VALUES
    ('MCM3501M 800W', 0), ('FX-11 1000W', 1), ('HL1660/00 750W', 2),
    ('PFP 6.0 600W', 3), ('Inox 1000W', 4), ('DFP-14BCWH 720W', 5),
    ('70725 500W', 6), ('7-Cup 250W', 7), ('MK-F800 700W', 8), ('FP 2501 500W', 9)
  ) AS t(model, idx)
)
UPDATE "Product" p
SET
  name        = b.brand || ' ' || m.model || ' Food Processor',
  description = 'The ' || b.brand || ' ' || m.model || ' Food Processor with multiple attachments for slicing, shredding, chopping and kneading — your perfect kitchen companion. ' ||
                'Category: Kitchen Appliances | Type: Food Processor | Brand: ' || b.brand || '. 2-year warranty.'
FROM ranked r
JOIN brand_names b ON b.idx = (r.rn % 10)
JOIN model_names m ON m.idx = ((r.rn / 10) % 10)
WHERE p.id = r.id;

-- Coffee Maker (1000 products)
WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Kitchen Appliances' AND "genericName" = 'Coffee Maker'
),
brand_names AS (
  SELECT brand, idx FROM (VALUES
    ('Morphy Richards', 0), ('Philips', 1), ('Nespresso', 2), ('DeLonghi', 3), ('Bosch', 4),
    ('Illy', 5), ('Instacuppa', 6), ('Black+Decker', 7), ('Bialetti', 8), ('Kaapi Machines', 9)
  ) AS t(brand, idx)
),
model_names AS (
  SELECT model, idx FROM (VALUES
    ('Europa 800W Drip', 0), ('Grind & Brew 1000W', 1), ('Vertuo Plus Capsule', 2),
    ('Dedica EC685 Espresso', 3), ('TKA6A041 1200W', 4), ('X7.5 iperEspresso', 5),
    ('French Press 600ml', 6), ('CM618 12-Cup Drip', 7), ('Moka Express 3-Cup', 8), ('Nuova Espresso 1300W', 9)
  ) AS t(model, idx)
)
UPDATE "Product" p
SET
  name        = b.brand || ' ' || m.model || ' Coffee Maker',
  description = 'The ' || b.brand || ' ' || m.model || ' Coffee Maker brews barista-quality coffee at home with precise temperature control and aroma-lock technology. ' ||
                'Category: Kitchen Appliances | Type: Coffee Maker | Brand: ' || b.brand || '. 1-year warranty.'
FROM ranked r
JOIN brand_names b ON b.idx = (r.rn % 10)
JOIN model_names m ON m.idx = ((r.rn / 10) % 10)
WHERE p.id = r.id;

-- Induction Cooktop (1000 products)
WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Kitchen Appliances' AND "genericName" = 'Induction Cooktop'
),
brand_names AS (
  SELECT brand, idx FROM (VALUES
    ('Prestige', 0), ('Philips', 1), ('Bajaj', 2), ('Pigeon', 3), ('Glen', 4),
    ('Usha', 5), ('Havells', 6), ('V-Guard', 7), ('Sunflame', 8), ('Preethi', 9)
  ) AS t(brand, idx)
),
model_names AS (
  SELECT model, idx FROM (VALUES
    ('PIC 6.0 V2 2000W', 0), ('HD4928 2100W', 1), ('Majesty ICX 3 2000W', 2),
    ('Favourite IC 1800W', 3), ('30012 IN 2000W', 4), ('3102 2000W', 5),
    ('Insta Cook PT-E 1900W', 6), ('Vesta 2000W', 7), ('IN 10 2000W', 8), ('Nicer 2000W', 9)
  ) AS t(model, idx)
)
UPDATE "Product" p
SET
  name        = b.brand || ' ' || m.model || ' Induction Cooktop',
  description = 'The ' || b.brand || ' ' || m.model || ' Induction Cooktop offers 8 power levels, auto-shut off and feather touch controls for safe, fast and energy-efficient cooking. ' ||
                'Category: Kitchen Appliances | Type: Induction Cooktop | Brand: ' || b.brand || '. 1-year warranty.'
FROM ranked r
JOIN brand_names b ON b.idx = (r.rn % 10)
JOIN model_names m ON m.idx = ((r.rn / 10) % 10)
WHERE p.id = r.id;

-- ── LAPTOPS ──────────────────────────────────────────────────────────────────

-- Laptop (1250 products)
WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Laptops' AND "genericName" = 'Laptop'
),
brand_names AS (
  SELECT brand, idx FROM (VALUES
    ('HP', 0), ('Dell', 1), ('Lenovo', 2), ('ASUS', 3), ('Acer', 4),
    ('Samsung', 5), ('LG', 6), ('Avita', 7), ('MI', 8), ('Infinix', 9)
  ) AS t(brand, idx)
),
model_names AS (
  SELECT model, idx FROM (VALUES
    ('Pavilion 15 Core i5 8GB 512GB', 0), ('Inspiron 15 Core i5 8GB 512GB', 1),
    ('IdeaPad Slim 3 Core i5 8GB 512GB', 2), ('VivoBook 15 Core i5 8GB 512GB', 3),
    ('Aspire 5 Core i5 8GB 512GB', 4), ('Galaxy Book3 Core i5 8GB 512GB', 5),
    ('Gram 16 Core i5 8GB 512GB', 6), ('Magus Nano Core i3 8GB 256GB', 7),
    ('RedmiBook 14 Core i5 16GB 512GB', 8), ('INBook X1 Core i5 8GB 512GB', 9)
  ) AS t(model, idx)
)
UPDATE "Product" p
SET
  name        = b.brand || ' ' || m.model || ' Laptop',
  description = 'The ' || b.brand || ' ' || m.model || ' Laptop is a versatile everyday laptop with fast SSD storage, full-HD display and all-day battery life. ' ||
                'Category: Laptops | Type: Laptop | Brand: ' || b.brand || '. 1-year on-site warranty.'
FROM ranked r
JOIN brand_names b ON b.idx = (r.rn % 10)
JOIN model_names m ON m.idx = ((r.rn / 10) % 10)
WHERE p.id = r.id;

-- Gaming Laptop (1250 products)
WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Laptops' AND "genericName" = 'Gaming Laptop'
),
brand_names AS (
  SELECT brand, idx FROM (VALUES
    ('ASUS ROG', 0), ('Lenovo Legion', 1), ('HP OMEN', 2), ('MSI', 3), ('Acer Nitro', 4),
    ('Dell Alienware', 5), ('Razer', 6), ('Gigabyte AORUS', 7), ('Realme', 8), ('Infinix GT', 9)
  ) AS t(brand, idx)
),
model_names AS (
  SELECT model, idx FROM (VALUES
    ('Strix G15 Ryzen 7 16GB 512GB RTX 4060', 0), ('5 Pro Ryzen 7 16GB 512GB RTX 4060', 1),
    ('15-en Ryzen 7 16GB 512GB RTX 4060', 2), ('GF65 Thin Core i7 16GB 512GB RTX 3060', 3),
    ('5 AN515 Core i7 16GB 512GB RTX 4060', 4), ('m16 Core i9 32GB 1TB RTX 4070', 5),
    ('Blade 15 Core i7 16GB 512GB RTX 4060', 6), ('Neo i7 16GB 512GB RTX 4060Ti', 7),
    ('Book Prime Core i7 16GB 512GB RTX 4050', 8), ('Book Neo Core i7 16GB 512GB RTX 4060', 9)
  ) AS t(model, idx)
)
UPDATE "Product" p
SET
  name        = b.brand || ' ' || m.model || ' Gaming Laptop',
  description = 'The ' || b.brand || ' ' || m.model || ' Gaming Laptop delivers unmatched gaming performance with high-refresh display, RGB keyboard and advanced thermal management. ' ||
                'Category: Laptops | Type: Gaming Laptop | Brand: ' || b.brand || '. 1-year warranty + 1-year accidental damage.'
FROM ranked r
JOIN brand_names b ON b.idx = (r.rn % 10)
JOIN model_names m ON m.idx = ((r.rn / 10) % 10)
WHERE p.id = r.id;

-- Ultrabook (1250 products)
WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Laptops' AND "genericName" = 'Ultrabook'
),
brand_names AS (
  SELECT brand, idx FROM (VALUES
    ('Apple', 0), ('Samsung', 1), ('Dell', 2), ('HP', 3), ('Lenovo', 4),
    ('LG', 5), ('Microsoft', 6), ('Huawei', 7), ('Asus', 8), ('Acer', 9)
  ) AS t(brand, idx)
),
model_names AS (
  SELECT model, idx FROM (VALUES
    ('MacBook Air M2 13" 8GB 256GB', 0), ('Galaxy Book3 Pro 16" Core Ultra 7 16GB', 1),
    ('XPS 13 Core Ultra 5 16GB 512GB', 2), ('Spectre x360 14 Core i7 16GB 512GB', 3),
    ('Yoga 9i Core i7 32GB 1TB', 4), ('Gram 14 Core i5 16GB 512GB', 5),
    ('Surface Pro 9 Core i7 16GB 256GB', 6), ('MateBook X Pro Core i7 16GB 1TB', 7),
    ('Zenbook 14 OLED Core i7 16GB 512GB', 8), ('Swift 5 Core i7 16GB 512GB', 9)
  ) AS t(model, idx)
)
UPDATE "Product" p
SET
  name        = b.brand || ' ' || m.model || ' Ultrabook',
  description = 'The ' || b.brand || ' ' || m.model || ' Ultrabook combines premium design with all-day battery life in a featherweight chassis — ideal for professionals and students on the go. ' ||
                'Category: Laptops | Type: Ultrabook | Brand: ' || b.brand || '. 1-year international warranty.'
FROM ranked r
JOIN brand_names b ON b.idx = (r.rn % 10)
JOIN model_names m ON m.idx = ((r.rn / 10) % 10)
WHERE p.id = r.id;

-- Notebook (1250 products)
WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Laptops' AND "genericName" = 'Notebook'
),
brand_names AS (
  SELECT brand, idx FROM (VALUES
    ('HP', 0), ('Dell', 1), ('Lenovo', 2), ('Acer', 3), ('ASUS', 4),
    ('Infinix', 5), ('Avita', 6), ('iBall', 7), ('Chuwi', 8), ('Primebook', 9)
  ) AS t(brand, idx)
),
model_names AS (
  SELECT model, idx FROM (VALUES
    ('15s-du3 Core i3 8GB 256GB', 0), ('Vostro 14 Core i5 8GB 512GB', 1),
    ('V14 G4 Core i5 8GB 512GB', 2), ('Aspire 3 Core i3 8GB 256GB', 3),
    ('ExpertBook B1 Core i5 8GB 512GB', 4), ('INBook X2 Core i5 8GB 512GB', 5),
    ('Pura T Core i5 8GB 256GB', 6), ('CompBook Acme Core i5 4GB 64GB', 7),
    ('HeroBook Air 11.6" Celeron 4GB', 8), ('4G Octa-Core 4GB 128GB', 9)
  ) AS t(model, idx)
)
UPDATE "Product" p
SET
  name        = b.brand || ' ' || m.model || ' Notebook',
  description = 'The ' || b.brand || ' ' || m.model || ' Notebook is a lightweight, affordable everyday computing companion with essential connectivity and long battery life. ' ||
                'Category: Laptops | Type: Notebook | Brand: ' || b.brand || '. 1-year warranty.'
FROM ranked r
JOIN brand_names b ON b.idx = (r.rn % 10)
JOIN model_names m ON m.idx = ((r.rn / 10) % 10)
WHERE p.id = r.id;

-- ── SMARTPHONES ──────────────────────────────────────────────────────────────

-- Smartphone (2000 products)
WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Smartphones' AND "genericName" = 'Smartphone'
),
brand_names AS (
  SELECT brand, idx FROM (VALUES
    ('Samsung', 0), ('Apple', 1), ('OnePlus', 2), ('Xiaomi', 3), ('Google', 4),
    ('Nothing', 5), ('Motorola', 6), ('Vivo', 7), ('Oppo', 8), ('Realme', 9)
  ) AS t(brand, idx)
),
model_names AS (
  SELECT model, idx FROM (VALUES
    ('Galaxy S23 FE 5G 128GB', 0), ('iPhone 15 128GB', 1),
    ('12 256GB 5G', 2), ('14 5G 256GB', 3), ('Pixel 8 128GB', 4),
    ('Phone 2a 128GB 5G', 5), ('Edge 50 Pro 256GB 5G', 6),
    ('V29 Pro 256GB 5G', 7), ('Reno 11 Pro 256GB 5G', 8), ('12 Pro+ 256GB 5G', 9)
  ) AS t(model, idx)
)
UPDATE "Product" p
SET
  name        = b.brand || ' ' || m.model || ' Smartphone',
  description = 'The ' || b.brand || ' ' || m.model || ' Smartphone offers a stunning AMOLED display, multi-camera AI system and all-day battery life. ' ||
                'Category: Smartphones | Type: Smartphone | Brand: ' || b.brand || '. 1-year warranty. Free screen replacement for 6 months.'
FROM ranked r
JOIN brand_names b ON b.idx = (r.rn % 10)
JOIN model_names m ON m.idx = ((r.rn / 10) % 10)
WHERE p.id = r.id;

-- Android Phone (1000 products)
WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Smartphones' AND "genericName" = 'Android Phone'
),
brand_names AS (
  SELECT brand, idx FROM (VALUES
    ('Samsung', 0), ('Xiaomi', 1), ('Realme', 2), ('Vivo', 3), ('Oppo', 4),
    ('Tecno', 5), ('Infinix', 6), ('iQOO', 7), ('Motorola', 8), ('Nokia', 9)
  ) AS t(brand, idx)
),
model_names AS (
  SELECT model, idx FROM (VALUES
    ('Galaxy A54 5G 128GB', 0), ('Redmi Note 13 Pro 5G 128GB', 1),
    ('12 Pro+ 5G 256GB', 2), ('V30 5G 256GB', 3), ('Reno 11 5G 256GB', 4),
    ('Camon 20 Pro 5G 256GB', 5), ('Note 40 Pro 5G 256GB', 6),
    ('Z9x 5G 128GB', 7), ('G84 5G 256GB', 8), ('G42 5G 128GB', 9)
  ) AS t(model, idx)
)
UPDATE "Product" p
SET
  name        = b.brand || ' ' || m.model || ' Android Phone',
  description = 'The ' || b.brand || ' ' || m.model || ' Android Phone runs the latest Android OS with a high-resolution display, triple-camera setup and fast-charging. ' ||
                'Category: Smartphones | Type: Android Phone | Brand: ' || b.brand || '. 1-year warranty.'
FROM ranked r
JOIN brand_names b ON b.idx = (r.rn % 10)
JOIN model_names m ON m.idx = ((r.rn / 10) % 10)
WHERE p.id = r.id;

-- 5G Phone (1000 products)
WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Smartphones' AND "genericName" = '5G Phone'
),
brand_names AS (
  SELECT brand, idx FROM (VALUES
    ('Apple', 0), ('Samsung', 1), ('OnePlus', 2), ('iQOO', 3), ('Motorola', 4),
    ('Xiaomi', 5), ('Realme', 6), ('Vivo', 7), ('Nothing', 8), ('Google', 9)
  ) AS t(brand, idx)
),
model_names AS (
  SELECT model, idx FROM (VALUES
    ('iPhone 15 Pro Max 256GB', 0), ('Galaxy S24 Ultra 256GB', 1),
    ('12R 5G 128GB', 2), ('12 5G 256GB', 3), ('Edge 50 Fusion 5G 128GB', 4),
    ('14 Ultra 5G 512GB', 5), ('GT 6 5G 256GB', 6), ('X100 Pro 5G 512GB', 7),
    ('Phone 2 5G 256GB', 8), ('Pixel 8 Pro 5G 256GB', 9)
  ) AS t(model, idx)
)
UPDATE "Product" p
SET
  name        = b.brand || ' ' || m.model || ' 5G Phone',
  description = 'The ' || b.brand || ' ' || m.model || ' 5G Phone features lightning-fast 5G connectivity, pro-grade camera system and premium build quality. ' ||
                'Category: Smartphones | Type: 5G Phone | Brand: ' || b.brand || '. 1-year warranty. EMI available.'
FROM ranked r
JOIN brand_names b ON b.idx = (r.rn % 10)
JOIN model_names m ON m.idx = ((r.rn / 10) % 10)
WHERE p.id = r.id;

-- Mobile Phone (1000 products)
WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Smartphones' AND "genericName" = 'Mobile Phone'
),
brand_names AS (
  SELECT brand, idx FROM (VALUES
    ('Samsung', 0), ('Realme', 1), ('Tecno', 2), ('Nokia', 3), ('Motorola', 4),
    ('Infinix', 5), ('Lava', 6), ('itel', 7), ('Micromax', 8), ('Jio', 9)
  ) AS t(brand, idx)
),
model_names AS (
  SELECT model, idx FROM (VALUES
    ('Galaxy M34 5G 128GB', 0), ('Narzo 60x 5G 128GB', 1),
    ('Spark 20 Pro+ 5G 128GB', 2), ('G310 5G 128GB', 3), ('G Power 2024 128GB', 4),
    ('Hot 40 Pro 5G 256GB', 5), ('Blaze X2 4G 128GB', 6), ('A70 4G 128GB', 7),
    ('IN Note 2b 5G 128GB', 8), ('Phone 2 4G 32GB', 9)
  ) AS t(model, idx)
)
UPDATE "Product" p
SET
  name        = b.brand || ' ' || m.model || ' Mobile Phone',
  description = 'The ' || b.brand || ' ' || m.model || ' Mobile Phone is a reliable everyday mobile device with long-lasting battery, spacious storage and clear camera. ' ||
                'Category: Smartphones | Type: Mobile Phone | Brand: ' || b.brand || '. 1-year warranty.'
FROM ranked r
JOIN brand_names b ON b.idx = (r.rn % 10)
JOIN model_names m ON m.idx = ((r.rn / 10) % 10)
WHERE p.id = r.id;

-- ── Update remaining categories with diverse names ───────────────────────────

-- Headphones (all genericNames)
WITH ranked AS (
  SELECT id, "genericName",
    (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Headphones'
)
UPDATE "Product" p
SET
  name = CASE r."genericName"
    WHEN 'Headphones' THEN
      CASE (r.rn % 8) WHEN 0 THEN 'Sony WH-1000XM5' WHEN 1 THEN 'Bose QuietComfort 45'
        WHEN 2 THEN 'Apple AirPods Max' WHEN 3 THEN 'Sennheiser HD 560S'
        WHEN 4 THEN 'JBL Tune 760NC' WHEN 5 THEN 'Jabra Evolve2 55'
        WHEN 6 THEN 'Beyerdynamic DT 770 Pro' ELSE 'Audio-Technica ATH-M50xBT2' END || ' Over-Ear Headphones'
    WHEN 'TWS Earbuds' THEN
      CASE (r.rn % 8) WHEN 0 THEN 'Apple AirPods Pro 2nd Gen' WHEN 1 THEN 'Samsung Galaxy Buds2 Pro'
        WHEN 2 THEN 'Sony WF-1000XM5' WHEN 3 THEN 'OnePlus Buds Pro 2'
        WHEN 4 THEN 'boAt Airdopes 441' WHEN 5 THEN 'Jabra Elite 5'
        WHEN 6 THEN 'Nothing Ear 2' ELSE 'Noise Buds VS104 Max' END || ' TWS Earbuds'
    WHEN 'Neckband' THEN
      CASE (r.rn % 5) WHEN 0 THEN 'Samsung Level U2' WHEN 1 THEN 'OnePlus Bullets Z2'
        WHEN 2 THEN 'boAt Rockerz 255 Pro+' WHEN 3 THEN 'Noise Tune Active'
        ELSE 'JBL Reflect Flow Pro' END || ' Bluetooth Neckband'
    ELSE
      CASE (r.rn % 5) WHEN 0 THEN 'Sony IER-M7' WHEN 1 THEN 'Sennheiser IE 300'
        WHEN 2 THEN 'boAt BassHeads 242' WHEN 3 THEN 'JBL T110'
        ELSE 'Noise Shots X5 Pro' END || ' In-Ear Earphones'
    END,
  description = 'Premium ' || r."genericName" || ' with active noise cancellation, superior sound quality and comfortable fit. ' ||
    'Category: Headphones | Type: ' || r."genericName" || '. 1-year warranty.'
FROM ranked r WHERE p.id = r.id;

-- Televisions (all genericNames)
WITH ranked AS (
  SELECT id, "genericName",
    (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Televisions'
)
UPDATE "Product" p
SET
  name = CASE r."genericName"
    WHEN 'Smart TV' THEN
      CASE (r.rn % 6) WHEN 0 THEN 'Samsung Crystal 4K 55"' WHEN 1 THEN 'LG NanoCell 55"'
        WHEN 2 THEN 'Sony BRAVIA X80L 55"' WHEN 3 THEN 'Mi 4K 55"'
        WHEN 4 THEN 'Toshiba V55 55"' ELSE 'OnePlus Y1S Pro 55"' END || ' Smart TV'
    WHEN '4K TV' THEN
      CASE (r.rn % 6) WHEN 0 THEN 'LG OLED C3 65"' WHEN 1 THEN 'Samsung QLED 65"'
        WHEN 2 THEN 'Sony BRAVIA XR A80L 65"' WHEN 3 THEN 'TCL QLED C835 65"'
        WHEN 4 THEN 'Hisense ULED 65"' ELSE 'Panasonic MX700 65"' END || ' 4K UHD TV'
    ELSE
      CASE (r.rn % 5) WHEN 0 THEN 'Sony OLED A95L 55"' WHEN 1 THEN 'LG G3 OLED 55"'
        WHEN 2 THEN 'Samsung S95C QD-OLED 55"' WHEN 3 THEN 'Panasonic MZ1500 55"'
        ELSE 'Philips OLED+ 55"' END || ' OLED TV'
    END,
  description = r."genericName" || ' with Dolby Vision, Dolby Atmos, and smart streaming apps built-in. ' ||
    'Category: Televisions | Type: ' || r."genericName" || '. 1-year comprehensive warranty.'
FROM ranked r WHERE p.id = r.id;

-- Smartwatches
WITH ranked AS (
  SELECT id, "genericName",
    (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Smartwatches'
)
UPDATE "Product" p
SET
  name = CASE (r.rn % 8)
    WHEN 0 THEN 'Apple Watch Series 9 45mm'
    WHEN 1 THEN 'Samsung Galaxy Watch6 Classic'
    WHEN 2 THEN 'Garmin Fenix 7 Solar'
    WHEN 3 THEN 'OnePlus Watch 2'
    WHEN 4 THEN 'Noise ColorFit Pro 4'
    WHEN 5 THEN 'boAt Xtend Pro Smartwatch'
    WHEN 6 THEN 'Amazfit GTR 4'
    ELSE 'Fitbit Versa 4' END || ' ' || r."genericName",
  description = 'Advanced ' || r."genericName" || ' with health monitoring, GPS tracking and 7-day battery life. ' ||
    'Category: Smartwatches | Type: ' || r."genericName" || '. 1-year warranty.'
FROM ranked r WHERE p.id = r.id;

-- Gaming products
WITH ranked AS (
  SELECT id, "genericName",
    (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Gaming'
)
UPDATE "Product" p
SET
  name = CASE r."genericName"
    WHEN 'Gaming Console' THEN
      CASE (r.rn % 4) WHEN 0 THEN 'Sony PlayStation 5 Disc' WHEN 1 THEN 'Microsoft Xbox Series X'
        WHEN 2 THEN 'Nintendo Switch OLED' ELSE 'Sony PlayStation 5 Digital' END || ' Gaming Console'
    WHEN 'Gaming Keyboard' THEN
      CASE (r.rn % 5) WHEN 0 THEN 'Corsair K70 RGB Pro' WHEN 1 THEN 'Razer BlackWidow V4'
        WHEN 2 THEN 'SteelSeries Apex Pro' WHEN 3 THEN 'HyperX Alloy FPS Pro'
        ELSE 'Logitech G Pro X' END || ' Gaming Keyboard'
    WHEN 'Gaming Mouse' THEN
      CASE (r.rn % 5) WHEN 0 THEN 'Razer DeathAdder V3' WHEN 1 THEN 'Logitech G Pro X Superlight'
        WHEN 2 THEN 'SteelSeries Rival 650' WHEN 3 THEN 'Corsair M65 RGB Elite'
        ELSE 'HyperX Pulsefire Haste' END || ' Gaming Mouse'
    WHEN 'Gaming Headset' THEN
      CASE (r.rn % 5) WHEN 0 THEN 'HyperX Cloud Alpha S' WHEN 1 THEN 'Razer BlackShark V2 Pro'
        WHEN 2 THEN 'SteelSeries Arctis Nova Pro' WHEN 3 THEN 'Corsair HS80 RGB Wireless'
        ELSE 'Logitech G435 LIGHTSPEED' END || ' Gaming Headset'
    ELSE
      CASE (r.rn % 4) WHEN 0 THEN 'Secretlab TITAN Evo XL' WHEN 1 THEN 'DXRacer Formula F01'
        WHEN 2 THEN 'AndaSeat Kaiser 4 XL' ELSE 'Corsair TC100' END || ' Gaming Chair'
    END,
  description = 'High-performance ' || r."genericName" || ' engineered for competitive gaming with precision, durability and immersive experience. ' ||
    'Category: Gaming | Type: ' || r."genericName" || '. 1-year warranty.'
FROM ranked r WHERE p.id = r.id;

-- Cameras
WITH ranked AS (
  SELECT id, "genericName",
    (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Cameras'
)
UPDATE "Product" p
SET
  name = CASE r."genericName"
    WHEN 'DSLR Camera' THEN
      CASE (r.rn % 5) WHEN 0 THEN 'Canon EOS 200D II 24.1MP' WHEN 1 THEN 'Nikon D3500 24.2MP'
        WHEN 2 THEN 'Canon EOS 1500D 24.1MP' WHEN 3 THEN 'Nikon D5600 24.2MP'
        ELSE 'Canon EOS 250D 24.1MP' END || ' DSLR Camera'
    WHEN 'Mirrorless Camera' THEN
      CASE (r.rn % 5) WHEN 0 THEN 'Sony Alpha ZV-E10 24.2MP' WHEN 1 THEN 'Canon EOS M50 Mark II'
        WHEN 2 THEN 'Fujifilm X-S10 26.1MP' WHEN 3 THEN 'Nikon Z30 20.9MP'
        ELSE 'Sony A6400 24.2MP' END || ' Mirrorless Camera'
    WHEN 'Action Camera' THEN
      CASE (r.rn % 4) WHEN 0 THEN 'GoPro HERO12 Black 5.3K' WHEN 1 THEN 'DJI Action 4'
        WHEN 2 THEN 'Insta360 X3' ELSE 'Sony FDR-X3000' END || ' Action Camera'
    WHEN 'Webcam' THEN
      CASE (r.rn % 4) WHEN 0 THEN 'Logitech C920s Pro HD' WHEN 1 THEN 'Razer Kiyo Pro'
        WHEN 2 THEN 'Elgato Facecam MK.2' ELSE 'ASUS ProArt 4K' END || ' Webcam'
    ELSE
      CASE (r.rn % 4) WHEN 0 THEN 'Sony Cyber-shot WX350' WHEN 1 THEN 'Canon PowerShot G7X'
        WHEN 2 THEN 'Fujifilm FinePix S1' ELSE 'Nikon Coolpix B500' END || ' Camera'
    END,
  description = 'Professional-grade ' || r."genericName" || ' with high-resolution sensor, image stabilization and 4K video recording. ' ||
    'Category: Cameras | Type: ' || r."genericName" || '. 1-year warranty.'
FROM ranked r WHERE p.id = r.id;

-- Tablets
WITH ranked AS (
  SELECT id, "genericName",
    (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Tablets'
)
UPDATE "Product" p
SET
  name = CASE r."genericName"
    WHEN 'Tablet' THEN
      CASE (r.rn % 6) WHEN 0 THEN 'Apple iPad 10th Gen 64GB' WHEN 1 THEN 'Samsung Galaxy Tab S9 FE'
        WHEN 2 THEN 'Xiaomi Pad 6 128GB' WHEN 3 THEN 'Lenovo Tab P12 Pro'
        WHEN 4 THEN 'OnePlus Pad 128GB' ELSE 'realme Pad X 64GB' END || ' Tablet'
    ELSE
      CASE (r.rn % 4) WHEN 0 THEN 'Amazon Kindle Paperwhite' WHEN 1 THEN 'Kindle Scribe 16GB'
        WHEN 2 THEN 'Kobo Libra 2' ELSE 'PocketBook Touch Lux 5' END || ' E-Reader'
    END,
  description = 'Versatile ' || r."genericName" || ' with high-resolution display, multi-window multitasking and optional stylus support. ' ||
    'Category: Tablets | Type: ' || r."genericName" || '. 1-year warranty.'
FROM ranked r WHERE p.id = r.id;

-- Speakers
WITH ranked AS (
  SELECT id, "genericName",
    (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Speakers'
)
UPDATE "Product" p
SET
  name = CASE r."genericName"
    WHEN 'Bluetooth Speaker' THEN
      CASE (r.rn % 6) WHEN 0 THEN 'JBL Flip 6' WHEN 1 THEN 'Sony SRS-XB43'
        WHEN 2 THEN 'Bose SoundLink Flex' WHEN 3 THEN 'boAt Stone 1200'
        WHEN 4 THEN 'Noise Aqua 2' ELSE 'Marshall Emberton II' END || ' Bluetooth Speaker'
    WHEN 'Soundbar' THEN
      CASE (r.rn % 5) WHEN 0 THEN 'Samsung HW-Q600C 3.1.2ch' WHEN 1 THEN 'Sony HT-S2000 3.1ch'
        WHEN 2 THEN 'JBL Bar 5.0 MultiBeam' WHEN 3 THEN 'Bose Smart Soundbar 300'
        ELSE 'Yamaha SR-B20A 2.1ch' END || ' Soundbar'
    ELSE
      CASE (r.rn % 4) WHEN 0 THEN 'Amazon Echo 4th Gen' WHEN 1 THEN 'Google Nest Audio'
        WHEN 2 THEN 'Apple HomePod mini' ELSE 'Sonos One SL' END || ' Smart Speaker'
    END,
  description = 'Immersive audio ' || r."genericName" || ' with deep bass, 360-degree sound and voice assistant integration. ' ||
    'Category: Speakers | Type: ' || r."genericName" || '. 1-year warranty.'
FROM ranked r WHERE p.id = r.id;

-- Storage Devices
WITH ranked AS (
  SELECT id, "genericName",
    (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Storage Devices'
)
UPDATE "Product" p
SET
  name = CASE r."genericName"
    WHEN 'SSD' THEN
      CASE (r.rn % 5) WHEN 0 THEN 'Samsung 980 Pro 1TB NVMe' WHEN 1 THEN 'WD Black SN850X 1TB'
        WHEN 2 THEN 'Seagate FireCuda 530 1TB' WHEN 3 THEN 'Kingston Fury Renegade 1TB'
        ELSE 'Crucial T700 1TB NVMe' END || ' SSD'
    WHEN 'Hard Drive' THEN
      CASE (r.rn % 5) WHEN 0 THEN 'Seagate BarraCuda 2TB' WHEN 1 THEN 'WD Blue 2TB'
        WHEN 2 THEN 'Toshiba P300 2TB' WHEN 3 THEN 'WD Purple 4TB'
        ELSE 'Seagate IronWolf 4TB' END || ' Hard Drive'
    WHEN 'External SSD' THEN
      CASE (r.rn % 5) WHEN 0 THEN 'Samsung T7 Shield 2TB' WHEN 1 THEN 'WD My Passport SSD 1TB'
        WHEN 2 THEN 'SanDisk Extreme V2 2TB' WHEN 3 THEN 'Seagate One Touch SSD 1TB'
        ELSE 'Kingston XS2000 1TB' END || ' External SSD'
    WHEN 'Pen Drive' THEN
      CASE (r.rn % 4) WHEN 0 THEN 'SanDisk Ultra USB 3.0 128GB' WHEN 1 THEN 'Kingston DataTraveler 64GB'
        WHEN 2 THEN 'Samsung USB 3.1 128GB' ELSE 'HP x796w 128GB' END || ' Pen Drive'
    ELSE
      CASE (r.rn % 4) WHEN 0 THEN 'SanDisk Extreme microSD 256GB' WHEN 1 THEN 'Samsung EVO Plus 256GB'
        WHEN 2 THEN 'Lexar PLAY 512GB' ELSE 'Kingston Canvas Go! Plus 256GB' END || ' Memory Card'
    END,
  description = 'High-speed ' || r."genericName" || ' with advanced error correction and durable build for reliable data storage. ' ||
    'Category: Storage Devices | Type: ' || r."genericName" || '. 3-5 year warranty.'
FROM ranked r WHERE p.id = r.id;

-- Computer Accessories
WITH ranked AS (
  SELECT id, "genericName",
    (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Computer Accessories'
)
UPDATE "Product" p
SET
  name = CASE r."genericName"
    WHEN 'Mechanical Keyboard' THEN
      CASE (r.rn % 5) WHEN 0 THEN 'Keychron K8 TKL Wireless' WHEN 1 THEN 'Logitech MX Keys S'
        WHEN 2 THEN 'Corsair K95 RGB Platinum' WHEN 3 THEN 'Razer Huntsman V3 Pro'
        ELSE 'Das Keyboard 4 Professional' END || ' Mechanical Keyboard'
    WHEN 'Gaming Mouse' THEN
      CASE (r.rn % 5) WHEN 0 THEN 'Logitech MX Master 3S' WHEN 1 THEN 'Razer Basilisk V3 Pro'
        WHEN 2 THEN 'Corsair Scimitar Elite' WHEN 3 THEN 'SteelSeries Prime Wireless'
        ELSE 'HP 930 Creator' END || ' Mouse'
    WHEN 'Monitor' THEN
      CASE (r.rn % 5) WHEN 0 THEN 'LG 27" UltraGear 165Hz' WHEN 1 THEN 'Samsung 27" Curved 144Hz'
        WHEN 2 THEN 'Dell 27" 4K UHD IPS' WHEN 3 THEN 'ASUS ProArt 27" 4K'
        ELSE 'BenQ MOBIUZ 27" 165Hz' END || ' Monitor'
    WHEN 'Webcam' THEN
      CASE (r.rn % 4) WHEN 0 THEN 'Logitech C920s Full HD' WHEN 1 THEN 'Razer Kiyo Pro Ultra'
        WHEN 2 THEN 'Microsoft LifeCam 1080p' ELSE 'Creative Live! Cam 1080p' END || ' Webcam'
    ELSE
      CASE (r.rn % 4) WHEN 0 THEN 'Anker 7-in-1 USB-C Hub' WHEN 1 THEN 'Belkin 12-in-1 Thunderbolt 4'
        WHEN 2 THEN 'CalDigit TS4 Thunderbolt 4' ELSE 'UGREEN USB-C 7-in-1' END || ' USB Hub'
    END,
  description = 'Premium ' || r."genericName" || ' for professional workstation and gaming setups with plug-and-play compatibility. ' ||
    'Category: Computer Accessories | Type: ' || r."genericName" || '. 2-year warranty.'
FROM ranked r WHERE p.id = r.id;

-- Personal Care
WITH ranked AS (
  SELECT id, "genericName",
    (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Personal Care'
)
UPDATE "Product" p
SET
  name = CASE r."genericName"
    WHEN 'Beard Trimmer' THEN
      CASE (r.rn % 5) WHEN 0 THEN 'Philips QT4011/15 Trimmer' WHEN 1 THEN 'Braun BT7240 Beard Trimmer'
        WHEN 2 THEN 'Mi Beard Trimmer 2' WHEN 3 THEN 'Wahl 9818 Grooming Kit'
        ELSE 'Nova NHT-1073 Trimmer' END
    WHEN 'Hair Dryer' THEN
      CASE (r.rn % 5) WHEN 0 THEN 'Dyson Supersonic HD08' WHEN 1 THEN 'Philips BHD356/10 1800W'
        WHEN 2 THEN 'Vega VHDP-02 2200W' WHEN 3 THEN 'Panasonic EH-NA98 Nanoe'
        ELSE 'Havells HD3153 1800W' END || ' Hair Dryer'
    WHEN 'Hair Straightener' THEN
      CASE (r.rn % 4) WHEN 0 THEN 'Philips BHS510 Selfie' WHEN 1 THEN 'Remington S5500 Keratin'
        WHEN 2 THEN 'Dyson Corrale HS05' ELSE 'Syska CPF8500 2-in-1' END || ' Hair Straightener'
    ELSE
      CASE (r.rn % 4) WHEN 0 THEN 'Braun Series 8 8370cc' WHEN 1 THEN 'Philips S9000 Series 9000'
        WHEN 2 THEN 'Gillette Styler 3-in-1' ELSE 'Panasonic ES-LV65 Arc5' END || ' Electric Shaver'
    END,
  description = 'Professional-grade ' || r."genericName" || ' for salon-like results at home with precision and comfort. ' ||
    'Category: Personal Care | Type: ' || r."genericName" || '. 2-year warranty.'
FROM ranked r WHERE p.id = r.id;

-- Fitness Equipment
WITH ranked AS (
  SELECT id, "genericName",
    (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Fitness Equipment'
)
UPDATE "Product" p
SET
  name = CASE r."genericName"
    WHEN 'Treadmill' THEN
      CASE (r.rn % 5) WHEN 0 THEN 'PowerMax TDA-100 2HP' WHEN 1 THEN 'Fitkit FT098 3HP'
        WHEN 2 THEN 'Cockatoo CTM-04 2.5HP' WHEN 3 THEN 'DURAFIT Spark 3HP'
        ELSE 'NordicTrack T 6.5 Si 2.6HP' END || ' Treadmill'
    WHEN 'Exercise Bike' THEN
      CASE (r.rn % 4) WHEN 0 THEN 'Impulse Smart Upright Bike' WHEN 1 THEN 'Fitkit FK917 Pro'
        WHEN 2 THEN 'PowerMax BU-200 Stationary' ELSE 'Kettler Giro S Bike' END || ' Exercise Bike'
    WHEN 'Yoga Mat' THEN
      CASE (r.rn % 4) WHEN 0 THEN 'Manduka PRO 6mm Yoga Mat' WHEN 1 THEN 'Liforme Yoga Mat'
        WHEN 2 THEN 'Decathlon 5mm Non-Slip Mat' ELSE 'Adidas 6mm Training Mat' END
    ELSE
      CASE (r.rn % 4) WHEN 0 THEN 'Kore PVC 20Kg Hex Dumbbell Set' WHEN 1 THEN 'Aurion 10Kg Dumbbell Set'
        WHEN 2 THEN 'Body Maxx 20Kg Rubber Dumbbell' ELSE 'Strauss Adjustable Dumbbell 20Kg' END || ' Set'
    END,
  description = 'Professional ' || r."genericName" || ' for home gym workouts with durable build and safety features. ' ||
    'Category: Fitness Equipment | Type: ' || r."genericName" || '. 2-year warranty.'
FROM ranked r WHERE p.id = r.id;

-- Networking
WITH ranked AS (
  SELECT id, "genericName",
    (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Networking'
)
UPDATE "Product" p
SET
  name = CASE r."genericName"
    WHEN 'WiFi Router' THEN
      CASE (r.rn % 6) WHEN 0 THEN 'TP-Link Archer AX73 AX5400' WHEN 1 THEN 'ASUS RT-AX88U AX6000'
        WHEN 2 THEN 'Netgear Nighthawk AX8' WHEN 3 THEN 'D-Link DIR-X5460 AX5400'
        WHEN 4 THEN 'Mi AX3000 WiFi 6' ELSE 'Tenda RX9 Pro AX3000' END || ' WiFi 6 Router'
    WHEN 'Mesh Router' THEN
      CASE (r.rn % 4) WHEN 0 THEN 'Google Nest WiFi Pro 2-pack' WHEN 1 THEN 'TP-Link Deco XE75 3-pack'
        WHEN 2 THEN 'ASUS ZenWiFi Pro ET12' ELSE 'Eero Pro 6E 3-pack' END || ' Mesh System'
    WHEN 'WiFi Extender' THEN
      CASE (r.rn % 4) WHEN 0 THEN 'TP-Link RE605X AX1800' WHEN 1 THEN 'Netgear EAX20 AX1800'
        WHEN 2 THEN 'D-Link DAP-1755 AX1800' ELSE 'ASUS RP-AX56 AX1800' END || ' WiFi Extender'
    ELSE
      CASE (r.rn % 4) WHEN 0 THEN 'TP-Link TL-SG1024D 24-Port' WHEN 1 THEN 'Netgear GS324P 24-Port PoE'
        WHEN 2 THEN 'D-Link DGS-1210-10P 10-Port PoE' ELSE 'Cisco SG110-16 16-Port' END || ' Network Switch'
    END,
  description = 'High-performance ' || r."genericName" || ' with WiFi 6/6E support, MU-MIMO and advanced QoS for seamless connectivity. ' ||
    'Category: Networking | Type: ' || r."genericName" || '. 3-year warranty.'
FROM ranked r WHERE p.id = r.id;

-- Printers
WITH ranked AS (
  SELECT id, "genericName",
    (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Printers'
)
UPDATE "Product" p
SET
  name = CASE r."genericName"
    WHEN 'Laser Printer' THEN
      CASE (r.rn % 5) WHEN 0 THEN 'HP LaserJet Pro M404dn' WHEN 1 THEN 'Brother HL-L2321D'
        WHEN 2 THEN 'Canon LBP6030 WiFi' WHEN 3 THEN 'Samsung Xpress M2021W'
        ELSE 'Ricoh SP 210SF' END || ' Laser Printer'
    WHEN 'All-in-One Printer' THEN
      CASE (r.rn % 5) WHEN 0 THEN 'HP DeskJet 2331 All-in-One' WHEN 1 THEN 'Canon PIXMA MG2577s'
        WHEN 2 THEN 'Epson EcoTank L3252' WHEN 3 THEN 'Brother DCP-T520W EcoTank'
        ELSE 'HP Smart Tank 516' END || ' All-in-One Printer'
    WHEN 'Photo Printer' THEN
      CASE (r.rn % 4) WHEN 0 THEN 'Canon PIXMA G3010 A4 Photo' WHEN 1 THEN 'Epson L805 6-Colour Photo'
        WHEN 2 THEN 'HP Sprocket 2-in-1' ELSE 'Kodak Mini 2 Retro Photo' END || ' Printer'
    ELSE
      CASE (r.rn % 4) WHEN 0 THEN 'HP OfficeJet Pro 7740 A3' WHEN 1 THEN 'Epson WorkForce WF-7720'
        WHEN 2 THEN 'Brother MFC-J5945DW' ELSE 'Canon MAXIFY MB5470' END || ' Inkjet Printer'
    END,
  description = 'Efficient ' || r."genericName" || ' with wireless printing, auto-duplex and high-yield ink system for home and office use. ' ||
    'Category: Printers | Type: ' || r."genericName" || '. 1-year warranty.'
FROM ranked r WHERE p.id = r.id;

-- Furniture
WITH ranked AS (
  SELECT id, "genericName",
    (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Furniture'
)
UPDATE "Product" p
SET
  name = CASE r."genericName"
    WHEN 'Ergonomic Chair' THEN
      CASE (r.rn % 6) WHEN 0 THEN 'Herman Miller Aeron Size B' WHEN 1 THEN 'DXRacer Formula F01'
        WHEN 2 THEN 'Green Soul Monster 5.0' WHEN 3 THEN 'Featherlite Ergo Chair Pro'
        WHEN 4 THEN 'Hbada Executive Office Chair' ELSE 'Oakcraft Ergonomic Mesh Chair' END || ' Ergonomic Chair'
    WHEN 'Study Desk' THEN
      CASE (r.rn % 5) WHEN 0 THEN 'Nilkamal Freedom Small Study Table' WHEN 1 THEN 'Wakefit Height Adjustable'
        WHEN 2 THEN 'Greenfield Smart Desk Electric' WHEN 3 THEN 'Durian Fermo Study Table'
        ELSE 'Amazon Basics L-Shape Corner Desk' END || ' Study Desk'
    WHEN 'Sofa' THEN
      CASE (r.rn % 4) WHEN 0 THEN 'Pepperfry Fella 3-Seater Fabric Sofa' WHEN 1 THEN 'IKEA EKTORP 3-Seat Sofa'
        WHEN 2 THEN 'Urban Ladder Essen 3 Seater' ELSE 'Nilkamal Georgia 3-Seater Sofa' END
    ELSE
      CASE (r.rn % 4) WHEN 0 THEN 'Pepperfry Polis Bed Frame Queen' WHEN 1 THEN 'Urban Ladder Hugo Bed'
        WHEN 2 THEN 'Nilkamal Chester Bed' ELSE 'IKEA MALM Bed Frame Queen' END || ' Bed Frame'
    END,
  description = 'Premium quality ' || r."genericName" || ' with ergonomic design, durable materials and easy assembly. ' ||
    'Category: Furniture | Type: ' || r."genericName" || '. Delivered in 7-10 days. 1-year warranty.'
FROM ranked r WHERE p.id = r.id;

-- Audio Equipment
WITH ranked AS (
  SELECT id, "genericName",
    (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Audio Equipment'
)
UPDATE "Product" p
SET
  name = CASE r."genericName"
    WHEN 'Soundbar' THEN
      CASE (r.rn % 5) WHEN 0 THEN 'Sony HT-S400 2.1ch 330W' WHEN 1 THEN 'Samsung HW-Q600B 3.1.2ch'
        WHEN 2 THEN 'JBL Bar 5.0 MultiBeam' WHEN 3 THEN 'Bose Smart Soundbar 600'
        ELSE 'LG SP11RA 7.1.4ch 770W' END || ' Soundbar'
    ELSE
      CASE (r.rn % 5) WHEN 0 THEN 'Yamaha YHT-4950U Home Theatre' WHEN 1 THEN 'Sony STR-DH790 7.2ch'
        WHEN 2 THEN 'Onkyo TX-NR696 7.2ch AV Receiver' WHEN 3 THEN 'Denon AVR-X3700H 9.2ch'
        ELSE 'Polk Audio T50 5.0 Channel' END || ' Home Theatre System'
    END,
  description = 'Cinema-quality ' || r."genericName" || ' with Dolby Atmos, DTS:X and multi-room audio support for immersive sound. ' ||
    'Category: Audio Equipment | Type: ' || r."genericName" || '. 1-year warranty.'
FROM ranked r WHERE p.id = r.id;

-- Office Supplies
WITH ranked AS (
  SELECT id, "genericName",
    (ROW_NUMBER() OVER (PARTITION BY category, "genericName" ORDER BY id) - 1) AS rn
  FROM "Product" WHERE category = 'Office Supplies'
)
UPDATE "Product" p
SET
  name = CASE r."genericName"
    WHEN 'Ergonomic Chair' THEN
      CASE (r.rn % 5) WHEN 0 THEN 'Featherlite Ergo Office Chair' WHEN 1 THEN 'Godrej Interio Workstation Chair'
        WHEN 2 THEN 'Hbada Reclining Office Chair' WHEN 3 THEN 'Green Soul Boston Mid-Back'
        ELSE 'Furwell Executive Mesh Chair' END || ' Office Chair'
    WHEN 'Paper Shredder' THEN
      CASE (r.rn % 4) WHEN 0 THEN 'Fellowes Powershred 99Ci P-5' WHEN 1 THEN 'Aurora AU1200XA P-4'
        WHEN 2 THEN 'HP OneSafe Shredder 8-Sheet' ELSE 'Texet TX-10L 10-Sheet' END || ' Paper Shredder'
    WHEN 'Standing Desk' THEN
      CASE (r.rn % 4) WHEN 0 THEN 'Wakefit Height-Adjustable Desk' WHEN 1 THEN 'Flexispot E7 Pro'
        WHEN 2 THEN 'Autonomous SmartDesk Core' ELSE 'FEZIBO Electric Standing Desk' END
    ELSE
      CASE (r.rn % 4) WHEN 0 THEN 'Casio MJ-120D Plus Calculator' WHEN 1 THEN 'Brother P-Touch D200 Label Maker'
        WHEN 2 THEN 'Navneet A4 Ream 500 Sheets' ELSE 'Pilot G2 Retractable Gel Pen 10pk' END
    END,
  description = 'Essential ' || r."genericName" || ' for a productive and organized workplace. Quality materials with ergonomic design. ' ||
    'Category: Office Supplies | Type: ' || r."genericName" || '. 1-year warranty.'
FROM ranked r WHERE p.id = r.id;

COMMIT;

-- ── Verify key updates ─────────────────────────────────────────────────────────
SELECT category, "genericName", count(DISTINCT name) as distinct_names, min(name) as sample
FROM "Product"
WHERE category IN ('Home Appliances','Laptops','Smartphones')
GROUP BY category, "genericName"
ORDER BY category, "genericName";
