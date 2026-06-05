-- Round 57: normalize Product.imageUrl to externally reachable category-aware URLs.
-- This keeps images in the real DB data path (no synthetic route fallback required).

BEGIN;

UPDATE "Product"
SET "imageUrl" = CASE category
  WHEN 'Smartphones' THEN 'https://loremflickr.com/640/640/smartphone?lock=' || id::text
  WHEN 'Laptops' THEN 'https://loremflickr.com/640/640/laptop?lock=' || id::text
  WHEN 'Headphones' THEN 'https://loremflickr.com/640/640/headphones?lock=' || id::text
  WHEN 'Televisions' THEN 'https://loremflickr.com/640/640/television?lock=' || id::text
  WHEN 'Cameras' THEN 'https://loremflickr.com/640/640/camera?lock=' || id::text
  WHEN 'Tablets' THEN 'https://loremflickr.com/640/640/tablet?lock=' || id::text
  WHEN 'Smartwatches' THEN 'https://loremflickr.com/640/640/smartwatch?lock=' || id::text
  WHEN 'Speakers' THEN 'https://loremflickr.com/640/640/speaker?lock=' || id::text
  WHEN 'Gaming' THEN 'https://loremflickr.com/640/640/gaming?lock=' || id::text
  WHEN 'Home Appliances' THEN 'https://loremflickr.com/640/640/home-appliance?lock=' || id::text
  WHEN 'Kitchen Appliances' THEN 'https://loremflickr.com/640/640/kitchen-appliance?lock=' || id::text
  WHEN 'Personal Care' THEN 'https://loremflickr.com/640/640/personal-care?lock=' || id::text
  WHEN 'Fitness Equipment' THEN 'https://loremflickr.com/640/640/fitness-equipment?lock=' || id::text
  WHEN 'Audio Equipment' THEN 'https://loremflickr.com/640/640/audio-equipment?lock=' || id::text
  WHEN 'Computer Accessories' THEN 'https://loremflickr.com/640/640/computer-accessories?lock=' || id::text
  WHEN 'Storage Devices' THEN 'https://loremflickr.com/640/640/storage-device?lock=' || id::text
  WHEN 'Networking' THEN 'https://loremflickr.com/640/640/network-router?lock=' || id::text
  WHEN 'Printers' THEN 'https://loremflickr.com/640/640/printer?lock=' || id::text
  WHEN 'Office Supplies' THEN 'https://loremflickr.com/640/640/office-supplies?lock=' || id::text
  WHEN 'Furniture' THEN 'https://loremflickr.com/640/640/furniture?lock=' || id::text
  ELSE 'https://loremflickr.com/640/640/product?lock=' || id::text
END
WHERE "imageUrl" IS NULL
   OR "imageUrl" = ''
   OR "imageUrl" LIKE '/images/%'
   OR "imageUrl" LIKE '/product-placeholder%';

COMMIT;
