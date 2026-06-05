/**
 * PHASE 2 & 3: Data Normalization + Cleaning
 * Maps heterogeneous external fields → DelegateCart internal schema.
 */

import type { RawProduct, NormalizedProduct } from './types';

// ─── Category Normalization Map ────────────────────────────────────────────────
const CATEGORY_MAP: Record<string, string> = {
  // Electronics
  electronics: 'Electronics',
  'computers&accessories': 'Electronics',
  computers: 'Electronics',
  laptops: 'Electronics',
  mobiles: 'Electronics',
  phones: 'Electronics',
  smartphones: 'Electronics',
  'mobile phones': 'Electronics',
  cameras: 'Electronics',
  'tv&home theatre': 'Electronics',
  'home theatre': 'Electronics',
  televisions: 'Electronics',
  headphones: 'Electronics',
  audio: 'Electronics',
  wearables: 'Electronics',
  smartwatches: 'Electronics',
  tablets: 'Electronics',
  // Fashion
  clothing: 'Fashion',
  fashion: 'Fashion',
  apparel: 'Fashion',
  shoes: 'Fashion',
  footwear: 'Fashion',
  "men's clothing": 'Fashion',
  "women's clothing": 'Fashion',
  'kids clothing': 'Fashion',
  accessories: 'Fashion',
  jewellery: 'Fashion',
  bags: 'Fashion',
  // Groceries
  grocery: 'Groceries',
  groceries: 'Groceries',
  food: 'Groceries',
  'food & beverage': 'Groceries',
  staples: 'Groceries',
  snacks: 'Groceries',
  beverages: 'Groceries',
  'health & beauty': 'Groceries',
  'personal care': 'Groceries',
  // Home & Kitchen
  home: 'Home & Kitchen',
  'home & kitchen': 'Home & Kitchen',
  kitchen: 'Home & Kitchen',
  furniture: 'Home & Kitchen',
  'home decor': 'Home & Kitchen',
  appliances: 'Home & Kitchen',
  cookware: 'Home & Kitchen',
  // Sports
  sports: 'Sports',
  'sports & outdoors': 'Sports',
  fitness: 'Sports',
  outdoor: 'Sports',
  // Books
  books: 'Books',
  'books & music': 'Books',
};

