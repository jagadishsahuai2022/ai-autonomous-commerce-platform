import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ==================== SEED DATA ====================

const SEED_CONFIG = {
  PRODUCT_CATEGORIES: ['Electronics', 'Groceries', 'Fashion', 'Home & Kitchen', 'Sports', 'Books'],
  PRODUCTS_PER_CATEGORY: 50,
  SELLERS_COUNT: 20,
  DEMO_USERS_COUNT: 10,
  TARGET_LEGACY_PRODUCTS: 10000,
};

interface ProductData {
  name: string;
  category: string;
  basePrice: number;
  costPrice: number;
  description: string;
  images: string[];
  quantity: number;
  deliveryDays: number;
  rating: number;
  ratingCount: number;
  subCategory?: string;
}

// ==================== PRODUCT DATA ====================

const ELECTRONICS_PRODUCTS: ProductData[] = [
  // Smartphones - Indian focus
  {
    name: 'Apple iPhone 15 Pro Max',
    category: 'Electronics',
    subCategory: 'Smartphones',
    basePrice: 139999,
    costPrice: 85000,
    description:
      'Latest Apple iPhone 15 Pro Max with A17 Pro chip, 6.7" Super Retina display. EMI available. COD accepted.',
    images: ['https://placehold.co/400x400?text=iPhone+15+Pro+Max'],
    quantity: 45,
    deliveryDays: 2,
    rating: 4.8,
    ratingCount: 2823,
  },
  {
    name: 'OnePlus 12 Pro',
    category: 'Electronics',
    subCategory: 'Smartphones',
    basePrice: 79999,
    costPrice: 48000,
    description: 'Flagship killer from OnePlus. Snapdragon 8 Gen 3, 12GB RAM. COD & EMI available.',
    images: ['https://placehold.co/400x400?text=OnePlus+12'],
    quantity: 120,
    deliveryDays: 1,
    rating: 4.6,
    ratingCount: 4521,
  },
  {
    name: 'Samsung Galaxy S24 Ultra',
    category: 'Electronics',
    subCategory: 'Smartphones',
    basePrice: 129999,
    costPrice: 78000,
    description:
      'Premium Samsung flagship with 200MP camera, 6.8" display, titanium frame. EMI, COD available.',
    images: ['https://placehold.co/400x400?text=Galaxy+S24+Ultra'],
    quantity: 52,
    deliveryDays: 2,
    rating: 4.7,
    ratingCount: 3412,
  },
  {
    name: 'Xiaomi 14 Ultra',
    category: 'Electronics',
    subCategory: 'Smartphones',
    basePrice: 59999,
    costPrice: 35000,
    description:
      'Flagship smartphone with premium camera. 1 inch sensor, 120W charging. COD & EMI available.',
    images: ['https://placehold.co/400x400?text=Xiaomi+14'],
    quantity: 200,
    deliveryDays: 1,
    rating: 4.5,
    ratingCount: 5234,
  },
  {
    name: 'iQOO 12 Pro',
    category: 'Electronics',
    subCategory: 'Smartphones',
    basePrice: 54999,
    costPrice: 32000,
    description:
      'Gaming beast with 200W charging, Snapdragon 8 Gen 3. Free gaming controller included.',
    images: ['https://placehold.co/400x400?text=iQOO+12'],
    quantity: 180,
    deliveryDays: 1,
    rating: 4.4,
    ratingCount: 6123,
  },
  {
    name: 'Realme 12 Pro+',
    category: 'Electronics',
    subCategory: 'Smartphones',
    basePrice: 34999,
    costPrice: 19000,
    description: 'Budget flagship killer. Snapdragon 7 Gen 3, 120Hz AMOLED. COD available.',
    images: ['https://placehold.co/400x400?text=Realme+12'],
    quantity: 350,
    deliveryDays: 1,
    rating: 4.3,
    ratingCount: 7421,
  },
  // Laptops
  {
    name: 'Dell XPS 15 Laptop',
    category: 'Electronics',
    subCategory: 'Laptops',
    basePrice: 189999,
    costPrice: 120000,
    description:
      'Intel Core i9, 32GB RAM, RTX 4090 GPU, 15.6" 4K OLED display. EMI available up to 12 months.',
    images: ['https://placehold.co/400x400?text=Dell+XPS+15'],
    quantity: 15,
    deliveryDays: 3,
    rating: 4.9,
    ratingCount: 287,
  },
  {
    name: 'MacBook Pro 16"',
    category: 'Electronics',
    subCategory: 'Laptops',
    basePrice: 249999,
    costPrice: 160000,
    description: 'M3 Max chip, 36GB unified memory, 1TB SSD, Space Gray. EMI available.',
    images: ['https://placehold.co/400x400?text=MacBook+Pro'],
    quantity: 22,
    deliveryDays: 2,
    rating: 4.9,
    ratingCount: 401,
  },
  {
    name: 'ASUS ROG Gaming Laptop',
    category: 'Electronics',
    subCategory: 'Laptops',
    basePrice: 159999,
    costPrice: 95000,
    description:
      'RTX 4080, Intel i9, 32GB RAM, 240Hz display. Perfect for gaming and content creation.',
    images: ['https://placehold.co/400x400?text=ASUS+ROG'],
    quantity: 35,
    deliveryDays: 2,
    rating: 4.7,
    ratingCount: 892,
  },
  {
    name: 'Lenovo ThinkPad X1 Carbon',
    category: 'Electronics',
    subCategory: 'Laptops',
    basePrice: 129999,
    costPrice: 78000,
    description: 'Business laptop, 14" display, Intel Core i7, 16GB RAM. COD & EMI available.',
    images: ['https://placehold.co/400x400?text=ThinkPad+X1'],
    quantity: 45,
    deliveryDays: 1,
    rating: 4.6,
    ratingCount: 645,
  },
  // Audio
  {
    name: 'boAt Airdopes 171 TWS',
    category: 'Electronics',
    subCategory: 'Audio',
    basePrice: 2999,
    costPrice: 1200,
    description: 'Indian brand true wireless earbuds with 42 hour battery life. COD available.',
    images: ['https://placehold.co/400x400?text=boAt+Airdopes'],
    quantity: 800,
    deliveryDays: 1,
    rating: 4.2,
    ratingCount: 8932,
  },
  {
    name: 'Sony WH-1000XM5 Headphones',
    category: 'Electronics',
    subCategory: 'Audio',
    basePrice: 24999,
    costPrice: 12000,
    description:
      'Premium noise-cancelling wireless headphones with 30-hour battery. EMI available.',
    images: ['https://placehold.co/400x400?text=Sony+WH1000XM5'],
    quantity: 128,
    deliveryDays: 1,
    rating: 4.6,
    ratingCount: 4892,
  },
  {
    name: 'Noise XQ Pro Earbuds',
    category: 'Electronics',
    subCategory: 'Audio',
    basePrice: 3999,
    costPrice: 1900,
    description: 'Indian brand with advanced ANC. 48-hour battery life. Affordable premium.',
    images: ['https://placehold.co/400x400?text=Noise+XQ'],
    quantity: 500,
    deliveryDays: 1,
    rating: 4.3,
    ratingCount: 5234,
  },
  // Wearables
  {
    name: 'Noise ColorFit Pro 4 Smartwatch',
    category: 'Electronics',
    subCategory: 'Wearables',
    basePrice: 5999,
    costPrice: 2400,
    description: 'Indian smartwatch with 100+ watch faces, 7-day battery. Most affordable premium.',
    images: ['https://placehold.co/400x400?text=Noise+ColorFit'],
    quantity: 600,
    deliveryDays: 1,
    rating: 4.1,
    ratingCount: 6234,
  },
  {
    name: 'Samsung Galaxy Watch 6 Classic',
    category: 'Electronics',
    subCategory: 'Wearables',
    basePrice: 29999,
    costPrice: 15000,
    description: 'Rotating bezel, AMOLED display, 5ATM water resistance. EMI available.',
    images: ['https://placehold.co/400x400?text=Galaxy+Watch+6'],
    quantity: 89,
    deliveryDays: 1,
    rating: 4.5,
    ratingCount: 3678,
  },
  {
    name: 'Apple Watch Series 9',
    category: 'Electronics',
    subCategory: 'Wearables',
    basePrice: 41999,
    costPrice: 25000,
    description:
      'Latest Apple Watch with always-on display, ECG, temperature sensing. EMI available.',
    images: ['https://placehold.co/400x400?text=Apple+Watch+9'],
    quantity: 120,
    deliveryDays: 1,
    rating: 4.7,
    ratingCount: 2134,
  },
  // Tablets
  {
    name: 'iPad Pro 12.9" M2',
    category: 'Electronics',
    subCategory: 'Tablets',
    basePrice: 99999,
    costPrice: 60000,
    description: 'M2 chip, 128GB storage, WiFi + Cellular, Apple Pencil included. EMI available.',
    images: ['https://placehold.co/400x400?text=iPad+Pro'],
    quantity: 34,
    deliveryDays: 1,
    rating: 4.8,
    ratingCount: 1567,
  },
  {
    name: 'Samsung Galaxy Tab S9 Ultra',
    category: 'Electronics',
    subCategory: 'Tablets',
    basePrice: 89999,
    costPrice: 52000,
    description: '14.6" AMOLED display, Snapdragon 8 Gen 2, 12GB RAM. EMI available.',
    images: ['https://placehold.co/400x400?text=Galaxy+Tab+S9'],
    quantity: 78,
    deliveryDays: 1,
    rating: 4.6,
    ratingCount: 892,
  },
  // TV & Displays
  {
    name: 'LG OLED 55" TV',
    category: 'Electronics',
    subCategory: 'TVs',
    basePrice: 149999,
    costPrice: 85000,
    description:
      '4K OLED Smart TV, 120Hz refresh rate, AI upscaling. Free installation & wall mount.',
    images: ['https://placehold.co/400x400?text=LG+OLED+55'],
    quantity: 18,
    deliveryDays: 3,
    rating: 4.7,
    ratingCount: 234,
  },
  {
    name: 'Samsung 65" Neo QLED 8K',
    category: 'Electronics',
    subCategory: 'TVs',
    basePrice: 179999,
    costPrice: 105000,
    description: '8K resolution, Mini LED, 144Hz refresh rate. EMI available for this premium TV.',
    images: ['https://placehold.co/400x400?text=Neo+QLED'],
    quantity: 12,
    deliveryDays: 3,
    rating: 4.8,
    ratingCount: 156,
  },
  // Cameras
  {
    name: 'GoPro Hero 12 Black',
    category: 'Electronics',
    subCategory: 'Cameras',
    basePrice: 39999,
    costPrice: 22000,
    description:
      '5.3K video, HyperSmooth 6.0, waterproof, voice control. Includes accessories bundle.',
    images: ['https://placehold.co/400x400?text=GoPro+Hero+12'],
    quantity: 45,
    deliveryDays: 2,
    rating: 4.6,
    ratingCount: 432,
  },
  {
    name: 'Sony Alpha A6700 Mirrorless',
    category: 'Electronics',
    subCategory: 'Cameras',
    basePrice: 129999,
    costPrice: 78000,
    description: '32.4MP full-frame, 4K 120fps video, AI autofocus. Professional grade.',
    images: ['https://placehold.co/400x400?text=Sony+A6700'],
    quantity: 22,
    deliveryDays: 2,
    rating: 4.7,
    ratingCount: 234,
  },
  // Accessories
  {
    name: 'Anker 737 Power Bank',
    category: 'Electronics',
    subCategory: 'Accessories',
    basePrice: 5999,
    costPrice: 2500,
    description: '24000mAh, 140W fast charging, 6 ports. Fastest charging available.',
    images: ['https://placehold.co/400x400?text=Anker+737'],
    quantity: 334,
    deliveryDays: 1,
    rating: 4.4,
    ratingCount: 5523,
  },
  {
    name: 'Belkin MagSafe Car Mount',
    category: 'Electronics',
    subCategory: 'Accessories',
    basePrice: 4999,
    costPrice: 2400,
    description: 'Premium car mount for smartphone. Magnetic, rotating, one-click mount.',
    images: ['https://placehold.co/400x400?text=Belkin+Mount'],
    quantity: 250,
    deliveryDays: 1,
    rating: 4.5,
    ratingCount: 1234,
  },
];

