-- ============================================================================
-- Seed 100,000 Products + Related Data for DelegateCart
-- Run: cat scripts/seed-100k-products.sql | docker exec -i dc-latest-postgres psql -U admin -d delegatecart
-- ============================================================================

BEGIN;

-- ─── 1. Products (100,000 rows) ──────────────────────────────────────────────
-- Categories and brands used across the product catalog
DO $$
DECLARE
  categories TEXT[] := ARRAY[
    'Smartphones', 'Laptops', 'Headphones', 'Televisions', 'Cameras',
    'Tablets', 'Smartwatches', 'Speakers', 'Gaming', 'Home Appliances',
    'Kitchen Appliances', 'Personal Care', 'Fitness Equipment', 'Audio Equipment',
    'Computer Accessories', 'Storage Devices', 'Networking', 'Printers',
    'Office Supplies', 'Furniture'
  ];
  brands TEXT[] := ARRAY[
    'Samsung', 'Apple', 'Sony', 'LG', 'Dell', 'HP', 'Lenovo', 'Asus',
    'OnePlus', 'Xiaomi', 'Realme', 'Bose', 'JBL', 'Boat', 'Noise',
    'Philips', 'Bosch', 'Dyson', 'Nike', 'Canon',
    'Panasonic', 'TCL', 'Hisense', 'Oppo', 'Vivo',
    'Skullcandy', 'Marshall', 'Sennheiser', 'Audio-Technica', 'Corsair',
    'Logitech', 'Razer', 'SteelSeries', 'HyperX', 'MSI',
    'Acer', 'Motorola', 'Nothing', 'Google', 'Microsoft'
  ];
  adjectives TEXT[] := ARRAY[
    'Pro', 'Ultra', 'Max', 'Plus', 'Lite', 'Neo', 'Air', 'Elite',
    'Prime', 'Advanced', 'Essential', 'Sport', 'Classic', 'Premium',
    'Turbo', 'Slim', 'Smart', 'Eco', 'Flex', 'Studio'
  ];
  product_types TEXT[][] := ARRAY[
    ARRAY['Galaxy S24', 'iPhone 15', 'Pixel 8', 'Find X7', 'Reno 11', 'Nord CE4', 'Redmi Note 13', 'Moto G84', 'Phone (2a)', 'V30'],
    ARRAY['ThinkPad X1', 'MacBook Air', 'XPS 15', 'Pavilion 15', 'ROG Strix', 'ZenBook 14', 'IdeaPad Slim', 'Aspire 5', 'Nitro V', 'Surface Laptop'],
    ARRAY['WH-1000XM5', 'AirPods Pro', 'QuietComfort', 'Live Pro 2', 'Buds Pro', 'Airdopes 441', 'Tune 770', 'Crusher ANC', 'Major IV', 'ATH-M50x'],
    ARRAY['OLED55C4', 'QN85B', 'Bravia XR A80L', 'U8K', '50C350', 'Smart TV 43', 'Frame LS03B', 'Nano80', 'X90L', 'A75K'],
    ARRAY['EOS R50', 'Alpha A7 IV', 'Z8', 'Lumix S5 II', 'X-T5', 'GoPro Hero12', 'Insta360 X4', 'DJI Osmo', 'PowerShot V10', 'ZV-E10'],
    ARRAY['iPad Air', 'Galaxy Tab S9', 'Tab P12', 'Pad 6', 'Surface Pro', 'MatePad', 'Pixel Tablet', 'Fire HD 10', 'Yoga Tab', 'Pad Plus'],
    ARRAY['Watch Ultra 2', 'Galaxy Watch 6', 'Pixel Watch 2', 'GT 4', 'Amazfit T-Rex', 'Noise ColorFit', 'Band 8', 'Venu 3', 'Versa 4', 'TicWatch Pro'],
    ARRAY['SRS-XB100', 'HomePod mini', 'SoundLink Flex', 'Charge 5', 'Flip 6', 'Xtreme 3', 'Echo Dot', 'Nest Audio', 'One SL', 'Roam 2'],
    ARRAY['PS5 Slim', 'Xbox Series X', 'Switch OLED', 'Steam Deck', 'ROG Ally', 'Legion Go', 'DualSense Edge', 'Pro Controller', 'Razer Kishi', 'Backbone One'],
    ARRAY['RoboVac G30', 'V15 Detect', 'PowerBot', 'LaserSmart', 'SpeedPro Max', 'AquaPure', 'PureAir', 'Jet Bot', 'Deebot X2', 'Roomba j9+'],
    ARRAY['Instant Pot Duo', 'Air Fryer XXL', 'KitchenAid Artisan', 'Ninja Foodi', 'Vitamix A3500', 'Thermomix TM6', 'Breville Barista', 'Oven Toaster Grill', 'Induction Cooktop', 'Juicer Pro'],
    ARRAY['OneBlade Pro', 'Series 9 Pro', 'Epilator Silk', 'Satin Hair 7', 'AirWrap Complete', 'Supersonic HD15', 'IPL Lumea', 'Beard Trimmer Pro', 'Water Flosser', 'Oral-B iO'],
    ARRAY['Treadmill T25', 'Spin Bike S22i', 'Rowing Machine', 'Yoga Mat Premium', 'Kettlebell Set', 'Resistance Bands', 'Pull-Up Bar', 'Ab Roller Pro', 'Jump Rope Speed', 'Balance Board'],
    ARRAY['DAC Amp Stack', 'Turntable AT-LP120', 'Soundbar HW-Q990', 'AV Receiver RX-V6A', 'Bookshelf LS50', 'Studio Monitor HS5', 'Podcast Mic Blue Yeti', 'Audio Interface 2i2', 'Wireless Mic Go II', 'DJ Controller DDJ-400'],
    ARRAY['MX Master 3S', 'G502 X Plus', 'DeathAdder V3', 'Apex Pro TKL', 'Huntsman V3', 'K70 Max', 'Orion Spark', 'UltraSharp U2723QE', 'ProArt PA278QV', 'Webcam C920'],
    ARRAY['T7 Shield 2TB', 'X6 Portable', 'My Passport 5TB', 'IronWolf 8TB NAS', 'Crucial P5 Plus', '980 Pro 2TB', 'FireCuda 530', 'KC3000', 'Rocket 4 Plus', 'SN850X'],
    ARRAY['Nighthawk RAX50', 'Deco XE75', 'AX86U Pro', 'Orbi RBKE963', 'eero Pro 6E', 'Archer AXE75', 'Dream Machine Pro', 'Wi-Fi 7 Router', 'MR7500', 'RBE972S'],
    ARRAY['LaserJet Pro M404', 'EcoTank ET-2850', 'PIXMA G3270', 'Smart Tank 580', 'HL-L2350DW', 'WorkForce WF-2960', 'Color LaserJet Pro M255', 'ENVY Inspire 7955', 'Expression Home XP-4200', 'DeskJet 4155e'],
    ARRAY['Ergonomic Chair S1', 'Standing Desk E7', 'Monitor Arm F8', 'Desk Mat XL', 'Cable Tray Pro', 'Footrest Comfort', 'Pen Holder Set', 'Document Scanner', 'Label Maker P750', 'Paper Shredder S8'],
    ARRAY['Herman Miller Aeron', 'IKEA Markus', 'FlexiSpot E7', 'Secretlab Titan', 'Steelcase Leap', 'Autonomous ErgoChair', 'Branch Task Chair', 'HON Ignition 2.0', 'Uplift V2 Desk', 'Jarvis Standing Desk']
  ];
  i INT;
  cat_idx INT;
  brand_idx INT;
  adj_idx INT;
  type_idx INT;
  prod_name TEXT;
  prod_price FLOAT;
  prod_cat TEXT;
  prod_brand TEXT;
  prod_desc TEXT;
  base_price FLOAT;
  feat BOOLEAN;
