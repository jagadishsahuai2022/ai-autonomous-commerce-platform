/**
 * 100K Product Seeder — DB-First Production Data
 *
 * Generates 100,000 realistic products across 10+ categories
 * and inserts them into PostgreSQL via Prisma in batches of 1000.
 *
 * Usage: npx tsx scripts/seed-100k-products.ts
 *
 * Categories: smartphones, laptops, appliances, fashion, footwear,
 *             watches, furniture, electronics, accessories, home_kitchen,
 *             groceries, sports, books, health, baby_kids
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Category definitions ─────────────────────────────────────────────────────

interface CategoryDef {
  name: string;
  weight: number; // relative share of 100K
  brands: string[];
  nameTemplates: string[];
  priceRange: { min: number; max: number };
  priceDist: { budget: number; mid: number; premium: number }; // 0-1 weights
  imageKeyword: string;
  specs: Record<string, string[]>;
}

const CATEGORIES: CategoryDef[] = [
  {
    name: 'smartphones',
    weight: 15,
    brands: [
      'Samsung',
      'Apple',
      'OnePlus',
      'Xiaomi',
      'Realme',
      'Vivo',
      'Oppo',
      'Google',
      'Nothing',
      'Motorola',
      'iQOO',
      'Tecno',
      'Infinix',
      'POCO',
    ],
    nameTemplates: ['{brand} {model} ({ram} RAM, {storage})', '{brand} {model} {suffix}'],
    priceRange: { min: 6999, max: 159999 },
    priceDist: { budget: 0.6, mid: 0.3, premium: 0.1 },
    imageKeyword: 'smartphone',
    specs: {
      model: [
        'Galaxy S24',
        'Galaxy A55',
        'Galaxy M55',
        'iPhone 16',
        'iPhone 15',
        '12R',
        'Nord 4',
        'Redmi Note 13',
        '14 Pro',
        'GT Neo 6',
        'V30 Pro',
        'Reno 12',
        'Pixel 8a',
        'Phone 2a',
        'Edge 50',
      ],
      ram: ['4GB', '6GB', '8GB', '12GB', '16GB'],
      storage: ['64GB', '128GB', '256GB', '512GB', '1TB'],
      suffix: ['Pro', 'Pro Max', 'Ultra', 'Lite', '5G', 'Plus', 'SE'],
    },
  },
  {
    name: 'laptops',
    weight: 10,
    brands: ['Dell', 'HP', 'Lenovo', 'ASUS', 'Acer', 'MSI', 'Apple', 'Samsung', 'LG', 'Microsoft'],
    nameTemplates: [
      '{brand} {model} ({processor}, {ram} RAM, {storage})',
      '{brand} {model} {suffix}',
    ],
    priceRange: { min: 25999, max: 299999 },
    priceDist: { budget: 0.5, mid: 0.35, premium: 0.15 },
    imageKeyword: 'laptop',
    specs: {
      model: [
        'XPS 15',
        'Inspiron 15',
        'Spectre x360',
        'Pavilion 15',
        'ThinkPad X1',
        'IdeaPad Slim 5',
        'ROG Zephyrus',
        'VivoBook 15',
        'Nitro V 16',
        'Swift Go 14',
        'Stealth 16',
        'MacBook Air',
        'MacBook Pro',
        'Galaxy Book',
      ],
      processor: [
        'Intel i5-13th',
        'Intel i7-13th',
        'Intel i9-14th',
        'AMD Ryzen 5',
        'AMD Ryzen 7',
        'AMD Ryzen 9',
        'Apple M3',
        'Apple M3 Pro',
      ],
      ram: ['8GB', '16GB', '32GB', '64GB'],
      storage: ['256GB SSD', '512GB SSD', '1TB SSD', '2TB SSD'],
      suffix: ['Pro', 'Ultra', 'Gaming', 'Business', 'Student'],
    },
  },
  {
    name: 'appliances',
    weight: 10,
    brands: [
      'Samsung',
      'LG',
      'Whirlpool',
      'Bosch',
      'IFB',
      'Haier',
      'Godrej',
      'Voltas',
      'Daikin',
      'Blue Star',
      'Hitachi',
      'Panasonic',
    ],
    nameTemplates: ['{brand} {capacity} {type} {suffix}', '{brand} {model} {type}'],
    priceRange: { min: 8999, max: 149999 },
    priceDist: { budget: 0.5, mid: 0.35, premium: 0.15 },
    imageKeyword: 'washing-machine',
    specs: {
      type: [
        'Washing Machine',
        'Refrigerator',
        'Air Conditioner',
        'Microwave',
        'Dishwasher',
        'Water Purifier',
      ],
      capacity: [
        '6Kg',
        '7Kg',
        '8Kg',
        '10Kg',
        '190L',
        '260L',
        '350L',
        '500L',
        '1 Ton',
        '1.5 Ton',
        '2 Ton',
        '20L',
        '25L',
        '30L',
      ],
      model: ['EcoBubble', 'TurboWash', 'FreshCare', 'Smart Eco', 'Senator', 'InstaView'],
      suffix: [
        'Front Load',
        'Top Load',
        'Semi-Automatic',
        'Fully-Automatic',
        'Inverter',
        'Smart',
        '5 Star',
        '3 Star',
      ],
    },
  },
  {
    name: 'fashion',
    weight: 15,
    brands: [
      'Allen Solly',
      'Van Heusen',
      'Peter England',
      'Louis Philippe',
      'H&M',
      'Zara',
      'Mango',
      "Levi's",
      'US Polo',
      'Tommy Hilfiger',
      'Calvin Klein',
      'Arrow',
      'Raymond',
      'FabIndia',
    ],
    nameTemplates: ['{brand} {type} - {style} {fit}', '{brand} {type} {suffix}'],
    priceRange: { min: 399, max: 12999 },
    priceDist: { budget: 0.6, mid: 0.3, premium: 0.1 },
    imageKeyword: 'fashion-clothing',
    specs: {
      type: [
        'T-Shirt',
        'Shirt',
        'Jeans',
        'Trousers',
        'Kurta',
        'Jacket',
        'Blazer',
        'Shorts',
        'Dress',
        'Saree',
        'Sweatshirt',
        'Hoodie',
      ],
      style: [
        'Casual',
        'Formal',
        'Semi-Formal',
        'Party',
        'Ethnic',
        'Streetwear',
        'Classic',
        'Modern',
      ],
      fit: ['Slim Fit', 'Regular Fit', 'Relaxed Fit', 'Oversized', 'Tailored'],
      suffix: ['Cotton', 'Linen', 'Denim', 'Poly-Cotton', 'Silk', 'Wool Blend'],
    },
  },
  {
    name: 'footwear',
    weight: 8,
    brands: [
      'Nike',
      'Adidas',
      'Puma',
      'Reebok',
      'Skechers',
      'Bata',
      'Woodland',
      'Red Tape',
      'Clarks',
      'New Balance',
      'ASICS',
      'Under Armour',
    ],
    nameTemplates: ['{brand} {model} {type} - {style}', '{brand} {model} {suffix}'],
    priceRange: { min: 999, max: 24999 },
    priceDist: { budget: 0.55, mid: 0.35, premium: 0.1 },
    imageKeyword: 'shoes',
    specs: {
      type: [
        'Running Shoes',
        'Sneakers',
        'Formal Shoes',
        'Casual Shoes',
        'Sandals',
        'Sports Shoes',
        'Boots',
        'Loafers',
      ],
      model: [
        'Air Max',
        'Ultraboost',
        'RS-X',
        'Classic',
        'GOwalk',
        'Pegasus',
        'Free RN',
        'NMD',
        'Forum',
        'Nano',
      ],
      style: ['Men', 'Women', 'Unisex'],
      suffix: ['Breathable', 'Waterproof', 'Lightweight', 'Cushioned', 'Orthopedic'],
    },
  },
  {
    name: 'watches',
    weight: 5,
    brands: [
      'Titan',
      'Fossil',
      'Casio',
      'Seiko',
      'Citizen',
      'Fastrack',
      'Timex',
      'Daniel Wellington',
      'Michael Kors',
      'Tissot',
    ],
    nameTemplates: ['{brand} {model} {movement} Watch - {style}', '{brand} {model} {suffix}'],
    priceRange: { min: 999, max: 49999 },
    priceDist: { budget: 0.5, mid: 0.35, premium: 0.15 },
    imageKeyword: 'wristwatch',
    specs: {
      model: [
        'Raga',
        'Edge',
        'G-Shock',
        'Edifice',
        'Eco-Drive',
        'Gen 6',
        'Presage',
        'Cocktail Time',
        'PRW',
        'Satellite Wave',
      ],
      movement: ['Analog', 'Digital', 'Chronograph', 'Smart', 'Automatic', 'Quartz'],
      style: ['Men', 'Women', 'Unisex'],
      suffix: ['Premium', 'Classic', 'Sport', 'Luxury', 'Limited Edition'],
    },
  },
  {
    name: 'furniture',
    weight: 5,
    brands: [
      'Ikea',
      'Durian',
      'Nilkamal',
      'Pepperfry',
      'Urban Ladder',
      'Wakefit',
      'Godrej Interio',
      'HomeTown',
      'Cello',
      'Supreme',
    ],
    nameTemplates: ['{brand} {model} {type} - {material}', '{brand} {type} {suffix}'],
    priceRange: { min: 2999, max: 89999 },
    priceDist: { budget: 0.5, mid: 0.35, premium: 0.15 },
    imageKeyword: 'furniture',
    specs: {
      type: [
        'Sofa',
        'Bed',
        'Table',
        'Chair',
        'Wardrobe',
        'Bookshelf',
        'TV Unit',
        'Dining Set',
        'Desk',
        'Shoe Rack',
      ],
      model: [
        'Billy',
        'Kallax',
        'Rio',
        'Berlin',
        'Nordic',
        'Bohemian',
        'Vienna',
        'Monaco',
        'Oxford',
        'Tokyo',
      ],
      material: ['Solid Wood', 'Engineered Wood', 'Metal', 'Fabric', 'Leather', 'Rattan', 'Glass'],
      suffix: ['3-Seater', '4-Seater', 'King Size', 'Queen Size', 'Single', 'L-Shape', 'Recliner'],
    },
  },
  {
    name: 'electronics',
    weight: 8,
    brands: [
      'Sony',
      'Samsung',
      'LG',
      'TCL',
      'JBL',
      'Bose',
      'Sennheiser',
      'boAt',
      'Noise',
      'Philips',
      'Panasonic',
    ],
    nameTemplates: ['{brand} {model} {type} {suffix}', '{brand} {type} - {model}'],
    priceRange: { min: 999, max: 199999 },
    priceDist: { budget: 0.5, mid: 0.35, premium: 0.15 },
    imageKeyword: 'electronics',
    specs: {
      type: [
        'Smart TV',
        'Headphones',
        'Speaker',
        'Soundbar',
        'Camera',
        'Earbuds',
        'Monitor',
        'Projector',
      ],
      model: [
        'WH-1000XM5',
        'Neo QLED',
        'OLED C4',
        'Charge 5',
        'QuietComfort',
        'Airdopes',
        'Wave Pro',
        'Bravia XR',
        'C845',
        'PartyBox',
      ],
      suffix: [
        '4K',
        '8K',
        'OLED',
        'QLED',
        'ANC',
        'TWS',
        'Wireless',
        'Bluetooth 5.3',
        'HDR10+',
        'Dolby Atmos',
      ],
    },
  },
  {
    name: 'accessories',
    weight: 5,
    brands: [
      'Hidesign',
      'Baggit',
      'Lavie',
      'Tommy Hilfiger',
      'Calvin Klein',
      'Ray-Ban',
      'Fastrack',
      'Titan',
      'Wildcraft',
      'American Tourister',
      'Samsonite',
    ],
    nameTemplates: ['{brand} {model} {type} - {style}', '{brand} {type} {suffix}'],
    priceRange: { min: 499, max: 19999 },
    priceDist: { budget: 0.55, mid: 0.35, premium: 0.1 },
    imageKeyword: 'accessories',
    specs: {
      type: [
        'Backpack',
        'Handbag',
        'Wallet',
        'Sunglasses',
        'Belt',
        'Tie',
        'Scarf',
        'Travel Bag',
        'Laptop Bag',
        'Crossbody Bag',
      ],
      model: [
        'Austin',
        'Maven',
        'Iconic',
        'Sculpted',
        'Wayfarer',
        'Aviator',
        'Classic',
        'Urban',
        'Pro',
        'Elite',
      ],
      style: ['Men', 'Women', 'Unisex'],
      suffix: ['Leather', 'Canvas', 'Nylon', 'Polyester', 'Premium', 'Compact', 'Expandable'],
    },
  },
  {
    name: 'home_kitchen',
    weight: 7,
    brands: [
      'Prestige',
      'Bajaj',
      'Philips',
      'Morphy Richards',
      'Preethi',
      'Butterfly',
      'Pigeon',
      'Hawkins',
      'Wonderchef',
      'Borosil',
    ],
    nameTemplates: ['{brand} {model} {type} {suffix}', '{brand} {type} - {capacity}'],
    priceRange: { min: 499, max: 29999 },
    priceDist: { budget: 0.6, mid: 0.3, premium: 0.1 },
    imageKeyword: 'kitchen-appliance',
    specs: {
      type: [
        'Mixer Grinder',
        'Air Fryer',
        'Pressure Cooker',
        'Induction Cooktop',
        'Toaster',
        'Blender',
        'Electric Kettle',
        'Rice Cooker',
        'OTG Oven',
        'Coffee Maker',
      ],
      model: [
        'IRIS',
        'Delight',
        'Popular',
        'Majesty',
        'HD9252',
        'Icon DLX',
        'Zodiac',
        'Nutri-Pro',
        'AeroFry',
        'SmartChef',
      ],
      capacity: ['500W', '750W', '1000W', '3L', '5L', '7L', '10L'],
      suffix: ['Digital', 'Stainless Steel', 'Non-Stick', 'Multi-Function', 'Smart', 'Pro'],
    },
  },
  {
    name: 'groceries',
    weight: 5,
    brands: [
      'Amul',
      'Mother Dairy',
      'Nestle',
      'ITC',
      'Britannia',
      'Haldiram',
      'MTR',
      'Dabur',
      'Tata',
      'Patanjali',
    ],
    nameTemplates: ['{brand} {type} {suffix} {weight}', '{brand} {type} - {style}'],
    priceRange: { min: 29, max: 1999 },
    priceDist: { budget: 0.7, mid: 0.25, premium: 0.05 },
    imageKeyword: 'groceries',
    specs: {
      type: [
        'Butter',
        'Milk',
        'Biscuits',
        'Snacks',
        'Spices',
        'Rice',
        'Oil',
        'Tea',
        'Coffee',
        'Chocolate',
        'Noodles',
        'Ghee',
      ],
      weight: ['100g', '200g', '500g', '1Kg', '2Kg', '5Kg', '1L', '500ml'],
      style: ['Organic', 'Premium', 'Family Pack', 'Value Pack'],
      suffix: ['Fresh', 'Gold', 'Classic', 'Select', 'Natural'],
    },
  },
  {
    name: 'sports',
    weight: 4,
    brands: [
      'Yonex',
      'Cosco',
      'Nivia',
      'SG',
      'SS',
      'Adidas',
      'Nike',
      'Puma',
      'Decathlon',
      'Fitbit',
    ],
    nameTemplates: ['{brand} {model} {type} {suffix}', '{brand} {type} - {style}'],
    priceRange: { min: 299, max: 24999 },
    priceDist: { budget: 0.55, mid: 0.35, premium: 0.1 },
    imageKeyword: 'sports-equipment',
    specs: {
      type: [
        'Cricket Bat',
        'Badminton Racket',
        'Football',
        'Fitness Band',
        'Yoga Mat',
        'Dumbbells',
        'Treadmill',
        'Resistance Band',
        'Cycling Gloves',
        'Swimming Goggles',
      ],
      model: [
        'Astrox',
        'Nanoray',
        'Storm',
        'Versa',
        'Inspire',
        'Champion',
        'Elite',
        'Pro',
        'Titanium',
        'Legend',
      ],
      style: ['Professional', 'Beginner', 'Intermediate', 'Training'],
      suffix: ['Lightweight', 'Tournament', 'Competition', 'Training', 'Home Gym'],
    },
  },
  {
    name: 'books',
    weight: 3,
    brands: [
      'Penguin',
      'HarperCollins',
      'Oxford',
      'Pearson',
      'McGraw-Hill',
      'Wiley',
      'Arihant',
      'S. Chand',
      'Rupa',
      'Scholastic',
    ],
    nameTemplates: ['{title} by {author} ({type})', '{title} - {suffix} Edition'],
    priceRange: { min: 99, max: 4999 },
    priceDist: { budget: 0.65, mid: 0.3, premium: 0.05 },
    imageKeyword: 'books',
    specs: {
      title: [
        'The Complete Guide',
        'Mastering',
        'Introduction to',
        'Advanced',
        'Fundamentals of',
        'The Art of',
        'Essential',
        'Practical',
        'Modern',
        'Classic',
      ],
      author: [
        'Sharma',
        'Gupta',
        'Singh',
        'Kumar',
        'Patel',
        'Collins',
        'Roberts',
        'Williams',
        'Brown',
        'Davis',
      ],
      type: ['Paperback', 'Hardcover', 'eBook'],
      suffix: ['Revised', 'Latest', 'Illustrated', 'Deluxe', "Collector's"],
    },
  },
];

// ── Deterministic RNG ────────────────────────────────────────────────────────

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

// ── Product generation ───────────────────────────────────────────────────────

interface SeedProduct {
  name: string;
  price: number;
  category: string;
  description: string;
  imageUrl: string;
  inStock: boolean;
}

function generateProduct(index: number, catDef: CategoryDef, rng: () => number): SeedProduct {
  const brand = pick(catDef.brands, rng);

  // Price distribution
  const priceBucket = rng();
  let priceMultiplier: number;
  if (priceBucket < catDef.priceDist.budget) {
    priceMultiplier = 0.3 + rng() * 0.3; // 30–60% of max
  } else if (priceBucket < catDef.priceDist.budget + catDef.priceDist.mid) {
    priceMultiplier = 0.4 + rng() * 0.3; // 40–70% of max
  } else {
    priceMultiplier = 0.6 + rng() * 0.4; // 60–100% of max
  }
  const price =
    Math.round(
      (catDef.priceRange.min + priceMultiplier * (catDef.priceRange.max - catDef.priceRange.min)) /
        100
    ) *
      100 +
    99;

  // Build name from template
  const template = pick(catDef.nameTemplates, rng);
  let name = template;
  for (const [key, values] of Object.entries(catDef.specs)) {
    name = name.replace(`{${key}}`, pick(values, rng));
  }
  name = name.replace('{brand}', brand);
  // Clean up any unreplaced placeholders
  name = name
    .replace(/\{[^}]+\}/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const description = `${brand} ${catDef.name} - Premium quality product. Trusted by millions of customers across India. Fast delivery available.`;
  const imageUrl = `/product-placeholder.svg`;

  return {
    name,
    price: Math.max(catDef.priceRange.min, Math.min(catDef.priceRange.max, price)),
    category: catDef.name,
    description,
    imageUrl,
    inStock: true,
  };
}

// ── Main seeder ──────────────────────────────────────────────────────────────

async function seed() {
  const TOTAL = 100000;
  const BATCH_SIZE = 1000;

  console.log('🌱 Starting 100K product seed...\n');

  // Calculate per-category counts
  const totalWeight = CATEGORIES.reduce((sum, c) => sum + c.weight, 0);
  const categoryCounts = CATEGORIES.map((c) => ({
    def: c,
    count: Math.round((c.weight / totalWeight) * TOTAL),
  }));

  // Adjust to exact total
  const diff = TOTAL - categoryCounts.reduce((s, c) => s + c.count, 0);
  if (diff !== 0) categoryCounts[0].count += diff;

  // Check existing product count
  const existingCount = await prisma.product.count();
  console.log(`📊 Existing products in DB: ${existingCount}`);

  if (existingCount >= TOTAL) {
    console.log('✅ Database already has 100K+ products. Skipping seed.');
    await prisma.$disconnect();
    return;
  }

  // Clear existing products if partial seed exists
  if (existingCount > 0 && existingCount < TOTAL) {
    console.log('🗑️  Clearing partial seed data...');
    await prisma.productBusinessMetrics.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.product.deleteMany();
  }

  let globalIndex = 0;
  let totalInserted = 0;

  for (const { def, count } of categoryCounts) {
    console.log(`\n📦 Seeding ${count} ${def.name} products...`);
    const rng = seededRng(globalIndex * 31337);

    for (let batchStart = 0; batchStart < count; batchStart += BATCH_SIZE) {
      const batchSize = Math.min(BATCH_SIZE, count - batchStart);
      const products: SeedProduct[] = [];

      for (let i = 0; i < batchSize; i++) {
        products.push(generateProduct(globalIndex + batchStart + i, def, rng));
      }

      // Batch insert with createMany (dramatically faster than individual creates)
      await prisma.product.createMany({
        data: products.map((p) => ({
          name: p.name,
          price: p.price,
          category: p.category,
          description: p.description,
          imageUrl: p.imageUrl,
          featured: rng() < 0.02, // 2% featured
        })),
        skipDuplicates: true,
      });

      totalInserted += batchSize;
      const pct = Math.round((totalInserted / TOTAL) * 100);
      process.stdout.write(
        `  ✓ ${totalInserted.toLocaleString()} / ${TOTAL.toLocaleString()} (${pct}%)\r`
      );
    }

    globalIndex += count;
  }

  console.log(`\n\n✅ Seeded ${totalInserted.toLocaleString()} products!`);

  // Seed business metrics for all products
  console.log('\n📊 Seeding business metrics...');
  const allProducts = await prisma.product.findMany({ select: { id: true, category: true } });

  for (let i = 0; i < allProducts.length; i += BATCH_SIZE) {
    const batch = allProducts.slice(i, i + BATCH_SIZE);
    const rng = seededRng(i * 7919);

    const marginBase: Record<string, number> = {
      smartphones: 12,
      laptops: 15,
      appliances: 20,
      fashion: 45,
      footwear: 40,
      watches: 35,
      furniture: 30,
      electronics: 18,
      accessories: 40,
      home_kitchen: 25,
      groceries: 10,
      sports: 25,
      books: 20,
    };
    await prisma.productBusinessMetrics.createMany({
      data: batch.map((p) => {
        const base = marginBase[p.category] || 20;
        return {
          productId: p.id,
          marginPercentage: base + Math.round(rng() * 20),
          inventoryCount: Math.floor(rng() * 500),
          salesVelocity: Math.round(rng() * 100 * 10) / 10,
          conversionRate: Math.round(rng() * 0.15 * 1000) / 1000,
          returnRate: Math.round(rng() * 0.1 * 1000) / 1000,
        };
      }),
      skipDuplicates: true,
    });

    const pct = Math.round(((i + batch.length) / allProducts.length) * 100);
    process.stdout.write(
      `  ✓ Metrics: ${(i + batch.length).toLocaleString()} / ${allProducts.length.toLocaleString()} (${pct}%)\r`
    );
  }

  console.log('\n\n✅ Business metrics seeded!');

  // Summary
  const summary = await prisma.product.groupBy({
    by: ['category'],
    _count: { id: true },
    _avg: { price: true },
  });

  console.log('\n📋 Category Summary:');
  console.log('─'.repeat(50));
  for (const row of summary) {
    console.log(
      `  ${row.category.padEnd(18)} ${String(row._count.id).padStart(7)} products  avg ₹${Math.round(row._avg.price || 0).toLocaleString()}`
    );
  }
  console.log('─'.repeat(50));
  console.log(`  Total: ${summary.reduce((s, r) => s + r._count.id, 0).toLocaleString()} products`);

  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error('❌ Seed failed:', e);
  prisma.$disconnect();
  process.exit(1);
});
