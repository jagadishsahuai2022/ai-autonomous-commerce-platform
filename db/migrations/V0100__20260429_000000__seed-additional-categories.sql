-- V0100: Seed Additional Product Categories
-- ─────────────────────────────────────────────────────────────────────────────
-- Seeds 16 new product subcategories as additional Product rows.
-- New category strings (lowercase_underscore, matching existing DB convention):
--   mens_clothing, womens_clothing, staples, packaged_foods, cricket, football,
--   badminton, books_self_help, books_academic, supplements, medical_devices,
--   baby_care, toys, car_accessories, bike_accessories
-- Footwear is already populated (8000 products) so it is skipped here.
-- All existing 100k products have categoryId=NULL (not linked to ProductCategory)
-- so new products follow the same pattern.
-- Uses generate_series() + array cycling for compact, reproducible inserts.
-- Safe to re-run: each subcategory insert will create duplicates if re-run,
--   so wrap in a guard check.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- Guard: skip if V0100 already applied (mens_clothing products exist)
-- ════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Product" WHERE category = 'mens_clothing' LIMIT 1) THEN
    RAISE NOTICE 'V0100 already applied — skipping product inserts.';
    RETURN;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 1: Fashion subcategories
-- ════════════════════════════════════════════════════════════════════════════

-- ── Mens Clothing (3000 products) ─────────────────────────────────────────
INSERT INTO "Product" (name, "genericName", price, category, description, "imageUrl", featured, "createdAt", "updatedAt")
SELECT
  (ARRAY['Levis','H&M','Zara','Arrow','Peter England','Van Heusen','Raymond','Allen Solly','US Polo','Jack Jones'])[(s-1)%10+1]
    || ' '
    || (ARRAY['Slim Fit Jeans','Regular Fit Shirt','Casual T-Shirt','Chino Trousers','Polo T-Shirt','Oxford Shirt','Smart Trousers','Linen Shirt','Joggers','Bomber Jacket'])[(((s-1)/10)%10)+1]
    || ' '
    || (ARRAY['Navy Blue','Black','White','Grey','Olive','Maroon','Beige','Charcoal','Sky Blue','Dark Green'])[(((s-1)/100)%10)+1],
  'Mens Clothing',
  499 + ((s-1) % 10) * 300,
  'mens_clothing',
  'Premium quality mens clothing from a top fashion brand. Perfect for casual and formal occasions. Machine washable, skin-friendly fabric. Free delivery on orders above Rs 499.',
  'https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=600&q=80',
  (s % 50 = 0),
  NOW(), NOW()
FROM generate_series(1, 3000) AS s
WHERE NOT EXISTS (SELECT 1 FROM "Product" WHERE category = 'mens_clothing' LIMIT 1);

-- ── Womens Clothing (3000 products) ───────────────────────────────────────
INSERT INTO "Product" (name, "genericName", price, category, description, "imageUrl", featured, "createdAt", "updatedAt")
SELECT
  (ARRAY['Biba','W Brand','Fabindia','Aurelia','Global Desi','AND Brand','Rangriti','Soch','Lakshita','Juniper'])[(s-1)%10+1]
    || ' '
    || (ARRAY['Printed Kurti','Floral Dress','Ethnic Saree','Salwar Suit','Palazzo Set','Anarkali Kurta','Casual Top','Embroidered Kurti','Wrap Dress','Lehenga Choli'])[(((s-1)/10)%10)+1]
    || ' '
    || (ARRAY['Blue','Pink','Red','Green','Yellow','Purple','Orange','Teal','Maroon','Peach'])[(((s-1)/100)%10)+1],
  'Womens Clothing',
  599 + ((s-1) % 10) * 400,
  'womens_clothing',
  'Beautiful womens ethnic and western wear. Soft, breathable fabric with vibrant colours. Ideal for daily wear, festive occasions and office. Easy care & machine washable.',
  'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=80',
  (s % 50 = 0),
  NOW(), NOW()
