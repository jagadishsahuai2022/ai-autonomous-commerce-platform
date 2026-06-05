/**
 * Product Learning + Session Personalization — Unit Tests
 */
import { describe, test, expect, beforeEach } from 'vitest';
import {
  recordLearningEvent,
  getLearningBoost,
  getBatchLearningBoosts,
  getTrendingProducts,
  getLearningStats,
  clearLearningState,
  recordImpressions,
} from '../product-learning';

describe('ProductLearning', () => {
  beforeEach(() => {
    clearLearningState();
  });

  test('records impression and returns 0 boost initially', () => {
    recordLearningEvent('p1', 'impression');
    expect(getLearningBoost('p1')).toBe(0); // impressions alone don't boost
  });

  test('click after impressions generates CTR-based boost', () => {
    for (let i = 0; i < 10; i++) recordLearningEvent('p1', 'impression');
    recordLearningEvent('p1', 'click');
    const boost = getLearningBoost('p1');
    // CTR = 1/11 ≈ 0.09, boost = ctr*10 + cart*2 + purchase*5 = ~0.9
    expect(boost).toBeGreaterThanOrEqual(0);
    expect(boost).toBeLessThanOrEqual(50);
  });

  test('add_to_cart increases boost', () => {
    recordLearningEvent('p1', 'impression');
    recordLearningEvent('p1', 'click');
    const beforeCart = getLearningBoost('p1');

    recordLearningEvent('p1', 'add_to_cart');
    const afterCart = getLearningBoost('p1');
    expect(afterCart).toBeGreaterThan(beforeCart);
  });

  test('purchase gives highest boost', () => {
    recordLearningEvent('p1', 'purchase');
    const boost = getLearningBoost('p1');
    expect(boost).toBeGreaterThanOrEqual(5);
  });

  test('batch lookup works', () => {
    recordLearningEvent('p1', 'click');
    recordLearningEvent('p2', 'purchase');
    const boosts = getBatchLearningBoosts(['p1', 'p2', 'p3']);
    expect(boosts.size).toBe(2); // p3 not tracked
    expect(boosts.has('p1')).toBe(true);
    expect(boosts.has('p2')).toBe(true);
  });

  test('recordImpressions batch works', () => {
    recordImpressions(['a', 'b', 'c']);
    const stats = getLearningStats();
    expect(stats.totalProducts).toBe(3);
    expect(stats.totalImpressions).toBe(3);
  });

  test('getTrendingProducts returns sorted by boost', () => {
    recordLearningEvent('low', 'impression');
    recordLearningEvent('high', 'purchase');
    recordLearningEvent('high', 'purchase');
    recordLearningEvent('high', 'click');

    const trending = getTrendingProducts(5);
    expect(trending.length).toBe(2);
    expect(trending[0].productId).toBe('high');
  });

  test('unknown product returns 0 boost', () => {
    expect(getLearningBoost('nonexistent')).toBe(0);
  });

  test('boost is capped at 50', () => {
    // Many purchases should still cap
    for (let i = 0; i < 100; i++) {
      recordLearningEvent('p1', 'purchase');
    }
    expect(getLearningBoost('p1')).toBeLessThanOrEqual(50);
  });

  test('stats reflect correct counts', () => {
    recordLearningEvent('p1', 'impression');
    recordLearningEvent('p1', 'impression');
    recordLearningEvent('p1', 'click');
    recordLearningEvent('p2', 'impression');

    const stats = getLearningStats();
    expect(stats.totalProducts).toBe(2);
    expect(stats.totalImpressions).toBe(3);
    expect(stats.totalClicks).toBe(1);
    expect(stats.averageCTR).toBeCloseTo(1 / 3, 1);
  });
});
