-- DelegateCart: 100K Product Seed (v3 - bulletproof per-category arrays)
DO $$
DECLARE v_start TIMESTAMP := clock_timestamp(); v_count BIGINT;
BEGIN
  RAISE NOTICE 'Truncating and re-seeding 100,000 products...';
  TRUNCATE TABLE "Product" RESTART IDENTITY CASCADE;
  INSERT INTO "Product" (name, price, category, description, "imageUrl", featured, "createdAt", "updatedAt")
  SELECT
    CASE (s.i % 21)
      WHEN  0 THEN (ARRAY['Samsung','Apple','OnePlus','Xiaomi','Realme','OPPO','Vivo','Nothing','Motorola','Google'])[1+(s.i/21)%10]||' '||(ARRAY['Galaxy M34 5G','Galaxy A54 5G','iPhone 15','iPhone 14','Nord CE3 Lite','Redmi Note 13 Pro+','realme 12 Pro+','Find X6 Pro','V29 Pro','Pixel 8a'])[1+(s.i/210)%10]
      WHEN  1 THEN (ARRAY['Dell','HP','Lenovo','Asus','Acer','Apple','MSI','Microsoft','Razer','LG'])[1+(s.i/21)%10]||' '||(ARRAY['Inspiron 15 3525','Pavilion 15-eg','IdeaPad Slim 5','VivoBook 15 OLED','MacBook Air M2','Aspire 7','ROG Strix G15','Surface Laptop 5','Blade 15','Gram 16'])[1+(s.i/210)%10]
      WHEN  2 THEN (ARRAY['boAt','Sony','Sennheiser','JBL','Bose','Jabra','Skullcandy','Noise','Realme','Audio-Technica'])[1+(s.i/21)%10]||' '||(ARRAY['Rockerz 450 Pro','WH-1000XM5','QuietComfort 45','Tune 520 BT','Momentum 4','Evolve2 85','Crusher ANC 2','Buds Air 5 Pro','Buds 2 Pro','ATH-M50x'])[1+(s.i/210)%10]
      WHEN  3 THEN (ARRAY['Samsung','Apple','Garmin','Fitbit','Fossil','Noise','boAt','Amazfit','Titan','Huawei'])[1+(s.i/21)%10]||' '||(ARRAY['Galaxy Watch 6 Classic','Apple Watch Series 9','Forerunner 965','Charge 6','Gen 6 Venture HR','ColorFit Pro 4','Watch Xtend Pro','GTR 4','Edge+ Pro','Watch GT 4'])[1+(s.i/210)%10]
      WHEN  4 THEN (ARRAY['Samsung','Apple','Lenovo','Xiaomi','Amazon','Realme','Huawei','OnePlus','Asus','Microsoft'])[1+(s.i/21)%10]||' '||(ARRAY['Galaxy Tab S9 FE','iPad Air 5th Gen','IdeaPad Duet 3i','Redmi Pad SE','Fire HD 10 Plus','Pad 2','MatePad 11','OnePlus Pad','ROG Flow Z13','Surface Pro 9'])[1+(s.i/210)%10]
      WHEN  5 THEN (ARRAY['Canon','Sony','Nikon','Fujifilm','Olympus','Panasonic','Leica','Ricoh','GoPro','DJI'])[1+(s.i/21)%10]||' '||(ARRAY['EOS R50','Alpha 6700','Z50','X-T50','OM-5','G9 II','Q3','GR IIIx','Hero 12 Black','Osmo Pocket 3'])[1+(s.i/210)%10]
      WHEN  6 THEN (ARRAY['Dyson','Xiaomi','Sharp','Philips','Levoit','Coway','Blueair','Honeywell','Winix','IQAir'])[1+(s.i/21)%10]||' '||(ARRAY['TP09 Cool Me','Mi Air Purifier 4 Pro','KC-G60-W','AX20 Series','Core 300S','Airmega 200M','Classic 280i','True HEPA 50250','AM315','GC MultiGas'])[1+(s.i/210)%10]
      WHEN  7 THEN (ARRAY['LG','Samsung','Whirlpool','Godrej','Haier','Bosch','IFB','Siemens','Voltas','Panasonic'])[1+(s.i/21)%10]||' '||(ARRAY['190L 5-Star Direct Cool','265L 3-Star Frost Free','322L Frost Free Double Door','415L Side-by-Side','253L 2-Door','442L 3-Door','580L Multi-Door','360L Bottom Mount','315L Double Door','540L French Door'])[1+(s.i/210)%10]
      WHEN  8 THEN (ARRAY['Tata','Fortune','Daawat','Aashirvaad','Patanjali','Nature Fresh','Saffola','Dhara','Gemini','Sundrop'])[1+(s.i/21)%10]||' '||(ARRAY['Premium Basmati Rice 5kg','Toor Dal 1kg','Sunflower Oil 5L','Whole Wheat Atta 10kg','Crystal Sugar 5kg','Iodized Salt 1kg','Pure Cow Ghee 1kg','Mustard Oil 1L','Moong Dal 1kg','Besan 1kg'])[1+(s.i/210)%10]
      WHEN  9 THEN (ARRAY['Britannia','Nestle','ITC','Haldiram','Maggi','Amul','MTR','Bikaji','Priya Gold','Pillsbury'])[1+(s.i/21)%10]||' '||(ARRAY['Digestive Biscuits 400g','Maggi 2-Minute 12-Pack','Quaker Oats 1kg','Cornflakes 875g','Dairy Milk 150g','Nescafe Classic 200g','Green Tea 100 Bags','Wild Berry Jam 500g','Pure Honey 500g','Peanut Butter 500g'])[1+(s.i/210)%10]
      WHEN 10 THEN (ARRAY['Dove','Pantene','Nivea','Vaseline','Himalaya','Biotique','Mamaearth','WOW','Plum','Minimalist'])[1+(s.i/21)%10]||' '||(ARRAY['Intense Repair Shampoo 400ml','Vitamin C Face Wash 100ml','Body Lotion 400ml','Total Care Toothpaste 150g','Deo Spray 150ml','SPF50 Sunscreen 100ml','Night Cream 50ml','Anti-Hair Fall Serum 30ml','Bhringraj Oil 300ml','Neem Tulsi Soap 75g'])[1+(s.i/210)%10]
      WHEN 11 THEN (ARRAY['Allen Solly','Van Heusen','Louis Philippe','Peter England','Arrow','Park Avenue','Wrangler','Killer','Flying Machine','Blackberrys'])[1+(s.i/21)%10]||' '||(ARRAY['Slim Fit Cotton Polo T-Shirt','Classic Oxford Shirt','Chino Trousers','Slim Fit Denim Jeans','Sports Shorts','Merino Wool Sweater','Tech Fleece Hoodie','Regular Fit Blazer','Cotton Kurta White','Graphic Tee'])[1+(s.i/210)%10]
      WHEN 12 THEN (ARRAY['W','Biba','Global Desi','Libas','Aurelia','Jaipur Kurti','AKS','Varanga','Vishudh','SASSAFRAS'])[1+(s.i/21)%10]||' '||(ARRAY['Jaipuri Block Print Kurta','Anarkali Set Mirror Work','Pure Banarasi Silk Saree','Floral Maxi Dress','High Rise Skinny Jeans','Sports Bra High Support','Active Wear Leggings','Embroidered Dupatta','A-line Skirt Floral','Party Sequin Gown'])[1+(s.i/210)%10]
      WHEN 13 THEN (ARRAY['Nike','Adidas','Puma','Reebok','New Balance','Skechers','Bata','Woodland','Red Tape','Lee Cooper'])[1+(s.i/21)%10]||' '||(ARRAY['Air Max 270 React','Ultraboost 24','RS-X3 Triple','Classic Leather Legacy','990v6','D-Lites 2.0','Jungle Lace-Up Boot','Camel Leather Derby','Velocity Running Shoe','Club C 85'])[1+(s.i/210)%10]
      WHEN 14 THEN (ARRAY['Prestige','Hawkins','TTK','Pigeon','Butterfly','Bajaj','Maharaja Whiteline','Philips','Inalsa','Morphy Richards'])[1+(s.i/21)%10]||' '||(ARRAY['3L Induction Pressure Cooker','Hard Anodised Kadai 5L','Non-stick Dosa Tawa 280mm','Cast Iron Skillet 26cm','Tri-ply Stainless Pan 24cm','Granite Cookware Set 9pc','Non-stick Roti Tawa 30cm','Deep Fry Pan 28cm','Wok 30cm Carbon Steel','Saucepan 18cm SS'])[1+(s.i/210)%10]
      WHEN 15 THEN (ARRAY['Bajaj','Philips','Prestige','Butterfly','Inalsa','Morphy Richards','Hamilton Beach','Cuisinart','Breville','KitchenAid'])[1+(s.i/21)%10]||' '||(ARRAY['Mixer Grinder 750W 3 Jar','Digital Air Fryer 6.2L','Convection Microwave 28L','Glass Electric Kettle 1.5L','Induction Cooktop 2000W','Hand Blender 600W','Pop-Up Toaster 2 Slice','Rice Cooker 1.8L','Sandwich Maker 750W','Food Processor 600W'])[1+(s.i/210)%10]
      WHEN 16 THEN (ARRAY['IKEA','Urban Ladder','Pepperfry','Nilkamal','Durian','Godrej Interio','Stanley','Royaloak','Evok','HomeTown'])[1+(s.i/21)%10]||' '||(ARRAY['3 Seater Fabric Sofa','Queen Hydraulic Storage Bed','L-Shape Study Desk','Ergonomic Mesh Chair','5-Tier Open Bookshelf','6 Seater Dining Set','3-Door Wardrobe with Mirror','TV Unit 180cm','Dressing Table with Stool','Shoe Rack 8 Tier'])[1+(s.i/210)%10]
      WHEN 17 THEN (ARRAY['SS','SG','MRF','Kookaburra','Gray-Nicolls','Gunn & Moore','BDM','Cosco','Vinex','Nivia'])[1+(s.i/21)%10]||' '||(ARRAY['English Willow Grade 3 Bat','Leather Cricket Ball Red','Pro Batting Gloves RH','Wicket Keeping Pads','SG ABS Helmet','Elbow Guard Adult','Thigh Guard RH','Cricket Kit Bag Jumbo','Cricket Shoes Rubber Sole','Stumps Steel Clip Base'])[1+(s.i/210)%10]
      WHEN 18 THEN (ARRAY['Cosco','Nivia','Decathlon','Kettler','York','Fitkit','BodyCraft','Vector X','Kore','Aurion'])[1+(s.i/21)%10]||' '||(ARRAY['Adjustable Dumbbell 2-20kg','Anti-Slip Yoga Mat 6mm','Resistance Band Set 5pc','Ab Roller Wheel','Skipping Rope Digital','Doorway Pull Up Bar','Foam Roller 90cm','Kettlebell Cast Iron 16kg','Push Up Bars Rotating','Wrist Wraps Powerlifting'])[1+(s.i/210)%10]
      WHEN 19 THEN (ARRAY['Penguin','HarperCollins','Ebury Press','Pan Macmillan','Bloomsbury','Westland','Juggernaut','Rupa','Fingerprint','Speaking Tiger'])[1+(s.i/21)%10]||' '||(ARRAY['Atomic Habits','The Psychology of Money','Rich Dad Poor Dad','Zero to One','Think and Grow Rich','The Lean Startup','Start With Why','Deep Work','Ikigai The Japanese Secret','The 7 Habits of Highly Effective People'])[1+(s.i/210)%10]
      ELSE       (ARRAY['S. Chand','Arihant','McGraw Hill','Wiley','Pearson','Oxford','Cambridge','Tata McGraw Hill','Cengage','Disha'])[1+(s.i/21)%10]||' '||(ARRAY['Quantitative Aptitude for Competitive Exams','Data Structures and Algorithms','UPSC Civil Services GS Paper 1','NCERT Physics Class 12','JEE Advanced 40 Years','CAT Quantitative Aptitude Guide','GATE Electronics Engineering','RRB NTPC Complete Guide','SSC CGL Previous 30 Years Solved','IELTS Academic Practice Tests'])[1+(s.i/210)%10]
    END || ' ' ||
    (ARRAY['Black','Blue','White','Silver','Green','Red','Gold','Titanium'])[1+((s.i/2100)*3+s.i%8)%8] AS name,
    ROUND(CAST(CASE (s.i%21)
      WHEN  0 THEN  7999+(s.i/21%50)*800   WHEN  1 THEN 28999+(s.i/21%50)*2600
      WHEN  2 THEN   799+(s.i/21%50)*500   WHEN  3 THEN  1999+(s.i/21%50)*1200
      WHEN  4 THEN 12999+(s.i/21%40)*3000  WHEN  5 THEN 19999+(s.i/21%40)*6000
      WHEN  6 THEN  3499+(s.i/21%30)*2000  WHEN  7 THEN  8999+(s.i/21%40)*3500
      WHEN  8 THEN    79+(s.i/21%30)*55    WHEN  9 THEN    39+(s.i/21%30)*28
      WHEN 10 THEN    89+(s.i/21%30)*85    WHEN 11 THEN   249+(s.i/21%40)*200
      WHEN 12 THEN   349+(s.i/21%40)*250   WHEN 13 THEN   699+(s.i/21%40)*350
      WHEN 14 THEN   399+(s.i/21%40)*350   WHEN 15 THEN   699+(s.i/21%40)*600
      WHEN 16 THEN  3999+(s.i/21%40)*2500  WHEN 17 THEN   129+(s.i/21%30)*130
      WHEN 18 THEN   179+(s.i/21%30)*190   WHEN 19 THEN    99+(s.i/21%25)*90
      ELSE           129+(s.i/21%25)*110
    END AS NUMERIC),2) AS price,
    CASE (s.i%21)
      WHEN  0 THEN 'Electronics' WHEN  1 THEN 'Electronics' WHEN  2 THEN 'Electronics'
      WHEN  3 THEN 'Electronics' WHEN  4 THEN 'Electronics' WHEN  5 THEN 'Electronics'
      WHEN  6 THEN 'Electronics' WHEN  7 THEN 'Electronics'
      WHEN  8 THEN 'Groceries'   WHEN  9 THEN 'Groceries'   WHEN 10 THEN 'Groceries'
      WHEN 11 THEN 'Fashion'     WHEN 12 THEN 'Fashion'     WHEN 13 THEN 'Fashion'
      WHEN 14 THEN 'Home & Kitchen' WHEN 15 THEN 'Home & Kitchen' WHEN 16 THEN 'Home & Kitchen'
      WHEN 17 THEN 'Sports'      WHEN 18 THEN 'Sports'
      WHEN 19 THEN 'Books'       ELSE 'Books'
    END AS category,
    CASE (s.i%7)
      WHEN 0 THEN 'Genuine product with manufacturer warranty. Fast free delivery. Easy 7-day returns. EMI at 0% interest.'
      WHEN 1 THEN 'Top-rated by verified buyers. Free delivery above Rs499. GST invoice included with shipment.'
      WHEN 2 THEN 'Premium quality guaranteed. Ships from authorised seller. COD available. Valid exchange offer.'
      WHEN 3 THEN 'Limited-time price drop. Express delivery in 1-2 business days. Secure tamper-proof packaging.'
      WHEN 4 THEN 'BIS/FSSAI certified product. 1-year brand warranty included. Installation support available.'
      WHEN 5 THEN 'Export-quality packaging. Trusted brand with 10K+ verified purchases. Hassle-free returns.'
      ELSE        'Bestseller in category. Thousands of 5-star reviews. Pay later option. Assured quality.'
    END AS description,
    'https://images.unsplash.com/photo-'||(ARRAY[
      '1511707171634-5f897ff02aa9','1610945265064-0e34e5519bbf','1592750475338-74b7b21085ab',
      '1601784551446-20c9e07cdbdb','1585060544812-6b45742d762f','1567581935884-3349723552ca',
      '1496181133206-80ce9b88a853','1484788984921-03950022c9ef','1517336714731-489689fd1ca8',
      '1525547719571-a2d4ac8945e2','1541807084-5c52b6b3adef','1564053489984-317bbd824340',
      '1505740420928-5e560c06d30e','1572536147248-ac59a8abfa4b','1546435770-a3e426bf472b',
      '1484704849700-f032a568e944','1578319439584-104c94d37305','1615655406736-b37887a81b08',
      '1551816230-ef5deaed4a26','1523275335684-37898b6baf30','1579586337278-3befd40fd17a',
      '1508685096489-7aacd43bd3b1','1434493789847-2f02dc6ca35d','1557935728-e6d1eaabe558',
      '1544244015-0df4b3ffc6b0','1589739900243-4b52cd9b104e','1561154464-82e9adf32764',
      '1516035069371-29a1b244cc32','1495707902641-96eb559286c2','1606983340126-99ab4feaa64a',
      '1550583724-b2692b85b150','1586201375761-83865001e31c','1568702846914-96b305d2aaeb',
      '1617137968427-85924c800a22','1598033129183-c4f50c736f10','1572804013309-59a88b7e92f1',
      '1542291026-7eec264c27ff','1608231387042-66d1773070a5','1600185365483-26d7a4cc7519',
      '1556909114-f34e67e29e50','1555041469-a586c61ea9bc','1534438327276-14e5300c3a48',
      '1512820790803-83ca734da794','1521587760476-6c12a4b040da'
    ])[1+(s.i%21*2+s.i/21)%44]||'?w=600&h=600&q=85&auto=format&fit=crop&sig='||s.i AS "imageUrl",
    (s.i<=200) AS featured,
    NOW()-((100001-s.i)::BIGINT*INTERVAL '10 minutes') AS "createdAt",
    NOW()-((100001-s.i)::BIGINT*INTERVAL '5 minutes')  AS "updatedAt"
  FROM generate_series(1,100000) AS s(i);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Inserted % products in %', v_count, clock_timestamp()-v_start;
END;
$$;

SELECT category, COUNT(*) AS product_count, ROUND(MIN(price)::NUMERIC,0) AS min_price, ROUND(MAX(price)::NUMERIC,0) AS max_price, ROUND(AVG(price)::NUMERIC,0) AS avg_price FROM "Product" GROUP BY category ORDER BY product_count DESC;
SELECT COUNT(*) AS total_products FROM "Product";