FROM generate_series(1, 3000) AS s
WHERE NOT EXISTS (SELECT 1 FROM "Product" WHERE category = 'womens_clothing' LIMIT 1);

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 2: Groceries subcategories
-- ════════════════════════════════════════════════════════════════════════════

-- ── Staples (2500 products) ───────────────────────────────────────────────
INSERT INTO "Product" (name, "genericName", price, category, description, "imageUrl", featured, "createdAt", "updatedAt")
SELECT
  (ARRAY['Fortune','India Gate','Aashirvaad','Tata Sampann','Daawat','Patanjali','24 Mantra','Organic India','Natures Basket','Saffola'])[(s-1)%10+1]
    || ' '
    || (ARRAY['Basmati Rice 5kg','Whole Wheat Atta 10kg','Toor Dal 2kg','Refined Sunflower Oil 5L','Sugar 5kg','Chana Dal 2kg','Moong Dal 1kg','Mustard Oil 2L','Groundnut Oil 1L','Poha 1kg'])[(((s-1)/10)%10)+1],
  'Staples',
  89 + ((s-1) % 10) * 85,
  'staples',
  'Premium quality staple food product. No artificial additives, preservatives or colours. Sourced from trusted farms. FSSAI licensed. Store in a cool, dry place.',
  'https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=600&q=80',
  (s % 50 = 0),
  NOW(), NOW()
FROM generate_series(1, 2500) AS s
WHERE NOT EXISTS (SELECT 1 FROM "Product" WHERE category = 'staples' LIMIT 1);

-- ── Packaged Foods (2500 products) ────────────────────────────────────────
INSERT INTO "Product" (name, "genericName", price, category, description, "imageUrl", featured, "createdAt", "updatedAt")
SELECT
  (ARRAY['Maggi','Parle','Britannia','Nestle','Kelloggs','Lays','Haldiram','ITC Sunfeast','MTR','Bingo'])[(s-1)%10+1]
    || ' '
    || (ARRAY['Instant Noodles 12-Pack','Glucose Biscuits 800g','Oats 1kg','Breakfast Cereal 500g','Potato Chips 300g','Bhujia 400g','Pasta 500g','Cornflakes 875g','Mixed Nuts 250g','Energy Bar 6-Pack'])[(((s-1)/10)%10)+1],
  'Packaged Foods',
  49 + ((s-1) % 10) * 60,
  'packaged_foods',
  'Ready-to-eat or easy-to-cook packaged food from a trusted FSSAI-licensed brand. No artificial colours, preservatives minimised. Shelf life 6-12 months.',
  'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=600&q=80',
  (s % 50 = 0),
  NOW(), NOW()
FROM generate_series(1, 2500) AS s
WHERE NOT EXISTS (SELECT 1 FROM "Product" WHERE category = 'packaged_foods' LIMIT 1);

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 3: Sports subcategories
-- ════════════════════════════════════════════════════════════════════════════

-- ── Cricket Equipment (2500 products) ─────────────────────────────────────
INSERT INTO "Product" (name, "genericName", price, category, description, "imageUrl", featured, "createdAt", "updatedAt")
SELECT
  (ARRAY['MRF','SG Cricket','SS Sunridges','Kookaburra','GM Cricket','Gray-Nicolls','Dukes','BDM Cricket','Spartan','Thrax'])[(s-1)%10+1]
    || ' '
    || (ARRAY['English Willow Bat','Kashmir Willow Bat','Leather Cricket Ball','Batting Pads','Batting Gloves','WK Gloves','Cricket Helmet','Thigh Guard','Cricket Bag','Training Kit'])[(((s-1)/10)%10)+1]
    || ' Grade '
    || (ARRAY['1','2','3','1','2','3','1','2','1','2'])[(((s-1)/100)%10)+1],
  'Cricket Equipment',
  399 + ((s-1) % 10) * 900,
  'cricket',
  'Professional grade cricket equipment from a trusted sports brand. Used by club and professional players. ISI/ICC approved where applicable.',
  'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&q=80',
  (s % 50 = 0),
  NOW(), NOW()
