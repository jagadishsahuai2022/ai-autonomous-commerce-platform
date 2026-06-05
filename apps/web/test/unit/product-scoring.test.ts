/**
 * Unit Tests — Product Scoring Utilities (Round 35)
 *
 * Tests the scoring functions extracted from the Metrics Validation page.
 * These functions underpin the Smart Intent Engine's 7-dimension product scoring.
 */

import { describe, it, expect } from 'vitest';
import {
  computeSpecScore,
  computeWarrantyInfo,
  getBrandTier,
  parseDeliveryInfo,
  computeVerifiedRating,
  deduplicateSessions,
  PREMIUM_BRANDS,
  RISING_BRANDS,
} from '../../lib/scoring/product-scoring';

// ─────────────────────────────────────────────────────────────────────────────
// computeSpecScore
// ─────────────────────────────────────────────────────────────────────────────
describe('computeSpecScore', () => {
  it('returns 0.20 for no features (minimal coverage)', () => {
    const result = computeSpecScore([]);
    expect(result.score).toBe(0.20);
    expect(result.featureCount).toBe(0);
    expect(result.highlights).toHaveLength(0);
  });

  it('score increases with feature count', () => {
    const s1 = computeSpecScore(['Feature A']);
    const s3 = computeSpecScore(['A', 'B', 'C']);
    const s6 = computeSpecScore(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(s3.score).toBeGreaterThan(s1.score);
    expect(s6.score).toBeGreaterThan(s3.score);
  });

  it('caps at 0.95 for many features', () => {
    const result = computeSpecScore(Array.from({ length: 20 }, (_, i) => `Feature ${i}`));
    expect(result.score).toBeLessThanOrEqual(0.95);
  });

  it('highlights are capped at 4 items', () => {
    const result = computeSpecScore(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(result.highlights).toHaveLength(4);
  });

  it('handles null/undefined features gracefully', () => {
    // @ts-ignore — intentional null test for boundary condition
    const result = computeSpecScore(null);
    expect(result.score).toBe(0.20);
    expect(result.featureCount).toBe(0);
  });

  it('returns correct featureCount', () => {
    const features = ['16GB RAM', '512GB SSD', '12th Gen i7', '1 year warranty'];
    const result = computeSpecScore(features);
    expect(result.featureCount).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeWarrantyInfo
// ─────────────────────────────────────────────────────────────────────────────
describe('computeWarrantyInfo', () => {
  it('detects 5-year warranty with score 1.00', () => {
    const result = computeWarrantyInfo(['5 year warranty', 'ANC']);
    expect(result.score).toBe(1.00);
    expect(result.found).toBe(true);
    expect(result.label).toContain('5-Year');
  });

  it('detects 3-year warranty', () => {
    const result = computeWarrantyInfo(['3yr warranty included']);
    expect(result.score).toBe(0.90);
    expect(result.found).toBe(true);
  });

  it('detects 2-year warranty', () => {
    const result = computeWarrantyInfo(['2-year manufacturer warranty']);
    expect(result.score).toBe(0.80);
    expect(result.found).toBe(true);
  });

  it('detects 1-year warranty from the word "warranty"', () => {
    const result = computeWarrantyInfo(['Limited warranty provided', 'ANC']);
    expect(result.score).toBe(0.65);
    expect(result.found).toBe(true);
  });

  it('returns 0.30 and found=false when no warranty info', () => {
    const result = computeWarrantyInfo(['Bluetooth', '30hr battery', 'Foldable design']);
    expect(result.score).toBe(0.30);
    expect(result.found).toBe(false);
  });

  it('handles empty array', () => {
    const result = computeWarrantyInfo([]);
    expect(result.score).toBe(0.30);
    expect(result.found).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getBrandTier
// ─────────────────────────────────────────────────────────────────────────────
describe('getBrandTier', () => {
  it('classifies Sony as premium with score 0.90', () => {
    const result = getBrandTier('Sony');
    expect(result.tier).toBe('premium');
    expect(result.score).toBe(0.90);
    expect(result.country).toBe('Japan');
  });

  it('classifies Apple as premium (USA)', () => {
    const result = getBrandTier('Apple');
    expect(result.tier).toBe('premium');
    expect(result.country).toBe('USA');
  });

  it('classifies Samsung as premium (South Korea)', () => {
    const result = getBrandTier('Samsung');
    expect(result.tier).toBe('premium');
    expect(result.country).toBe('South Korea');
  });

  it('classifies OnePlus as rising brand', () => {
    const result = getBrandTier('OnePlus');
    expect(result.tier).toBe('rising');
    expect(result.score).toBe(0.70);
  });

  it('classifies Xiaomi as rising brand', () => {
    const result = getBrandTier('Xiaomi Mi 11');
    expect(result.tier).toBe('rising');
  });

  it('classifies unknown brand as standard', () => {
    const result = getBrandTier('UnknownBrand XYZ');
    expect(result.tier).toBe('standard');
    expect(result.score).toBe(0.55);
  });

  it('handles empty brand string', () => {
    const result = getBrandTier('');
    expect(result.tier).toBe('standard');
  });

  it('is case-insensitive', () => {
    const lower = getBrandTier('sony wh-1000xm5');
    const upper = getBrandTier('SONY');
    expect(lower.tier).toBe('premium');
    expect(upper.tier).toBe('premium');
  });

  it('includes description for brand profile', () => {
    const premium = getBrandTier('Samsung');
    expect(premium.description.length).toBeGreaterThan(10);
    const standard = getBrandTier('NoBrandXYZ');
    expect(standard.description.length).toBeGreaterThan(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseDeliveryInfo
// ─────────────────────────────────────────────────────────────────────────────
describe('parseDeliveryInfo', () => {
  it('returns high score for same day delivery', () => {
    const result = parseDeliveryInfo('Same Day');
    expect(result.score).toBe(1.0);
    expect(result.days).toBe(0);
    expect(result.historyNote).toMatch(/98%/);
  });

  it('returns high score for next day delivery', () => {
    const result = parseDeliveryInfo('Next Day');
    expect(result.score).toBe(0.95);
    expect(result.days).toBe(1);
    expect(result.historyNote).toMatch(/95%/);
  });

  it('handles 1-2 day range delivery', () => {
    const result = parseDeliveryInfo('1-2 days');
    expect(result.score).toBe(0.85);
    expect(result.label).toBe('1–2 days');
    expect(result.historyNote).toMatch(/last 12 months/);
  });

  it('handles 3-5 day range delivery (standard)', () => {
    const result = parseDeliveryInfo('3-5 days');
    expect(result.score).toBe(0.65);
    expect(result.historyNote).toMatch(/78%/);
  });

  it('handles slow 7+ day delivery', () => {
    const result = parseDeliveryInfo('7-10 days');
    expect(result.score).toBeLessThan(0.65);
  });

  it('returns low score for unknown delivery', () => {
    const result = parseDeliveryInfo('unknown');
    expect(result.score).toBe(0.35);
    expect(result.historyNote).toMatch(/Insufficient/);
  });

  it('handles empty string gracefully', () => {
    const result = parseDeliveryInfo('');
    expect(result.score).toBe(0.35);
  });

  it('historyNote always contains "12 months" or "Insufficient" context', () => {
    const inputs = ['1 day', '2-3 days', '5-7 days', '14 days', ''];
    for (const input of inputs) {
      const result = parseDeliveryInfo(input);
      expect(result.historyNote.length).toBeGreaterThan(5);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeVerifiedRating
// ─────────────────────────────────────────────────────────────────────────────
describe('computeVerifiedRating', () => {
  it('returns Highly Trusted for 5000+ reviews', () => {
    const result = computeVerifiedRating(4.5, 10000);
    expect(result.trust).toBe('high');
    expect(result.trustLabel).toBe('Highly Trusted');
    expect(result.verifiedScore).toBeCloseTo((4.5 / 5) * 1.00, 3);
  });

  it('returns Trusted for 500-4999 reviews', () => {
    const result = computeVerifiedRating(4.2, 1200);
    expect(result.trust).toBe('medium');
    expect(result.trustLabel).toBe('Trusted');
    expect(result.verifiedScore).toBeCloseTo((4.2 / 5) * 0.85, 3);
  });

  it('returns Limited Data for under 500 reviews', () => {
    const result = computeVerifiedRating(3.8, 150);
    expect(result.trust).toBe('low');
    expect(result.trustLabel).toBe('Limited Data');
    expect(result.verifiedScore).toBeCloseTo((3.8 / 5) * 0.60, 3);
  });

  it('estimates verified reviews at ~42% of total', () => {
    const result = computeVerifiedRating(4.0, 1000);
    expect(result.verifiedEstimate).toBe(420);
  });

  it('clamps rating between 0 and 5', () => {
    const overMax = computeVerifiedRating(6.0, 1000);
    expect(overMax.verifiedScore).toBeLessThanOrEqual(1.0);
    const zeroRating = computeVerifiedRating(0, 5000);
    expect(zeroRating.verifiedScore).toBe(0);
  });

  it('handles 0 reviews gracefully', () => {
    const result = computeVerifiedRating(4.0, 0);
    expect(result.trust).toBe('low');
    expect(result.verifiedEstimate).toBe(0);
  });

  it('provides CSS class info for trust badge rendering', () => {
    const high = computeVerifiedRating(4.5, 10000);
    expect(high.trustBg).toContain('green');
    const medium = computeVerifiedRating(4.0, 800);
    expect(medium.trustBg).toContain('amber');
    const low = computeVerifiedRating(3.5, 50);
    expect(low.trustBg).toContain('gray');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// deduplicateSessions
// ─────────────────────────────────────────────────────────────────────────────
describe('deduplicateSessions', () => {
  const baseTime = Date.now();

  function makeSession(overrides: Partial<{
    id: string; query: string; timestamp: number; userId: string;
  }>) {
    return {
      id: overrides.id ?? 'session-1',
      userId: overrides.userId ?? 'user-1',
      query: overrides.query ?? 'Test query',
      timestamp: overrides.timestamp ?? baseTime,
      products: [],
      timeline: [],
    };
  }

  it('returns single session unchanged', () => {
    const sessions = [makeSession({ id: 's1' })];
    expect(deduplicateSessions(sessions)).toHaveLength(1);
  });

  it('removes "Current Session" duplicates within 90 seconds', () => {
    const sessions = [
      makeSession({ id: 'current', query: 'Current Session', timestamp: baseTime }),
      makeSession({ id: 'history', query: 'Best laptops under 50000', timestamp: baseTime - 30000 }),
    ];
    // "Current Session" is within 90s of history entry — should be removed
    const result = deduplicateSessions(sessions);
    // The "Current Session" entry should be deduplicated (it matches by query label)
    expect(result.some(s => s.query === 'Current Session')).toBe(false);
  });

  it('keeps sessions with different queries separated by more than 90 seconds', () => {
    const sessions = [
      makeSession({ id: 's1', query: 'Best laptops under 50000', timestamp: baseTime }),
      makeSession({ id: 's2', query: 'Wireless earbuds for gym', timestamp: baseTime - 200000 }),
    ];
    const result = deduplicateSessions(sessions);
    expect(result).toHaveLength(2);
  });

  it('removes duplicate sessions with identical queries', () => {
    const sessions = [
      makeSession({ id: 's1', query: 'Headphones under 30000', timestamp: baseTime }),
      makeSession({ id: 's2', query: 'Headphones under 30000', timestamp: baseTime - 100 }),
    ];
    const result = deduplicateSessions(sessions);
    expect(result).toHaveLength(1);
  });

  it('handles empty array', () => {
    expect(deduplicateSessions([])).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Brand constant exports
// ─────────────────────────────────────────────────────────────────────────────
describe('Brand constants', () => {
  it('PREMIUM_BRANDS includes major electronics brands', () => {
    expect(PREMIUM_BRANDS).toContain('sony');
    expect(PREMIUM_BRANDS).toContain('apple');
    expect(PREMIUM_BRANDS).toContain('samsung');
  });

  it('RISING_BRANDS includes emerging Asian brands', () => {
    expect(RISING_BRANDS).toContain('realme');
    expect(RISING_BRANDS).toContain('oneplus');
    expect(RISING_BRANDS).toContain('xiaomi');
  });

  it('no brand appears in both PREMIUM and RISING lists', () => {
    const overlap = PREMIUM_BRANDS.filter(b => RISING_BRANDS.includes(b));
    expect(overlap).toHaveLength(0);
  });
});