BEGIN
  FOR i IN 1..100000 LOOP
    cat_idx   := ((i - 1) % 20) + 1;
    brand_idx := ((i - 1) % 40) + 1;
    adj_idx   := ((i * 7 + 3) % 20) + 1;
    type_idx  := ((i * 3 + 1) % 10) + 1;
    prod_cat  := categories[cat_idx];
    prod_brand := brands[brand_idx];

    -- Build product name: "Brand TypeName Adjective Series-Number"
    prod_name := prod_brand || ' ' || product_types[cat_idx][type_idx] || ' ' || adjectives[adj_idx];
    IF i > 20000 THEN
      prod_name := prod_name || ' ' || ((i % 999) + 1)::TEXT;
    END IF;

    -- Realistic price ranges by category
    base_price := CASE cat_idx
      WHEN 1 THEN 8999 + (random() * 141000)    -- Smartphones: ₹8,999-₹149,999
      WHEN 2 THEN 29999 + (random() * 270000)   -- Laptops: ₹29,999-₹299,999
      WHEN 3 THEN 999 + (random() * 34000)      -- Headphones: ₹999-₹34,999
      WHEN 4 THEN 12999 + (random() * 287000)   -- TVs: ₹12,999-₹299,999
      WHEN 5 THEN 15999 + (random() * 284000)   -- Cameras: ₹15,999-₹299,999
      WHEN 6 THEN 9999 + (random() * 140000)    -- Tablets: ₹9,999-₹149,999
      WHEN 7 THEN 1499 + (random() * 88500)     -- Smartwatches: ₹1,499-₹89,999
      WHEN 8 THEN 799 + (random() * 39200)      -- Speakers: ₹799-₹39,999
      WHEN 9 THEN 2999 + (random() * 57000)     -- Gaming: ₹2,999-₹59,999
      WHEN 10 THEN 4999 + (random() * 95000)    -- Home Appliances: ₹4,999-₹99,999
      WHEN 11 THEN 1999 + (random() * 48000)    -- Kitchen: ₹1,999-₹49,999
      WHEN 12 THEN 499 + (random() * 49500)     -- Personal Care: ₹499-₹49,999
      WHEN 13 THEN 999 + (random() * 99000)     -- Fitness: ₹999-₹99,999
      WHEN 14 THEN 2999 + (random() * 197000)   -- Audio Equipment: ₹2,999-₹199,999
      WHEN 15 THEN 499 + (random() * 29500)     -- Computer Accessories: ₹499-₹29,999
      WHEN 16 THEN 1999 + (random() * 28000)    -- Storage: ₹1,999-₹29,999
      WHEN 17 THEN 1499 + (random() * 48500)    -- Networking: ₹1,499-₹49,999
      WHEN 18 THEN 4999 + (random() * 45000)    -- Printers: ₹4,999-₹49,999
      WHEN 19 THEN 999 + (random() * 49000)     -- Office Supplies: ₹999-₹49,999
      WHEN 20 THEN 4999 + (random() * 145000)   -- Furniture: ₹4,999-₹149,999
      ELSE 999 + (random() * 49000)
    END;
    prod_price := round(base_price::numeric, 0)::FLOAT;

    prod_desc := prod_brand || ' ' || product_types[cat_idx][type_idx] || ' ' || adjectives[adj_idx]
      || ' — ' || prod_cat || ' category. '
      || CASE WHEN random() < 0.5 THEN 'Latest model with enhanced performance. ' ELSE 'Popular choice with great value. ' END
      || CASE WHEN random() < 0.3 THEN '1 Year Warranty included. ' WHEN random() < 0.5 THEN '2 Year Warranty. ' ELSE '' END
      || 'Free delivery available.';

    feat := (random() < 0.15); -- 15% featured

    INSERT INTO "Product" (name, price, category, description, "imageUrl", featured, "createdAt", "updatedAt")
    VALUES (
      prod_name,
      prod_price,
      prod_cat,
      prod_desc,
      '/images/products/' || lower(replace(prod_cat, ' ', '-')) || '/' || i || '.webp',
      feat,
      NOW() - (random() * INTERVAL '365 days'),
      NOW() - (random() * INTERVAL '30 days')
    );

    -- Progress logging every 25,000 rows
    IF i % 25000 = 0 THEN
      RAISE NOTICE 'Inserted % products...', i;
    END IF;
  END LOOP;
  RAISE NOTICE 'All 100,000 products inserted.';
