/**
 * Product Image Service
 *
 * Maps products to brand/category-specific images from reliable internet sources.
 * Uses picsum.photos, unsplash, and static brand logos for consistent, fast-loading images.
 *
 * Strategy: Use deterministic URL generation so the same product always gets the same image.
 * Fallback chain: Brand-specific → Category-specific → Generic product image
 */

// ── Brand Logo / Product Image Mappings ────────────────────────────────────

// These are curated, reliable image URLs for real brand products
const BRAND_PRODUCT_IMAGES: Record<string, string[]> = {
  // Smartphones
  samsung: [
    'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1585060544812-6b45742d762f?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=400&q=80&auto=format&fit=crop',
  ],
  apple: [
    'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1591337676887-a217a6c8c80d?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=400&q=80&auto=format&fit=crop',
  ],
  oneplus: [
    'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=400&q=80&auto=format&fit=crop',
  ],
  google: [
    'https://images.unsplash.com/photo-1598532213919-078e54dd1f40?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1605236453806-6ff36851218e?w=400&q=80&auto=format&fit=crop',
  ],
  // Laptops
  dell: [
    'https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=400&q=80&auto=format&fit=crop',
  ],
  hp: [
    'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=400&q=80&auto=format&fit=crop',
  ],
  lenovo: [
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=400&q=80&auto=format&fit=crop',
  ],
  asus: [
    'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1587614382346-4ec70e388b28?w=400&q=80&auto=format&fit=crop',
  ],
  // Headphones & Audio
  sony: [
    'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=400&q=80&auto=format&fit=crop',
  ],
  bose: [
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=400&q=80&auto=format&fit=crop',
  ],
  jbl: [
    'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?w=400&q=80&auto=format&fit=crop',
  ],
  // Watches & Wearables
  boat: [
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1557438159-51eec7a6c9e8?w=400&q=80&auto=format&fit=crop',
  ],
  noise: [
    'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=400&q=80&auto=format&fit=crop',
  ],
  fitbit: [
    'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1510017803434-a899398421b3?w=400&q=80&auto=format&fit=crop',
  ],
  // Kitchen / Home Appliances
  lg: [
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=400&q=80&auto=format&fit=crop',
  ],
  whirlpool: [
    'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&q=80&auto=format&fit=crop',
  ],
  philips: [
    'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&q=80&auto=format&fit=crop',
  ],
  dyson: [
    'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&q=80&auto=format&fit=crop',
  ],
  // Fashion / Clothing
  nike: [
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400&q=80&auto=format&fit=crop',
  ],
  adidas: [
    'https://images.unsplash.com/photo-1518002171953-a080ee817e1f?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1588361861040-ac9b1018f6d5?w=400&q=80&auto=format&fit=crop',
  ],
  puma: [
    'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=400&q=80&auto=format&fit=crop',
  ],
  // Cameras
  canon: [
    'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&q=80&auto=format&fit=crop',
  ],
  nikon: [
    'https://images.unsplash.com/photo-1495707902641-75cac588d2e9?w=400&q=80&auto=format&fit=crop',
  ],
  gopro: [
    'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&q=80&auto=format&fit=crop',
  ],
};

// Generic category images for when brand isn't matched
const CATEGORY_IMAGES: Record<string, string[]> = {
  smartphone: [
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1556656793-08538906a9f8?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1580910051074-3eb694886571?w=400&q=80&auto=format&fit=crop',
  ],
  laptop: [
    'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1484788984921-03950022c9ef?w=400&q=80&auto=format&fit=crop',
  ],
  headphone: [
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1487215078519-e21cc028cb29?w=400&q=80&auto=format&fit=crop',
  ],
  earphone: [
    'https://images.unsplash.com/photo-1590658268037-6bf12f032f55?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=400&q=80&auto=format&fit=crop',
  ],
  watch: [
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=400&q=80&auto=format&fit=crop',
  ],
  tablet: [
    'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1561154464-82e9aab73ab2?w=400&q=80&auto=format&fit=crop',
  ],
  camera: [
    'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=400&q=80&auto=format&fit=crop',
  ],
  tv: [
    'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1567690187548-f07b1d7bf5a9?w=400&q=80&auto=format&fit=crop',
  ],
  shoe: [
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&q=80&auto=format&fit=crop',
  ],
  clothing: [
    'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=400&q=80&auto=format&fit=crop',
  ],
  kitchen: [
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=400&q=80&auto=format&fit=crop',
  ],
  furniture: [
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80&auto=format&fit=crop',
  ],
  beauty: [
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=400&q=80&auto=format&fit=crop',
  ],
  book: [
    'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80&auto=format&fit=crop',
  ],
  toy: [
    'https://images.unsplash.com/photo-1530325553241-4f6e7690cf36?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=400&q=80&auto=format&fit=crop',
  ],
  speaker: [
    'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=400&q=80&auto=format&fit=crop',
  ],
  gaming: [
    'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=400&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=400&q=80&auto=format&fit=crop',
  ],
};

