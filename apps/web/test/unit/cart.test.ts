/**
 * Unit Tests — Add to Cart Logic
 * Tests the localStorage cart operations used by the shopping assistant
 * and product pages throughout the DelegateCart app.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Cart localStorage helpers (mirrors app/page.tsx and shopping-assistant/page.tsx patterns) ──

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
  image?: string;
}

function getCart(storage: Storage): CartItem[] {
  try {
    const raw = storage.getItem('cart');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addToCart(storage: Storage, item: Omit<CartItem, 'id'> & { id?: string }): CartItem[] {
  const cart = getCart(storage);
  const existing = cart.find((i) => i.productId === item.productId);
  if (existing) {
    existing.quantity = (existing.quantity || 1) + 1;
  } else {
    cart.push({
      id: item.id ?? `cart-${item.productId}-${Date.now()}`,
      productId: item.productId,
      name: item.name,
      price: item.price,
      quantity: 1,
      stock: item.stock ?? 99,
    });
  }
  storage.setItem('cart', JSON.stringify(cart));
  return cart;
}

function removeFromCart(storage: Storage, productId: string): CartItem[] {
  const cart = getCart(storage).filter((i) => i.productId !== productId);
  storage.setItem('cart', JSON.stringify(cart));
  return cart;
}

function clearCart(storage: Storage): void {
  storage.removeItem('cart');
}

function getCartCount(storage: Storage): number {
  return getCart(storage).reduce((sum, item) => sum + (item.quantity || 1), 0);
}

function getCartTotal(storage: Storage): number {
  return getCart(storage).reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);
}

// ── Mock localStorage ─────────────────────────────────────────────────────────

let mockStorage: Record<string, string> = {};

const localStorageMock: Storage = {
  getItem: (key) => mockStorage[key] ?? null,
  setItem: (key, value) => {
    mockStorage[key] = String(value);
  },
  removeItem: (key) => {
    delete mockStorage[key];
  },
  clear: () => {
    mockStorage = {};
  },
  length: 0,
  key: () => null,
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Cart localStorage helpers', () => {
  beforeEach(() => {
    mockStorage = {};
  });

  describe('getCart()', () => {
    it('returns empty array when cart is empty', () => {
      expect(getCart(localStorageMock)).toEqual([]);
    });

    it('returns empty array when cart key missing', () => {
      localStorageMock.removeItem('cart');
      expect(getCart(localStorageMock)).toEqual([]);
    });

    it('returns parsed cart array from localStorage', () => {
      const items: CartItem[] = [
        { id: 'c1', productId: 'p1', name: 'Phone', price: 9999, quantity: 1, stock: 99 },
      ];
      localStorageMock.setItem('cart', JSON.stringify(items));
      expect(getCart(localStorageMock)).toEqual(items);
    });

    it('returns empty array on malformed JSON', () => {
      localStorageMock.setItem('cart', '{invalid json}');
      expect(getCart(localStorageMock)).toEqual([]);
    });
  });

  describe('addToCart()', () => {
    it('adds a new item to empty cart', () => {
      const cart = addToCart(localStorageMock, {
        id: 'cart-p1',
        productId: 'p1',
        name: 'Apple iPhone 15',
        price: 79999,
        quantity: 1,
        stock: 99,
      });
      expect(cart).toHaveLength(1);
      expect(cart[0].name).toBe('Apple iPhone 15');
      expect(cart[0].quantity).toBe(1);
    });

    it('increments quantity for existing item', () => {
      addToCart(localStorageMock, {
        productId: 'p1',
        name: 'Phone',
        price: 9999,
        quantity: 1,
        stock: 99,
      });
      const cart = addToCart(localStorageMock, {
        productId: 'p1',
        name: 'Phone',
        price: 9999,
        quantity: 1,
        stock: 99,
      });
      expect(cart).toHaveLength(1);
      expect(cart[0].quantity).toBe(2);
    });

    it('adds multiple distinct products', () => {
      addToCart(localStorageMock, {
        productId: 'p1',
        name: 'Phone',
        price: 9999,
        quantity: 1,
        stock: 99,
      });
      const cart = addToCart(localStorageMock, {
        productId: 'p2',
        name: 'Laptop',
        price: 49999,
        quantity: 1,
        stock: 99,
      });
      expect(cart).toHaveLength(2);
    });

    it('persists to localStorage', () => {
      addToCart(localStorageMock, {
        productId: 'p1',
        name: 'Product',
        price: 1000,
        quantity: 1,
        stock: 10,
      });
      const raw = localStorageMock.getItem('cart');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed[0].productId).toBe('p1');
    });

    it('auto-generates id if not provided', () => {
      const cart = addToCart(localStorageMock, {
        productId: 'p99',
        name: 'Test Product',
        price: 5000,
        quantity: 1,
        stock: 5,
      });
      expect(cart[0].id).toMatch(/^cart-p99-\d+$/);
    });

    it('handles RankedProduct price as number', () => {
      const cart = addToCart(localStorageMock, {
        productId: 'prod-001',
        name: 'Apple 15 Pro Max 5G Black',
        price: 118999,
        quantity: 1,
        stock: 99,
      });
      expect(typeof cart[0].price).toBe('number');
      expect(cart[0].price).toBe(118999);
    });
  });

  describe('removeFromCart()', () => {
    it('removes item by productId', () => {
      addToCart(localStorageMock, {
        productId: 'p1',
        name: 'A',
        price: 100,
        quantity: 1,
        stock: 5,
      });
      addToCart(localStorageMock, {
        productId: 'p2',
        name: 'B',
        price: 200,
        quantity: 1,
        stock: 5,
      });
      const cart = removeFromCart(localStorageMock, 'p1');
      expect(cart).toHaveLength(1);
      expect(cart[0].productId).toBe('p2');
    });

    it('returns empty cart when removing only item', () => {
      addToCart(localStorageMock, {
        productId: 'p1',
        name: 'A',
        price: 100,
        quantity: 1,
        stock: 5,
      });
      const cart = removeFromCart(localStorageMock, 'p1');
      expect(cart).toHaveLength(0);
    });

    it('no-ops if productId does not exist', () => {
      addToCart(localStorageMock, {
        productId: 'p1',
        name: 'A',
        price: 100,
        quantity: 1,
        stock: 5,
      });
      const cart = removeFromCart(localStorageMock, 'not-found');
      expect(cart).toHaveLength(1);
    });
  });

  describe('clearCart()', () => {
    it('empties the cart', () => {
      addToCart(localStorageMock, {
        productId: 'p1',
        name: 'A',
        price: 100,
        quantity: 1,
        stock: 5,
      });
      clearCart(localStorageMock);
      expect(getCart(localStorageMock)).toEqual([]);
      expect(localStorageMock.getItem('cart')).toBeNull();
    });
  });

  describe('getCartCount()', () => {
    it('returns 0 for empty cart', () => {
      expect(getCartCount(localStorageMock)).toBe(0);
    });

    it('counts total quantity across items', () => {
      addToCart(localStorageMock, {
        productId: 'p1',
        name: 'A',
        price: 100,
        quantity: 1,
        stock: 5,
      });
      addToCart(localStorageMock, {
        productId: 'p1',
        name: 'A',
        price: 100,
        quantity: 1,
        stock: 5,
      }); // qty 2
      addToCart(localStorageMock, {
        productId: 'p2',
        name: 'B',
        price: 200,
        quantity: 1,
        stock: 5,
      }); // qty 1 (new product)
      expect(getCartCount(localStorageMock)).toBe(3);
    });
  });

  describe('getCartTotal()', () => {
    it('returns 0 for empty cart', () => {
      expect(getCartTotal(localStorageMock)).toBe(0);
    });

    it('calculates total price * quantity', () => {
      addToCart(localStorageMock, {
        productId: 'p1',
        name: 'A',
        price: 1000,
        quantity: 1,
        stock: 5,
      });
      addToCart(localStorageMock, {
        productId: 'p1',
        name: 'A',
        price: 1000,
        quantity: 1,
        stock: 5,
      }); // qty=2
      expect(getCartTotal(localStorageMock)).toBe(2000);
    });

    it('sums multiple products', () => {
      addToCart(localStorageMock, {
        productId: 'p1',
        name: 'A',
        price: 1000,
        quantity: 1,
        stock: 5,
      });
      addToCart(localStorageMock, {
        productId: 'p2',
        name: 'B',
        price: 3000,
        quantity: 1,
        stock: 5,
      });
      expect(getCartTotal(localStorageMock)).toBe(4000);
    });

    it('handles large prices (Indian rupees)', () => {
      addToCart(localStorageMock, {
        productId: 'p1',
        name: 'iPhone',
        price: 118999,
        quantity: 1,
        stock: 5,
      });
      expect(getCartTotal(localStorageMock)).toBe(118999);
    });
  });
});

// ── RankedProduct → CartItem mapping tests ────────────────────────────────────

describe('RankedProduct → CartItem conversion', () => {
  const mockRankedProduct = {
    rank: 1,
    product: {
      id: 'prod-apple-001',
      name: 'Apple 15 Pro Max 5G Black',
      brand: 'Apple',
      price: 118999,
      original_price: 136849,
      discount_percent: 13,
      rating: 3.5,
      review_count: 50,
      delivery_time: '1-3 days',
      key_features: ['5G', 'A17 Pro chip', '120Hz ProMotion'],
      source: 'DelegateCart',
    },
    score: 1.0,
    confidence: 0.95,
    explanation: {
      product_id: 'prod-apple-001',
      final_score: 1.0,
      summary: 'Best match',
      key_strengths: ['Top hardware'],
      key_weaknesses: [],
      budget_fit_score: { score: 0.9, reason: '' },
      quality_score: { score: 1.0, reason: '' },
      brand_preference_score: { score: 1.0, reason: '' },
      delivery_speed_score: { score: 0.8, reason: '' },
      ratings_score: { score: 0.7, reason: '' },
    },
  };

  beforeEach(() => {
    mockStorage = {};
  });

  it('maps product.id → productId correctly', () => {
    const cart = addToCart(localStorageMock, {
      productId: mockRankedProduct.product.id,
      name: mockRankedProduct.product.name,
      price: mockRankedProduct.product.price,
      quantity: 1,
      stock: 99,
    });
    expect(cart[0].productId).toBe('prod-apple-001');
  });

  it('preserves product name exactly', () => {
    const cart = addToCart(localStorageMock, {
      productId: mockRankedProduct.product.id,
      name: mockRankedProduct.product.name,
      price: mockRankedProduct.product.price,
      quantity: 1,
      stock: 99,
    });
    expect(cart[0].name).toBe('Apple 15 Pro Max 5G Black');
  });

  it('preserves product price as number', () => {
    const cart = addToCart(localStorageMock, {
      productId: mockRankedProduct.product.id,
      name: mockRankedProduct.product.name,
      price: mockRankedProduct.product.price,
      quantity: 1,
      stock: 99,
    });
    expect(cart[0].price).toBe(118999);
    expect(typeof cart[0].price).toBe('number');
  });

  it('starts with quantity 1', () => {
    const cart = addToCart(localStorageMock, {
      productId: mockRankedProduct.product.id,
      name: mockRankedProduct.product.name,
      price: mockRankedProduct.product.price,
      quantity: 1,
      stock: 99,
    });
    expect(cart[0].quantity).toBe(1);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('Cart edge cases', () => {
  beforeEach(() => {
    mockStorage = {};
  });

  it('handles adding item with price = 0', () => {
    const cart = addToCart(localStorageMock, {
      productId: 'free-item',
      name: 'Free Sample',
      price: 0,
      quantity: 1,
      stock: 10,
    });
    expect(cart[0].price).toBe(0);
    expect(getCartTotal(localStorageMock)).toBe(0);
  });

  it('handles product names with special characters', () => {
    const name = 'Samsung Galaxy S24 Ultra — 5G | 12GB+256GB';
    const cart = addToCart(localStorageMock, {
      productId: 'sg-s24',
      name,
      price: 116999,
      quantity: 1,
      stock: 5,
    });
    expect(cart[0].name).toBe(name);
  });

  it('handles products with unicode names (₹, Indian rupees)', () => {
    const cart = addToCart(localStorageMock, {
      productId: 'item-₹',
      name: 'OnePlus 12 Pro ₹75,999',
      price: 75999,
      quantity: 1,
      stock: 20,
    });
    expect(cart[0].name).toContain('₹');
  });

  it('does not lose existing items when adding new one', () => {
    for (let i = 0; i < 5; i++) {
      addToCart(localStorageMock, {
        productId: `prod-${i}`,
        name: `Product ${i}`,
        price: 1000 * (i + 1),
        quantity: 1,
        stock: 10,
      });
    }
    expect(getCart(localStorageMock)).toHaveLength(5);
  });

  it('cart count equals sum of all quantities', () => {
    addToCart(localStorageMock, { productId: 'p1', name: 'A', price: 100, quantity: 1, stock: 5 });
    addToCart(localStorageMock, { productId: 'p1', name: 'A', price: 100, quantity: 1, stock: 5 }); // qty=2
    addToCart(localStorageMock, { productId: 'p1', name: 'A', price: 100, quantity: 1, stock: 5 }); // qty=3
    addToCart(localStorageMock, { productId: 'p2', name: 'B', price: 200, quantity: 1, stock: 5 }); // new item qty=1
    expect(getCartCount(localStorageMock)).toBe(4); // 3 + 1
  });
});
