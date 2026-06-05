/**
 * Fast batch seed: inserts 10,000 products into the Product table.
 * Uses createMany for batching (100 at a time) → much faster than one-by-one.
 * Run: npx ts-node --project tsconfig.json prisma/seed-products.ts
 */

import { PrismaClient } from '@prisma/client';

// Ensure DATABASE_URL is set before constructing PrismaClient
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5432/delegatecart';

const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

// ─── Catalog definition ───────────────────────────────────────────────────────

const CATALOG = [
  {
    category: 'Electronics',
    subCategory: 'Smartphones',
    brands: [
      'Apple',
      'Samsung',
      'OnePlus',
      'Xiaomi',
      'Realme',
      'Vivo',
      'Oppo',
      'iQOO',
      'Nothing',
      'Motorola',
    ],
    names: [
      'iPhone 15',
      'Galaxy S24',
      'Nord CE4',
      'Redmi Note 13',
      '12 Pro',
      'V30',
      'Reno 12',
      'Neo 9',
      'Phone 2a',
      'Edge 50',
    ],
    prices: [139999, 129999, 79999, 24999, 34999, 36999, 32999, 29999, 23999, 26999],
  },
  {
    category: 'Electronics',
    subCategory: 'Laptops',
    brands: ['Dell', 'HP', 'Lenovo', 'Apple', 'ASUS', 'Acer', 'MSI', 'LG', 'Razer', 'Microsoft'],
    names: [
      'XPS 15',
      'Spectre x360',
      'ThinkPad X1',
      'MacBook Pro 16"',
      'VivoBook 15',
      'Swift 5',
      'Prestige 16',
      'Gram 16',
      'Blade 16',
      'Surface Pro 9',
    ],
    prices: [189999, 149999, 129999, 249999, 89999, 79999, 159999, 139999, 229999, 179999],
  },
  {
    category: 'Electronics',
    subCategory: 'Headphones',
    brands: [
      'Sony',
      'boAt',
      'JBL',
      'Sennheiser',
      'Bose',
      'Noise',
      'Jabra',
      'Skullcandy',
      'Audio-Technica',
      'Beyerdynamic',
    ],
    names: [
      'WH-1000XM5',
      'Airdopes 141',
      'Tune 150',
      'HD 560S',
      'QuietComfort 45',
      'Buds Pro',
      'Elite 85t',
      'Crusher Evo',
      'M50xBT2',
      'DT 770 Pro',
    ],
    prices: [24999, 1299, 1449, 7999, 24999, 2999, 14999, 7999, 9499, 12999],
  },
  {
    category: 'Fashion',
    subCategory: "Men's Clothing",
    brands: [
      "Levi's",
      'H&M',
      'Zara',
      'Allen Solly',
      'Peter England',
      'Louis Philippe',
      'Van Heusen',
      'Arrow',
      'Raymond',
      'Wrangler',
    ],
    names: [
      'Slim Fit Jeans',
      'Polo T-Shirt',
      'Casual Shirt',
      'Chinos',
      'Formal Trousers',
      'Blazer',
      'Suit Set',
      'Kurta',
      'Sweatshirt',
      'Hoodie',
    ],
    prices: [2999, 799, 1499, 1999, 2499, 4999, 9999, 1299, 1799, 2499],
  },
  {
    category: 'Fashion',
    subCategory: "Women's Clothing",
    brands: [
      'Mango',
      'Forever 21',
      'W',
      'Biba',
      'Fab India',
      'AND',
      'Global Desi',
      'Aurelia',
      'Sangria',
      'Libas',
    ],
    names: [
      'Floral Kurti',
      'Straight Jeans',
      'Wrap Dress',
      'Palazzo Set',
      'Co-ord Set',
      'Anarkali Suit',
      'Salwar Kameez',
      'Maxi Dress',
      'Crop Top',
      'Skirt Set',
    ],
    prices: [1499, 1999, 3499, 2499, 2999, 3999, 2299, 2799, 999, 1899],
  },
  {
    category: 'Fashion',
    subCategory: 'Shoes',
    brands: [
      'Nike',
      'Adidas',
      'Puma',
      'Reebok',
      'Bata',
      'Liberty',
      'Woodland',
      'Red Tape',
      'Skechers',
      'New Balance',
    ],
    names: [
      'Air Max 270',
      'Ultraboost 23',
      'RS-X',
      'Classic Leather',
      'Casual Sneaker',
      'Formal Oxford',
      'Ankle Boot',
      'Sport Running',
      'Walking Shoe',
      'Trail Runner',
    ],
    prices: [10999, 12999, 7499, 6999, 1499, 1999, 4999, 6499, 5999, 8999],
  },
  {
    category: 'Groceries',
    subCategory: 'Staples',
    brands: [
      'India Gate',
      'Daawat',
      'Tata Sampann',
      'Fortune',
      'Aashirvaad',
      'Saffola',
      'Patanjali',
      'Organic India',
      'ITC',
      'Vedaka',
    ],
    names: [
      'Basmati Rice 5kg',
      'Toor Dal 1kg',
      'Maida 1kg',
      'Sunflower Oil 1L',
      'Wheat Atta 5kg',
      'Masala Oats 500g',
      'Desi Ghee 500g',
      'Green Tea 25 bags',
      'Salt 1kg',
      'Brown Rice 1kg',
    ],
    prices: [249, 119, 60, 149, 249, 99, 399, 149, 25, 149],
  },
  {
    category: 'Groceries',
    subCategory: 'Dairy & Beverages',
    brands: [
      'Amul',
      'Mother Dairy',
      'Nestle',
      'Britannia',
      'Tata Tea',
      'Bru Coffee',
      'Red Bull',
      'Tropicana',
      'Real',
      'Paper Boat',
    ],
    names: [
      'Butter 200g',
      'Paneer 400g',
      'Nescafe Classic 200g',
      'Cheese Slices',
      'Premium Tea 500g',
      'Gold Coffee 200g',
      'Energy Drink 250ml',
      'Mango Juice 1L',
      'Mixed Fruit 1L',
      'Aamras 200ml',
    ],
    prices: [89, 199, 349, 149, 249, 299, 99, 110, 95, 35],
  },
  {
    category: 'Home & Kitchen',
    subCategory: 'Cookware',
    brands: [
      'Prestige',
      'Hawkins',
      'Meyer',
      'Pigeon',
      'Wonderchef',
      'Vinod',
      'TTK',
      'Butterfly',
      'Tefal',
      'Cello',
    ],
    names: [
      'Pressure Cooker 3L',
      'Kadai 28cm',
      'Non-Stick Pan Set',
      'Tawa 28cm',
      'Sauce Pan 16cm',
      'Casserole 2.5L',
      'Induction Cooktop',
      'Idli Maker 4P',
      'Wok 28cm',
      'Dosa Tawa 30cm',
    ],
    prices: [1299, 1499, 3999, 899, 699, 1299, 2499, 699, 2499, 799],
  },
  {
    category: 'Home & Kitchen',
    subCategory: 'Furniture',
    brands: [
      'IKEA',
      'Durian',
      'HomeTown',
      'Wakefit',
      'Pepperfry',
      'Urban Ladder',
      'Godrej Interio',
      'Nilkamal',
      'Damro',
      'Royal Oak',
    ],
    names: [
      '3-Seater Sofa',
      'Study Table',
      'Wardrobe 3-Door',
      'Queen Bed Frame',
      'Bookshelf 5-Tier',
      'Dining Table 6P',
      'TV Unit 150cm',
      'Office Chair',
      'Bean Bag XL',
      'Shoe Rack 5-Layer',
    ],
    prices: [24999, 4999, 19999, 29999, 5999, 22999, 8999, 9999, 3999, 2499],
  },
  {
    category: 'Sports',
    subCategory: 'Fitness Equipment',
    brands: [
      'Powermax',
      'Kore',
      'Cockatoo',
      'Welcare',
      'Reach',
      'Lifeline',
      'Body Maxx',
      'Kamachi',
      'Gold Gym',
      'Viva Fitness',
    ],
    names: [
      'Dumbbell Set 20kg',
      'Resistance Bands',
      'Yoga Mat 6mm',
      'Exercise Cycle',
      'Treadmill 3HP',
      'Pull-Up Bar',
      'Kettlebell 16kg',
      'Foam Roller',
      'Weight Bench',
      'Barbell Set',
    ],
    prices: [4999, 699, 799, 9999, 34999, 999, 3999, 1299, 7999, 5999],
  },
  {
    category: 'Sports',
    subCategory: 'Outdoor Sports',
    brands: [
      'Yonex',
      'SG Cricket',
      'Cosco',
      'Vector X',
      'Nivia',
      'DSC',
      'Mayor',
      'Prokick',
      'Facto Sport',
      'Addidas Sport',
    ],
    names: [
      'Badminton Racket',
      'Cricket Bat',
      'Football Size 5',
      'Basketball Size 7',
      'Tennis Ball Pack',
      'Stumps Set',
      'Volleyball',
      'Table Tennis Set',
      'Carrom Board',
      'Skipping Rope',
    ],
    prices: [2499, 4999, 1499, 2999, 399, 849, 1699, 3499, 5999, 299],
  },
  {
    category: 'Books',
    subCategory: 'Self Help & Business',
    brands: [
      'Penguin',
      'HarperCollins',
      'Westland',
      'Rupa',
      'Jaico',
      'S&S',
      'Bloomsbury',
      'Pan Macmillan',
      'Hachette',
      'PRH India',
    ],
    names: [
      'Atomic Habits',
      'Zero to One',
      'The Lean Startup',
      'Rich Dad Poor Dad',
      'Deep Work',
      'Psychology of Money',
      'Think Like A Monk',
      'Ikigai',
      'The Alchemist',
      'Mindset',
    ],
    prices: [299, 399, 449, 299, 499, 349, 399, 299, 175, 349],
  },
  {
    category: 'Books',
    subCategory: 'Technology',
    brands: [
      "O'Reilly",
      'Manning',
      'Packt',
      'Apress',
      'Pearson',
      'Wrox',
      'No Starch',
      'Sybex',
      'AW Professional',
      'Wiley',
    ],
    names: [
      'Clean Code',
      'Design Patterns',
      'The Pragmatic Programmer',
      'Refactoring',
      'SICP',
      'DDIA',
      'System Design Interview',
      'Cracking the Coding',
      'Algorithms',
      'Operating Systems',
    ],
    prices: [799, 849, 999, 799, 699, 899, 1199, 999, 849, 749],
  },
  {
    category: 'Electronics',
    subCategory: 'Smart Home',
    brands: [
      'Amazon',
      'Google',
      'Xiaomi',
      'Syska',
      'Wipro Smart',
      'Philips Hue',
      'Havells',
      'Honeywell',
      'D-Link',
      'TP-Link',
    ],
    names: [
      'Echo Dot 5th Gen',
      'Nest Mini',
      'Smart Bulb 9W',
      'LED Strip 5m',
      'Smart Plug',
      'Color Light Kit',
      'Smart Fan',
      'Door Sensor',
      'WiFi Camera',
      'Mesh Router',
    ],
    prices: [4999, 4499, 799, 1299, 1199, 6999, 3999, 2499, 3499, 8999],
  },
  {
    category: 'Home & Kitchen',
    subCategory: 'Appliances',
    brands: [
      'LG',
      'Samsung',
      'Whirlpool',
      'Voltas',
      'Godrej',
      'Bajaj',
      'Philips',
      'Havells',
      'Usha',
      'Orient',
    ],
    names: [
      'Washing Machine 7kg',
      'Refrigerator 253L',
      'Microwave 28L',
      'Air Conditioner 1.5T',
      'Mixer Grinder 750W',
      'Room Heater 2000W',
      'Iron 2400W',
      'Ceiling Fan 1200mm',
      'Sandwich Maker',
      'Hand Blender',
    ],
    prices: [29999, 32999, 12999, 35999, 4999, 2999, 1999, 3999, 1499, 2499],
  },
  {
    category: 'Electronics',
    subCategory: 'Cameras & Photography',
    brands: [
      'Canon',
      'Nikon',
      'Sony',
      'Fujifilm',
      'Olympus',
      'Panasonic',
      'Leica',
      'GoPro',
      'DJI',
      'Insta360',
    ],
    names: [
      'EOS 1500D',
      'D3500',
      'Alpha A7 III',
      'X-T30 II',
      'OM-D E-M10',
      'G100D',
      'Q2',
      'Hero 12 Black',
      'Action 4',
      'X3',
    ],
    prices: [39999, 34999, 129999, 59999, 44999, 54999, 299999, 39999, 34999, 29999],
  },
  {
    category: 'Fashion',
    subCategory: 'Accessories',
    brands: [
      'Titan',
      'Fossil',
      'Casio',
      'Fastrack',
      'Sonata',
      'Guess',
      'Daniel Wellington',
      'Timex',
      'Citizen',
      'Seiko',
    ],
    names: [
      'Analog Watch',
      'Chronograph',
      'G-Shock',
      'Sports Watch',
      'Classic Watch',
      'Quartz Watch',
      'Mesh Watch',
      'Digital Watch',
      'Eco-Drive Watch',
      'Seiko 5',
    ],
    prices: [4999, 12999, 9999, 2999, 1999, 14999, 9999, 3499, 15999, 11999],
  },
  {
    category: 'Groceries',
    subCategory: 'Snacks & Instant',
    brands: [
      "Lay's",
      'Haldirams',
      'Maggi',
      'Bingo!',
      'Pringles',
      'ITC',
      'Parle',
      'Britannia',
      'Sunfeast',
      'Too Yumm',
    ],
    names: [
      'Potato Chips 90g',
      'Aloo Bhujia 200g',
      'Noodles 80g x12',
      'Mad Angles 50g',
      'Original Chips 131g',
      'Chat Pata Biscuits',
      'Glucose Biscuits',
      'Good Day 200g',
      'Dark Fantasy',
      'Veggie Sticks',
    ],
    prices: [25, 89, 120, 15, 199, 35, 25, 65, 75, 30],
  },
  {
    category: 'Sports',
    subCategory: 'Sportswear',
    brands: [
      'Nike',
      'Adidas',
      'Puma',
      'Under Armour',
      'Reebok',
      'Asics',
      'Li Ning',
      'Arena',
      'Speedo',
      'Fila',
    ],
    names: [
      'Dri-FIT Running Tee',
      'Ultraboost Shorts',
      'Tapered Joggers',
      'HeatGear Leggings',
      'Training Tank',
      'Running Capri',
      'Sport Tee',
      'Swim Shorts',
      'Racing Swimsuit',
      'Sport Bra',
    ],
    prices: [2499, 3499, 2999, 3999, 2499, 2999, 1999, 1799, 3499, 1999],
  },
  {
    category: 'Home & Kitchen',
    subCategory: 'Décor & Organization',
    brands: [
      'IKEA',
      'FabFurnish',
      'Craftsvilla',
      'Indian Roots',
      'Ellementry',
      'Pure Home',
      'My Home',
      'House This',
      'Nestasia',
      'Wooden Street',
    ],
    names: [
      'Wall Clock',
      'Photo Frame Set',
      'Storage Box Set',
      'Cushion Cover 5P',
      'Table Runner',
      'Candle Holder',
      'Vase Set',
      'Door Mat',
      'Bath Towel Set',
      'Curtain Pair',
    ],
    prices: [899, 799, 1499, 1299, 499, 699, 1199, 599, 1999, 1799],
  },
];

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '32GB', '64GB', '128GB', '256GB'];
const COLORS = [
  'Black',
  'White',
  'Navy',
  'Red',
  'Blue',
  'Grey',
  'Silver',
  'Gold',
  'Green',
  'Midnight',
];
const EDITIONS = ['5G', 'Pro', 'Plus', 'Ultra', 'Max', 'SE', 'Lite', 'Neo', 'Sport', 'Elite'];