END $$;

-- ─── 2. Carts for existing users ────────────────────────────────────────────
INSERT INTO "Cart" ("userId", "createdAt", "updatedAt")
SELECT id, NOW() - (random() * INTERVAL '7 days'), NOW() - (random() * INTERVAL '1 day')
FROM "User"
WHERE id IN (1, 2, 3, 4, 16, 17, 18, 19)
ON CONFLICT DO NOTHING;

-- ─── 3. Cart Items (random products for each cart) ───────────────────────────
INSERT INTO "CartItem" ("cartId", "productId", quantity)
SELECT c.id, p.id, (floor(random() * 3) + 1)::INT
FROM "Cart" c
CROSS JOIN LATERAL (
  SELECT id FROM "Product" ORDER BY random() LIMIT (floor(random() * 5) + 2)::INT
) p;

-- ─── 4. Additional Orders (200 orders across users) ─────────────────────────
INSERT INTO "Order" ("userId", total, status, "createdAt", "updatedAt", "aiAssisted", "orderNumber", "paymentMethod", "shippingAddress", notes, "processedByAI", "autoCheckout")
SELECT
  u.id,
  round((5000 + random() * 95000)::numeric, 2)::FLOAT,
  (ARRAY['completed', 'completed', 'completed', 'processing', 'shipped', 'delivered', 'cancelled'])[floor(random() * 7 + 1)::INT],
  NOW() - (random() * INTERVAL '180 days'),
  NOW() - (random() * INTERVAL '30 days'),
  random() < 0.4,
  'DC-' || to_char(NOW(), 'YYYY') || '-' || lpad((25 + row_number() OVER ())::TEXT, 5, '0'),
  (ARRAY['wallet', 'wallet', 'upi', 'card', 'cod'])[floor(random() * 5 + 1)::INT],
  (ARRAY[
    '{"street":"MG Road","city":"Mumbai","state":"Maharashtra","pin":"400001"}'::jsonb,
    '{"street":"Connaught Place","city":"Delhi","state":"NCR","pin":"110001"}'::jsonb,
    '{"street":"Brigade Road","city":"Bangalore","state":"Karnataka","pin":"560001"}'::jsonb,
    '{"street":"Anna Nagar","city":"Chennai","state":"Tamil Nadu","pin":"600001"}'::jsonb,
    '{"street":"Banjara Hills","city":"Hyderabad","state":"Telangana","pin":"500001"}'::jsonb,
    '{"street":"FC Road","city":"Pune","state":"Maharashtra","pin":"411001"}'::jsonb,
    '{"street":"Park Street","city":"Kolkata","state":"West Bengal","pin":"700001"}'::jsonb,
    '{"street":"CG Road","city":"Ahmedabad","state":"Gujarat","pin":"380001"}'::jsonb
  ])[floor(random() * 8 + 1)::INT],
  CASE WHEN random() < 0.3 THEN 'Express delivery requested' WHEN random() < 0.5 THEN 'Gift wrapping' ELSE NULL END,
  random() < 0.35,
  random() < 0.2
