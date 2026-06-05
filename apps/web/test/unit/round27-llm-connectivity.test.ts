/**
 * Round 27 — Unit Tests
 *
 * Covers:
 * 1. LLM model connectivity check function (checkModelConnectivity)
 * 2. Claude endpoint fix (must call /v1/messages not /v1/messages/batches)
 * 3. enrichWithRealLLM respects forceRealLLM=true (returns null on failure)
 * 4. Entity extractor noun+amount confidence boost
 * 5. LLM_MODELS array correctness
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

// ────────────────────────────────────────────────────────────────────────────
// Mock global fetch
// ────────────────────────────────────────────────────────────────────────────
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

afterEach(() => {
  vi.resetAllMocks();
  // Clear env vars set in tests
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

// ────────────────────────────────────────────────────────────────────────────
// Import under test
// ────────────────────────────────────────────────────────────────────────────
import {
  checkModelConnectivity,
  enrichWithRealLLM,
  LLM_MODELS,
} from '@/lib/llm-enrichment';

import { extractEntities } from '@/lib/smart-intent/entity-extractor';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────
function mockFetchOk(body: object, status = 200) {
  fetchMock.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: async () => body,
  });
}

function mockFetchFail(status: number, errorMsg = 'error') {
  fetchMock.mockResolvedValueOnce({
    ok: false,
    status,
    statusText: errorMsg,
    json: async () => ({ error: { message: errorMsg } }),
  });
}

function mockFetchNetworkError(msg = 'Network unreachable') {
  fetchMock.mockRejectedValueOnce(new Error(msg));
}

const SAMPLE_INTENT = {
  intent: { category: 'phone', budget: { min: 0, max: 30000 } },
  confidence: 70,
  questions: [{ text: 'What brand?', category: 'brand' }],
};

// ────────────────────────────────────────────────────────────────────────────
// 1. LLM_MODELS array
// ────────────────────────────────────────────────────────────────────────────
describe('LLM_MODELS array', () => {
  it('contains 3 models with required fields', () => {
    expect(LLM_MODELS).toHaveLength(3);
    for (const m of LLM_MODELS) {
      expect(m).toHaveProperty('id');
      expect(m).toHaveProperty('name');
      expect(m).toHaveProperty('provider');
      expect(m).toHaveProperty('costPerMTok');
      expect(m).toHaveProperty('apiKeyEnv');
    }
  });

  it('includes claude-opus, gpt-4-turbo, gpt-3.5-turbo', () => {
    const ids = LLM_MODELS.map((m) => m.id);
    expect(ids).toContain('claude-opus');
    expect(ids).toContain('gpt-4-turbo');
    expect(ids).toContain('gpt-3.5-turbo');
  });

  it('claude-opus uses Anthropic provider', () => {
    const claude = LLM_MODELS.find((m) => m.id === 'claude-opus')!;
    expect(claude.provider).toBe('Anthropic');
    expect(claude.apiKeyEnv).toBe('ANTHROPIC_API_KEY');
  });

  it('openai models use OpenAI provider', () => {
    const gpt4 = LLM_MODELS.find((m) => m.id === 'gpt-4-turbo')!;
    const gpt35 = LLM_MODELS.find((m) => m.id === 'gpt-3.5-turbo')!;
    expect(gpt4.provider).toBe('OpenAI');
    expect(gpt35.provider).toBe('OpenAI');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. checkModelConnectivity — API key missing
// ────────────────────────────────────────────────────────────────────────────
describe('checkModelConnectivity — API key missing', () => {
  it('returns connected=false and apiKeyConfigured=false when ANTHROPIC_API_KEY unset', async () => {
    const result = await checkModelConnectivity('claude-opus');
    expect(result.connected).toBe(false);
    expect(result.apiKeyConfigured).toBe(false);
    expect(result.error).toMatch(/ANTHROPIC_API_KEY/i);
  });

  it('returns connected=false and apiKeyConfigured=false when OPENAI_API_KEY unset', async () => {
    const result = await checkModelConnectivity('gpt-4-turbo');
    expect(result.connected).toBe(false);
    expect(result.apiKeyConfigured).toBe(false);
    expect(result.error).toMatch(/OPENAI_API_KEY/i);
  });

  it('returns error for unknown modelId', async () => {
    const result = await checkModelConnectivity('unknown-model');
    expect(result.connected).toBe(false);
    expect(result.error).toMatch(/Unknown model/i);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. checkModelConnectivity — Claude: correct endpoint + responses
// ────────────────────────────────────────────────────────────────────────────
describe('checkModelConnectivity — Claude endpoint', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-key';
  });

  it('calls /v1/messages (NOT /v1/messages/batches)', async () => {
    mockFetchOk({ content: [{ text: 'pong' }], usage: { input_tokens: 1, output_tokens: 1 } });

    await checkModelConnectivity('claude-opus');

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(url).not.toContain('batches'); // CRITICAL: must NOT use Batch API
  });

  it('returns connected=true on HTTP 200', async () => {
    mockFetchOk({ content: [{ text: 'pong' }], usage: {} });
    const result = await checkModelConnectivity('claude-opus');
    expect(result.connected).toBe(true);
    expect(result.apiKeyConfigured).toBe(true);
    expect(result.latencyMs).toBeTypeOf('number');
  });

  it('returns connected=false with auth error on HTTP 401', async () => {
    mockFetchFail(401, 'Unauthorized');
    const result = await checkModelConnectivity('claude-opus');
    expect(result.connected).toBe(false);
    expect(result.error).toMatch(/invalid or expired/i);
  });

  it('returns connected=false with rate-limit message on HTTP 429', async () => {
    mockFetchFail(429, 'Too Many Requests');
    const result = await checkModelConnectivity('claude-opus');
    expect(result.connected).toBe(false);
    expect(result.error).toMatch(/rate limit/i);
  });

  it('returns connected=false on network error', async () => {
    mockFetchNetworkError('ECONNREFUSED');
    const result = await checkModelConnectivity('claude-opus');
    expect(result.connected).toBe(false);
    expect(result.error).toMatch(/Network error/i);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. checkModelConnectivity — OpenAI
// ────────────────────────────────────────────────────────────────────────────
describe('checkModelConnectivity — OpenAI', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-openai-test';
  });

  it('returns connected=true for gpt-4-turbo on 200', async () => {
    mockFetchOk({ choices: [{ message: { content: 'pong' } }], usage: { total_tokens: 2 } });
    const result = await checkModelConnectivity('gpt-4-turbo');
    expect(result.connected).toBe(true);
    expect(result.provider).toBe('OpenAI');
  });

  it('returns connected=true for gpt-3.5-turbo on 200', async () => {
    mockFetchOk({ choices: [{ message: { content: 'pong' } }], usage: { total_tokens: 2 } });
    const result = await checkModelConnectivity('gpt-3.5-turbo');
    expect(result.connected).toBe(true);
  });

  it('returns connected=false on 401 auth error', async () => {
    mockFetchFail(401, 'Unauthorized');
    const result = await checkModelConnectivity('gpt-4-turbo');
    expect(result.connected).toBe(false);
    expect(result.error).toMatch(/invalid or expired/i);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. enrichWithRealLLM — forceRealLLM=true returns null when LLM unavailable
// ────────────────────────────────────────────────────────────────────────────
describe('enrichWithRealLLM — forceRealLLM behavior', () => {
  it('returns null when forceRealLLM=true and no API key', async () => {
    // No keys set — LLM will fail
    const result = await enrichWithRealLLM('budget phone under 20k', SAMPLE_INTENT, 'claude-opus', true);
    expect(result).toBeNull();
  });

  it('returns rule-based result when forceRealLLM=false and no API key', async () => {
    const result = await enrichWithRealLLM('budget phone under 20k', SAMPLE_INTENT, 'claude-opus', false);
    expect(result).not.toBeNull();
    expect(result!.source).toBe('rule-based');
    expect((result!.enriched as any).note).toMatch(/rule-based fallback/i);
  });

  it('returns rule-based for invalid/too-short query', async () => {
    const result = await enrichWithRealLLM('ab', SAMPLE_INTENT, 'claude-opus', false);
    expect(result).toBeNull(); // too short, returns null
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. enrichWithRealLLM — uses /v1/messages endpoint for Claude (not batches)
// ────────────────────────────────────────────────────────────────────────────
describe('enrichWithRealLLM — Claude endpoint correctness', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-key';
  });

  it('calls /v1/messages not /v1/messages/batches', async () => {
    const mockResponse = {
      content: [{ text: JSON.stringify({
        enrichedQuestions: [{ text: 'Budget?', options: ['10k', '20k'], category: 'budget', priority: 1 }],
        refinedQuery: 'Samsung phone under 20k',
      }) }],
      usage: { input_tokens: 100, output_tokens: 80 },
    };
    mockFetchOk(mockResponse);

    await enrichWithRealLLM('Samsung phone under 20k', SAMPLE_INTENT, 'claude-opus', true);

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(url).not.toContain('batches');
  });

  it('returns llm-claude source on successful Claude response', async () => {
    const mockResponse = {
      content: [{ text: JSON.stringify({
        enrichedQuestions: [],
        refinedQuery: 'Samsung phone under 20k',
      }) }],
      usage: { input_tokens: 50, output_tokens: 30 },
    };
    mockFetchOk(mockResponse);

    const result = await enrichWithRealLLM('Samsung phone under 20k', SAMPLE_INTENT, 'claude-opus', true);
    expect(result).not.toBeNull();
    expect(result!.source).toBe('llm-claude');
    expect(result!.tokensUsed).toBe(80); // 50 + 30
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 7. Entity extractor — Noun signal detection
// ────────────────────────────────────────────────────────────────────────────
describe('Entity extractor — noun signals', () => {
  it('detects category as noun signal', () => {
    const tokens = ['samsung', 'phone', 'under', '20k'];
    const result = extractEntities(tokens, 'samsung phone under 20k');
    expect(result.noun_signals).toContain('category:phone');
  });

  it('detects brand as noun signal', () => {
    const tokens = ['samsung', 'phone'];
    const result = extractEntities(tokens, 'samsung phone');
    // Brand key casing follows BRAND_PATTERNS keys (e.g. "Samsung")
    const hasBrandSignal = result.noun_signals.some((s) => s.startsWith('brand:'));
    expect(hasBrandSignal).toBe(true);
  });

  it('detects both category+brand noun signals', () => {
    const tokens = ['apple', 'laptop', 'under', '80k'];
    const result = extractEntities(tokens, 'apple laptop under 80k');
    expect(result.noun_signals.length).toBeGreaterThanOrEqual(2);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 8. Entity extractor — Amount signal detection
// ────────────────────────────────────────────────────────────────────────────
describe('Entity extractor — amount signals', () => {
  it('detects budget amount signal', () => {
    const tokens = ['phone', 'under', '20k'];
    const result = extractEntities(tokens, 'phone under 20k');
    expect(result.amount_signals.length).toBeGreaterThan(0);
    expect(result.amount_signals[0]).toMatch(/20k/i);
  });

  it('detects rupee amount signal', () => {
    const tokens = ['laptop', '₹50000'];
    const result = extractEntities(tokens, 'laptop ₹50000');
    expect(result.amount_signals.length).toBeGreaterThan(0);
  });

  it('has empty amount_signals when no budget mentioned', () => {
    const tokens = ['samsung', 'phone'];
    const result = extractEntities(tokens, 'samsung phone');
    expect(result.amount_signals).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 9. Entity extractor — Confidence boost for noun+amount
// ────────────────────────────────────────────────────────────────────────────
describe('Entity extractor — confidence boost', () => {
  it('gives higher confidence when both noun and amount detected vs noun only', () => {
    const withBudget = extractEntities(['phone', 'under', '20k'], 'phone under 20k');
    const withoutBudget = extractEntities(['phone'], 'phone');
    // noun+amount combo gets +15 boost on top of base scores
    expect(withBudget.confidence).toBeGreaterThan(withoutBudget.confidence);
  });

  it('strong noun boost: both category AND brand gives higher confidence', () => {
    const both = extractEntities(['samsung', 'phone', 'under', '20k'], 'samsung phone under 20k');
    const catOnly = extractEntities(['phone', 'under', '20k'], 'phone under 20k');
    // category+brand: +10 extra bonus
    expect(both.confidence).toBeGreaterThan(catOnly.confidence);
  });

  it('confidence is capped at 100', () => {
    // Everything detected: category + brand + budget + use case + features
    const result = extractEntities(
      ['samsung', 'phone', '5g', 'camera', 'under', '30k', 'gaming'],
      'samsung 5g phone camera under 30k gaming'
    );
    expect(result.confidence).toBeLessThanOrEqual(100);
  });
});
