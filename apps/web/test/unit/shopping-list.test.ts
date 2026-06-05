/**
 * Unit Tests — Shopping List & AI Questions Logic
 * Tests the shopping list API validation, product matching,
 * dynamic category-aware question generation, and profile settings.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Shopping List Item Types (mirrors API) ──────────────────────────────────

interface ShoppingListItemInput {
  productName: string;
  preferredBrand: string | null;
  budget: number | null;
  quantity: number;
  deliveryDays: number | null;
  paymentMethod: string | null;
  emiOnly: boolean;
}

// ── Validation (mirrors API route) ──────────────────────────────────────────

function validateItem(item: unknown): item is ShoppingListItemInput {
  if (!item || typeof item !== 'object') return false;
  const i = item as Record<string, unknown>;
  if (typeof i.productName !== 'string' || !i.productName.trim()) return false;
  if (!/^[a-zA-Z0-9 ]+$/.test(i.productName.trim())) return false;
  if (i.preferredBrand !== null && typeof i.preferredBrand !== 'string') return false;
  if (i.preferredBrand && !/^[a-zA-Z0-9 ]*$/.test(i.preferredBrand as string)) return false;
  if (i.budget !== null && (typeof i.budget !== 'number' || i.budget < 0)) return false;
  if (typeof i.quantity !== 'number' || i.quantity < 1) return false;
  if (i.deliveryDays !== null && (typeof i.deliveryDays !== 'number' || i.deliveryDays < 0))
    return false;
  return true;
}

// ── Category Detection (mirrors analyze/route.ts) ───────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  washing_machine: ['washing', 'washer', 'laundry'],
  refrigerator: ['fridge', 'refrigerator', 'freezer'],
  audio: ['headphone', 'earphone', 'speaker', 'earbuds', 'headset', 'airpods'],
  phone: ['phone', 'mobile', 'smartphone', 'iphone'],
  laptop: ['laptop', 'notebook', 'macbook', 'chromebook'],
  tv: ['tv', 'television', 'oled', 'qled'],
  ac: ['ac', 'air conditioner', 'air conditioning', 'cooler'],
};

function detectCategory(name: string): string {
  const lower = name.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return cat;
  }
  return 'generic';
}

// ── Budget/Brand Parsing (mirrors answer-question/route.ts) ──────────────────

function parseBudgetAnswer(answer: string): { min: number; max: number } | null {
  if (answer.startsWith('custom_')) {
    const val = parseInt(answer.replace('custom_', ''));
    if (!isNaN(val) && val > 0) return { min: 0, max: Math.round(val * 1.2) };
    return null;
  }
  return null;
}

function parseBrandAnswer(answer: string): string | null {
  if (answer.startsWith('custom_')) {
    const brand = answer.replace('custom_', '').trim();
    return brand || null;
  }
  return answer;
}

// ── Profile Settings (mirrors profile/page.tsx localStorage) ─────────────────

function getAutoCheckoutSettings(storage: Storage): { enabled: boolean; threshold: number } {
  const enabled = storage.getItem('autoPurchaseEnabled') === 'true';
  const threshold = parseInt(storage.getItem('autoPurchaseThreshold') || '10000');
  return { enabled, threshold: isNaN(threshold) ? 10000 : threshold };
}

function getWhatsAppNumber(storage: Storage): string | null {
  return storage.getItem('whatsappNumber') || null;
}

// ══════════════════════════════════════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe('Shopping List Validation', () => {
  it('accepts a valid complete item', () => {
    const item = {
      productName: 'Washing Machine',
      preferredBrand: 'Samsung',
      budget: 25000,
      quantity: 1,
      deliveryDays: 5,
      paymentMethod: 'upi',
      emiOnly: false,
    };
    expect(validateItem(item)).toBe(true);
  });

  it('accepts item with optional fields as null', () => {
    const item = {
      productName: 'Laptop',
      preferredBrand: null,
      budget: null,
      quantity: 2,
      deliveryDays: null,
      paymentMethod: null,
      emiOnly: false,
    };
    expect(validateItem(item)).toBe(true);
  });

  it('rejects empty product name', () => {
    const item = {
      productName: '',
      preferredBrand: null,
      budget: null,
      quantity: 1,
      deliveryDays: null,
      paymentMethod: null,
      emiOnly: false,
    };
    expect(validateItem(item)).toBe(false);
  });

  it('rejects product name with special characters', () => {
    const item = {
      productName: 'Washing Machine <script>',
      preferredBrand: null,
      budget: null,
      quantity: 1,
      deliveryDays: null,
      paymentMethod: null,
      emiOnly: false,
    };
    expect(validateItem(item)).toBe(false);
  });

  it('rejects brand name with special characters', () => {
    const item = {
      productName: 'Phone',
      preferredBrand: 'Sam$ung!',
      budget: null,
      quantity: 1,
      deliveryDays: null,
      paymentMethod: null,
      emiOnly: false,
    };
    expect(validateItem(item)).toBe(false);
  });

  it('rejects negative budget', () => {
    const item = {
      productName: 'TV',
      preferredBrand: null,
      budget: -5000,
      quantity: 1,
      deliveryDays: null,
      paymentMethod: null,
      emiOnly: false,
    };
    expect(validateItem(item)).toBe(false);
  });

  it('rejects zero quantity', () => {
    const item = {
      productName: 'Phone',
      preferredBrand: null,
      budget: null,
      quantity: 0,
      deliveryDays: null,
      paymentMethod: null,
      emiOnly: false,
    };
    expect(validateItem(item)).toBe(false);
  });

  it('rejects null input', () => {
    expect(validateItem(null)).toBe(false);
  });

  it('rejects number input', () => {
    expect(validateItem(42)).toBe(false);
  });

  it('rejects string input', () => {
    expect(validateItem('hello')).toBe(false);
  });

  it('rejects negative delivery days', () => {
    const item = {
      productName: 'Tablet',
      preferredBrand: null,
      budget: null,
      quantity: 1,
      deliveryDays: -3,
      paymentMethod: null,
      emiOnly: false,
    };
    expect(validateItem(item)).toBe(false);
  });

  it('accepts brand with spaces', () => {
    const item = {
      productName: 'Air Conditioner',
      preferredBrand: 'Blue Star',
      budget: 40000,
      quantity: 1,
      deliveryDays: null,
      paymentMethod: null,
      emiOnly: false,
    };
    expect(validateItem(item)).toBe(true);
  });

  it('accepts zero budget (free items)', () => {
    const item = {
      productName: 'Gift Card',
      preferredBrand: null,
      budget: 0,
      quantity: 1,
      deliveryDays: null,
      paymentMethod: null,
      emiOnly: false,
    };
    expect(validateItem(item)).toBe(true);
  });
});

// ── Category Detection Tests ─────────────────────────────────────────────────

describe('Category Detection', () => {
  it('detects washing machine category', () => {
    expect(detectCategory('washing machine')).toBe('washing_machine');
    expect(detectCategory('Automatic Washer')).toBe('washing_machine');
    expect(detectCategory('laundry machine')).toBe('washing_machine');
  });

  it('detects phone category', () => {
    expect(detectCategory('smartphone')).toBe('phone');
    expect(detectCategory('iPhone 15')).toBe('phone');
    expect(detectCategory('mobile phone')).toBe('phone');
  });

  it('detects laptop category', () => {
    expect(detectCategory('gaming laptop')).toBe('laptop');
    expect(detectCategory('MacBook Pro')).toBe('laptop');
    expect(detectCategory('notebook computer')).toBe('laptop');
    expect(detectCategory('chromebook')).toBe('laptop');
  });

  it('detects TV category', () => {
    expect(detectCategory('smart tv')).toBe('tv');
    expect(detectCategory('OLED Television')).toBe('tv');
    expect(detectCategory('QLED 4K')).toBe('tv');
  });

  it('detects AC category', () => {
    expect(detectCategory('split ac')).toBe('ac');
    expect(detectCategory('air conditioner')).toBe('ac');
    expect(detectCategory('cooler')).toBe('ac');
  });

  it('detects refrigerator category', () => {
    expect(detectCategory('double door fridge')).toBe('refrigerator');
    expect(detectCategory('refrigerator')).toBe('refrigerator');
    expect(detectCategory('deep freezer')).toBe('refrigerator');
  });

  it('detects audio category', () => {
    expect(detectCategory('bluetooth headphone')).toBe('audio');
    expect(detectCategory('wireless earbuds')).toBe('audio');
    expect(detectCategory('JBL speaker')).toBe('audio');
    expect(detectCategory('AirPods')).toBe('audio');
  });

  it('returns generic for unrecognized products', () => {
    expect(detectCategory('desk lamp')).toBe('generic');
    expect(detectCategory('yoga mat')).toBe('generic');
    expect(detectCategory('water bottle')).toBe('generic');
  });

  it('is case-insensitive', () => {
    expect(detectCategory('WASHING MACHINE')).toBe('washing_machine');
    expect(detectCategory('SmartPhone')).toBe('phone');
  });
});

// ── Budget/Brand Answer Parsing ──────────────────────────────────────────────

describe('Budget Answer Parsing', () => {
  it('parses custom budget amount', () => {
    const result = parseBudgetAnswer('custom_5000');
    expect(result).not.toBeNull();
    expect(result!.min).toBe(0);
    expect(result!.max).toBe(6000); // 5000 * 1.2
  });

  it('parses custom budget for small amount like 100', () => {
    const result = parseBudgetAnswer('custom_100');
    expect(result).not.toBeNull();
    expect(result!.min).toBe(0);
    expect(result!.max).toBe(120);
  });

  it('returns null for invalid custom budget', () => {
    expect(parseBudgetAnswer('custom_abc')).toBeNull();
    expect(parseBudgetAnswer('custom_')).toBeNull();
    expect(parseBudgetAnswer('custom_0')).toBeNull();
    expect(parseBudgetAnswer('custom_-500')).toBeNull();
  });

  it('returns null for non-custom budget', () => {
    expect(parseBudgetAnswer('under_15000')).toBeNull();
  });
});

describe('Brand Answer Parsing', () => {
  it('extracts custom brand name', () => {
    expect(parseBrandAnswer('custom_Bosch')).toBe('Bosch');
    expect(parseBrandAnswer('custom_Blue Star')).toBe('Blue Star');
  });

  it('returns null for empty custom brand', () => {
    expect(parseBrandAnswer('custom_')).toBeNull();
    expect(parseBrandAnswer('custom_   ')).toBeNull();
  });

  it('passes through non-custom brand answers', () => {
    expect(parseBrandAnswer('Samsung')).toBe('Samsung');
    expect(parseBrandAnswer('apple')).toBe('apple');
  });
});

// ── Profile Settings Tests ───────────────────────────────────────────────────

describe('Profile Auto-Checkout Settings', () => {
  let storage: Storage;

  beforeEach(() => {
    const store: Record<string, string> = {};
    storage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => {
        store[key] = val;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
      key: (index: number) => Object.keys(store)[index] ?? null,
      get length() {
        return Object.keys(store).length;
      },
    };
  });

  it('returns defaults when no settings stored', () => {
    const settings = getAutoCheckoutSettings(storage);
    expect(settings.enabled).toBe(false);
    expect(settings.threshold).toBe(10000);
  });

  it('reads enabled=true', () => {
    storage.setItem('autoPurchaseEnabled', 'true');
    storage.setItem('autoPurchaseThreshold', '25000');
    const settings = getAutoCheckoutSettings(storage);
    expect(settings.enabled).toBe(true);
    expect(settings.threshold).toBe(25000);
  });

  it('treats non-true as disabled', () => {
    storage.setItem('autoPurchaseEnabled', 'false');
    expect(getAutoCheckoutSettings(storage).enabled).toBe(false);
    storage.setItem('autoPurchaseEnabled', 'yes');
    expect(getAutoCheckoutSettings(storage).enabled).toBe(false);
  });

  it('defaults threshold for invalid values', () => {
    storage.setItem('autoPurchaseThreshold', 'abc');
    expect(getAutoCheckoutSettings(storage).threshold).toBe(10000);
  });
});

describe('Profile WhatsApp Number', () => {
  let storage: Storage;

  beforeEach(() => {
    const store: Record<string, string> = {};
    storage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => {
        store[key] = val;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
      key: (index: number) => Object.keys(store)[index] ?? null,
      get length() {
        return Object.keys(store).length;
      },
    };
  });

  it('returns null when no number stored', () => {
    expect(getWhatsAppNumber(storage)).toBeNull();
  });

  it('returns stored number', () => {
    storage.setItem('whatsappNumber', '+919876543210');
    expect(getWhatsAppNumber(storage)).toBe('+919876543210');
  });

  it('returns null for empty string', () => {
    storage.setItem('whatsappNumber', '');
    expect(getWhatsAppNumber(storage)).toBeNull();
  });
});

// ── Shopping List UI Helpers ─────────────────────────────────────────────────

describe('Shopping List UI Validation', () => {
  function validateItemUI(item: {
    productName: string;
    preferredBrand: string;
    budget: string;
    quantity: string;
    deliveryDays: string;
  }): string | null {
    if (!item.productName.trim()) return 'Product name is required';
    if (!/^[a-zA-Z0-9 ]+$/.test(item.productName.trim()))
      return 'Product name must be alphanumeric';
    if (item.preferredBrand && !/^[a-zA-Z0-9 ]*$/.test(item.preferredBrand))
      return 'Brand name must be alphanumeric';
    if (item.budget && !/^\d+$/.test(item.budget)) return 'Budget must be numeric';
    if (!item.quantity.trim() || !/^\d+$/.test(item.quantity) || parseInt(item.quantity) < 1)
      return 'Quantity must be at least 1';
    if (item.deliveryDays && !/^\d+$/.test(item.deliveryDays))
      return 'Delivery days must be numeric';
    return null;
  }

  it('passes for valid item', () => {
    expect(
      validateItemUI({
        productName: 'Washing Machine',
        preferredBrand: 'LG',
        budget: '25000',
        quantity: '2',
        deliveryDays: '5',
      })
    ).toBeNull();
  });

  it('rejects empty product name', () => {
    expect(
      validateItemUI({
        productName: '',
        preferredBrand: '',
        budget: '',
        quantity: '1',
        deliveryDays: '',
      })
    ).toBe('Product name is required');
  });

  it('rejects non-numeric budget text', () => {
    expect(
      validateItemUI({
        productName: 'Phone',
        preferredBrand: '',
        budget: 'twenty thousand',
        quantity: '1',
        deliveryDays: '',
      })
    ).toBe('Budget must be numeric');
  });

  it('rejects empty quantity', () => {
    expect(
      validateItemUI({
        productName: 'Phone',
        preferredBrand: '',
        budget: '',
        quantity: '',
        deliveryDays: '',
      })
    ).toBe('Quantity must be at least 1');
  });

  it('rejects zero quantity', () => {
    expect(
      validateItemUI({
        productName: 'Phone',
        preferredBrand: '',
        budget: '',
        quantity: '0',
        deliveryDays: '',
      })
    ).toBe('Quantity must be at least 1');
  });

  it('rejects non-numeric delivery days', () => {
    expect(
      validateItemUI({
        productName: 'Phone',
        preferredBrand: '',
        budget: '',
        quantity: '1',
        deliveryDays: 'three',
      })
    ).toBe('Delivery days must be numeric');
  });

  it('accepts all optional fields empty', () => {
    expect(
      validateItemUI({
        productName: 'Laptop',
        preferredBrand: '',
        budget: '',
        quantity: '1',
        deliveryDays: '',
      })
    ).toBeNull();
  });
});

// ── Product Category Filtering (mirrors answer-question/route.ts) ────────────

describe('Product Category Filtering (getEmbeddedProducts logic)', () => {
  // Simulates the fixed catNameMap-based filtering from answer-question/route.ts
  const SAMPLE_PRODUCTS = [
    { id: 101, name: 'iPhone 15', category: 'Phones', price: 80000 },
    { id: 201, name: 'MacBook Air', category: 'Laptops', price: 120000 },
    { id: 301, name: 'Sony WH-1000XM5', category: 'Audio', price: 30000 },
    { id: 401, name: 'Samsung QLED 4K', category: 'Electronic', price: 90000 },
    { id: 501, name: 'Apple Watch 9', category: 'Wearables', price: 45000 },
    { id: 701, name: 'LG Front Load', category: 'Washing Machine', price: 34000 },
    { id: 801, name: 'LG Double Door', category: 'Refrigerator', price: 28000 },
    { id: 901, name: 'Daikin Split AC', category: 'AC', price: 43000 },
  ];

  const catNameMap: Record<string, string[]> = {
    phones: ['phones'],
    laptops: ['laptops'],
    audio: ['audio'],
    tv: ['electronic', 'tv'],
    wearables: ['wearables'],
    washing_machine: ['washing machine'],
    refrigerator: ['refrigerator'],
    ac: ['ac'],
  };

  function filterByCategory(categoryKey: string) {
    const allowed = catNameMap[categoryKey];
    if (!allowed) return SAMPLE_PRODUCTS;
    return SAMPLE_PRODUCTS.filter((p) => allowed.some((a) => p.category.toLowerCase() === a));
  }

  it('filters AC products correctly (not phones)', () => {
    const result = filterByCategory('ac');
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Daikin Split AC');
    expect(result.every((p) => p.category === 'AC')).toBe(true);
  });

  it('filters washing machine products correctly', () => {
    const result = filterByCategory('washing_machine');
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('LG Front Load');
  });

  it('filters phone products correctly', () => {
    const result = filterByCategory('phones');
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('iPhone 15');
  });

  it('filters TV products (category=Electronic)', () => {
    const result = filterByCategory('tv');
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Samsung QLED 4K');
  });

  it('returns all products for unknown category', () => {
    const result = filterByCategory('gaming');
    expect(result.length).toBe(SAMPLE_PRODUCTS.length);
  });

  it('never mixes AC and washing machine (substring bug fix)', () => {
    // "washing machine" used to match "ac" because 'washing machine'.includes('ac') was true
    const acProducts = filterByCategory('ac');
    expect(acProducts.every((p) => p.category === 'AC')).toBe(true);
    expect(acProducts.some((p) => p.category === 'Washing Machine')).toBe(false);
  });
});

// ── Cart Toggle Logic ────────────────────────────────────────────────────────

describe('Cart Toggle Logic', () => {
  function toggleCart(
    cart: Array<{ productId: string; name: string; price: number }>,
    product: { id: string; name: string; price: number }
  ): Array<{ productId: string; name: string; price: number }> {
    const idx = cart.findIndex((i) => i.productId === product.id);
    if (idx >= 0) {
      return cart.filter((_, i) => i !== idx);
    }
    return [...cart, { productId: product.id, name: product.name, price: product.price }];
  }

  it('adds product to empty cart', () => {
    const result = toggleCart([], { id: '101', name: 'Phone', price: 20000 });
    expect(result.length).toBe(1);
    expect(result[0].productId).toBe('101');
  });

  it('removes product from cart if already present', () => {
    const cart = [{ productId: '101', name: 'Phone', price: 20000 }];
    const result = toggleCart(cart, { id: '101', name: 'Phone', price: 20000 });
    expect(result.length).toBe(0);
  });

  it('does not duplicate on double add', () => {
    const cart = [{ productId: '101', name: 'Phone', price: 20000 }];
    // Second toggle should REMOVE
    const result = toggleCart(cart, { id: '101', name: 'Phone', price: 20000 });
    expect(result.length).toBe(0);
  });

  it('can toggle multiple products independently', () => {
    let cart: Array<{ productId: string; name: string; price: number }> = [];
    cart = toggleCart(cart, { id: '101', name: 'Phone', price: 20000 });
    cart = toggleCart(cart, { id: '201', name: 'Laptop', price: 60000 });
    expect(cart.length).toBe(2);
    // Remove phone
    cart = toggleCart(cart, { id: '101', name: 'Phone', price: 20000 });
    expect(cart.length).toBe(1);
    expect(cart[0].productId).toBe('201');
  });
});