const GROCERY_PRODUCTS: ProductData[] = [
  // Rice & Grains
  {
    name: 'Basmati Rice 1kg',
    category: 'Groceries',
    subCategory: 'Rice & Grains',
    basePrice: 89,
    costPrice: 45,
    description: 'Premium basmati rice, aged 1 year, aromatic long grains. COD available.',
    images: ['https://placehold.co/400x400?text=Basmati+Rice'],
    quantity: 2500,
    deliveryDays: 1,
    rating: 4.3,
    ratingCount: 8532,
  },
  {
    name: 'Tata Rice 5kg',
    category: 'Groceries',
    subCategory: 'Rice & Grains',
    basePrice: 399,
    costPrice: 195,
    description: 'Indian brand quality rice. Best value for family. COD available.',
    images: ['https://placehold.co/400x400?text=Tata+Rice'],
    quantity: 3200,
    deliveryDays: 1,
    rating: 4.2,
    ratingCount: 6234,
  },
  {
    name: 'Everyday Wheat',
    category: 'Groceries',
    subCategory: 'Flour & Cereals',
    basePrice: 49,
    costPrice: 24,
    description: '500g premium wheat for making whole wheat flour.',
    images: ['https://placehold.co/400x400?text=Wheat'],
    quantity: 4500,
    deliveryDays: 1,
    rating: 4.1,
    ratingCount: 5123,
  },
  // Dairy
  {
    name: 'Organic Milk 1L',
    category: 'Groceries',
    subCategory: 'Dairy',
    basePrice: 65,
    costPrice: 35,
    description: 'Fresh organic milk, no preservatives, delivered daily. EMI option available.',
    images: ['https://placehold.co/400x400?text=Organic+Milk'],
    quantity: 5000,
    deliveryDays: 1,
    rating: 4.5,
    ratingCount: 7421,
  },
  {
    name: 'Amul Butter 200g',
    category: 'Groceries',
    subCategory: 'Dairy',
    basePrice: 89,
    costPrice: 45,
    description: 'Fresh butter, spreadable, rich quality. Made in India, most loved brand.',
    images: ['https://placehold.co/400x400?text=Amul+Butter'],
    quantity: 2300,
    deliveryDays: 1,
    rating: 4.5,
    ratingCount: 4345,
  },
  {
    name: 'Paneer 400g',
    category: 'Groceries',
    subCategory: 'Dairy',
    basePrice: 199,
    costPrice: 99,
    description: 'Fresh paneer, soft and spongy. Perfect for curries.',
    images: ['https://placehold.co/400x400?text=Paneer'],
    quantity: 1800,
    deliveryDays: 1,
    rating: 4.4,
    ratingCount: 3456,
  },
  // Beverages
  {
    name: 'Tata Tea 500g',
    category: 'Groceries',
    subCategory: 'Beverages',
    basePrice: 249,
    costPrice: 120,
    description: 'Premium black tea, fresh garden collection. Made in India.',
    images: ['https://placehold.co/400x400?text=Tata+Tea'],
    quantity: 1200,
    deliveryDays: 1,
    rating: 4.4,
    ratingCount: 5134,
  },
  {
    name: 'Nescafe Coffee 200g',
    category: 'Groceries',
    subCategory: 'Beverages',
    basePrice: 349,
    costPrice: 165,
    description: 'Instant coffee, rich flavor. Great morning drink.',
    images: ['https://placehold.co/400x400?text=Nescafe+Coffee'],
    quantity: 890,
    deliveryDays: 1,
    rating: 4.3,
    ratingCount: 3234,
  },
  {
    name: 'Red Bull Energy Drink 250ml',
    category: 'Groceries',
    subCategory: 'Beverages',
    basePrice: 99,
    costPrice: 50,
    description: 'Energy drink, vitalizes body and mind. Pack of 6.',
    images: ['https://placehold.co/400x400?text=Red+Bull'],
    quantity: 3400,
    deliveryDays: 1,
    rating: 4.3,
    ratingCount: 4123,
  },
  // Oils & Fats
  {
    name: 'Sunflower Oil 1L',
    category: 'Groceries',
    subCategory: 'Oils & Fats',
    basePrice: 199,
    costPrice: 95,
    description: 'Pure refined sunflower oil, cold-pressed. Healthy choice.',
    images: ['https://placehold.co/400x400?text=Sunflower+Oil'],
    quantity: 2100,
    deliveryDays: 1,
    rating: 4.3,
    ratingCount: 3832,
  },
  {
    name: 'Mustard Oil 5L',
    category: 'Groceries',
    subCategory: 'Oils & Fats',
    basePrice: 799,
    costPrice: 395,
    description: 'Traditional mustard oil. Best for Indian cooking.',
    images: ['https://placehold.co/400x400?text=Mustard+Oil'],
    quantity: 1200,
    deliveryDays: 1,
    rating: 4.2,
    ratingCount: 2456,
  },
  // Instant Food
  {
    name: 'Maggi Noodles 80g (Pack of 12)',
    category: 'Groceries',
    subCategory: 'Instant Food',
    basePrice: 120,
    costPrice: 55,
    description: 'Quick cooking noodles, assorted flavors. All-time favorite.',
    images: ['https://placehold.co/400x400?text=Maggi+Noodles'],
    quantity: 5600,
    deliveryDays: 1,
    rating: 4.2,
    ratingCount: 8932,
  },
  {
    name: 'Yippee Noodles 80g (Pack of 10)',
    category: 'Groceries',
    subCategory: 'Instant Food',
    basePrice: 100,
    costPrice: 45,
    description: 'ITC brand instant noodles. Affordable and tasty.',
    images: ['https://placehold.co/400x400?text=Yippee'],
    quantity: 4500,
    deliveryDays: 1,
    rating: 4.1,
    ratingCount: 4234,
  },
  // Flour & Cereals
  {
    name: 'ITC Aashirvaad Atta 5kg',
    category: 'Groceries',
    subCategory: 'Flour & Cereals',
    basePrice: 249,
    costPrice: 130,
    description: 'Whole wheat flour, fortified with micronutrients. Made in India.',
    images: ['https://placehold.co/400x400?text=Aashirvaad+Atta'],
    quantity: 3400,
    deliveryDays: 1,
    rating: 4.6,
    ratingCount: 7123,
  },
  // Cleaning Supplies
  {
    name: 'Domex Disinfectant 250ml',
    category: 'Groceries',
    subCategory: 'Cleaning Supplies',
    basePrice: 99,
    costPrice: 40,
    description: 'Powerful disinfectant, kills 99.9% germs. Indian brand.',
    images: ['https://placehold.co/400x400?text=Domex'],
    quantity: 1800,
    deliveryDays: 1,
    rating: 4.4,
    ratingCount: 5456,
  },
  {
    name: 'Surf Excel Washing Powder 1kg',
    category: 'Groceries',
    subCategory: 'Cleaning Supplies',
    basePrice: 349,
    costPrice: 165,
    description: 'Powerful wash powder. Tough on stains.',
    images: ['https://placehold.co/400x400?text=Surf+Excel'],
    quantity: 2100,
    deliveryDays: 1,
    rating: 4.3,
    ratingCount: 3234,
  },
  // Personal Care
  {
    name: 'Dove Soap Bar',
    category: 'Groceries',
    subCategory: 'Personal Care',
    basePrice: 79,
    costPrice: 35,
    description: 'Moisturizing soap bar, 1/4 moisturizing cream. Pack of 3.',
    images: ['https://placehold.co/400x400?text=Dove+Soap'],
    quantity: 4200,
    deliveryDays: 1,
    rating: 4.6,
    ratingCount: 6523,
  },
  {
    name: 'Colgate Toothpaste 200g',
    category: 'Groceries',
    subCategory: 'Personal Care',
    basePrice: 99,
    costPrice: 45,
    description: 'Toothpaste with fluoride. Trusted by millions.',
    images: ['https://placehold.co/400x400?text=Colgate'],
    quantity: 3500,
    deliveryDays: 1,
    rating: 4.4,
    ratingCount: 5234,
  },
];