const GENERIC_IMAGES = [
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=400&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=400&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1503602642458-232111445657?w=400&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=400&q=80&auto=format&fit=crop',
];

// ── Core Functions ────────────────────────────────────────────────────────────

/**
 * Deterministic hash for consistent image selection
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Detect category from product name
 */
function detectCategory(name: string): string | null {
  const n = name.toLowerCase();
  const KEYWORDS: Record<string, string[]> = {
    smartphone: ['phone', 'smartphone', 'mobile', 'iphone', 'galaxy', 'pixel', 'redmi', 'poco'],
    laptop: ['laptop', 'notebook', 'macbook', 'chromebook', 'thinkpad', 'ideapad'],
    headphone: ['headphone', 'headset', 'earbuds', 'airpods', 'buds', 'wh-1000', 'quietcomfort'],
    earphone: ['earphone', 'ear phone', 'in-ear'],
    watch: ['watch', 'smartwatch', 'band', 'fitband', 'fitness tracker'],
    tablet: ['tablet', 'ipad', 'tab s', 'fire hd'],
    camera: ['camera', 'dslr', 'mirrorless', 'gopro', 'webcam'],
    tv: ['television', ' tv ', 'smart tv', 'led tv', 'oled', 'monitor', 'display'],
    shoe: ['shoe', 'sneaker', 'running shoe', 'sports shoe', 'boot', 'sandal'],
    clothing: ['shirt', 't-shirt', 'jeans', 'jacket', 'dress', 'trouser', 'kurta'],
    kitchen: [
      'mixer',
      'grinder',
      'blender',
      'microwave',
      'oven',
      'cooker',
      'toaster',
      'juicer',
      'kettle',
    ],
    furniture: ['sofa', 'chair', 'desk', 'table', 'bed', 'mattress', 'shelf', 'cabinet'],
    beauty: ['perfume', 'cosmetic', 'skincare', 'serum', 'moisturizer', 'lipstick', 'foundation'],
    book: ['book', 'novel', 'textbook', 'kindle'],
    speaker: ['speaker', 'soundbar', 'subwoofer', 'bluetooth speaker'],
    gaming: ['playstation', 'xbox', 'nintendo', 'controller', 'gaming mouse', 'gaming keyboard'],
    toy: ['toy', 'lego', 'puzzle', 'doll', 'action figure'],
  };

  for (const [cat, keywords] of Object.entries(KEYWORDS)) {
    if (keywords.some((kw) => n.includes(kw))) return cat;
  }
  return null;
}

/**
 * Get the best product image URL based on brand and product name.
 * Uses deterministic selection so the same product always gets the same image.
 */
export function getProductImage(
  productName: string,
  brand?: string,
  productId?: string | number
): string {
  const hash = simpleHash(productId ? String(productId) : productName);

  // 1. Try brand-specific images
  if (brand) {
    const brandKey = brand.toLowerCase().trim();
    const brandImages = BRAND_PRODUCT_IMAGES[brandKey];
    if (brandImages?.length) {
      return brandImages[hash % brandImages.length];
    }
  }

  // 2. Try to detect brand from product name
  const nameLC = productName.toLowerCase();
  for (const [brandKey, images] of Object.entries(BRAND_PRODUCT_IMAGES)) {
    if (nameLC.includes(brandKey)) {
      return images[hash % images.length];
    }
  }

  // 3. Try category-specific images
  const category = detectCategory(productName);
  if (category && CATEGORY_IMAGES[category]?.length) {
    const catImages = CATEGORY_IMAGES[category];
    return catImages[hash % catImages.length];
  }

  // 4. Fallback to generic
  return GENERIC_IMAGES[hash % GENERIC_IMAGES.length];
}

/**
 * Get a unique product image that minimizes duplicates within a list
 */
export function getUniqueProductImages(
  products: Array<{ name: string; brand?: string; id?: string | number }>
): string[] {
  const usedUrls = new Set<string>();
  return products.map((p, idx) => {
    let url = getProductImage(p.name, p.brand, p.id);

    // If URL already used, try variations
    if (usedUrls.has(url)) {
      const hash = simpleHash(`${p.id || p.name}_${idx}`);
      const category = detectCategory(p.name);
      const categoryImages = category ? CATEGORY_IMAGES[category] : GENERIC_IMAGES;
      const pool = categoryImages || GENERIC_IMAGES;
      url = pool[hash % pool.length];

      // If still duplicate, use a picsum deterministic URL
      if (usedUrls.has(url)) {
        const seed = simpleHash(`${p.name}_unique_${idx}`);
        url = `https://picsum.photos/seed/${seed}/400/400`;
      }
    }

    usedUrls.add(url);
    return url;
  });
}