FROM "User" u
CROSS JOIN generate_series(1, 8) s
WHERE u.id IN (1, 2, 3, 4, 16, 17, 18, 19);

-- ─── 5. Order Items referencing real products ────────────────────────────────
INSERT INTO "OrderItem" ("orderId", "productId", quantity, price, "productName", "imageUrl")
SELECT
  o.id,
  p.id,
  (floor(random() * 3) + 1)::INT,
  p.price,
  p.name,
  p."imageUrl"
FROM "Order" o
CROSS JOIN LATERAL (
  SELECT id, price, name, "imageUrl" FROM "Product" ORDER BY random() LIMIT (floor(random() * 4) + 1)::INT
) p
WHERE o.id > 25; -- Only for new orders

-- ─── 6. Wishlist Items ─────────────────────────────────────────────────────
INSERT INTO "WishlistItem" ("userId", "productId", "productName", price, "imageUrl", "addedAt")
SELECT
  u.id,
  p.id::TEXT,
  p.name,
  p.price,
  p."imageUrl",
  NOW() - (random() * INTERVAL '60 days')
FROM "User" u
CROSS JOIN LATERAL (
  SELECT id, name, price, "imageUrl" FROM "Product" ORDER BY random() LIMIT (floor(random() * 8) + 3)::INT
) p
WHERE u.id IN (1, 2, 3, 4, 16, 17, 18, 19);