const FASHION_PRODUCTS: ProductData[] = [
  // Men's Clothing
  {
    name: 'Levis 501 Jeans',
    category: 'Fashion',
    subCategory: 'Men Denim',
    basePrice: 4999,
    costPrice: 2400,
    description:
      'Classic original fit denim, blue black, perfect for all occasions. COD available.',
    images: ['https://placehold.co/400x400?text=Levis+501'],
    quantity: 234,
    deliveryDays: 2,
    rating: 4.5,
    ratingCount: 3234,
  },
  {
    name: 'Nike Air Force 1',
    category: 'Fashion',
    subCategory: 'Shoes',
    basePrice: 8999,
    costPrice: 4500,
    description: 'Classic white leather sneakers, timeless style. Available in multiple sizes.',
    images: ['https://placehold.co/400x400?text=Nike+AF1'],
    quantity: 456,
    deliveryDays: 1,
    rating: 4.7,
    ratingCount: 5456,
  },
  {
    name: 'Columbia Full Zip Hoodie',
    category: 'Fashion',
    subCategory: 'Sweatshirts',
    basePrice: 3999,
    costPrice: 1900,
    description:
      'Comfortable fleece hoodie, water resistant, multiple colors. COD & EMI available.',
    images: ['https://placehold.co/400x400?text=Columbia+Hoodie'],
    quantity: 189,
    deliveryDays: 2,
    rating: 4.4,
    ratingCount: 1567,
  },
  {
    name: 'Tommy Hilfiger Polo',
    category: 'Fashion',
    subCategory: 'Men Tops',
    basePrice: 2499,
    costPrice: 1200,
    description: 'Classic polo shirt, cotton, machine washable. Free delivery.',
    images: ['https://placehold.co/400x400?text=Tommy+Polo'],
    quantity: 345,
    deliveryDays: 1,
    rating: 4.5,
    ratingCount: 2834,
  },
  {
    name: 'Puma Running Shoes',
    category: 'Fashion',
    subCategory: 'Shoes',
    basePrice: 7499,
    costPrice: 3800,
    description:
      'Lightweight running shoes, responsive cushioning, breathable mesh. Best for running.',
    images: ['https://placehold.co/400x400?text=Puma+Running'],
    quantity: 345,
    deliveryDays: 1,
    rating: 4.5,
    ratingCount: 4341,
  },
  {
    name: 'Adidas Ultraboost 23',
    category: 'Fashion',
    subCategory: 'Shoes',
    basePrice: 12999,
    costPrice: 6500,
    description: 'Premium running shoes with Boost cushioning. Lightweight and responsive.',
    images: ['https://placehold.co/400x400?text=Adidas+Ultraboost'],
    quantity: 234,
    deliveryDays: 1,
    rating: 4.6,
    ratingCount: 3456,
  },
  // Women's Clothing
  {
    name: 'Zara Black T-shirt',
    category: 'Fashion',
    subCategory: 'Women Tops',
    basePrice: 1999,
    costPrice: 900,
    description: 'Premium black tee, regular fit, soft cotton. Trending now.',
    images: ['https://placehold.co/400x400?text=Zara+Tee'],
    quantity: 567,
    deliveryDays: 1,
    rating: 4.6,
    ratingCount: 3123,
  },
  {
    name: 'H&M Casual Dress',
    category: 'Fashion',
    subCategory: 'Women Dresses',
    basePrice: 2999,
    costPrice: 1400,
    description: 'Casual summer dress, breathable fabric. Perfect for daily wear.',
    images: ['https://placehold.co/400x400?text=HM+Dress'],
    quantity: 423,
    deliveryDays: 1,
    rating: 4.4,
    ratingCount: 2156,
  },
  {
    name: 'Forever 21 Crop Top',
    category: 'Fashion',
    subCategory: 'Women Tops',
    basePrice: 899,
    costPrice: 400,
    description: 'Trendy crop top, available in multiple colors. Very affordable.',
    images: ['https://placehold.co/400x400?text=F21+Crop'],
    quantity: 1200,
    deliveryDays: 2,
    rating: 4.2,
    ratingCount: 4234,
  },
  // Accessories
  {
    name: 'Fossil Analog Watch',
    category: 'Fashion',
    subCategory: 'Watches',
    basePrice: 9999,
    costPrice: 5000,
    description: 'Stainless steel watch, water resistant 50m, Japanese movement.',
    images: ['https://placehold.co/400x400?text=Fossil+Watch'],
    quantity: 123,
    deliveryDays: 3,
    rating: 4.4,
    ratingCount: 1456,
  },
  {
    name: 'Ray-Ban Sunglasses',
    category: 'Fashion',
    subCategory: 'Accessories',
    basePrice: 6999,
    costPrice: 3500,
    description: 'Original Wayfarer style, UV protection, acetate frame.',
    images: ['https://placehold.co/400x400?text=Ray+Ban'],
    quantity: 234,
    deliveryDays: 2,
    rating: 4.7,
    ratingCount: 2234,
  },
  {
    name: 'Coach Leather Belt',
    category: 'Fashion',
    subCategory: 'Accessories',
    basePrice: 4999,
    costPrice: 2400,
    description: 'Premium leather belt, Italian made. Professional and casual look.',
    images: ['https://placehold.co/400x400?text=Coach+Belt'],
    quantity: 456,
    deliveryDays: 2,
    rating: 4.5,
    ratingCount: 1834,
  },
  // Ethnic Wear
  {
    name: 'AJIO Ethnic Kurti',
    category: 'Fashion',
    subCategory: 'Women Ethnic',
    basePrice: 1499,
    costPrice: 700,
    description: 'Traditional kurti, comfortable fit, vibrant prints. Made in India.',
    images: ['https://placehold.co/400x400?text=Ethnic+Kurti'],
    quantity: 645,
    deliveryDays: 1,
    rating: 4.4,
    ratingCount: 4456,
  },
  {
    name: 'Saree with Blouse',
    category: 'Fashion',
    subCategory: 'Women Ethnic',
    basePrice: 3999,
    costPrice: 1800,
    description: 'Traditional silk saree with embroidered blouse. Festival special.',
    images: ['https://placehold.co/400x400?text=Saree'],
    quantity: 234,
    deliveryDays: 2,
    rating: 4.3,
    ratingCount: 2134,
  },
  // Men's Bottom
  {
    name: 'Jack & Jones Cargo Pants',
    category: 'Fashion',
    subCategory: 'Men Bottom',
    basePrice: 3499,
    costPrice: 1700,
    description: 'Comfortable cargo pants, multiple pockets, olive green. Great fit.',
    images: ['https://placehold.co/400x400?text=JJ+Cargo'],
    quantity: 289,
    deliveryDays: 2,
    rating: 4.3,
    ratingCount: 1678,
  },
];