function normalizeCategory(raw: string | undefined): string {
  if (!raw) return 'Electronics';
  const key = raw
    .toLowerCase()
    .replace(/[^a-z0-9&'\s]/g, '')
    .trim();
  return CATEGORY_MAP[key] ?? 'Electronics';
}

// ─── Price Normalization ────────────────────────────────────────────────────────
// Handles: "₹1,299", "1299.00", "Rs. 999", "$49.99", "1,299"
function normalizePrice(raw: string | number | undefined): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const str = String(raw)
    .replace(/[₹$£€Rs.\s,]/g, '') // strip currency symbols & commas
    .replace(/[^\d.]/g, '');
  const n = parseFloat(str);
  if (isNaN(n) || n <= 0 || n > 10_000_000) return null;
  return Math.round(n);
}

// ─── Image Normalization ────────────────────────────────────────────────────────
const UNSPLASH_CATEGORY_PHOTOS: Record<string, string[]> = {
  Electronics: [
    'photo-1510557880182-3d4d3cba35a5',
    'photo-1498049794561-7780e7231661',
    'photo-1517336714731-489689fd1ca8',
    'photo-1505740420928-5e560c06d30e',
  ],
  Fashion: [
    'photo-1523275335684-37898b6baf30',
    'photo-1529374255404-311a2a4f1fd9',
    'photo-1542291026-7eec264c27ff',
    'photo-1595950653106-6c9ebd614d3a',
  ],
  Groceries: [
    'photo-1506617420156-8e4536971650',
    'photo-1543168256-418811576931',
    'photo-1466637574441-749b8f19452f',
    'photo-1452195100486-9cc805987862',
  ],
  'Home & Kitchen': [
    'photo-1556909114-f6e7ad7d3136',
    'photo-1484154218962-a197022b5858',
    'photo-1555041469-a586c61ea9bc',
    'photo-1484101403633-562f891dc89a',
  ],
  Sports: [
    'photo-1517649763962-0c623066013b',
    'photo-1571019613454-1cb2f99b2d8b',
    'photo-1535131749006-b7f58c99034b',
    'photo-1518611012118-696072aa579a',
  ],
  Books: [
    'photo-1512820790803-83ca734da794',
    'photo-1544947950-fa07a98d237f',
    'photo-1497633762265-9d179a990aa6',
    'photo-1524995997946-a1c2e315a42f',
  ],
};

function resolveImage(
  raw: string | undefined,
  category: string,
  index: number,
  strategy: 'use_source' | 'unsplash_fallback' | 'force_unsplash'
): string {
  if (strategy !== 'force_unsplash' && raw && raw.startsWith('http')) {
    return raw;
  }
  // Fallback to Unsplash
  const photos = UNSPLASH_CATEGORY_PHOTOS[category] ?? UNSPLASH_CATEGORY_PHOTOS.Electronics;
  const photoId = photos[index % photos.length];
  return `https://images.unsplash.com/${photoId}?w=600&h=600&q=85&auto=format&fit=crop&sig=${index}`;
}

// ─── PHASE 4: Attribute Extraction ─────────────────────────────────────────────
// Extracts structured specs from a free-text description
export function extractSpecifications(description: string): Record<string, string> {
  const specs: Record<string, string> = {};
  if (!description) return specs;

  const patterns: [RegExp, string][] = [
    [/(\d+)\s*GB\s*RAM/i, 'RAM'],
    [/(\d+)\s*GB\s*(?:storage|rom|internal)/i, 'Storage'],
    [/(\d+)\s*TB\s*(?:storage|ssd|hdd)/i, 'Storage_TB'],
    [/(\d+)\s*mAh/i, 'Battery'],
    [/(\d+\.?\d*)\s*inch(?:es)?/i, 'Display'],
    [/(\d+)\s*MP\s*(?:camera|rear|front)/i, 'Camera'],
    [/(\d+)\s*W\s*(?:fast\s*charge|charging|power)/i, 'Charging'],
    [/(\d+)\s*Hz\s*(?:refresh|display)/i, 'RefreshRate'],
    [/5G/i, '5G'],
    [/4G\s*LTE/i, '4G_LTE'],
    [/(\d+)\s*core/i, 'Processor_Cores'],
    [/(Android|iOS|Windows|macOS)\s*(\d+\.?\d*)?/i, 'OS'],
    [/(?:ISI|CE|BIS|FCC)\s*[Cc]ertified/i, 'Certification'],
    [/(\d+)\s*L(?:itre|iter)/i, 'Capacity_L'],
    [/(\d+)\s*(?:kg|Kg|KG)/i, 'Weight_KG'],
    [/(\d+\s*x\s*\d+)\s*(?:cm|mm|px)/i, 'Dimensions'],
  ];

  for (const [regex, key] of patterns) {
    const m = description.match(regex);
    if (m) {
      specs[key] = m[1] ?? m[0];
    }
  }
  return specs;
}

// ─── Brand Extraction ───────────────────────────────────────────────────────────
const KNOWN_BRANDS = [
  'Samsung',
  'Apple',
  'OnePlus',
  'Xiaomi',
  'Realme',
  'Vivo',
  'Oppo',
  'iQOO',
  'Nothing',
  'Motorola',
  'Nokia',
  'Sony',
  'LG',
  'Panasonic',
  'Philips',
  'Bosch',
  'Nike',
  'Adidas',
  'Puma',
  'Reebok',
  'Under Armour',
  'Decathlon',
  'Prestige',
  'Pigeon',
  'Havells',
  'Bajaj',
  'Crompton',
  'Voltas',
  'Daikin',
  'Tata',
  'Haldirams',
  'Britannia',
  'Parle',
  'Nestle',
  'Amul',
  'ITC',
  'Penguin',
  'Oxford',
  'Scholastic',
  'Pearson',
  'McGraw-Hill',
];

function extractBrand(product: RawProduct): string {
  // If explicit brand field present
  if (product.brand && product.brand.trim().length > 1) return product.brand.trim();
  if (product.manufacturer && product.manufacturer.trim().length > 1)
    return product.manufacturer.trim();

  // Try to extract from product name
  const name = String(product.product_name || product.name || product.title || '');
  for (const brand of KNOWN_BRANDS) {
    if (name.toLowerCase().includes(brand.toLowerCase())) return brand;
  }
  // Fall back to first word of name
  return name.split(' ')[0] ?? 'Unknown';
}

// ─── Main Normalizer ────────────────────────────────────────────────────────────
export function normalizeProduct(
  raw: RawProduct,
  index: number,
  imageStrategy: 'use_source' | 'unsplash_fallback' | 'force_unsplash' = 'unsplash_fallback'
): NormalizedProduct | null {
  // ── Name ──────────────────────────────────────────────────────────
  const name = (raw.product_name || raw.name || raw.title || '').trim().replace(/\s+/g, ' ');
  if (!name || name.length < 3 || name.length > 300) return null;

  // ── Category ──────────────────────────────────────────────────────
  const categoryRaw = raw.category || raw.sub_category || raw.subcategory || '';
  const category = normalizeCategory(categoryRaw);
  const subcategory = raw.sub_category || raw.subcategory || null;

  // ── Price ─────────────────────────────────────────────────────────
  const priceRaw =
    raw.discounted_price ?? raw.selling_price ?? raw.price ?? raw.actual_price ?? raw.retail_price;
  const originalRaw = raw.actual_price ?? raw.retail_price ?? priceRaw;

  const price = normalizePrice(priceRaw);
  const originalPrice = normalizePrice(originalRaw);
  if (!price || price < 1) return null; // reject zero/null price

  // ── Image ─────────────────────────────────────────────────────────
  const imageRaw = raw.image_url || raw.img_link || raw.image || undefined;
  const image = resolveImage(imageRaw, category, index, imageStrategy);

  // ── Description ───────────────────────────────────────────────────
  const description = (raw.description || raw.about_product || raw.specifications || '')
    .trim()
    .slice(0, 2000);

  // ── Brand ─────────────────────────────────────────────────────────
  const brand = extractBrand(raw);

  // ── Rating ────────────────────────────────────────────────────────
  const ratingRaw = parseFloat(String(raw.rating ?? '3.5'));
  const rating = isNaN(ratingRaw) || ratingRaw < 0 || ratingRaw > 5 ? 3.5 : ratingRaw;

  const reviewCountRaw = parseInt(
    String(raw.rating_count ?? raw.no_of_ratings ?? '0').replace(/,/g, '')
  );
  const reviewCount = isNaN(reviewCountRaw) || reviewCountRaw < 0 ? 0 : reviewCountRaw;

  // ── Specifications ────────────────────────────────────────────────
  const specifications = extractSpecifications(description);

  // ── SKU ───────────────────────────────────────────────────────────
  const sourceId = String(raw.asin || raw.product_id || '');
  const sku = sourceId ? `EXT-${sourceId}` : `SKU-${String(index + 1).padStart(8, '0')}`;

  return {
    name,
    category,
    subcategory: subcategory?.trim() || null,
    price,
    originalPrice: originalPrice ?? price,
    image,
    description,
    brand,
    rating,
    reviewCount,
    inStock: true,
    sku,
    specifications,
    source: 'kaggle',
    sourceId: sourceId || null,
  };
}