-- ─── 7. Wallet + Wallet Transactions for users who don't have wallets ────────
INSERT INTO "Wallet" ("userId", balance, "totalAdded", "totalSpent", "isActive", "createdAt", "updatedAt", "isAiAuthorized")
SELECT id, 50000 + (random() * 100000)::INT, 80000 + (random() * 120000)::INT, 30000 + (random() * 50000)::INT, true, NOW() - INTERVAL '90 days', NOW(), random() < 0.5
FROM "User"
WHERE id NOT IN (SELECT "userId" FROM "Wallet")
AND id IN (1, 2, 3, 16, 17, 18, 19);

-- Additional wallet transactions for all wallet holders
INSERT INTO "WalletTransaction" ("walletId", type, amount, description, status, "balanceBefore", "balanceAfter", "createdAt", "updatedAt")
SELECT
  w.id,
  (ARRAY['debit', 'debit', 'credit', 'debit', 'refund'])[floor(random() * 5 + 1)::INT],
  round((500 + random() * 15000)::numeric, 2)::FLOAT,
  (ARRAY['Order payment', 'Wallet top-up', 'Refund - cancelled order', 'Product purchase', 'Cashback reward', 'Subscription payment'])[floor(random() * 6 + 1)::INT],
  'completed',
  w.balance + (random() * 5000)::INT,
  w.balance,
  NOW() - (random() * INTERVAL '90 days'),
  NOW() - (random() * INTERVAL '30 days')
FROM "Wallet" w
CROSS JOIN generate_series(1, 10) s;

-- ─── 8. Wallet Audit Log entries ─────────────────────────────────────────────
INSERT INTO "WalletAuditLog" ("walletId", action, performer, reason, "createdAt")
SELECT
  w.id,
  (ARRAY['debit', 'credit', 'balance_check', 'limit_update', 'ai_authorization'])[floor(random() * 5 + 1)::INT],
  (ARRAY['system', 'user', 'admin', 'ai-engine'])[floor(random() * 4 + 1)::INT],
  (ARRAY['Order payment processed', 'Wallet topped up', 'Balance verified', 'AI spending limit updated', 'Refund processed'])[floor(random() * 5 + 1)::INT],
  NOW() - (random() * INTERVAL '90 days')
FROM "Wallet" w
CROSS JOIN generate_series(1, 5) s;

-- ─── 9. Analytics Events (browsing, search, purchase events) ─────────────────
INSERT INTO "AnalyticsEvent" ("eventType", "userId", "productId", metadata, "createdAt")
SELECT
  (ARRAY['product_view', 'product_view', 'search', 'add_to_cart', 'purchase', 'wishlist_add', 'page_view', 'checkout_start'])[floor(random() * 8 + 1)::INT],
  u.id,
  p.id::TEXT,
  jsonb_build_object(
    'source', (ARRAY['shopping-assistant', 'browse', 'search', 'recommendation', 'smart-delegate'])[floor(random() * 5 + 1)::INT],
    'device', (ARRAY['mobile', 'desktop', 'tablet'])[floor(random() * 3 + 1)::INT],
    'session_id', 'sess_' || md5(random()::TEXT)
  ),
  NOW() - (random() * INTERVAL '30 days')
FROM "User" u
CROSS JOIN LATERAL (
  SELECT id FROM "Product" ORDER BY random() LIMIT (floor(random() * 10) + 5)::INT
) p
WHERE u.id IN (1, 2, 3, 4, 16, 17, 18, 19);

-- ─── 10. User Behavior tracking ──────────────────────────────────────────────
INSERT INTO "UserBehavior" ("userId", "productId", action, metadata, "createdAt")
SELECT
  u.id,
  p.id::TEXT,
  (ARRAY['view', 'click', 'scroll', 'hover', 'compare', 'share'])[floor(random() * 6 + 1)::INT],
  jsonb_build_object(
    'duration_ms', floor(random() * 30000),
    'scroll_depth', round((random() * 100)::numeric, 1),
    'referrer', (ARRAY['/shopping-assistant', '/products', '/search', '/home', '/smart-delegate'])[floor(random() * 5 + 1)::INT]
  ),
  NOW() - (random() * INTERVAL '30 days')