// ==================== DEMO BUY REQUESTS ====================

const HOME_KITCHEN_PRODUCTS: ProductData[] = [
  {
    name: 'Prestige Pressure Cooker 5L',
    category: 'Home & Kitchen',
    subCategory: 'Cookware',
    basePrice: 1299,
    costPrice: 620,
    description: 'Durable steel pressure cooker, safety valve, heat resistant. Indian favorite.',
    images: ['https://placehold.co/400x400?text=Prestige+Cooker'],
    quantity: 1200,
    deliveryDays: 1,
    rating: 4.3,
    ratingCount: 8234,
  },
  {
    name: 'Pigeon Non-Stick Frying Pan 28cm',
    category: 'Home & Kitchen',
    subCategory: 'Cookware',
    basePrice: 899,
    costPrice: 425,
    description: 'Non-stick coating, comfortable handle. Perfect for everyday cooking.',
    images: ['https://placehold.co/400x400?text=Pigeon+Pan'],
    quantity: 1500,
    deliveryDays: 1,
    rating: 4.2,
    ratingCount: 5234,
  },
  {
    name: 'Whirlpool Refrigerator 215L',
    category: 'Home & Kitchen',
    subCategory: 'Appliances',
    basePrice: 14999,
    costPrice: 8500,
    description: 'Direct-cool fridge, 215L capacity. Energy efficient, Indian brand.',
    images: ['https://placehold.co/400x400?text=Fridge'],
    quantity: 45,
    deliveryDays: 3,
    rating: 4.4,
    ratingCount: 2134,
  },
  {
    name: 'Godrej Microwave 23L',
    category: 'Home & Kitchen',
    subCategory: 'Appliances',
    basePrice: 6999,
    costPrice: 4000,
    description: 'Compact microwave with 10 power levels. Made in India.',
    images: ['https://placehold.co/400x400?text=Microwave'],
    quantity: 156,
    deliveryDays: 2,
    rating: 4.3,
    ratingCount: 1234,
  },
  {
    name: 'Singer Sewing Machine',
    category: 'Home & Kitchen',
    subCategory: 'Appliances',
    basePrice: 9999,
    costPrice: 5500,
    description: 'Portable sewing machine, 40 stitches. Perfect for beginners.',
    images: ['https://placehold.co/400x400?text=Singer'],
    quantity: 234,
    deliveryDays: 2,
    rating: 4.2,
    ratingCount: 834,
  },
  {
    name: 'Tupperware Container Set',
    category: 'Home & Kitchen',
    subCategory: 'Kitchen Storage',
    basePrice: 1499,
    costPrice: 700,
    description: '5 piece container set, microwave safe. Durable and colorful.',
    images: ['https://placehold.co/400x400?text=Tupperware'],
    quantity: 800,
    deliveryDays: 1,
    rating: 4.4,
    ratingCount: 4234,
  },
  {
    name: 'Cello Plastic Bottles (Set of 4)',
    category: 'Home & Kitchen',
    subCategory: 'Kitchen Storage',
    basePrice: 399,
    costPrice: 185,
    description: '1L each bottle, food grade plastic. Affordable.',
    images: ['https://placehold.co/400x400?text=Cello+Bottles'],
    quantity: 2100,
    deliveryDays: 1,
    rating: 4.2,
    ratingCount: 3456,
  },
  {
    name: 'Cutter Stainless Steel Knife Set',
    category: 'Home & Kitchen',
    subCategory: 'Utensils',
    basePrice: 1299,
    costPrice: 620,
    description: '4 piece knife set with block. German stainless steel.',
    images: ['https://placehold.co/400x400?text=Knife+Set'],
    quantity: 345,
    deliveryDays: 1,
    rating: 4.5,
    ratingCount: 3456,
  },
  {
    name: 'Sumeet Mixing Bowls (Set of 5)',
    category: 'Home & Kitchen',
    subCategory: 'Utensils',
    basePrice: 499,
    costPrice: 235,
    description: 'Stainless steel mixing bowls. Professional quality.',
    images: ['https://placehold.co/400x400?text=Mixing+Bowls'],
    quantity: 1200,
    deliveryDays: 1,
    rating: 4.3,
    ratingCount: 2134,
  },
];

