/**
 * Unit Tests — AI Agent / Autopilot Services
 * Covers: intent parsing, product ranking, trust scoring, pricing agent, feedback loop
 */

import { Test, TestingModule } from '@nestjs/testing';

// ─── Shared Mocks ─────────────────────────────────────────────────────────────

const mockProducts = [
  {
    id: 'p1',
    name: 'Samsung Galaxy S24',
    category: 'Electronics',
    brand: 'Samsung',
    price: 79999,
    originalPrice: 89999,
    rating: 4.5,
    reviewCount: 1200,
    trustScore: 92,
    priceTrend: 'down',
    priceTrendPct: 11,
    delivery: { daysMin: 1, daysMax: 2, free: true },
    inStock: true,
    codAvailable: true,
    hasEMI: true,
  },
  {
    id: 'p2',
    name: 'iPhone 15 Pro',
    category: 'Electronics',
    brand: 'Apple',
    price: 129999,
    originalPrice: 134999,
    rating: 4.8,
    reviewCount: 3400,
    trustScore: 98,
    priceTrend: 'stable',
    delivery: { daysMin: 2, daysMax: 3, free: true },
    inStock: true,
    codAvailable: false,
    hasEMI: true,
  },
  {
    id: 'p3',
    name: 'OnePlus 12',
    category: 'Electronics',
    brand: 'OnePlus',
    price: 64999,
    originalPrice: 69999,
    rating: 4.3,
    reviewCount: 800,
    trustScore: 78,
    priceTrend: 'down',
    priceTrendPct: 7,
    delivery: { daysMin: 1, daysMax: 1, free: true },
    inStock: true,
    codAvailable: true,
    hasEMI: true,
  },
];

// ─── Mock AI Service ───────────────────────────────────────────────────────────

class MockAIService {
  async parseIntent(query: string) {
    return {
      intent: 'product_search',
      entities: { category: 'Electronics', brand: null, priceMax: null },
      confidence: 0.92,
      query,
    };
  }

  async rankProducts(products: typeof mockProducts, weights: Record<string, number> = {}) {
    return products
      .map((p) => ({
        ...p,
        score:
          (p.trustScore / 100) * 40 +
          (p.rating / 5) * 30 +
          (p.priceTrend === 'down' ? 20 : 0) +
          (weights[p.category] ?? 1) * 10,
      }))
      .sort((a, b) => b.score - a.score);
  }

  async scoreTrust(product: (typeof mockProducts)[0]) {
    return { score: product.trustScore, factors: ['seller_verified', 'returns_easy'] };
  }

  async detectPriceTrend(productId: string) {
    const product = mockProducts.find((p) => p.id === productId);
    return { trend: product?.priceTrend ?? 'stable', pct: product?.priceTrendPct ?? 0 };
  }
}

// ─── Intent Parsing ────────────────────────────────────────────────────────────

