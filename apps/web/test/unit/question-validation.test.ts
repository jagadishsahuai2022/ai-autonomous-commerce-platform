/**
 * Unit Tests — Intent Question Validation
 * 
 * Validates that the question validation logic properly filters out
 * malformed/empty question stubs from learning DB and enrichment responses.
 */

import { describe, it, expect } from 'vitest';

describe('Question Validation Logic', () => {
  // Simulates the validation logic from route.ts
  function isValidQuestionSet(questions: Array<Record<string, unknown>>): boolean {
    return questions.every(
      (q) =>
        typeof q.question === 'string' &&
        (q.question as string).length > 0 &&
        Array.isArray(q.options) &&
        (q.options as unknown[]).length > 0
    );
  }

  function filterValidEnrichedQuestions(
    enrichedQuestions: Array<{ text: string; options: string[]; category: string; priority: number }>
  ) {
    return enrichedQuestions.filter(
      (eq) => eq.text && Array.isArray(eq.options) && eq.options.length > 0
    );
  }

  describe('isValidQuestionSet', () => {
    it('returns true for properly formed questions', () => {
      const questions = [
        {
          id: 'q1',
          question: "What's your budget range for an appliance?",
          type: 'multiple_choice',
          options: [
            { value: '0_10000', label: 'Under ₹10K' },
            { value: '10000_30000', label: '₹10K – ₹30K' },
          ],
          category: 'budget',
          required: false,
        },
        {
          id: 'q2',
          question: 'What will you primarily use this appliance for?',
          type: 'multiple_choice',
          options: [
            { value: 'home', label: '🏠 Family / Daily Use' },
            { value: 'energy_efficient', label: '⚡ Energy Saving' },
          ],
          category: 'use_case',
          required: false,
        },
      ];
      expect(isValidQuestionSet(questions)).toBe(true);
    });

    it('returns false for stub questions [{id, category}]', () => {
      const stubs = [
        { id: 'q1', category: 'use_case' },
        { id: 'q2', category: 'feature' },
      ];
      expect(isValidQuestionSet(stubs)).toBe(false);
    });

    it('returns false when question text is empty string', () => {
      const questions = [
        {
          id: 'q1',
          question: '',
          type: 'multiple_choice',
          options: [{ value: 'a', label: 'A' }],
          category: 'budget',
        },
      ];
      expect(isValidQuestionSet(questions)).toBe(false);
    });

    it('returns false when options is empty array', () => {
      const questions = [
        {
          id: 'q1',
          question: 'What is your budget?',
          type: 'multiple_choice',
          options: [],
          category: 'budget',
        },
      ];
      expect(isValidQuestionSet(questions)).toBe(false);
    });

    it('returns false when question field is missing', () => {
      const questions = [
        {
          id: 'q1',
          type: 'multiple_choice',
          options: [{ value: 'a', label: 'A' }],
          category: 'budget',
        },
      ];
      expect(isValidQuestionSet(questions)).toBe(false);
    });

    it('returns false when options is not an array', () => {
      const questions = [
        {
          id: 'q1',
          question: 'What budget?',
          type: 'multiple_choice',
          options: 'not an array',
          category: 'budget',
        },
      ];
      expect(isValidQuestionSet(questions)).toBe(false);
    });

    it('handles mix of valid and invalid questions', () => {
      const mixed = [
        {
          id: 'q1',
          question: 'Valid question?',
          options: [{ value: 'a', label: 'A' }],
          category: 'budget',
        },
        { id: 'q2', category: 'feature' }, // stub
      ];
      // every() means ALL must be valid
      expect(isValidQuestionSet(mixed)).toBe(false);
    });
  });

  describe('filterValidEnrichedQuestions', () => {
    it('keeps questions with text and options', () => {
      const enriched = [
        { text: 'Fully automatic?', options: ['Yes', 'No'], category: 'type', priority: 1 },
        { text: 'Capacity?', options: ['6kg', '7kg', '8kg'], category: 'capacity', priority: 2 },
      ];
      const filtered = filterValidEnrichedQuestions(enriched);
      expect(filtered).toHaveLength(2);
    });

    it('removes questions with empty options', () => {
      const enriched = [
        { text: 'Fully automatic?', options: ['Yes', 'No'], category: 'type', priority: 1 },
        { text: 'Empty question', options: [] as string[], category: 'empty', priority: 2 },
      ];
      const filtered = filterValidEnrichedQuestions(enriched);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].text).toBe('Fully automatic?');
    });

    it('removes questions with empty text', () => {
      const enriched = [
        { text: '', options: ['a', 'b'], category: 'x', priority: 1 },
        { text: 'Valid?', options: ['Yes'], category: 'y', priority: 2 },
      ];
      const filtered = filterValidEnrichedQuestions(enriched);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].text).toBe('Valid?');
    });

    it('returns empty array if all invalid', () => {
      const enriched = [
        { text: '', options: [] as string[], category: 'x', priority: 1 },
      ];
      const filtered = filterValidEnrichedQuestions(enriched);
      expect(filtered).toHaveLength(0);
    });
  });
});

