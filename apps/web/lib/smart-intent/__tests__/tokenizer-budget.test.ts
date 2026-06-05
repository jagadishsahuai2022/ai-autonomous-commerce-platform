/**
 * Tokenizer & Budget Extraction — Regression Tests
 *
 * Covers critical scenarios where ₹ symbols, commas, lakhs, and various
 * amount formats must be correctly parsed into budget objects.
 */

import { describe, it, expect } from 'vitest';
import { tokenize } from '../tokenizer';
import { extractEntities } from '../entity-extractor';
import { processQuery } from '../index';

describe('Tokenizer — comma-in-numbers handling', () => {
  it('should strip commas from ₹50,000 → 50000', () => {
    const { normalized } = tokenize('laptop under ₹50,000');
    expect(normalized).toContain('50000');
    expect(normalized).not.toContain('50,000');
  });

  it('should strip commas from 1,50,000 (Indian notation)', () => {
    const { normalized } = tokenize('phone under 1,50,000');
    expect(normalized).toContain('150000');
  });

  it('should strip ₹ symbol and commas together', () => {
    const { normalized } = tokenize('Find laptops under ₹50,000');
    expect(normalized).toContain('50000');
    expect(normalized).not.toContain('₹');
  });

  it('should handle "Rs. 25,000" with dot and comma', () => {
    const { normalized } = tokenize('headphones under Rs. 25,000');
    expect(normalized).toContain('25000');
  });

  it('should preserve k-suffix after comma stripping: "₹1,500" → "1500"', () => {
    const { normalized } = tokenize('earphones under ₹1,500');
    expect(normalized).toContain('1500');
  });
});

describe('Entity Extractor — budget from comma-formatted amounts', () => {
  it('should parse "laptop under ₹50,000" → budget max 50000', () => {
    const { tokens, normalized } = tokenize('laptop under ₹50,000');
    const intent = extractEntities(tokens, normalized);
    expect(intent.budget).toBeTruthy();
    expect(intent.budget!.max).toBe(50000);
  });

  it('should parse "phone under 1,50,000" → budget max 150000', () => {
    const { tokens, normalized } = tokenize('phone under 1,50,000');
    const intent = extractEntities(tokens, normalized);
    expect(intent.budget).toBeTruthy();
    expect(intent.budget!.max).toBe(150000);
  });

  it('should parse "tv under ₹25,000" → budget max 25000', () => {
    const { tokens, normalized } = tokenize('tv under ₹25,000');
    const intent = extractEntities(tokens, normalized);
    expect(intent.budget).toBeTruthy();
    expect(intent.budget!.max).toBe(25000);
  });

  it('should still handle non-comma amounts: "under 50000"', () => {
    const { tokens, normalized } = tokenize('laptop under 50000');
    const intent = extractEntities(tokens, normalized);
    expect(intent.budget).toBeTruthy();
    expect(intent.budget!.max).toBe(50000);
  });

  it('should still handle k-suffix: "under 50k"', () => {
    const { tokens, normalized } = tokenize('laptop under 50k');
    const intent = extractEntities(tokens, normalized);
    expect(intent.budget).toBeTruthy();
    expect(intent.budget!.max).toBe(50000);
  });
});

describe('Full Pipeline — comma amount queries', () => {
  it('"Find laptops under ₹50,000" → laptop category, products under budget', () => {
    const result = processQuery('Find laptops under ₹50,000');
    expect(result.engine_version).toBe('v2');
    expect(result.intent.category).toBe('laptop');
    expect(result.intent.budget).toBeTruthy();
    expect(result.intent.budget!.max).toBe(50000);
    expect(result.products.length).toBeGreaterThan(0);
    // ALL products must be within budget
    for (const p of result.products) {
      expect(p.price).toBeLessThanOrEqual(50000);
      expect(p.category).toBe('laptop');
    }
  });

  it('"phone under ₹20,000" → phone category, budget correct', () => {
    const result = processQuery('phone under ₹20,000');
    expect(result.intent.category).toBe('phone');
    expect(result.intent.budget!.max).toBe(20000);
    expect(result.products.length).toBeGreaterThan(0);
    for (const p of result.products) {
      expect(p.price).toBeLessThanOrEqual(20000);
    }
  });

  it('"headphones under Rs.5,000" → headphones category', () => {
    const result = processQuery('headphones under Rs.5,000');
    expect(result.intent.category).toBe('headphones');
    expect(result.intent.budget!.max).toBe(5000);
  });

  it('"best laptop under ₹50,000" returns only laptop category, no phones', () => {
    const result = processQuery('best laptop under ₹50,000');
    expect(result.products.length).toBeGreaterThan(0);
    for (const p of result.products) {
      expect(p.category).toBe('laptop');
      expect(p.price).toBeLessThanOrEqual(50000);
    }
  });
});