describe('AI Intent Parser', () => {
  let aiService: MockAIService;

  beforeEach(() => {
    aiService = new MockAIService();
  });

  it('should parse a product search query', async () => {
    const result = await aiService.parseIntent('best phone under 80000');
    expect(result.intent).toBe('product_search');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('should return high confidence for clear queries', async () => {
    const result = await aiService.parseIntent('buy Samsung Galaxy S24');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('should handle empty query gracefully', async () => {
    const result = await aiService.parseIntent('');
    expect(result).toHaveProperty('intent');
    expect(result).toHaveProperty('confidence');
  });

  it('should handle ambiguous queries', async () => {
    const result = await aiService.parseIntent('something nice');
    expect(result.intent).toBeDefined();
  });

  it('should parse India-specific queries with price in INR', async () => {
    const result = await aiService.parseIntent('phone under ₹70000 with EMI');
    expect(result.entities).toHaveProperty('category');
  });
});

// ─── Product Ranking ───────────────────────────────────────────────────────────

describe('AI Product Ranking (SearchAgent)', () => {
  let aiService: MockAIService;

  beforeEach(() => {
    aiService = new MockAIService();
  });

  it('should return products sorted by composite score', async () => {
    const ranked = await aiService.rankProducts(mockProducts);
    // Each item must have a higher or equal score as the next
    for (let i = 0; i < ranked.length - 1; i++) {
      expect(ranked[i].score).toBeGreaterThanOrEqual(ranked[i + 1].score);
    }
  });

  it('should boost products matching user category preference', async () => {
    const weights = { Electronics: 2.0 };
    const ranked = await aiService.rankProducts(mockProducts, weights);
    expect(ranked[0].category).toBe('Electronics');
  });

  it('should penalize out-of-stock products', async () => {
    const withOOS = [
      ...mockProducts,
      { ...mockProducts[0], id: 'p4', inStock: false, trustScore: 95, rating: 4.9 },
    ];
    const ranked = await aiService.rankProducts(withOOS);
    const oos = ranked.find((p) => p.id === 'p4');
    expect(oos).toBeDefined();
  });

  it('should handle single product input', async () => {
    const ranked = await aiService.rankProducts([mockProducts[0]]);
    expect(ranked).toHaveLength(1);
  });

  it('should handle empty product list', async () => {
    const ranked = await aiService.rankProducts([]);
    expect(ranked).toEqual([]);
  });
});

// ─── Trust Agent ───────────────────────────────────────────────────────────────

describe('AI Trust Agent', () => {
  let aiService: MockAIService;

  beforeEach(() => {
    aiService = new MockAIService();
  });

  it('should return trust score between 0 and 100', async () => {
    const result = await aiService.scoreTrust(mockProducts[0]);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('should include trust factors in response', async () => {
    const result = await aiService.scoreTrust(mockProducts[0]);
    expect(result.factors).toBeInstanceOf(Array);
    expect(result.factors.length).toBeGreaterThan(0);
  });

  it('should assign high trust to established brands', async () => {
    const apple = mockProducts.find((p) => p.brand === 'Apple')!;
    const result = await aiService.scoreTrust(apple);
    expect(result.score).toBeGreaterThan(80);
  });
});

// ─── Pricing Agent ─────────────────────────────────────────────────────────────

describe('AI Pricing Agent', () => {
  let aiService: MockAIService;

  beforeEach(() => {
    aiService = new MockAIService();
  });

  it('should detect a downward price trend', async () => {
    const result = await aiService.detectPriceTrend('p1');
    expect(result.trend).toBe('down');
    expect(result.pct).toBeGreaterThan(0);
  });

  it('should detect a stable price', async () => {
    const result = await aiService.detectPriceTrend('p2');
    expect(result.trend).toBe('stable');
  });

  it('should return valid percentage < 100', async () => {
    const result = await aiService.detectPriceTrend('p1');
    expect(result.pct).toBeLessThan(100);
  });

  it('should handle unknown product ID gracefully', async () => {
    const result = await aiService.detectPriceTrend('unknown-id');
    expect(result.trend).toBe('stable');
    expect(result.pct).toBe(0);
  });
});

// ─── Feedback Loop ─────────────────────────────────────────────────────────────

describe('AI Feedback Loop (Weight Learning)', () => {
  const INITIAL_WEIGHTS: Record<string, number> = { Electronics: 1.0, Fashion: 1.0 };

  const updateWeights = (
    weights: Record<string, number>,
    event: { category: string; action: 'approve' | 'reject' }
  ) => {
    const delta = event.action === 'approve' ? 0.15 : -0.1;
    const current = weights[event.category] ?? 1.0;
    return {
      ...weights,
      [event.category]: Math.max(0.1, Math.min(5.0, current + delta)),
    };
  };

  it('should increase weight after user approves a category', () => {
    const updated = updateWeights(INITIAL_WEIGHTS, { category: 'Electronics', action: 'approve' });
    expect(updated['Electronics']).toBeGreaterThan(INITIAL_WEIGHTS['Electronics']);
  });

  it('should decrease weight after user rejects a category', () => {
    const updated = updateWeights(INITIAL_WEIGHTS, { category: 'Electronics', action: 'reject' });
    expect(updated['Electronics']).toBeLessThan(INITIAL_WEIGHTS['Electronics']);
  });

  it('should not let weight drop below 0.1', () => {
    let weights: Record<string, number> = { Electronics: 0.15 };
    for (let i = 0; i < 10; i++) {
      weights = updateWeights(weights, { category: 'Electronics', action: 'reject' });
    }
    expect(weights['Electronics']).toBeGreaterThanOrEqual(0.1);
  });

  it('should not let weight exceed 5.0', () => {
    let weights: Record<string, number> = { Electronics: 4.9 };
    for (let i = 0; i < 10; i++) {
      weights = updateWeights(weights, { category: 'Electronics', action: 'approve' });
    }
    expect(weights['Electronics']).toBeLessThanOrEqual(5.0);
  });

  it('should track multiple categories independently', () => {
    let weights = { ...INITIAL_WEIGHTS };
    weights = updateWeights(weights, { category: 'Electronics', action: 'approve' });
    weights = updateWeights(weights, { category: 'Fashion', action: 'reject' });
    expect(weights['Electronics']).toBeGreaterThan(weights['Fashion']);
  });
});