describe('Smart Intent — Question Generator Appliances coverage', () => {
  it('generates questions for appliance category with budget detected', async () => {
    const { generateQuestions } = await import('@/lib/smart-intent/question-generator');
    const intent = {
      category: 'appliances',
      brand: null,
      budget: { min: 0, max: 40000 },
      use_case: null,
      features: [] as string[],
      confidence: 65,
      raw_tokens: ['washing', 'machine', 'under', '40000'],
      matched_entities: [],
    };

    const questions = generateQuestions(intent);
    expect(questions.length).toBeGreaterThan(0);

    // Each question must have options
    for (const q of questions) {
      expect(q.question.length).toBeGreaterThan(3);
      expect(q.options.length).toBeGreaterThan(0);
      expect(q.type).toBe('multiple_choice');
    }

    // Budget detected → no budget question, but use_case/feature should be present
    const categories = questions.map((q) => q.category);
    // Should have use_case or feature
    expect(categories.some((c) => c === 'use_case' || c === 'feature')).toBe(true);
  });

  it('generates budget question when no budget detected', async () => {
    const { generateQuestions } = await import('@/lib/smart-intent/question-generator');
    const intent = {
      category: 'appliances',
      brand: null,
      budget: null,
      use_case: null,
      features: [] as string[],
      confidence: 50,
      raw_tokens: ['washing', 'machine'],
      matched_entities: [],
    };

    const questions = generateQuestions(intent);
    const budgetQ = questions.find((q) => q.category === 'budget');
    expect(budgetQ).toBeDefined();
    expect(budgetQ!.options.length).toBeGreaterThan(0);
  });
});

describe('Noun/Amount extraction for learning match', () => {
  const STOP_WORDS = new Set([
    'i', 'me', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'shall', 'would', 'should',
    'may', 'might', 'can', 'could', 'must', 'need', 'want', 'looking', 'for', 'to',
    'of', 'in', 'on', 'at', 'by', 'with', 'from', 'up', 'about', 'into', 'through',
    'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
    'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where',
    'why', 'how', 'all', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
    'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    's', 't', 'just', 'don', 'now', 'get', 'find', 'show', 'give', 'best', 'good',
    'top', 'cheap', 'budget', 'expensive', 'premium', 'and', 'or', 'but', 'if', 'it',
    'its', 'this', 'that', 'what', 'which', 'who', 'whom', 'my', 'your', 'his', 'her',
  ]);

  function extractNouns(text: string): string[] {
    return text
      .replace(/[^a-z0-9\s]/gi, '')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
  }

  function extractAmounts(text: string): number[] {
    const matches = text.match(/\d[\d,]*(?:\.\d+)?/g);
    if (!matches) return [];
    return matches.map((m) => parseFloat(m.replace(/,/g, ''))).filter((n) => n >= 100);
  }

  it('extracts nouns from "washing machine under 40000"', () => {
    const nouns = extractNouns('washing machine under 40000');
    expect(nouns).toContain('washing');
    expect(nouns).toContain('machine');
    expect(nouns).not.toContain('under');
    expect(nouns).not.toContain('40000');
  });

  it('extracts amounts from "washing machine under 40000"', () => {
    const amounts = extractAmounts('washing machine under 40000');
    expect(amounts).toContain(40000);
  });

  it('handles "lg washing machine under 50000"', () => {
    const nouns = extractNouns('lg washing machine under 50000');
    expect(nouns).toContain('lg');
    expect(nouns).toContain('washing');
    expect(nouns).toContain('machine');
    const amounts = extractAmounts('lg washing machine under 50000');
    expect(amounts).toContain(50000);
  });

  it('handles "best smartphone for photography" (no amounts)', () => {
    const nouns = extractNouns('best smartphone for photography');
    expect(nouns).toContain('smartphone');
    expect(nouns).toContain('photography');
    expect(nouns).not.toContain('best');
    expect(nouns).not.toContain('for');
    const amounts = extractAmounts('best smartphone for photography');
    expect(amounts).toHaveLength(0);
  });
});