FROM "User" u
CROSS JOIN LATERAL (
  SELECT id FROM "Product" ORDER BY random() LIMIT (floor(random() * 8) + 3)::INT
) p
WHERE u.id IN (1, 2, 3, 4, 16, 17, 18, 19);

-- ─── 11. Activity Log ────────────────────────────────────────────────────────
INSERT INTO "ActivityLog" ("userId", action, metadata, "createdAt")
SELECT
  u.id,
  (ARRAY['login', 'logout', 'search', 'page_view', 'order_placed', 'wallet_topup', 'profile_update', 'password_change'])[floor(random() * 8 + 1)::INT],
  jsonb_build_object(
    'ip', '192.168.' || floor(random() * 255)::INT || '.' || floor(random() * 255)::INT,
    'user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0',
    'page', (ARRAY['/', '/products', '/shopping-assistant', '/account', '/admin', '/observability'])[floor(random() * 6 + 1)::INT]
  ),
  NOW() - (random() * INTERVAL '30 days')
FROM "User" u
CROSS JOIN generate_series(1, 15) s
WHERE u.id IN (1, 2, 3, 4, 16, 17, 18, 19);

-- ─── 12. SmartIntentEngineResponse (more learning data) ──────────────────────
INSERT INTO "SmartIntentEngineResponse" ("userId", "queryBy", "queryText", "initialProductSuggestionText", "intentEngineResponse", "supervisedResponse", "isActive", comments, "createdAt", "updatedAt")
SELECT
  u.id,
  u.email,
  q.query_text,
  'Based on your search, here are the top recommendations...',
  jsonb_build_object(
    'intent', (ARRAY['purchase', 'compare', 'research', 'gift', 'budget_find'])[floor(random() * 5 + 1)::INT],
    'products', '[]'::jsonb,
    'engine_version', 'v2',
    'processing_time_ms', floor(random() * 3000 + 500)
  ),
  '{}'::jsonb,
  true,
  jsonb_build_array(jsonb_build_object('text', 'Record created', 'author', 'system', 'type', 'created', 'timestamp', NOW()::TEXT)),
  NOW() - (random() * INTERVAL '14 days'),
  NOW() - (random() * INTERVAL '7 days')
FROM "User" u
CROSS JOIN (
  VALUES
    ('best laptop under 50000'),
    ('wireless headphones with noise cancellation'),
    ('samsung galaxy s24 ultra review'),
    ('gaming chair ergonomic'),
    ('air fryer best brand india'),
    ('smartwatch with blood oxygen sensor'),
    ('4K OLED TV 55 inch deals'),
    ('mechanical keyboard for programming'),
    ('portable bluetooth speaker waterproof'),
    ('mirrorless camera for beginners'),
    ('best running shoes under 5000'),
    ('robot vacuum cleaner with mopping'),
    ('standing desk adjustable height'),
    ('wireless earbuds long battery life'),
    ('mini projector for home theater'),
    ('electric toothbrush sonicare vs oral-b'),
    ('NAS storage for home server'),
    ('mesh wifi system for large house'),
    ('webcam 4k for streaming'),
    ('ergonomic mouse for carpal tunnel')
) AS q(query_text)
WHERE u.id IN (1, 2, 3, 4, 17)
ON CONFLICT DO NOTHING;

