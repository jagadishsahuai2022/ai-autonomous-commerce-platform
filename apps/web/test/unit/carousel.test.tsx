/**
 * Unit Tests — ProductRecommendationCarousel
 * Tests rendering, cart toggle, scroll navigation, best-match banner,
 * score display, layout containment attributes, and localStorage sync.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { ProductRecommendationCarousel } from '../../components/ProductRecommendationCarousel';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) =>
    React.createElement('span', { 'data-icon': 'icon', className });
  return new Proxy({}, { get: () => Icon });
});

vi.mock('@/types/shopping-assistant', () => ({}));

// ── localStorage mock ──────────────────────────────────────────────────────

let mockStorage: Record<string, string> = {};
const storageMock: Storage = {
  getItem: (key) => mockStorage[key] ?? null,
  setItem: (key, value) => { mockStorage[key] = String(value); },
  removeItem: (key) => { delete mockStorage[key]; },
  clear: () => { mockStorage = {}; },
  length: 0,
  key: () => null,
};
Object.defineProperty(window, 'localStorage', { value: storageMock });

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeProduct(overrides: { id?: string; rank?: number; price?: number; name?: string; score?: number } = {}) {
  const id = overrides.id ?? 'prod-1';
  const rank = overrides.rank ?? 1;
  return {
    rank,
    product: {
      id,
      name: overrides.name ?? `Test Product ${rank}`,
      brand: 'TestBrand',
      price: overrides.price ?? 9999,
      original_price: overrides.price ? overrides.price + 1000 : 11999,
      discount_percent: 10,
      rating: 4.5,
      review_count: 500,
      delivery_time: '2-3 days',
      key_features: ['Feature A', 'Feature B', 'Feature C'],
      source: 'TestStore',
      imageUrl: '',
    },
    score: overrides.score ?? 0.92,
    confidence: 0.88,
    explanation: {
      product_id: id,
      final_score: overrides.score ?? 0.92,
      summary: 'Great product for your needs.',
      key_strengths: ['Good quality', 'Fast delivery'],
      key_weaknesses: ['Slightly expensive'],
      budget_fit_score: { score: 0.90, reason: 'Within budget' },
      quality_score: { score: 0.95, reason: 'High quality' },
      brand_preference_score: { score: 0.85, reason: 'Trusted brand' },
      delivery_speed_score: { score: 0.80, reason: 'Fast delivery' },
      ratings_score: { score: 0.92, reason: '4.5 stars' },
    },
  };
}

const singleProduct = [makeProduct({ id: 'p1', rank: 1 })];
const threeProducts = [
  makeProduct({ id: 'p1', rank: 1, name: 'Alpha Product', score: 0.95 }),
  makeProduct({ id: 'p2', rank: 2, name: 'Beta Product', score: 0.85 }),
  makeProduct({ id: 'p3', rank: 3, name: 'Gamma Product', score: 0.75 }),
];
const fiveProducts = [
  makeProduct({ id: 'p1', rank: 1, score: 0.95 }),
  makeProduct({ id: 'p2', rank: 2, score: 0.88 }),
  makeProduct({ id: 'p3', rank: 3, score: 0.80 }),
  makeProduct({ id: 'p4', rank: 4, score: 0.72 }),
  makeProduct({ id: 'p5', rank: 5, score: 0.65 }),
];

// ── Import component ───────────────────────────────────────────────────────
// (Static import above — no dynamic import needed, avoids beforeEach timeout)

beforeEach(() => { mockStorage = {}; });
afterEach(() => { mockStorage = {}; });

// ── Tests: Rendering ───────────────────────────────────────────────────────

describe('ProductRecommendationCarousel — Rendering', () => {
  it('renders the carousel container with data-testid', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: singleProduct }));
    expect(document.querySelector('[data-testid="product-carousel"]')).toBeTruthy();
  });

  it('renders the viewport element', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: singleProduct }));
    expect(document.querySelector('[data-testid="carousel-viewport"]')).toBeTruthy();
  });

  it('renders the scroll container', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: singleProduct }));
    expect(document.querySelector('[data-testid="carousel-scroll"]')).toBeTruthy();
  });

  it('renders the correct number of product cards', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: threeProducts }));
    const cards = document.querySelectorAll('[data-testid="product-card"]');
    expect(cards.length).toBe(3);
  });

  it('renders 5 cards for 5 products', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: fiveProducts }));
    const cards = document.querySelectorAll('[data-testid="product-card"]');
    expect(cards.length).toBe(5);
  });

  it('shows product names in cards', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: threeProducts }));
    expect(screen.getByText('Alpha Product')).toBeTruthy();
    expect(screen.getByText('Beta Product')).toBeTruthy();
    expect(screen.getByText('Gamma Product')).toBeTruthy();
  });

  it('displays the products count badge in header', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: threeProducts }));
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('shows "Top Recommendations" heading', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: singleProduct }));
    expect(screen.getByText('Top Recommendations')).toBeTruthy();
  });

  it('shows average AI confidence in header', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: threeProducts }));
    // confidence 0.88 → "88%"
    const confText = screen.getAllByText(/\d+%/);
    expect(confText.length).toBeGreaterThan(0);
  });
});

// ── Tests: Best Match Banner ───────────────────────────────────────────────

describe('ProductRecommendationCarousel — Best Match Banner', () => {
  it('shows Best Match label for first product', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: threeProducts }));
    expect(screen.getByText('Best Match')).toBeTruthy();
  });

  it('shows the top product name in best match banner', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: threeProducts }));
    // The first product name appears in both banner and card — just check it exists
    const names = screen.getAllByText('Alpha Product');
    expect(names.length).toBeGreaterThan(0);
  });

  it('shows discount badge when discount_percent > 0', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: singleProduct }));
    // product has 10% discount
    const discountBadges = screen.getAllByText(/-10%|10% OFF/);
    expect(discountBadges.length).toBeGreaterThan(0);
  });

  it('shows best match Highlight cart button', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: singleProduct }));
    const highlightBtn = document.querySelector('[data-testid="cart-toggle-highlight"]');
    expect(highlightBtn).toBeTruthy();
    expect(highlightBtn?.textContent).toMatch(/Add to Cart/);
  });
});

// ── Tests: Product Cards ───────────────────────────────────────────────────

describe('ProductRecommendationCarousel — Product Cards', () => {
  it('each card has an Add to Cart button', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: threeProducts }));
    const cartBtns = document.querySelectorAll('[data-testid="cart-toggle-card"]');
    expect(cartBtns.length).toBe(3);
  });

  it('renders score percentages as text (e.g. 95%)', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: singleProduct }));
    expect(screen.getAllByText(/\d+%/).length).toBeGreaterThan(0);
  });

  it('shows brand name in cards', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: singleProduct }));
    expect(screen.getAllByText('TestBrand').length).toBeGreaterThan(0);
  });

  it('shows delivery time in card', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: singleProduct }));
    expect(screen.getAllByText('2-3 days').length).toBeGreaterThan(0);
  });

  it('shows key features (up to 3) in card', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: singleProduct }));
    expect(screen.getByText('Feature A')).toBeTruthy();
    expect(screen.getByText('Feature B')).toBeTruthy();
    expect(screen.getByText('Feature C')).toBeTruthy();
  });

  it('shows expand/collapse toggle (+/-) button', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: singleProduct }));
    expect(screen.getByText('+')).toBeTruthy();
  });

  it('toggles expanded state when + clicked', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: singleProduct }));
    const plusBtn = screen.getByText('+');
    fireEvent.click(plusBtn);
    // After click, should show '−'
    expect(screen.getByText('−')).toBeTruthy();
  });

  it('shows explanation summary when expanded', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: singleProduct }));
    const plusBtn = screen.getByText('+');
    fireEvent.click(plusBtn);
    expect(screen.getByText('Great product for your needs.')).toBeTruthy();
  });

  it('shows strengths when expanded', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: singleProduct }));
    fireEvent.click(screen.getByText('+'));
    expect(screen.getByText('Good quality')).toBeTruthy();
    expect(screen.getByText('Fast delivery')).toBeTruthy();
  });

  it('shows weaknesses when expanded', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: singleProduct }));
    fireEvent.click(screen.getByText('+'));
    expect(screen.getByText('Slightly expensive')).toBeTruthy();
  });
});

// ── Tests: Cart Toggle ─────────────────────────────────────────────────────

describe('ProductRecommendationCarousel — Cart Toggle', () => {
  it('Add to Cart button adds product to localStorage', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: singleProduct }));
    const cardBtns = document.querySelectorAll('[data-testid="cart-toggle-card"]');
    fireEvent.click(cardBtns[0]);
    const cart = JSON.parse(mockStorage['cart'] ?? '[]');
    expect(cart.some((i: any) => i.productId === 'p1')).toBe(true);
  });

  it('button changes to Remove after adding to cart', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: singleProduct }));
    const cardBtn = document.querySelector('[data-testid="cart-toggle-card"]') as HTMLElement;
    fireEvent.click(cardBtn);
    expect(cardBtn.textContent).toMatch(/Remove/);
  });

  it('Remove button removes product from localStorage', () => {
    // Pre-seed cart
    mockStorage['cart'] = JSON.stringify([{ productId: 'p1', id: 'c1', name: 'T', price: 100, quantity: 1, stock: 99 }]);
    render(React.createElement(ProductRecommendationCarousel, { products: singleProduct }));
    // Button should say "Remove"
    const cardBtn = document.querySelector('[data-testid="cart-toggle-card"]') as HTMLElement;
    expect(cardBtn.textContent).toMatch(/Remove/);
    fireEvent.click(cardBtn);
    const cart = JSON.parse(mockStorage['cart'] ?? '[]');
    expect(cart.some((i: any) => i.productId === 'p1')).toBe(false);
  });

  it('does not add duplicate when same product added twice', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: threeProducts }));
    const btn1 = document.querySelectorAll('[data-testid="cart-toggle-card"]')[0] as HTMLElement;
    fireEvent.click(btn1);
    // Remove and add again
    fireEvent.click(btn1); // remove
    fireEvent.click(btn1); // add again
    const cart = JSON.parse(mockStorage['cart'] ?? '[]');
    const dupes = cart.filter((i: any) => i.productId === 'p1');
    expect(dupes.length).toBeLessThanOrEqual(1);
  });

  it('highlight cart button also adds to cart', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: singleProduct }));
    const highlightBtn = document.querySelector('[data-testid="cart-toggle-highlight"]') as HTMLElement;
    fireEvent.click(highlightBtn);
    const cart = JSON.parse(mockStorage['cart'] ?? '[]');
    expect(cart.some((i: any) => i.productId === 'p1')).toBe(true);
  });

  it('syncs cart state when cartUpdated event fires', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: singleProduct }));
    // Externally add to cart and fire event
    act(() => {
      mockStorage['cart'] = JSON.stringify([{ productId: 'p1', id: 'c1', name: 'T', price: 100, quantity: 1, stock: 99 }]);
      window.dispatchEvent(new Event('cartUpdated'));
    });
    const cardBtn = document.querySelector('[data-testid="cart-toggle-card"]') as HTMLElement;
    expect(cardBtn.textContent).toMatch(/Remove/);
  });

  it('multiple products can be independently toggled', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: threeProducts }));
    const btns = document.querySelectorAll('[data-testid="cart-toggle-card"]');
    // Add p1 and p3
    fireEvent.click(btns[0] as HTMLElement);
    fireEvent.click(btns[2] as HTMLElement);
    const cart = JSON.parse(mockStorage['cart'] ?? '[]');
    const ids = cart.map((i: any) => i.productId);
    expect(ids).toContain('p1');
    expect(ids).toContain('p3');
    expect(ids).not.toContain('p2');
  });
});

// ── Tests: Navigation Arrows ───────────────────────────────────────────────

describe('ProductRecommendationCarousel — Navigation', () => {
  it('renders left and right scroll arrow buttons', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: fiveProducts }));
    const leftBtn = screen.getByLabelText('Scroll left');
    const rightBtn = screen.getByLabelText('Scroll right');
    expect(leftBtn).toBeTruthy();
    expect(rightBtn).toBeTruthy();
  });

  it('clicking right arrow button does not throw', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: fiveProducts }));
    const rightBtn = screen.getByLabelText('Scroll right');
    expect(() => fireEvent.click(rightBtn)).not.toThrow();
  });
});

// ── Tests: Compare Button ──────────────────────────────────────────────────

describe('ProductRecommendationCarousel — Compare', () => {
  it('does not render Compare button when onCompareToggle not provided', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: threeProducts }));
    expect(screen.queryByText('Compare')).toBeNull();
  });

  it('renders Compare button when onCompareToggle is provided', () => {
    render(React.createElement(ProductRecommendationCarousel, {
      products: threeProducts,
      onCompareToggle: vi.fn(),
    }));
    expect(screen.getByText('Compare')).toBeTruthy();
  });

  it('calls onCompareToggle when Compare button clicked', () => {
    const toggleFn = vi.fn();
    render(React.createElement(ProductRecommendationCarousel, {
      products: threeProducts,
      onCompareToggle: toggleFn,
    }));
    fireEvent.click(screen.getByText('Compare'));
    expect(toggleFn).toHaveBeenCalledTimes(1);
  });

  it('applies active styling when showComparison is true', () => {
    render(React.createElement(ProductRecommendationCarousel, {
      products: threeProducts,
      onCompareToggle: vi.fn(),
      showComparison: true,
    }));
    const compareBtn = screen.getByText('Compare');
    expect(compareBtn.className).toMatch(/bg-blue-600/);
  });
});

// ── Tests: Layout / Overflow Prevention ──────────────────────────────────

describe('ProductRecommendationCarousel — Layout / Overflow Prevention', () => {
  it('outer wrapper has overflow-hidden class', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: threeProducts }));
    const wrapper = document.querySelector('[data-testid="product-carousel"]');
    expect(wrapper?.className).toMatch(/overflow-hidden/);
  });

  it('outer wrapper has w-full class', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: threeProducts }));
    const wrapper = document.querySelector('[data-testid="product-carousel"]');
    expect(wrapper?.className).toMatch(/w-full/);
  });

  it('outer wrapper has min-w-0 class', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: threeProducts }));
    const wrapper = document.querySelector('[data-testid="product-carousel"]');
    expect(wrapper?.className).toMatch(/min-w-0/);
  });

  it('carousel viewport has overflow-hidden class', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: threeProducts }));
    const viewport = document.querySelector('[data-testid="carousel-viewport"]');
    expect(viewport?.className).toMatch(/overflow-hidden/);
  });

  it('scroll container has overflow-x-auto class', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: threeProducts }));
    const scroll = document.querySelector('[data-testid="carousel-scroll"]');
    expect(scroll?.className).toMatch(/overflow-x-auto/);
  });

  it('scroll container has w-full class', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: threeProducts }));
    const scroll = document.querySelector('[data-testid="carousel-scroll"]');
    expect(scroll?.className).toMatch(/w-full/);
  });

  it('product cards have flex-shrink-0 to prevent compression', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: threeProducts }));
    const cards = document.querySelectorAll('[data-testid="product-card"]');
    cards.forEach((card) => {
      expect(card.className).toMatch(/flex-shrink-0/);
    });
  });
});

// ── Tests: Scroll Dots ────────────────────────────────────────────────────

describe('ProductRecommendationCarousel — Scroll Position Dots', () => {
  it('renders position dots when products > 2', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: threeProducts }));
    // 3 products should render 3 dot buttons
    const dots = document.querySelectorAll('.h-1\\.5.rounded-full');
    expect(dots.length).toBeGreaterThan(0);
  });

  it('does not render dots for single product', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: singleProduct }));
    const dots = document.querySelectorAll('.h-1\\.5.rounded-full');
    expect(dots.length).toBe(0);
  });
});

// ── Tests: Scoring Legend ──────────────────────────────────────────────────

describe('ProductRecommendationCarousel — Scoring Legend', () => {
  it('renders all 5 scoring dimensions', () => {
    render(React.createElement(ProductRecommendationCarousel, { products: singleProduct }));
    expect(screen.getByText(/Quality/)).toBeTruthy();
    expect(screen.getByText(/Price/)).toBeTruthy();
    expect(screen.getByText(/Rating/)).toBeTruthy();
    expect(screen.getByText(/Delivery/)).toBeTruthy();
    expect(screen.getByText(/Confidence/)).toBeTruthy();
  });
});

// ── Tests: onSelectProduct callback ──────────────────────────────────────

describe('ProductRecommendationCarousel — Callbacks', () => {
  it('calls onSelectProduct when card "Add to Cart" button is clicked', () => {
    const onSelect = vi.fn();
    render(React.createElement(ProductRecommendationCarousel, {
      products: singleProduct,
      onSelectProduct: onSelect,
    }));
    const cardBtn = document.querySelector('[data-testid="cart-toggle-card"]') as HTMLElement;
    fireEvent.click(cardBtn);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(singleProduct[0]);
  });

  it('does NOT call onSelectProduct when removing from cart', () => {
    const onSelect = vi.fn();
    // Pre-seed cart
    mockStorage['cart'] = JSON.stringify([{ productId: 'p1', id: 'c1', name: 'T', price: 100, quantity: 1, stock: 99 }]);
    render(React.createElement(ProductRecommendationCarousel, {
      products: singleProduct,
      onSelectProduct: onSelect,
    }));
    const cardBtn = document.querySelector('[data-testid="cart-toggle-card"]') as HTMLElement;
    fireEvent.click(cardBtn); // remove
    expect(onSelect).not.toHaveBeenCalled();
  });
});