FROM generate_series(1, 2500) AS s
WHERE NOT EXISTS (SELECT 1 FROM "Product" WHERE category = 'cricket' LIMIT 1);

-- ── Football & Soccer (2000 products) ─────────────────────────────────────
INSERT INTO "Product" (name, "genericName", price, category, description, "imageUrl", featured, "createdAt", "updatedAt")
SELECT
  (ARRAY['Nike','Adidas','Puma','Kipsta','Nivia Sports','Vector X','Cosco Sports','Splay','Asiimut','Futebol'])[(s-1)%10+1]
    || ' '
    || (ARRAY['Size 5 Football','Shin Guards','Football Cleats','Goalkeeper Gloves','Football Jersey','Training Cones Set','Football Pump','Football Net','Ankle Support','Football Kit Bag'])[(((s-1)/10)%10)+1],
  'Football',
  299 + ((s-1) % 10) * 450,
  'football',
  'Premium football and soccer equipment for training and match play. Suitable for all levels from beginners to professionals. Durable construction for outdoor & indoor use.',
  'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=600&q=80',
  (s % 50 = 0),
  NOW(), NOW()
FROM generate_series(1, 2000) AS s
WHERE NOT EXISTS (SELECT 1 FROM "Product" WHERE category = 'football' LIMIT 1);

-- ── Badminton (2000 products) ──────────────────────────────────────────────
INSERT INTO "Product" (name, "genericName", price, category, description, "imageUrl", featured, "createdAt", "updatedAt")
SELECT
  (ARRAY['Yonex','Victor Sports','Li-Ning','Babolat','Carlton','Cosco','Apacs','Fleet Sports','Kawasaki','Forza'])[(s-1)%10+1]
    || ' '
    || (ARRAY['Carbon Racket','Feather Shuttlecock 6-Pack','Nylon Shuttlecock 6-Pack','Racket Bag','Court Shoes','Grip Tape 3-Pack','Badminton Net','Racket String','Training Racket Set','Wristband'])[(((s-1)/10)%10)+1],
  'Badminton',
  249 + ((s-1) % 10) * 350,
  'badminton',
  'High-quality badminton equipment for recreational and competitive play. Lightweight, aerodynamic design for superior control and power. Suitable for all skill levels.',
  'https://images.unsplash.com/photo-1627896084524-e08d2b0ed93a?w=600&q=80',
  (s % 50 = 0),
  NOW(), NOW()
FROM generate_series(1, 2000) AS s
WHERE NOT EXISTS (SELECT 1 FROM "Product" WHERE category = 'badminton' LIMIT 1);

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 4: Books subcategories
-- ════════════════════════════════════════════════════════════════════════════

-- ── Self Help & Business Books (2500 products) ────────────────────────────
INSERT INTO "Product" (name, "genericName", price, category, description, "imageUrl", featured, "createdAt", "updatedAt")
SELECT
  (ARRAY['Penguin','HarperCollins','Jaico Publishing','Westland Books','Rupa Publications','Bloomsbury','Simon Schuster','Notion Press','Fingerprint','Random House'])[(s-1)%10+1]
    || ' - '
    || (ARRAY['The Power of Habit','Atomic Habits','Think and Grow Rich','The 7 Habits','Rich Dad Poor Dad','Zero to One','The Lean Startup','Start With Why','Ikigai','Deep Work'])[(((s-1)/10)%10)+1],
  'Self Help Book',
  149 + ((s-1) % 10) * 100,
  'books_self_help',
  'Best-selling self-help and business book in English paperback edition. Great for personal development, career growth and financial literacy. Quality printing with original content.',
  'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&q=80',
  (s % 50 = 0),
  NOW(), NOW()