const SPORTS_PRODUCTS: ProductData[] = [
  {
    name: 'Decathlon Cricket Bat',
    category: 'Sports',
    subCategory: 'Cricket',
    basePrice: 1999,
    costPrice: 950,
    description: 'Professional cricket bat, English willow. Great for all-rounder players.',
    images: ['https://placehold.co/400x400?text=Cricket+Bat'],
    quantity: 456,
    deliveryDays: 2,
    rating: 4.3,
    ratingCount: 2134,
  },
  {
    name: 'Kookaburra Cricket Ball (Box of 6)',
    category: 'Sports',
    subCategory: 'Cricket',
    basePrice: 2999,
    costPrice: 1400,
    description: 'Professional cricket balls. Tournament grade quality.',
    images: ['https://placehold.co/400x400?text=Cricket+Ball'],
    quantity: 234,
    deliveryDays: 2,
    rating: 4.4,
    ratingCount: 834,
  },
  {
    name: 'Nivia Football Classic',
    category: 'Sports',
    subCategory: 'Football',
    basePrice: 1299,
    costPrice: 620,
    description: 'Professional football. Best for training and matches.',
    images: ['https://placehold.co/400x400?text=Football'],
    quantity: 345,
    deliveryDays: 1,
    rating: 4.2,
    ratingCount: 1456,
  },
  {
    name: 'Cosco Basketball',
    category: 'Sports',
    subCategory: 'Basketball',
    basePrice: 2499,
    costPrice: 1200,
    description: 'Indoor/outdoor basketball. Durable rubber compound.',
    images: ['https://placehold.co/400x400?text=Basketball'],
    quantity: 289,
    deliveryDays: 1,
    rating: 4.3,
    ratingCount: 1234,
  },
  {
    name: 'Decathlon Yoga Mat',
    category: 'Sports',
    subCategory: 'Fitness',
    basePrice: 599,
    costPrice: 285,
    description: '6mm yoga mat, non-slip. Perfect for yoga and pilates.',
    images: ['https://placehold.co/400x400?text=Yoga+Mat'],
    quantity: 1200,
    deliveryDays: 1,
    rating: 4.4,
    ratingCount: 3456,
  },
  {
    name: 'Lifeline Home Gym Resistance Bands Set',
    category: 'Sports',
    subCategory: 'Fitness',
    basePrice: 1499,
    costPrice: 700,
    description: '5 resistance bands with carry bag. Complete home workout.',
    images: ['https://placehold.co/400x400?text=Resistance+Bands'],
    quantity: 567,
    deliveryDays: 1,
    rating: 4.3,
    ratingCount: 2345,
  },
  {
    name: 'Skipping Rope Professional',
    category: 'Sports',
    subCategory: 'Fitness',
    basePrice: 299,
    costPrice: 140,
    description: 'Steel wire jumping rope. Great for cardio.',
    images: ['https://placehold.co/400x400?text=Skipping+Rope'],
    quantity: 2000,
    deliveryDays: 1,
    rating: 4.2,
    ratingCount: 5234,
  },
  {
    name: 'Dumbbells Hex 5 kg (Pair)',
    category: 'Sports',
    subCategory: 'Fitness',
    basePrice: 1999,
    costPrice: 950,
    description: 'Hexagonal dumbbells, comfortable grip. Home gym essential.',
    images: ['https://placehold.co/400x400?text=Dumbbells'],
    quantity: 456,
    deliveryDays: 1,
    rating: 4.3,
    ratingCount: 1834,
  },
  {
    name: 'Badminton Racket Pair with Shuttle',
    category: 'Sports',
    subCategory: 'Badminton',
    basePrice: 1999,
    costPrice: 950,
    description: 'Professional badminton set with 10 shuttles included.',
    images: ['https://placehold.co/400x400?text=Badminton'],
    quantity: 345,
    deliveryDays: 1,
    rating: 4.2,
    ratingCount: 1234,
  },
  {
    name: 'Roller Skates Adult',
    category: 'Sports',
    subCategory: 'Outdoor Sports',
    basePrice: 3999,
    costPrice: 1900,
    description: 'Adjustable roller skates with helmet and pads. Safe & fun.',
    images: ['https://placehold.co/400x400?text=Roller+Skates'],
    quantity: 234,
    deliveryDays: 2,
    rating: 4.1,
    ratingCount: 834,
  },
];

// ==================== DEMO BUY REQUESTS ====================

const DEMO_BUY_REQUESTS = [
  {
    productName: 'Best Laptop under â‚¹1,00,000',
    description:
      'Looking for a powerful laptop for work and entertainment. Need good processor, at least 16GB RAM, SSD storage.',
    budgetMin: 50000,
    budgetMax: 100000,
    qualityScore: 8,
    preferredBrands: ['Dell', 'ASUS', 'Lenovo', 'HP'],
    deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    autoExecute: false,
  },
  {
    productName: 'Best iPhone under â‚¹1,00,000',
    description: 'Want latest iPhone with great camera. Budget conscious but need good quality.',
    budgetMin: 60000,
    budgetMax: 100000,
    qualityScore: 9,
    preferredBrands: ['Apple'],
    deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
    autoExecute: false,
  },
  {
    productName: 'Daily Grocery List',
    description:
      'Regular weekly groceries: rice, dal, vegetables, oil, spices. Need fresh items, reliable seller.',
    budgetMin: 500,
    budgetMax: 5000,
    qualityScore: 7,
    preferredBrands: [],
    deliveryDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day
    autoExecute: false,
  },
  {
    productName: 'Premium Smartwatch under â‚¹30,000',
    description:
      'Need smartwatch with good battery life, health tracking, and premium build. Water resistant preferred.',
    budgetMin: 10000,
    budgetMax: 30000,
    qualityScore: 8,
    preferredBrands: ['Apple', 'Samsung', 'Garmin'],
    deliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
    autoExecute: false,
  },
  {
    productName: 'Best Running Shoes',
    description:
      'Looking for comfortable running shoes. Need good cushioning and breathability. Size 9.',
    budgetMin: 3000,
    budgetMax: 10000,
    qualityScore: 7,
    preferredBrands: ['Nike', 'Adidas', 'Puma', 'Asics'],
    deliveryDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days
    autoExecute: false,
  },
];

// ==================== SELLER DATA ====================

const SELLER_NAMES = [
  'TechHub Store',
  'GroceryMart',
  'Fashion Forward',
  'Electronics Express',
  'Fresh Daily',
  'Style Avenue',
  'Budget Electronics',
  'Premium Groceries',
  'Fashion Hub',
  'Smart Electronics',
  'Organic Foods',
  'Trendy Clothes',
  'Electronics Paradise',
  'Quality Groceries',
  'Designer Fashion',
  'Tech World',
  'Super Stores',
  'Fashion Bazaar',
  'Mega Electronics',
  'Health Foods',
];

// ==================== HELPER FUNCTIONS ====================

function generateProductSku(): string {
  return `SKU${Date.now()}${Math.random().toString(36).substring(7)}`;
}

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateRandomRating(): number {
  return Math.round((Math.random() * 2 + 3) * 10) / 10; // 3.0 to 5.0
}