const TARGET = 10000;
const BATCH = 100;

function buildProducts(): Array<{
  name: string;
  price: number;
  category: string;
  description: string;
  imageUrl: string;
  featured: boolean;
}> {
  const products = [];
  const perEntry = Math.ceil(TARGET / CATALOG.length); // ~481

  for (let catI = 0; catI < CATALOG.length && products.length < TARGET; catI++) {
    const entry = CATALOG[catI];
    let localIdx = 0;

    while (localIdx < perEntry && products.length < TARGET) {
      const pairI = localIdx % 10;
      const sizeI = Math.floor(localIdx / 10) % 10;
      const colorI = Math.floor(localIdx / 100);

      const brand = entry.brands[pairI];
      const model = entry.names[pairI];
      const size = SIZES[sizeI];
      const color = COLORS[colorI] ?? COLORS[colorI % COLORS.length];
      const edition = EDITIONS[pairI];

      // Use size for Fashion/Sports, edition for Electronics, color for others
      const variant =
        entry.category === 'Fashion' || entry.category === 'Sports'
          ? `${size} ${color}`
          : entry.category === 'Electronics'
            ? `${edition} ${color}`
            : entry.category === 'Groceries'
              ? color // pack type
              : `${size} ${color}`;

      const name = `${brand} ${model} ${variant}`.trim();
      const baseP = entry.prices[pairI];
      const price = Math.round(baseP * (0.8 + (localIdx % 7) * 0.06));
      const rating = (3.5 + (localIdx % 15) * 0.1).toFixed(1);
      const isFeatured = localIdx === 0 && catI < 5;

      products.push({
        name,
        price,
        category: entry.category,
        description: `${name} — ${entry.subCategory}. Rating: ${rating}/5. Free delivery on orders above ₹499. COD available. Brand: ${brand}.`,
        imageUrl: `/product-placeholder.svg`,
        featured: isFeatured,
      });

      localIdx++;
    }
  }

  return products;
}

async function main() {
  console.log('🌱 Seeding 10,000 products...');

  // Clear existing products (only products, not users/orders)
  const existingCount = await prisma.product.count();
  console.log(`  Existing products: ${existingCount}`);

  if (existingCount >= TARGET) {
    console.log(`  ✅ Already have ${existingCount} products — skipping seed`);
    return;
  }

  // Clear and reseed for a clean run if < target
  if (existingCount > 0) {
    console.log('  Deleting existing products...');
    await prisma.orderItem.deleteMany({});
    await prisma.cartItem.deleteMany({});
    await prisma.product.deleteMany({});
    console.log('  ✅ Cleared');
  }

  const all = buildProducts();
  console.log(`  Built ${all.length} product records`);

  let inserted = 0;
  for (let i = 0; i < all.length; i += BATCH) {
    const batch = all.slice(i, i + BATCH);
    await prisma.product.createMany({ data: batch });
    inserted += batch.length;
    if (inserted % 1000 === 0 || inserted === all.length) {
      console.log(`  📦 Inserted ${inserted}/${all.length}`);
    }
  }

  const finalCount = await prisma.product.count();
  console.log(`\n✨ Done! Total products in DB: ${finalCount}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