FROM generate_series(1, 2500) AS s
WHERE NOT EXISTS (SELECT 1 FROM "Product" WHERE category = 'books_self_help' LIMIT 1);

-- ── Academic & Competitive Exam Books (2500 products) ─────────────────────
INSERT INTO "Product" (name, "genericName", price, category, description, "imageUrl", featured, "createdAt", "updatedAt")
SELECT
  (ARRAY['S. Chand','Arihant Publications','MTG Learning','Disha Publications','Oswaal Books','Allen Career','NCERT Exemplar','RS Agarwal','RD Sharma','Cengage Learning'])[(s-1)%10+1]
    || ' '
    || (ARRAY['JEE Main Complete Guide','NEET 40 Years Solutions','Class 12 Physics','SSC CGL Guide','UPSC GS Manual','CAT Preparation Kit','Class 10 Board Package','GATE ECE Guide','Bank PO Package','Class 8 Science'])[(((s-1)/10)%10)+1]
    || ' '
    || (ARRAY['2024','2025','Latest Edition','Revised','Vol 1','Vol 2','2024','2025','Latest','Revised'])[(((s-1)/100)%10)+1],
  'Academic Book',
  249 + ((s-1) % 10) * 150,
  'books_academic',
  'Comprehensive academic or competitive exam preparation book with solved previous year papers, theory explanations and practice exercises. Latest edition with updated syllabus.',
  'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&q=80',
  (s % 50 = 0),
  NOW(), NOW()
FROM generate_series(1, 2500) AS s
WHERE NOT EXISTS (SELECT 1 FROM "Product" WHERE category = 'books_academic' LIMIT 1);

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 5: Health & Wellness subcategories
-- ════════════════════════════════════════════════════════════════════════════

-- ── Supplements (2500 products) ───────────────────────────────────────────
INSERT INTO "Product" (name, "genericName", price, category, description, "imageUrl", featured, "createdAt", "updatedAt")
SELECT
  (ARRAY['Optimum Nutrition','MuscleBlaze','HealthKart','GNC Nutrition','Myprotein','Scitec Nutrition','Dymatize','BSN Sports','Isopure','Nutrabay'])[(s-1)%10+1]
    || ' '
    || (ARRAY['Whey Protein 1kg','Creatine Monohydrate 300g','BCAA 400g','Multivitamin 60 Tabs','Fish Oil 60 Softgels','Pre-Workout 200g','Mass Gainer 3kg','Vitamin C 500mg','Zinc 25mg 60 Tabs','Omega-3 60 Caps'])[(((s-1)/10)%10)+1]
    || ' '
    || (ARRAY['Chocolate','Vanilla','Strawberry','Unflavoured','Mango','Cookies Cream','Double Chocolate','French Vanilla','Mixed Berry','Unflavoured'])[(((s-1)/100)%10)+1],
  'Supplement',
  399 + ((s-1) % 10) * 600,
  'supplements',
  'High-quality nutritional supplement from a trusted brand. Lab-tested for purity and potency. Free from banned substances. Suitable for athletes and health-conscious individuals. FSSAI approved.',
  'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&q=80',
  (s % 50 = 0),
  NOW(), NOW()
FROM generate_series(1, 2500) AS s
WHERE NOT EXISTS (SELECT 1 FROM "Product" WHERE category = 'supplements' LIMIT 1);

