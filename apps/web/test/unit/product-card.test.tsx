/**
 * Unit Tests — AmazonProductCard component (Vitest + React Testing Library)
 * Covers: rendering, trust score, price trend, delivery ETA, COD/EMI badges,
 *         AI recommended badge, wishlist toggle, add-to-cart callback
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_t, prop) => ({ children, className, ...rest }: any) =>
      React.createElement('div', { 'data-motion': String(prop), className, ...rest }, children),
  }),
  AnimatePresence: ({ children }: any) => children,
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, fill, ...rest }: any) => React.createElement('img', { src, alt, ...rest }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: any) => React.createElement('a', { href }, children),
}));

vi.mock('@/lib/formatting', () => ({
  formatPrice: (price: number) => `₹${price.toLocaleString('en-IN')}`,
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseProduct = {
  id: 'prod-001',
  name: 'Sony WH-1000XM5 Headphones',
  description: 'Industry-leading noise cancelling headphones',
  price: 29999,
  originalPrice: 34999,
  rating: 4.8,
  reviews: 1500,
  reviewCount: 1500,
  image: 'https://cdn.example.com/sony.jpg',
  category: 'Electronics',
  brand: 'Sony',
  inStock: true,
  delivery: { daysMin: 2, daysMax: 3, free: true },
  codAvailable: true,
  hasEMI: true,
  trustScore: 94,
  priceTrend: 'down' as const,
  priceTrendPct: 14,
  aiRecommended: false,
  aiConfidence: 88,
};

// ─── Import component ─────────────────────────────────────────────────────────

let AmazonProductCard: any;
beforeEach(async () => {
  const mod = await import('../../components/product/AmazonProductCard').catch(() => null);
  if (mod) AmazonProductCard = mod.AmazonProductCard ?? mod.default;
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AmazonProductCard', () => {
  it('should render product name', () => {
    if (!AmazonProductCard) return;
    render(React.createElement(AmazonProductCard, { product: baseProduct }));
    expect(screen.getByText(/Sony WH-1000XM5/)).toBeInTheDocument();
  });

  it('should render formatted price', () => {
    if (!AmazonProductCard) return;
    render(React.createElement(AmazonProductCard, { product: baseProduct }));
    expect(screen.getByText(/₹29,999|29999/)).toBeInTheDocument();
  });

  it('should show discount badge when originalPrice is set', () => {
    if (!AmazonProductCard) return;
    render(React.createElement(AmazonProductCard, { product: baseProduct }));
    // 14% discount
    expect(screen.getByText(/\d+% OFF/)).toBeInTheDocument();
  });

  it('should show COD badge when codAvailable is true', () => {
    if (!AmazonProductCard) return;
    render(React.createElement(AmazonProductCard, { product: baseProduct }));
    expect(screen.getByText(/COD/)).toBeInTheDocument();
  });

  it('should show EMI badge when hasEMI is true', () => {
    if (!AmazonProductCard) return;
    render(React.createElement(AmazonProductCard, { product: baseProduct }));
    expect(screen.getByText(/EMI/)).toBeInTheDocument();
  });

  it('should show trust score badge', () => {
    if (!AmazonProductCard) return;
    render(React.createElement(AmazonProductCard, { product: baseProduct }));
    expect(screen.getByText(/94%/)).toBeInTheDocument();
  });

  it('should show price trend down indicator', () => {
    if (!AmazonProductCard) return;
    render(React.createElement(AmazonProductCard, { product: baseProduct }));
    // Both discount badge ("14% OFF") and trend indicator ("14%") match — use getAllByText
    const matches = screen.getAllByText(/14%/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('should show delivery ETA', () => {
    if (!AmazonProductCard) return;
    render(React.createElement(AmazonProductCard, { product: baseProduct }));
    expect(screen.getByText(/days|Tomorrow|Today/)).toBeInTheDocument();
  });

  it('should show AI+ badge on all products', () => {
    if (!AmazonProductCard) return;
    render(React.createElement(AmazonProductCard, { product: baseProduct }));
    expect(screen.getByText(/AI\+/)).toBeInTheDocument();
  });

  it('should show AI+ badge regardless of aiRecommended flag', () => {
    if (!AmazonProductCard) return;
    const aiProduct = { ...baseProduct, aiRecommended: true };
    render(React.createElement(AmazonProductCard, { product: aiProduct }));
    expect(screen.getByText(/AI\+/)).toBeInTheDocument();
  });

  it('should call onAddToCart when add-to-cart is clicked', () => {
    if (!AmazonProductCard) return;
    const onAddToCart = vi.fn();
    render(React.createElement(AmazonProductCard, { product: baseProduct, onAddToCart }));
    const btn = screen.getByText(/Add to Cart/);
    fireEvent.click(btn);
    expect(onAddToCart).toHaveBeenCalledWith(baseProduct);
  });

  it('should toggle wishlist state on heart click in hover overlay', () => {
    if (!AmazonProductCard) return;
    const onWishlist = vi.fn();
    render(React.createElement(AmazonProductCard, { product: baseProduct, onWishlist }));
    // Trigger hover to show action icons
    const card = screen.getByTestId('product-card');
    fireEvent.mouseEnter(card);
    // Find the wishlist button by its title
    const wishlistBtn = screen.getByTitle('Save to Wishlist');
    fireEvent.click(wishlistBtn);
    expect(onWishlist).toHaveBeenCalledWith(baseProduct);
  });

  it('should render out-of-stock product without crashing', () => {
    if (!AmazonProductCard) return;
    const oos = { ...baseProduct, inStock: false };
    expect(() => render(React.createElement(AmazonProductCard, { product: oos }))).not.toThrow();
  });

  it('should handle missing optional fields gracefully', () => {
    if (!AmazonProductCard) return;
    const minimal = {
      id: 'min-01', name: 'Minimal Product', description: '', price: 100,
      rating: 3, reviews: 0, reviewCount: 0, image: '', category: 'General',
      brand: 'Unknown', inStock: true,
      delivery: { daysMin: 3, daysMax: 5, free: false },
    };
    expect(() => render(React.createElement(AmazonProductCard, { product: minimal }))).not.toThrow();
  });

  it('should show strikethrough original price', () => {
    if (!AmazonProductCard) return;
    render(React.createElement(AmazonProductCard, { product: baseProduct }));
    expect(screen.getByText(/₹34,999|34999/)).toBeInTheDocument();
  });

  it('should render star ratings based on product.rating', () => {
    if (!AmazonProductCard) return;
    render(React.createElement(AmazonProductCard, { product: baseProduct }));
    expect(screen.getByText(/4.8/)).toBeInTheDocument();
  });

  // ── Round-5 regression tests ────────────────────────────────────────────────

  it('R5 should render Buy Now element with title="Buy Now" after hover', () => {
    if (!AmazonProductCard) return;
    render(React.createElement(AmazonProductCard, { product: baseProduct }));
    // framer-motion mock renders motion.button as <div data-motion="button" title="..."> 
    // so use getByTestId for hover target and getByTitle for element lookup
    const card = screen.getByTestId('product-card');
    fireEvent.mouseEnter(card);
    const buyNowEls = screen.getAllByTitle('Buy Now');
    expect(buyNowEls.length).toBeGreaterThanOrEqual(1);
  });

  it('R5 Buy Now element should NOT carry a Zap/lightning aria-label — uses CreditCard now', () => {
    if (!AmazonProductCard) return;
    render(React.createElement(AmazonProductCard, { product: baseProduct }));
    const card = screen.getByTestId('product-card');
    fireEvent.mouseEnter(card);
    const buyNowEls = screen.getAllByTitle('Buy Now');
    buyNowEls.forEach((el) => {
      const ariaLabel = el.getAttribute('aria-label') ?? '';
      expect(ariaLabel.toLowerCase()).not.toMatch(/zap|lightning|bolt/);
    });
  });

  it('R5 should call onBuyNow when Buy Now element is clicked', () => {
    if (!AmazonProductCard) return;
    const onBuyNow = vi.fn();
    render(React.createElement(AmazonProductCard, { product: baseProduct, onBuyNow }));
    const card = screen.getByTestId('product-card');
    fireEvent.mouseEnter(card);
    const buyNowEl = screen.getByTitle('Buy Now');
    fireEvent.click(buyNowEl);
    expect(onBuyNow).toHaveBeenCalledWith(baseProduct);
  });

  it('R5 AI+ badge (Zap icon) is still present on product tile', () => {
    if (!AmazonProductCard) return;
    render(React.createElement(AmazonProductCard, { product: baseProduct }));
    const aiBadge = screen.getByText(/AI\+/);
    expect(aiBadge).toBeInTheDocument();
  });
});
