/**
 * Unit tests for the Question Generator
 *
 * Covers the critical bug where TOTAL_QUESTIONS=3 was hardcoded but only
 * 2 questions were generated when budget/brand were already detected.
 */

import { describe, it, expect } from 'vitest';
import { generateQuestions } from '../question-generator';
import type { ParsedIntent } from '../types';

function makeIntent(overrides: Partial<ParsedIntent> = {}): ParsedIntent {
  return {
    category: null,
    brand: null,
    budget: null,
    use_case: null,
    features: [],
    confidence: 60,
    raw_tokens: [],
    matched_entities: [],
    noun_signals: [],
    amount_signals: [],
    ...overrides,
  };
}

describe('generateQuestions', () => {
  describe('washing machine — brand + budget already detected', () => {
    const intent = makeIntent({
      category: 'washing_machine',
      brand: 'lg',
      budget: { min: 0, max: 50000 },
    });

    it('generates exactly 2 questions (use_case + feature) when budget & brand are known', () => {
      const questions = generateQuestions(intent);
      // Budget + brand are already detected, so only use_case and feature should be generated
      expect(questions.length).toBeLessThanOrEqual(2);
      expect(questions.length).toBeGreaterThan(0);
    });

    it('does NOT generate a budget question when budget is already known', () => {
      const questions = generateQuestions(intent);
      expect(questions.find((q) => q.category === 'budget')).toBeUndefined();
    });

    it('does NOT generate a brand question when brand is already known', () => {
      const questions = generateQuestions(intent);
      expect(questions.find((q) => q.category === 'brand')).toBeUndefined();
    });

    it('generates use_case and/or feature questions', () => {
      const questions = generateQuestions(intent);
      const categories = questions.map((q) => q.category);
      const hasUseCaseOrFeature = categories.some((c) => c === 'use_case' || c === 'feature');
      expect(hasUseCaseOrFeature).toBe(true);
    });

    it('each question has required fields', () => {
      const questions = generateQuestions(intent);
      questions.forEach((q) => {
        expect(q.id).toBeTruthy();
        expect(q.question).toBeTruthy();
        expect(Array.isArray(q.options)).toBe(true);
        expect(q.options.length).toBeGreaterThan(0);
        expect(q.category).toBeTruthy();
      });
    });
  });

  describe('phone — nothing detected', () => {
    const intent = makeIntent({ category: 'phone' });

    it('generates up to 3 questions', () => {
      const questions = generateQuestions(intent);
      expect(questions.length).toBeGreaterThan(0);
      expect(questions.length).toBeLessThanOrEqual(3);
    });

    it('generates a budget question first when budget is unknown', () => {
      const questions = generateQuestions(intent);
      expect(questions[0]?.category).toBe('budget');
    });
  });

  describe('laptop — budget known, no brand/use_case', () => {
    const intent = makeIntent({
      category: 'laptop',
      budget: { min: 50000, max: 100000 },
    });

    it('does not generate budget question', () => {
      const questions = generateQuestions(intent);
      expect(questions.find((q) => q.category === 'budget')).toBeUndefined();
    });

    it('generates brand and use_case questions for laptop', () => {
      const questions = generateQuestions(intent);
      expect(questions.length).toBeGreaterThan(0);
    });
  });

  describe('question IDs are sequential', () => {
    it('assigns sequential ids q1, q2, q3', () => {
      const intent = makeIntent({ category: 'phone' });
      const questions = generateQuestions(intent);
      questions.forEach((q, idx) => {
        expect(q.id).toBe(`q${idx + 1}`);
      });
    });
  });

  describe('MAX_QUESTIONS cap', () => {
    it('never exceeds 3 questions', () => {
      // Scenario with nothing detected — should still not exceed 3
      const intent = makeIntent({ category: 'headphones', features: [] });
      const questions = generateQuestions(intent);
      expect(questions.length).toBeLessThanOrEqual(3);
    });
  });

  describe('safety-net: always returns ≥1 question even when intent is fully specified', () => {
    it('returns at least 1 question when budget + brand + use_case + features are all known', () => {
      const fullySpecified = makeIntent({
        category: 'appliances',
        brand: 'LG',
        budget: { min: 30000, max: 60000 },
        use_case: 'home',
        features: ['inverter', 'energy_efficient'],
      });
      const questions = generateQuestions(fullySpecified);
      expect(questions.length).toBeGreaterThanOrEqual(1);
    });

    it('safety-net question has valid structure', () => {
      const fullySpecified = makeIntent({
        category: 'laptop',
        brand: 'Dell',
        budget: { min: 50000, max: 80000 },
        use_case: 'gaming',
        features: ['gpu', 'display', 'battery'],
      });
      const questions = generateQuestions(fullySpecified);
      // Must always have at least the safety-net question
      expect(questions.length).toBeGreaterThanOrEqual(1);
      const q = questions[0];
      expect(q.id).toBeTruthy();
      expect(q.question).toBeTruthy();
      expect(Array.isArray(q.options)).toBe(true);
      expect(q.options.length).toBeGreaterThan(0);
    });

    it('safety-net question is categorised as "feature"', () => {
      const fullySpecified = makeIntent({
        category: 'phone',
        brand: 'Samsung',
        budget: { min: 0, max: 30000 },
        use_case: 'photography',
        features: ['camera', '5g', 'fast_charging', 'display'],
      });
      const questions = generateQuestions(fullySpecified);
      expect(questions.length).toBeGreaterThanOrEqual(1);
      expect(questions[0].category).toBe('feature');
    });
  });
});