-- ── Medical Devices (2000 products) ───────────────────────────────────────
INSERT INTO "Product" (name, "genericName", price, category, description, "imageUrl", featured, "createdAt", "updatedAt")
SELECT
  (ARRAY['Omron Healthcare','Beurer Medical','Dr Morepen','Contec Medical','Rossmax','Yuwell','A and D Medical','Nisco Health','BPL Medical','Hicks Medical'])[(s-1)%10+1]
    || ' '
    || (ARRAY['Digital BP Monitor','Blood Glucose Monitor','Pulse Oximeter','Digital Thermometer','Nebulizer Machine','Smart Weighing Scale','Peak Flow Meter','Hearing Aid','ECG Monitor','Infrared Thermometer'])[(((s-1)/10)%10)+1],
  'Medical Device',
  699 + ((s-1) % 10) * 800,
  'medical_devices',
  'Certified medical device for home health monitoring. Easy to use with large digital display. BIS/CE certified. Clinically validated for accuracy. Comes with user manual and 1-year warranty.',
  'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&q=80',
  (s % 50 = 0),
  NOW(), NOW()
FROM generate_series(1, 2000) AS s
WHERE NOT EXISTS (SELECT 1 FROM "Product" WHERE category = 'medical_devices' LIMIT 1);

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 6: Baby & Kids subcategories
-- ════════════════════════════════════════════════════════════════════════════

-- ── Baby Care (2000 products) ──────────────────────────────────────────────
INSERT INTO "Product" (name, "genericName", price, category, description, "imageUrl", featured, "createdAt", "updatedAt")
SELECT
  (ARRAY['Pampers','Huggies','MamyPoko','Himalaya Baby','Johnsons Baby','Pigeon Baby','Mee Mee','Mothercare','Nestle Nan','Dabur Lal'])[(s-1)%10+1]
    || ' '
    || (ARRAY['Diapers Size M 50-Pack','Baby Shampoo 200ml','Baby Lotion 400ml','Baby Wipes 80-Pack','Baby Powder 400g','Feeding Bottle 240ml','Baby Food Cereal 300g','Nursing Pads 24-Pack','Baby Rash Cream 50g','Baby Oil 200ml'])[(((s-1)/10)%10)+1],
  'Baby Care',
  149 + ((s-1) % 10) * 200,
  'baby_care',
  'Gentle, hypoallergenic baby care product tested by dermatologists. Safe for sensitive baby skin. Free from parabens, sulphates and artificial fragrances. Paediatrician recommended.',
  'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&q=80',
  (s % 50 = 0),
  NOW(), NOW()
FROM generate_series(1, 2000) AS s
WHERE NOT EXISTS (SELECT 1 FROM "Product" WHERE category = 'baby_care' LIMIT 1);

-- ── Toys & Games (2000 products) ──────────────────────────────────────────
INSERT INTO "Product" (name, "genericName", price, category, description, "imageUrl", featured, "createdAt", "updatedAt")
SELECT
  (ARRAY['LEGO','Funskool India','Fisher-Price','Hot Wheels','Barbie','Chhota Bheem','Nerf','Carrom Games','Milton Games','Mattel'])[(s-1)%10+1]
    || ' '
    || (ARRAY['Building Blocks Set','STEM Puzzle 50-Piece','Family Board Game','Action Figure Set','Remote Control Car','Soft Stuffed Toy','Drawing Art Set','Educational Flash Cards','Musical Learning Toy','Strategy Game'])[(((s-1)/10)%10)+1]
    || ' Ages '
    || (ARRAY['3+','5+','7+','8+','10+','3+','6+','4+','2+','12+'])[(((s-1)/100)%10)+1],
  'Toy',
  199 + ((s-1) % 10) * 400,
  'toys',
  'Safe, high-quality toy and game for children. Made with non-toxic, BIS-certified materials. Encourages creativity, problem-solving and social skills. Age-appropriate design for safe play.',
  'https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=600&q=80',
  (s % 50 = 0),
  NOW(), NOW()
FROM generate_series(1, 2000) AS s
WHERE NOT EXISTS (SELECT 1 FROM "Product" WHERE category = 'toys' LIMIT 1);

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 7: Automotive subcategories
-- ════════════════════════════════════════════════════════════════════════════