async function seedDatabase() {
  console.log('ðŸŒ± Starting database seed...');

  try {
    // Clear existing data
    console.log('ðŸ§¹ Clearing existing data...');
    await prisma.chatMessage.deleteMany({});
    await prisma.cartItem.deleteMany({});
    await prisma.cart.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.buyRequest.deleteMany({});
    await prisma.sellerProduct.deleteMany({});
    await prisma.seller.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.activityLog.deleteMany({});

    // ==================== CREATE DEMO USERS ====================
    console.log('ðŸ‘¥ Creating demo users...');
    const demoUsers = [];
    const userEmails = [
      'john@demo.com',
      'priya@demo.com',
      'amit@demo.com',
      'neha@demo.com',
      'rajesh@demo.com',
      'sarah@demo.com',
      'ananya@demo.com',
      'vikram@demo.com',
      'pooja@demo.com',
      'arjun@demo.com',
    ];

    for (const email of userEmails) {
      const user = await prisma.user.create({
        data: {
          email,
          name: email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1),
        },
      });
      demoUsers.push(user);
    }
    console.log(`âœ… Created ${demoUsers.length} demo users`);

    // ==================== CREATE SELLERS ====================
    console.log('ðŸª Creating sellers...');
    const sellers = [];
    for (let i = 0; i < SELLER_NAMES.length && i < 10; i++) {
      const seller = await prisma.seller.create({
        data: {
          userId: demoUsers[i].id,
          storeName: SELLER_NAMES[i],
          storeDescription: `Premium ${SELLER_NAMES[i]} - Trusted seller with 5000+ happy customers`,
          category: SEED_CONFIG.PRODUCT_CATEGORIES[i % SEED_CONFIG.PRODUCT_CATEGORIES.length],
          isVerified: true,
          isActive: true,
          vendorTier: i % 3 === 0 ? 'enterprise' : i % 2 === 0 ? 'premium' : 'standard',
          averageRating: 4.5 + Math.random() * 0.4,
          ratingCount: Math.floor(Math.random() * 10000 + 1000),
        },
      });
      sellers.push(seller);
    }
    console.log(`âœ… Created ${sellers.length} sellers`);

    // ==================== CREATE PRODUCTS FROM EACH CATEGORY ====================
    console.log('ðŸ“¦ Creating products...');
    let totalProducts = 0;

    // Electronics
    for (const productData of ELECTRONICS_PRODUCTS) {
      for (let sellerIdx = 0; sellerIdx < 3; sellerIdx++) {
        const seller = sellers[sellerIdx % sellers.length];
        const variation = Math.random() * 20 - 10; // Â±10% price variation
        const price = Math.round(productData.basePrice * (1 + variation / 100));

        await prisma.sellerProduct.create({
          data: {
            sellerId: seller.id,
            title: productData.name,
            description: productData.description,
            category: productData.category,
            subCategory: productData.subCategory,
            basePrice: productData.basePrice,
            currentPrice: price,
            costPrice: productData.costPrice,
            quantity: Math.floor(Math.random() * productData.quantity + 10),
            sku: generateProductSku(),
            images: productData.images,
            thumbnail: productData.images[0],
            views: Math.floor(Math.random() * 1000),
            clicks: Math.floor(Math.random() * 500),
            conversions: Math.floor(Math.random() * 100),
            demandScore: Math.random() * 100,
            listingScore: Math.random() * 100,
            status: 'active',
            publishedAt: new Date(),
          },
        });
        totalProducts++;
      }
    }

    // Groceries
    for (const productData of GROCERY_PRODUCTS) {
      for (let sellerIdx = 1; sellerIdx < 4; sellerIdx++) {
        const seller = sellers[sellerIdx % sellers.length];
        const variation = Math.random() * 15 - 7.5; // Â±7.5% price variation
        const price = Math.round(productData.basePrice * (1 + variation / 100));

        await prisma.sellerProduct.create({
          data: {
            sellerId: seller.id,
            title: productData.name,
            description: productData.description,
            category: productData.category,
            subCategory: productData.subCategory,
            basePrice: productData.basePrice,
            currentPrice: price,
            costPrice: productData.costPrice,
            quantity: Math.floor(Math.random() * productData.quantity + 50),
            sku: generateProductSku(),
            images: productData.images,
            thumbnail: productData.images[0],
            views: Math.floor(Math.random() * 5000),
            clicks: Math.floor(Math.random() * 2000),
            conversions: Math.floor(Math.random() * 500),
            demandScore: Math.random() * 100,
            listingScore: Math.random() * 100,
            status: 'active',
            publishedAt: new Date(),
          },
        });
        totalProducts++;
      }
    }

    // Fashion
    for (const productData of FASHION_PRODUCTS) {
      for (let sellerIdx = 2; sellerIdx < 5; sellerIdx++) {
        const seller = sellers[sellerIdx % sellers.length];
        const variation = Math.random() * 25 - 12.5; // Â±12.5% price variation
        const price = Math.round(productData.basePrice * (1 + variation / 100));

        await prisma.sellerProduct.create({
          data: {
            sellerId: seller.id,
            title: productData.name,
            description: productData.description,
            category: productData.category,
            subCategory: productData.subCategory,
            basePrice: productData.basePrice,
            currentPrice: price,
            costPrice: productData.costPrice,
            quantity: Math.floor(Math.random() * productData.quantity + 20),
            sku: generateProductSku(),
            images: productData.images,
            thumbnail: productData.images[0],
            views: Math.floor(Math.random() * 2000),
            clicks: Math.floor(Math.random() * 800),
            conversions: Math.floor(Math.random() * 150),
            demandScore: Math.random() * 100,
            listingScore: Math.random() * 100,
            status: 'active',
            publishedAt: new Date(),
          },
        });
        totalProducts++;
      }
    }

    // Home & Kitchen
    for (const productData of HOME_KITCHEN_PRODUCTS) {
      for (let sellerIdx = 3; sellerIdx < 6; sellerIdx++) {
        const seller = sellers[sellerIdx % sellers.length];
        const variation = Math.random() * 15 - 7.5; // Â±7.5% price variation
        const price = Math.round(productData.basePrice * (1 + variation / 100));

        await prisma.sellerProduct.create({
          data: {
            sellerId: seller.id,
            title: productData.name,
            description: productData.description,
            category: productData.category,
            subCategory: productData.subCategory,
            basePrice: productData.basePrice,
            currentPrice: price,
            costPrice: productData.costPrice,
            quantity: Math.floor(Math.random() * productData.quantity + 30),
            sku: generateProductSku(),
            images: productData.images,
            thumbnail: productData.images[0],
            views: Math.floor(Math.random() * 1500),
            clicks: Math.floor(Math.random() * 600),
            conversions: Math.floor(Math.random() * 100),
            demandScore: Math.random() * 100,
            listingScore: Math.random() * 100,
            status: 'active',
            publishedAt: new Date(),
          },
        });
        totalProducts++;
      }
    }

    // Sports
    for (const productData of SPORTS_PRODUCTS) {
      for (let sellerIdx = 4; sellerIdx < 7; sellerIdx++) {
        const seller = sellers[sellerIdx % sellers.length];
        const variation = Math.random() * 20 - 10; // Â±10% price variation
        const price = Math.round(productData.basePrice * (1 + variation / 100));

        await prisma.sellerProduct.create({
          data: {
            sellerId: seller.id,
            title: productData.name,
            description: productData.description,
            category: productData.category,
            subCategory: productData.subCategory,
            basePrice: productData.basePrice,
            currentPrice: price,
            costPrice: productData.costPrice,
            quantity: Math.floor(Math.random() * productData.quantity + 25),
            sku: generateProductSku(),
            images: productData.images,
            thumbnail: productData.images[0],
            views: Math.floor(Math.random() * 1200),
            clicks: Math.floor(Math.random() * 500),
            conversions: Math.floor(Math.random() * 80),
            demandScore: Math.random() * 100,
            listingScore: Math.random() * 100,
            status: 'active',
            publishedAt: new Date(),
          },
        });
        totalProducts++;
      }
    }

    console.log(`âœ… Created ${totalProducts} seller products`);

    // ==================== CREATE LEGACY PRODUCTS ====================
    // Generate 10,000 products for a rich catalog with proper pagination support
    console.log('ðŸ“¦ Creating 10,000 legacy products...');

    const CATALOG_TEMPLATES = [
      // Electronics
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
        baseNames: [
          'Pro Max',
          'Ultra',
          'Plus',
          'Lite',
          'Standard',
          'Pro',
          'X',
          'Neo',
          'Pro+',
          'Prime',
        ],
        basePrices: [14999, 24999, 34999, 44999, 54999, 69999, 89999, 109999, 129999, 139999],
      },
      {
        category: 'Electronics',
        subCategory: 'Laptops',
        brands: ['Dell', 'HP', 'Lenovo', 'Apple', 'ASUS', 'Acer', 'MSI', 'LG', 'Razer', 'Surface'],
        baseNames: [
          'Inspiron',
          'Pavilion',
          'IdeaPad',
          'MacBook',
          'VivoBook',
          'Aspire',
          'Stealth',
          'Gram',
          'Blade',
          'Pro',
        ],
        basePrices: [29999, 44999, 59999, 74999, 89999, 109999, 129999, 149999, 179999, 249999],
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
        baseNames: [
          'WH-X',
          'Airdopes',
          'Tune',
          'RS',
          'QC',
          'Buds Pro',
          'Elite',
          'Hesh',
          'M50x',
          'DT',
        ],
        basePrices: [999, 1999, 3999, 5999, 7999, 9999, 14999, 19999, 24999, 34999],
      },
      {
        category: 'Electronics',
        subCategory: 'Tablets',
        brands: [
          'Apple',
          'Samsung',
          'Lenovo',
          'Realme',
          'OnePlus',
          'Xiaomi',
          'Motorola',
          'TCL',
          'Amazon',
          'Nokia',
        ],
        baseNames: [
          'iPad',
          'Galaxy Tab',
          'Tab P',
          'Pad',
          'Pad Pro',
          'Pad 6',
          'Tab G',
          'Tab 10',
          'Fire',
          'T20',
        ],
        basePrices: [9999, 14999, 19999, 24999, 29999, 34999, 44999, 59999, 74999, 89999],
      },
      {
        category: 'Electronics',
        subCategory: 'Smart Watches',
        brands: [
          'Apple',
          'Samsung',
          'boAt',
          'Noise',
          'Amazfit',
          'Garmin',
          'Fossil',
          'Huawei',
          'Fitbit',
          'Oppo',
        ],
        baseNames: [
          'Watch Ultra',
          'Galaxy Watch',
          'Watch X',
          'Colorfit',
          'GTR',
          'Vivoactive',
          'Gen 6',
          'Band',
          'Sense',
          'Band Pro',
        ],
        basePrices: [1999, 2999, 4999, 7999, 9999, 12999, 17999, 24999, 34999, 49999],
      },
      {
        category: 'Electronics',
        subCategory: 'Cameras',
        brands: [
          'Canon',
          'Nikon',
          'Sony',
          'Fujifilm',
          'GoPro',
          'Panasonic',
          'Olympus',
          'Leica',
          'Hasselblad',
          'DJI',
        ],
        baseNames: ['EOS', 'D', 'Alpha', 'X-T', 'Hero', 'Lumix', 'OM-D', 'M11', 'X2D', 'Mavic'],
        basePrices: [24999, 39999, 54999, 74999, 29999, 44999, 59999, 149999, 499999, 89999],
      },
      {
        category: 'Electronics',
        subCategory: 'TVs',
        brands: ['Samsung', 'LG', 'Sony', 'Mi', 'OnePlus', 'TCL', 'Hisense', 'VU', 'Vu', 'BPL'],
        baseNames: [
          'Crystal UHD',
          'OLED C3',
          'Bravia',
          '4K Pro',
          'U1S',
          'P745',
          'U7',
          'Cinema Pro',
          'Premium',
          'Athena',
        ],
        basePrices: [14999, 24999, 34999, 44999, 54999, 74999, 89999, 109999, 129999, 179999],
      },
      {
        category: 'Electronics',
        subCategory: 'Air Conditioners',
        brands: [
          'Daikin',
          'Voltas',
          'Blue Star',
          'LG',
          'Samsung',
          'Carrier',
          'Panasonic',
          'Whirlpool',
          'Hitachi',
          'O General',
        ],
        baseNames: [
          '1.5 Ton 3 Star',
          '1.5 Ton 5 Star',
          '2 Ton 3 Star',
          '1 Ton Inverter',
          '1.5 Ton Inverter',
          '2 Ton Inverter',
          'Split 1 Ton',
          'Split 1.5 Ton',
          'Window 1 Ton',
          'Cassette 2 Ton',
        ],
        basePrices: [29999, 34999, 39999, 32999, 37999, 44999, 27999, 31999, 24999, 74999],
      },
      // Groceries
      {
        category: 'Groceries',
        subCategory: 'Rice & Dal',
        brands: [
          'India Gate',
          'Daawat',
          'Kohinoor',
          'Tata Sampann',
          'Fortune',
          'Aashirvaad',
          'Patanjali',
          'Organic India',
          'Natureland',
          'Urban Platter',
        ],
        baseNames: [
          'Basmati 5kg',
          'Basmati 1kg',
          'Brown Rice 1kg',
          'Toor Dal 1kg',
          'Chana Dal 1kg',
          'Moong Dal 500g',
          'Masoor Dal 1kg',
          'Rajma 1kg',
          'Kabuli Chana 1kg',
          'Quinoa 500g',
        ],
        basePrices: [249, 299, 179, 139, 149, 99, 129, 159, 169, 299],
      },
      {
        category: 'Groceries',
        subCategory: 'Snacks & Beverages',
        brands: [
          "Lay's",
          'Kurkure',
          "Haldiram's",
          'Bingo',
          'Pepsi',
          'Coca Cola',
          'Red Bull',
          'Tropicana',
          'Minute Maid',
          'Real',
        ],
        baseNames: [
          'Classic Salted',
          'Masala',
          'Bhujia',
          'Mad Angles',
          'Chilled 6-Pack',
          'Original 6-Pack',
          'Energy Drink',
          'Mixed Fruit Juice',
          'Orange Juice',
          'Pomegranate Juice',
        ],
        basePrices: [30, 20, 99, 40, 150, 120, 115, 85, 70, 75],
      },
      // Fashion
      {
        category: 'Fashion',
        subCategory: "Men's T-Shirts",
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
        baseNames: [
          'Classic Fit',
          'Slim Fit Polo',
          'Graphic Tee',
          'Henley',
          'Striped',
          'Solid Round Neck',
          'V-Neck',
          'Full Sleeve',
          'Casual Shirt',
          'Oxford Shirt',
        ],
        basePrices: [599, 799, 999, 1299, 1499, 1799, 2199, 2499, 2999, 3499],
      },
      {
        category: 'Fashion',
        subCategory: "Women's Ethnic",
        brands: [
          'Biba',
          'W',
          'Fabindia',
          'Libas',
          'Aurelia',
          'Sangria',
          'Jaipur Kurti',
          'Soch',
          'Vishudh',
          'Anouk',
        ],
        baseNames: [
          'Anarkali Kurta',
          'Straight Kurta',
          'Palazzo Set',
          'Salwar Suit',
          'Embroidered Saree',
          'Silk Saree',
          'Kurti Set',
          'Lehenga Choli',
          'Sharara Set',
          'Dhoti Kurta',
        ],
        basePrices: [799, 999, 1299, 1499, 1999, 2499, 2999, 3499, 3999, 4999],
      },
      {
        category: 'Fashion',
        subCategory: 'Footwear',
        brands: [
          'Nike',
          'Adidas',
          'Puma',
          'Reebok',
          'New Balance',
          'Skechers',
          'Bata',
          'Woodland',
          'Sparx',
          'Red Tape',
        ],
        baseNames: [
          'Running Shoes',
          'Training Shoes',
          'Casual Sneakers',
          'Sports Shoes',
          'Loafers',
          'Sandals',
          'Boots',
          'Formal Shoes',
          'Slip-ons',
          'Trail Shoes',
        ],
        basePrices: [1499, 1999, 2499, 2999, 3499, 3999, 4499, 4999, 5499, 5999],
      },
      // Home & Kitchen
      {
        category: 'Home & Kitchen',
        subCategory: 'Cookware',
        brands: [
          'Prestige',
          'Hawkins',
          'TTK',
          'Meyer',
          'Pigeon',
          'Wonderchef',
          'Vinod',
          'Butterfly',
          'Preethi',
          'Baltra',
        ],
        baseNames: [
          'Pressure Cooker 3L',
          'Pressure Cooker 5L',
          'Non-Stick Pan',
          'Kadai Set',
          'Tawa',
          'Sauce Pan',
          'Casserole',
          'Idli Maker',
          'Dosa Tawa',
          'Wok',
        ],
        basePrices: [699, 999, 799, 1299, 599, 499, 899, 699, 799, 1099],
      },
      {
        category: 'Home & Kitchen',
        subCategory: 'Kitchen Appliances',
        brands: [
          'Philips',
          'Bajaj',
          'Preethi',
          'Butterfly',
          'Pigeon',
          'Inalsa',
          'Usha',
          'Sujata',
          'Maharaja Whiteline',
          'Havells',
        ],
        baseNames: [
          'Mixer Grinder',
          'Juicer Mixer',
          'Blender',
          'Rice Cooker',
          'Electric Kettle',
          'OTG Oven',
          'Air Fryer',
          'Microwave',
          'Sandwich Maker',
          'Hand Blender',
        ],
        basePrices: [2499, 1999, 1499, 1799, 699, 3999, 4999, 7999, 1299, 1999],
      },
      {
        category: 'Home & Kitchen',
        subCategory: 'Furniture',
        brands: [
          'Nilkamal',
          'Godrej',
          'Pepperfry',
          'Urban Ladder',
          'IKEA',
          'Durian',
          'Zuari',
          'HomeTown',
          'Amazon Basics',
          'Evok',
        ],
        baseNames: [
          '3-Seater Sofa',
          'L-Shape Sofa',
          'Coffee Table',
          'Dining Table 4-Seater',
          'King Bed',
          'Queen Bed',
          'Wardrobe 3-Door',
          'Bookshelf',
          'Office Chair',
          'Study Table',
        ],
        basePrices: [9999, 24999, 6999, 14999, 19999, 14999, 16999, 5999, 8999, 7999],
      },
      // Sports
      {
        category: 'Sports',
        subCategory: 'Cricket Equipment',
        brands: [
          'SG',
          'SS',
          'MRF',
          'Kookaburra',
          'Gray-Nicolls',
          'GM',
          'Adidas',
          'Nike',
          'Puma',
          'Reebok',
        ],
        baseNames: [
          'Cricket Bat English Willow',
          'Cricket Bat Kashmir Willow',
          'Cricket Ball',
          'Cricket Gloves',
          'Cricket Helmet',
          'Batting Pads',
          'Wicket Keeping Gloves',
          'Cricket Shoes',
          'Cricket Bag',
          'Cricket Kit',
        ],
        basePrices: [2499, 999, 499, 1499, 2999, 1999, 2499, 2999, 3499, 7999],
      },
      {
        category: 'Sports',
        subCategory: 'Fitness Equipment',
        brands: [
          'Powermax',
          'Kore',
          'Cockatoo',
          'Welcare',
          'Viva Fitness',
          'Reach',
          'Lifeline',
          'Body Maxx',
          'Gold Gym',
          'Kamachi',
        ],
        baseNames: [
          'Adjustable Dumbbell Set',
          'Resistance Bands Set',
          'Yoga Mat 6mm',
          'Exercise Cycle',
          'Treadmill',
          'Pull-Up Bar',
          'Kettlebell Set',
          'Foam Roller',
          'Weight Plates',
          'Barbell Rod',
        ],
        basePrices: [2999, 699, 599, 7999, 24999, 999, 3999, 1299, 3499, 1999],
      },
      // Books
      {
        category: 'Books',
        subCategory: 'Self Help',
        brands: [
          'Penguin',
          'HarperCollins',
          'Random House',
          'Westland',
          'Rupa',
          'Jaico',
          'Simon & Schuster',
          'Disha',
          'Arihant',
          'S Chand',
        ],
        baseNames: [
          'Atomic Habits',
          'The Power of Habit',
          'Rich Dad Poor Dad',
          'Think and Grow Rich',
          'The Alchemist',
          'Psychology of Money',
          'Deep Work',
          'Ikigai',
          "Can't Hurt Me",
          'The Subtle Art',
        ],
        basePrices: [199, 249, 299, 199, 175, 299, 499, 299, 399, 249],
      },
      {
        category: 'Books',
        subCategory: 'Engineering & Competitive',
        brands: [
          'Arihant',
          'Disha',
          'MTG',
          'Cengage',
          'DC Pandey',
          'HC Verma',
          'RD Sharma',
          'RS Aggarwal',
          'PW',
          'Allen',
        ],
        baseNames: [
          'JEE Advanced',
          'NEET Guide',
          'Gate ECE',
          'CAT Quant',
          'SSC CGL',
          'RRB NTPC',
          'UPSC General Studies',
          'IBPS PO',
          'Class 12 Physics',
          'Class 12 Maths',
        ],
        basePrices: [299, 349, 399, 449, 199, 249, 549, 299, 249, 299],
      },
    ];

    const allProductData = [
      ...ELECTRONICS_PRODUCTS,
      ...GROCERY_PRODUCTS,
      ...FASHION_PRODUCTS,
      ...HOME_KITCHEN_PRODUCTS,
      ...SPORTS_PRODUCTS,
    ];

    // First insert the hand-crafted products
    let legacyCount = 0;
    for (let i = 0; i < Math.min(200, allProductData.length); i++) {
      const pd = allProductData[i];
      await prisma.product.create({
        data: {
          name: pd.name,
          price: pd.basePrice,
          category: pd.category,
          description: pd.description,
          imageUrl: pd.images[0],
        },
      });
      legacyCount++;
    }

    // Generate remaining products to reach 10,000 using templates
    const remaining = SEED_CONFIG.TARGET_LEGACY_PRODUCTS - legacyCount;
    const batchSize = 100;
    let generated = 0;
    const templateCount = CATALOG_TEMPLATES.length;

    for (let tIdx = 0; generated < remaining; tIdx++) {
      const tmpl = CATALOG_TEMPLATES[tIdx % templateCount];
      const brandIdx = Math.floor(generated / tmpl.baseNames.length) % tmpl.brands.length;
      const nameIdx = generated % tmpl.baseNames.length;
      const priceVariant = Math.round(
        tmpl.basePrices[nameIdx % tmpl.basePrices.length] * (0.8 + (generated % 5) * 0.1)
      );
      const variant = Math.floor(generated / (tmpl.brands.length * tmpl.baseNames.length)) + 1;
      const productName =
        `${tmpl.brands[brandIdx]} ${tmpl.baseNames[nameIdx]} ${variant > 1 ? `v${variant}` : ''}`.trim();
      const rating = Math.round((3.5 + Math.random() * 1.4) * 10) / 10;
      const reviewCount = Math.floor(100 + Math.random() * 9900);

      await prisma.product.create({
        data: {
          name: productName,
          price: priceVariant,
          category: tmpl.category,
          description: `${productName} â€” ${tmpl.subCategory}. Rating: ${rating}/5. Free delivery on orders above â‚¹499. COD available.`,
          imageUrl: `https://placehold.co/400x400?text=${encodeURIComponent(tmpl.brands[brandIdx])}`,
        },
      });

      generated++;
      if (generated % batchSize === 0) {
        console.log(
          `  ðŸ“¦ Generated ${legacyCount + generated}/${SEED_CONFIG.TARGET_LEGACY_PRODUCTS} products...`
        );
      }
    }

    legacyCount += generated;
    console.log(`âœ… Created ${legacyCount} legacy products`);

    // ==================== CREATE DEMO BUY REQUESTS ====================
    console.log('ðŸ’¡ Creating demo buy requests...');
    for (let i = 0; i < DEMO_BUY_REQUESTS.length; i++) {
      const buyReqData = DEMO_BUY_REQUESTS[i];
      await prisma.buyRequest.create({
        data: {
          userId: demoUsers[i].id,
          productName: buyReqData.productName,
          description: buyReqData.description,
          budgetMin: buyReqData.budgetMin,
          budgetMax: buyReqData.budgetMax,
          qualityScore: buyReqData.qualityScore,
          preferredBrands: buyReqData.preferredBrands,
          deliveryDate: buyReqData.deliveryDate,
          autoExecute: buyReqData.autoExecute,
          status: 'pending',
        },
      });
    }
    console.log(`âœ… Created ${DEMO_BUY_REQUESTS.length} demo buy requests`);

    // ==================== CREATE SAMPLE ACTIVITY LOGS ====================
    console.log('ðŸ“Š Creating activity logs...');
    const activities = ['product_view', 'add_to_cart', 'purchase', 'chat_interaction'];
    for (let i = 0; i < 100; i++) {
      await prisma.activityLog.create({
        data: {
          userId: demoUsers[Math.floor(Math.random() * demoUsers.length)].id,
          action: getRandomItem(activities),
          metadata: {
            productId: Math.floor(Math.random() * totalProducts + 1),
            timestamp: new Date(),
          },
        },
      });
    }
    console.log('âœ… Created activity logs');

    // ==================== CREATE SAMPLE CARTS ====================
    console.log('ðŸ›’ Creating sample carts...');
    for (let i = 0; i < 5; i++) {
      const cart = await prisma.cart.create({
        data: {
          userId: demoUsers[i].id,
        },
      });

      // Add 2-4 items to each cart
      const itemCount = Math.floor(Math.random() * 3 + 2);
      for (let j = 0; j < itemCount; j++) {
        const cartItem = await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productId: (j % 10) + 1, // Use some of the created products
            quantity: Math.floor(Math.random() * 3 + 1),
          },
        });
      }
    }
    console.log('âœ… Created sample carts');

    console.log('\nâœ¨ âœ¨ âœ¨ Database seed completed successfully! âœ¨ âœ¨ âœ¨');
    console.log(`
    ðŸ“Š Summary:
    âœ… Demo Users: ${demoUsers.length}
    âœ… Sellers: ${sellers.length}
    âœ… Seller Products: ${totalProducts}
    âœ… Buy Requests: ${DEMO_BUY_REQUESTS.length}
    âœ… Activity Logs: 100
    âœ… Sample Carts: 5

    ðŸŽ¯ Demo Accounts (all with password 'demo'):
    ${userEmails.map((e) => `   - ${e}`).join('\n')}

    ðŸ›ï¸ Ready to explore the demo!
    `);
  } catch (error) {
    console.error('âŒ Seed error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

seedDatabase().catch((error) => {
  console.error(error);
  process.exit(1);
});