-- ─── 13. Validation Sessions (more session data) ────────────────────────────
INSERT INTO "ValidationSession" ("userId", "userExternalId", "userEmail", "queryText", "sessionSource", "productsJson", "timelineJson", "feedbackJson", "metricsJson", "createdAt", "updatedAt")
SELECT
  u.id,
  u.email,
  u.email,
  q.query_text,
  (ARRAY['smart-shopping-assistant', 'shopping-list', 'ai-plus', 'smart-delegate'])[floor(random() * 4 + 1)::INT],
  (
    SELECT jsonb_agg(jsonb_build_object(
      'rank', row_number,
      'product', jsonb_build_object(
        'id', p.id::TEXT,
        'name', p.name,
        'brand', split_part(p.name, ' ', 1),
        'price', p.price,
        'rating', round((3.5 + random() * 1.5)::numeric, 1),
        'review_count', floor(random() * 10000 + 100)::INT,
        'delivery_time', (ARRAY['1-2 days', '2-3 days', '3-5 days', 'Same Day'])[floor(random() * 4 + 1)::INT],
        'key_features', jsonb_build_array('Feature 1', 'Feature 2', 'Feature 3'),
        'source', 'database',
        'category', p.category
      ),
      'score', round((0.5 + random() * 0.5)::numeric, 4),
      'confidence', round((0.4 + random() * 0.6)::numeric, 4),
      'explanation', jsonb_build_object(
        'product_id', p.id::TEXT,
        'final_score', round((0.5 + random() * 0.5)::numeric, 4),
        'summary', 'Good match based on user preferences',
        'key_strengths', jsonb_build_array('Good price', 'Reliable brand'),
        'key_weaknesses', jsonb_build_array('Average battery'),
        'budget_fit_score', jsonb_build_object('score', round((0.6 + random() * 0.4)::numeric, 2), 'reason', 'Within budget range'),
        'brand_preference_score', jsonb_build_object('score', round((0.5 + random() * 0.5)::numeric, 2), 'reason', 'Known brand')
      )
    ))
    FROM (
      SELECT p2.id, p2.name, p2.price, p2.category, row_number() OVER () as row_number
      FROM "Product" p2 ORDER BY random() LIMIT 5
    ) p
  ),
  jsonb_build_array(
    jsonb_build_object('id', 'step_1', 'label', 'Intent Analysis', 'duration', floor(random() * 2000 + 500)::INT, 'status', 'completed'),
    jsonb_build_object('id', 'step_2', 'label', 'Product Search', 'duration', floor(random() * 1500 + 300)::INT, 'status', 'completed'),
    jsonb_build_object('id', 'step_3', 'label', 'AI Ranking', 'duration', floor(random() * 3000 + 800)::INT, 'status', 'completed'),
    jsonb_build_object('id', 'step_4', 'label', 'Decision', 'duration', floor(random() * 500 + 100)::INT, 'status', 'completed')
  ),
  '[]'::jsonb,
  jsonb_build_object('totalProducts', 5, 'avgScore', round((0.6 + random() * 0.3)::numeric, 4), 'processingTime', floor(random() * 5000 + 1000)::INT),
  NOW() - (random() * INTERVAL '14 days'),
  NOW() - (random() * INTERVAL '3 days')
FROM "User" u
CROSS JOIN (
  VALUES
    ('best laptop under 50000 for coding'),
    ('wireless noise cancelling headphones'),
    ('4K smart TV samsung vs lg'),
    ('gaming mouse with programmable buttons'),
    ('air purifier for bedroom'),
    ('running shoes for marathon training'),
    ('portable SSD 1TB fastest'),
    ('smart home starter kit'),
    ('DSLR camera for wedding photography'),
    ('electric standing desk')
) AS q(query_text)
WHERE u.id IN (1, 2, 3, 17);

COMMIT;

-- Verify counts
SELECT 'Product' as "Table", COUNT(*) as "Rows" FROM "Product" UNION ALL
SELECT 'Order', COUNT(*) FROM "Order" UNION ALL
SELECT 'OrderItem', COUNT(*) FROM "OrderItem" UNION ALL
SELECT 'Cart', COUNT(*) FROM "Cart" UNION ALL
SELECT 'CartItem', COUNT(*) FROM "CartItem" UNION ALL
SELECT 'WishlistItem', COUNT(*) FROM "WishlistItem" UNION ALL
SELECT 'Wallet', COUNT(*) FROM "Wallet" UNION ALL
SELECT 'WalletTransaction', COUNT(*) FROM "WalletTransaction" UNION ALL
SELECT 'WalletAuditLog', COUNT(*) FROM "WalletAuditLog" UNION ALL
SELECT 'AnalyticsEvent', COUNT(*) FROM "AnalyticsEvent" UNION ALL
SELECT 'UserBehavior', COUNT(*) FROM "UserBehavior" UNION ALL
SELECT 'ActivityLog', COUNT(*) FROM "ActivityLog" UNION ALL
SELECT 'SmartIntentEngineResponse', COUNT(*) FROM "SmartIntentEngineResponse" UNION ALL
SELECT 'ValidationSession', COUNT(*) FROM "ValidationSession"
ORDER BY "Table";