-- ── Car Accessories (2000 products) ───────────────────────────────────────
INSERT INTO "Product" (name, "genericName", price, category, description, "imageUrl", featured, "createdAt", "updatedAt")
SELECT
  (ARRAY['Viofo','Garmin Auto','Meguiars','3M Automotive','Michelin','Bosch Auto','Hella Lights','Pioneer Car','JBL Car','Osram Auto'])[(s-1)%10+1]
    || ' '
    || (ARRAY['Dash Camera HD','Car Seat Cover Set','Tyre Inflator Pump','Car Wax Polish','Windshield Sunshade','USB Car Charger','Car Floor Mats','Reverse Parking Sensor','Car Air Freshener','Battery Jump Starter'])[(((s-1)/10)%10)+1],
  'Car Accessory',
  499 + ((s-1) % 10) * 800,
  'car_accessories',
  'Premium car accessory from a trusted brand. Easy to install, compatible with most car models. Enhances comfort, safety and aesthetics of your vehicle. 1-year warranty included.',
  'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600&q=80',
  (s % 50 = 0),
  NOW(), NOW()
FROM generate_series(1, 2000) AS s
WHERE NOT EXISTS (SELECT 1 FROM "Product" WHERE category = 'car_accessories' LIMIT 1);

-- ── Bike Accessories (2000 products) ──────────────────────────────────────
INSERT INTO "Product" (name, "genericName", price, category, description, "imageUrl", featured, "createdAt", "updatedAt")
SELECT
  (ARRAY['Steelbird','Vega Helmets','Royal Enfield','Studds','LS2 Helmets','AGV','BSDDP','Autofy','Moto Max','TVS Accessories'])[(s-1)%10+1]
    || ' '
    || (ARRAY['Full Face Helmet','Half Face Helmet','Riding Gloves','Bike Cover','Rear View Mirror','LED Indicator Set','Chain Lubricant','Handle Bar Grips','Pannier Bag','Tyre Pressure Gauge'])[(((s-1)/10)%10)+1],
  'Bike Accessory',
  299 + ((s-1) % 10) * 600,
  'bike_accessories',
  'Quality bike accessory for your motorcycle or scooter. ISI/DOT certified safety equipment where applicable. Easy installation, durable build for Indian road conditions. 6-month warranty.',
  'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=80',
  (s % 50 = 0),
  NOW(), NOW()
FROM generate_series(1, 2000) AS s
WHERE NOT EXISTS (SELECT 1 FROM "Product" WHERE category = 'bike_accessories' LIMIT 1);

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 8: Seed ProductBusinessMetrics for new products
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO "ProductBusinessMetrics" ("productId", "marginPercentage", "inventoryCount", "salesVelocity", "conversionRate", "returnRate", "lastUpdated")
SELECT
  p.id,
  ROUND((8.0 + RANDOM() * 37.0)::NUMERIC, 2),
  (5 + (RANDOM() * 245)::INTEGER),
  ROUND((0.1 + RANDOM() * 4.9)::NUMERIC, 4),
  ROUND((0.01 + RANDOM() * 0.10)::NUMERIC, 4),
  ROUND((0.02 + RANDOM() * 0.13)::NUMERIC, 4),
  NOW()
FROM "Product" p
WHERE p.category IN (
  'mens_clothing', 'womens_clothing', 'staples', 'packaged_foods',
  'cricket', 'football', 'badminton', 'books_self_help', 'books_academic',
  'supplements', 'medical_devices', 'baby_care', 'toys',
  'car_accessories', 'bike_accessories'
)
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 9: Verification — show category counts for new products
-- ════════════════════════════════════════════════════════════════════════════

SELECT category, COUNT(*) AS product_count
FROM "Product"
WHERE category IN (
  'mens_clothing', 'womens_clothing', 'staples', 'packaged_foods',
  'cricket', 'football', 'badminton', 'books_self_help', 'books_academic',
  'supplements', 'medical_devices', 'baby_care', 'toys',
  'car_accessories', 'bike_accessories'
)
GROUP BY category
ORDER BY category;

COMMIT;
