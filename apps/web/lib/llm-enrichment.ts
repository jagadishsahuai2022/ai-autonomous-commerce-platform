/**
 * Real LLM Enrichment Service
 * Uses Claude 3 Opus or GPT-4 for actual AI-powered question enrichment
 * with cost optimization and fallback to rule-based enrichment
 *
 * ROOT CAUSE FIX (Round 27):
 *   Claude was calling /v1/messages/batches (async Batch API â€” returns batch IDs, not text).
 *   The correct synchronous endpoint is /v1/messages.
 *   This caused data.content to always be undefined â†’ JSON.parse failed â†’ rule-based fallback.
 */

export interface EnrichmentResult {
  enriched: Record<string, unknown>;
  tokensUsed: number;
  source: 'llm-claude' | 'llm-gpt4' | 'llm-gpt35' | 'llm-gemini' | 'llm-groq' | 'llm-openrouter' | 'rule-based';
  model: string;
  error?: string;
}

export interface ModelConnectivityResult {
  modelId: string;
  provider: string;
  connected: boolean;
  error?: string;
  latencyMs?: number;
  apiKeyConfigured: boolean;
}

/** Available LLM model definitions */
export const LLM_MODELS = [
  // ── Free-tier models (recommended for testing) ──────────────────────
  {
    id: 'gemini-flash',
    name: 'Gemini 2.0 Flash (Free)',
    provider: 'Google',
    costPerMTok: 0,
    contextWindow: 1048576,
    description: 'Free 15 RPM / 1M tokens-per-day — best free option',
    apiKeyEnv: 'GOOGLE_GEMINI_API_KEY',
  },
  {
    id: 'groq-llama',
    name: 'Llama 3.3 70B via Groq (Free)',
    provider: 'Groq',
    costPerMTok: 0,
    contextWindow: 131072,
    description: 'Free tier — ultra-fast inference, 30 RPM',
    apiKeyEnv: 'GROQ_API_KEY',
  },
  {
    id: 'openrouter-free',
    name: 'Llama 3.3 70B via OpenRouter (Free)',
    provider: 'OpenRouter',
    costPerMTok: 0,
    contextWindow: 131072,
    description: 'Free models via OpenRouter aggregator',
    apiKeyEnv: 'OPENROUTER_API_KEY',
  },
  // ── Paid models ─────────────────────────────────────────────────────
  {
    id: 'claude-opus',
    name: 'Claude 3 Opus (Best Quality)',
    provider: 'Anthropic',
    costPerMTok: 0.015,
    contextWindow: 200000,
    description: 'Most capable model, best for complex enrichment',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo (High Quality)',
    provider: 'OpenAI',
    costPerMTok: 0.01,
    contextWindow: 128000,
    description: 'Excellent quality, balanced cost',
    apiKeyEnv: 'OPENAI_API_KEY',
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo (Budget)',
    provider: 'OpenAI',
    costPerMTok: 0.0005,
    contextWindow: 16384,
    description: 'Fast and cheap, good for simple tasks',
    apiKeyEnv: 'OPENAI_API_KEY',
  },
];

/**
 * Check whether a specific LLM model is reachable and the API key is configured.
 * Sends a minimal test prompt to verify end-to-end connectivity.
 * Returns a detailed result so the UI can show the exact failure reason.
 */
export async function checkModelConnectivity(
  modelId: string
): Promise<ModelConnectivityResult> {
  const model = LLM_MODELS.find((m) => m.id === modelId);
  if (!model) {
    return {
      modelId,
      provider: 'unknown',
      connected: false,
      error: `Unknown model ID: ${modelId}`,
      apiKeyConfigured: false,
    };
  }

  const start = Date.now();

  if (modelId === 'claude-opus') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        modelId,
        provider: 'Anthropic',
        connected: false,
        error: 'ANTHROPIC_API_KEY environment variable is not set. Please configure it in your .env file.',
        apiKeyConfigured: false,
      };
    }

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-opus-20240229',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'ping' }],
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (res.status === 401) {
        return {
          modelId, provider: 'Anthropic', connected: false,
          error: 'Authentication failed. The ANTHROPIC_API_KEY is invalid or expired.',
          apiKeyConfigured: true,
        };
      }
      if (res.status === 429) {
        return {
          modelId, provider: 'Anthropic', connected: false,
          error: 'Rate limit exceeded. Too many requests to Anthropic API. Please wait and retry.',
          apiKeyConfigured: true,
        };
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return {
          modelId, provider: 'Anthropic', connected: false,
          error: `Anthropic API error ${res.status}: ${(body as any)?.error?.message || res.statusText}`,
          apiKeyConfigured: true,
        };
      }

      return {
        modelId, provider: 'Anthropic', connected: true,
        latencyMs: Date.now() - start,
        apiKeyConfigured: true,
      };
    } catch (err: any) {
      return {
        modelId, provider: 'Anthropic', connected: false,
        error: `Network error reaching Anthropic API: ${err.message}`,
        apiKeyConfigured: true,
      };
    }
  }

  if (modelId === 'gpt-4-turbo' || modelId === 'gpt-3.5-turbo') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        modelId, provider: 'OpenAI', connected: false,
        error: 'OPENAI_API_KEY environment variable is not set. Please configure it in your .env file.',
        apiKeyConfigured: false,
      };
    }

    try {
      const openAiModel = modelId === 'gpt-4-turbo' ? 'gpt-4-turbo-preview' : 'gpt-3.5-turbo';
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: openAiModel,
          max_tokens: 5,
          messages: [{ role: 'user', content: 'ping' }],
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (res.status === 401) {
        return {
          modelId, provider: 'OpenAI', connected: false,
          error: 'Authentication failed. The OPENAI_API_KEY is invalid or expired.',
          apiKeyConfigured: true,
        };
      }
      if (res.status === 429) {
        return {
          modelId, provider: 'OpenAI', connected: false,
          error: 'Rate limit exceeded. Too many requests to OpenAI API. Please wait and retry.',
          apiKeyConfigured: true,
        };
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return {
          modelId, provider: 'OpenAI', connected: false,
          error: `OpenAI API error ${res.status}: ${(body as any)?.error?.message || res.statusText}`,
          apiKeyConfigured: true,
        };
      }

      return {
        modelId, provider: 'OpenAI', connected: true,
        latencyMs: Date.now() - start,
        apiKeyConfigured: true,
      };
    } catch (err: any) {
      return {
        modelId, provider: 'OpenAI', connected: false,
        error: `Network error reaching OpenAI API: ${err.message}`,
        apiKeyConfigured: true,
      };
    }
  }

  // ── Google Gemini (Free tier) ────────────────────────────────────────
  if (modelId === 'gemini-flash') {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return {
        modelId, provider: 'Google', connected: false,
        error: 'GOOGLE_GEMINI_API_KEY environment variable is not set. Get a free key at https://aistudio.google.com/apikey',
        apiKeyConfigured: false,
      };
    }

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'ping' }] }],
            generationConfig: { maxOutputTokens: 5 },
          }),
          signal: AbortSignal.timeout(10000),
        }
      );

      if (res.status === 400 || res.status === 403) {
        const body = await res.json().catch(() => ({}));
        return {
          modelId, provider: 'Google', connected: false,
          error: `Gemini API error: ${(body as any)?.error?.message || 'Invalid API key'}`,
          apiKeyConfigured: true,
        };
      }
      if (res.status === 429) {
        return {
          modelId, provider: 'Google', connected: false,
          error: 'Rate limit exceeded on Gemini free tier. Wait a minute and retry.',
          apiKeyConfigured: true,
        };
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return {
          modelId, provider: 'Google', connected: false,
          error: `Gemini API error ${res.status}: ${(body as any)?.error?.message || res.statusText}`,
          apiKeyConfigured: true,
        };
      }

      return {
        modelId, provider: 'Google', connected: true,
        latencyMs: Date.now() - start,
        apiKeyConfigured: true,
      };
    } catch (err: any) {
      return {
        modelId, provider: 'Google', connected: false,
        error: `Network error reaching Gemini API: ${err.message}`,
        apiKeyConfigured: true,
      };
    }
  }

  // ── Groq (Free tier — Llama 3.3 70B) ────────────────────────────────
  if (modelId === 'groq-llama') {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return {
        modelId, provider: 'Groq', connected: false,
        error: 'GROQ_API_KEY environment variable is not set. Get a free key at https://console.groq.com/keys',
        apiKeyConfigured: false,
      };
    }

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'ping' }],
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (res.status === 401) {
        return {
          modelId, provider: 'Groq', connected: false,
          error: 'Authentication failed. The GROQ_API_KEY is invalid or expired.',
          apiKeyConfigured: true,
        };
      }
      if (res.status === 429) {
        return {
          modelId, provider: 'Groq', connected: false,
          error: 'Rate limit exceeded on Groq free tier. Please wait and retry.',
          apiKeyConfigured: true,
        };
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return {
          modelId, provider: 'Groq', connected: false,
          error: `Groq API error ${res.status}: ${(body as any)?.error?.message || res.statusText}`,
          apiKeyConfigured: true,
        };
      }

      return {
        modelId, provider: 'Groq', connected: true,
        latencyMs: Date.now() - start,
        apiKeyConfigured: true,
      };
    } catch (err: any) {
      return {
        modelId, provider: 'Groq', connected: false,
        error: `Network error reaching Groq API: ${err.message}`,
        apiKeyConfigured: true,
      };
    }
  }

  // ── OpenRouter (Free models) ─────────────────────────────────────────
  if (modelId === 'openrouter-free') {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return {
        modelId, provider: 'OpenRouter', connected: false,
        error: 'OPENROUTER_API_KEY environment variable is not set. Get a free key at https://openrouter.ai/keys',
        apiKeyConfigured: false,
      };
    }

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'DelegateCart',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-70b-instruct:free',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'ping' }],
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (res.status === 401) {
        return {
          modelId, provider: 'OpenRouter', connected: false,
          error: 'Authentication failed. The OPENROUTER_API_KEY is invalid.',
          apiKeyConfigured: true,
        };
      }
      if (res.status === 429) {
        return {
          modelId, provider: 'OpenRouter', connected: false,
          error: 'Rate limit exceeded on OpenRouter. Please wait and retry.',
          apiKeyConfigured: true,
        };
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return {
          modelId, provider: 'OpenRouter', connected: false,
          error: `OpenRouter API error ${res.status}: ${(body as any)?.error?.message || res.statusText}`,
          apiKeyConfigured: true,
        };
      }

      return {
        modelId, provider: 'OpenRouter', connected: true,
        latencyMs: Date.now() - start,
        apiKeyConfigured: true,
      };
    } catch (err: any) {
      return {
        modelId, provider: 'OpenRouter', connected: false,
        error: `Network error reaching OpenRouter API: ${err.message}`,
        apiKeyConfigured: true,
      };
    }
  }

  return {
    modelId, provider: 'unknown', connected: false,
    error: `Unsupported model: ${modelId}`,
    apiKeyConfigured: false,
  };
}

/**
 * Compress intent response to reduce token usage
 */
function compressIntentResponse(
  intentResponse: Record<string, unknown>
): Record<string, unknown> {
  const compressed: Record<string, unknown> = {};

  if (intentResponse.intent) {
    const intent = intentResponse.intent as Record<string, unknown>;
    compressed.intent = {
      category: intent.category,
      budget: intent.budget,
      brand: intent.brand,
      features: (intent.features as string[] | undefined)?.slice(0, 3),
    };
  }

  if (intentResponse.confidence) {
    compressed.confidence = intentResponse.confidence;
  }

  if (Array.isArray(intentResponse.questions)) {
    compressed.existingQuestions = (intentResponse.questions as any[])
      .slice(0, 2)
      .map((q: any) => q.text);
  }

  return compressed;
}

/**
 * Create optimized LLM prompt for enrichment.
 * Focus: generate refined clarifying questions based on nouns (brands/products) & amounts (budget).
 */
function createEnrichmentPrompt(
  queryText: string,
  compressedIntent: Record<string, unknown>
): string {
  const intent = (compressedIntent.intent as Record<string, unknown>) || {};
  const category = (intent.category as string) || 'general';
  const budget = intent.budget as { min?: number; max?: number } | null | undefined;
  const budgetStr = budget
    ? `₹${budget.min || 0} – ₹${budget.max || 0} INR`
    : 'not specified';
  const brand = (intent.brand as string) || 'not specified';
  const existingQ = (compressedIntent.existingQuestions as string[]) || [];

  return `You are a shopping assistant AI for an Indian e-commerce platform. All prices are in Indian Rupees (INR, ₹).

User query: "${queryText}"
Detected category: ${category}
Detected brand: ${brand}
Budget constraint: ${budgetStr}
Existing questions: ${existingQ.length > 0 ? existingQ.join(' | ') : 'none'}

Your task: Generate 3-5 refined, specific clarifying questions to better understand the user's needs.
Focus on:
- Key product attributes (nouns) specific to ${category}
- Budget/price expectations in INR (₹) — NEVER use USD ($)
- Use case or purpose
- Brand preferences if brand="${brand === 'not specified' ? 'unspecified' : brand}"

Rules:
- Questions must be SHORT (under 15 words each)
- Provide 2-4 answer options per question; if options include price ranges, use INR (₹) format like "Under ₹10,000" NOT "$100"
- Don't repeat existing questions
- Focus on what would most help narrow down the search
- All monetary values MUST be in INR (Indian Rupees, ₹) — the app is India-focused

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "enrichedQuestions": [
    {
      "text": "What is your primary use case?",
      "options": ["Option A", "Option B", "Option C"],
      "category": "use_case",
      "priority": 1
    }
  ],
  "refinedQuery": "a more specific version of the original query"
}`;
}

/**
 * Call Claude 3 Opus API â€” FIXED: uses /v1/messages (synchronous), not /v1/messages/batches (async)
 */
async function enrichWithClaude(
  queryText: string,
  intentResponse: Record<string, unknown>
): Promise<EnrichmentResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[LLM] Claude API key not configured');
    return null;
  }

  try {
    const compressed = compressIntentResponse(intentResponse);
    const prompt = createEnrichmentPrompt(queryText, compressed);

    // FIXED: /v1/messages (sync) instead of /v1/messages/batches (async batch)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-opus-20240229',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      console.error('[LLM] Claude API error:', response.status, (errBody as any)?.error?.message);
      return null;
    }

    const data = await response.json();
    const content = (data.content?.[0]?.text || '').trim();

    if (!content) {
      console.error('[LLM] Claude returned empty content');
      return null;
    }

    // Parse JSON â€” strip markdown fences if present
    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    const tokensUsed = data.usage?.input_tokens + data.usage?.output_tokens || 0;

    const enriched = {
      ...intentResponse,
      enrichedQuestions: parsed.enrichedQuestions || [],
      refinedQuery: parsed.refinedQuery || queryText,
      enrichment_source: 'claude-opus',
      enriched_at: new Date().toISOString(),
      model: 'claude-3-opus-20240229',
    };

    return { enriched, tokensUsed, source: 'llm-claude', model: 'claude-3-opus' };
  } catch (error: any) {
    console.error('[LLM] Claude enrichment error:', error.message);
    return null;
  }
}

/**
 * Call OpenAI GPT-4 or GPT-3.5-turbo API for enrichment
 */
async function enrichWithOpenAI(
  queryText: string,
  intentResponse: Record<string, unknown>,
  model: 'gpt-4-turbo' | 'gpt-3.5-turbo'
): Promise<EnrichmentResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[LLM] OpenAI API key not configured');
    return null;
  }

  try {
    const compressed = compressIntentResponse(intentResponse);
    const prompt = createEnrichmentPrompt(queryText, compressed);
    const modelId = model === 'gpt-4-turbo' ? 'gpt-4-turbo-preview' : 'gpt-3.5-turbo';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: 'system',
            content:
              'You are a shopping assistant. Respond ONLY with valid JSON, no markdown or explanations.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      console.error('[LLM] OpenAI API error:', response.status, (errBody as any)?.error?.message);
      return null;
    }

    const data = await response.json();
    const content = (data.choices?.[0]?.message?.content || '').trim();
    const tokensUsed = data.usage?.total_tokens || 0;

    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    const enriched = {
      ...intentResponse,
      enrichedQuestions: parsed.enrichedQuestions || [],
      refinedQuery: parsed.refinedQuery || queryText,
      enrichment_source: model === 'gpt-4-turbo' ? 'gpt4-turbo' : 'gpt-35-turbo',
      enriched_at: new Date().toISOString(),
      model: modelId,
    };

    return {
      enriched,
      tokensUsed,
      source: model === 'gpt-4-turbo' ? 'llm-gpt4' : 'llm-gpt35',
      model: modelId,
    };
  } catch (error: any) {
    console.error('[LLM] OpenAI enrichment error:', error.message);
    return null;
  }
}

/**
 * Call Google Gemini 2.0 Flash API for enrichment (FREE tier)
 */
async function enrichWithGemini(
  queryText: string,
  intentResponse: Record<string, unknown>
): Promise<EnrichmentResult | null> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[LLM] Google Gemini API key not configured');
    return null;
  }

  try {
    const compressed = compressIntentResponse(intentResponse);
    const prompt = createEnrichmentPrompt(queryText, compressed);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: 800,
            temperature: 0.7,
          },
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      console.error('[LLM] Gemini API error:', response.status, (errBody as any)?.error?.message);
      return null;
    }

    const data = await response.json();
    const content = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    const tokensUsed =
      (data.usageMetadata?.promptTokenCount || 0) +
      (data.usageMetadata?.candidatesTokenCount || 0);

    if (!content) {
      console.error('[LLM] Gemini returned empty content');
      return null;
    }

    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    const enriched = {
      ...intentResponse,
      enrichedQuestions: parsed.enrichedQuestions || [],
      refinedQuery: parsed.refinedQuery || queryText,
      enrichment_source: 'gemini-flash',
      enriched_at: new Date().toISOString(),
      model: 'gemini-2.0-flash',
    };

    return { enriched, tokensUsed, source: 'llm-gemini', model: 'gemini-2.0-flash' };
  } catch (error: any) {
    console.error('[LLM] Gemini enrichment error:', error.message);
    return null;
  }
}

/**
 * Call Groq API (Llama 3.3 70B) for enrichment (FREE tier)
 * Groq uses OpenAI-compatible API format.
 */
async function enrichWithGroq(
  queryText: string,
  intentResponse: Record<string, unknown>
): Promise<EnrichmentResult | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn('[LLM] Groq API key not configured');
    return null;
  }

  try {
    const compressed = compressIntentResponse(intentResponse);
    const prompt = createEnrichmentPrompt(queryText, compressed);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a shopping assistant. Respond ONLY with valid JSON, no markdown or explanations.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      console.error('[LLM] Groq API error:', response.status, (errBody as any)?.error?.message);
      return null;
    }

    const data = await response.json();
    const content = (data.choices?.[0]?.message?.content || '').trim();
    const tokensUsed = data.usage?.total_tokens || 0;

    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    const enriched = {
      ...intentResponse,
      enrichedQuestions: parsed.enrichedQuestions || [],
      refinedQuery: parsed.refinedQuery || queryText,
      enrichment_source: 'groq-llama',
      enriched_at: new Date().toISOString(),
      model: 'llama-3.3-70b-versatile',
    };

    return { enriched, tokensUsed, source: 'llm-groq', model: 'llama-3.3-70b-versatile' };
  } catch (error: any) {
    console.error('[LLM] Groq enrichment error:', error.message);
    return null;
  }
}

/**
 * Call OpenRouter API (DeepSeek V3 — free model) for enrichment
 * OpenRouter uses OpenAI-compatible API format.
 */
async function enrichWithOpenRouter(
  queryText: string,
  intentResponse: Record<string, unknown>
): Promise<EnrichmentResult | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn('[LLM] OpenRouter API key not configured');
    return null;
  }

  try {
    const compressed = compressIntentResponse(intentResponse);
    const prompt = createEnrichmentPrompt(queryText, compressed);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'DelegateCart',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        messages: [
          {
            role: 'system',
            content: 'You are a shopping assistant. Respond ONLY with valid JSON, no markdown or explanations.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      console.error('[LLM] OpenRouter API error:', response.status, (errBody as any)?.error?.message);
      return null;
    }

    const data = await response.json();
    const content = (data.choices?.[0]?.message?.content || '').trim();
    const tokensUsed = data.usage?.total_tokens || 0;

    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    const enriched = {
      ...intentResponse,
      enrichedQuestions: parsed.enrichedQuestions || [],
      refinedQuery: parsed.refinedQuery || queryText,
      enrichment_source: 'openrouter-deepseek',
      enriched_at: new Date().toISOString(),
      model: 'deepseek-chat-v3-0324',
    };

    return { enriched, tokensUsed, source: 'llm-openrouter', model: 'deepseek-chat-v3-0324' };
  } catch (error: any) {
    console.error('[LLM] OpenRouter enrichment error:', error.message);
    return null;
  }
}

/**
 * Rule-based enrichment fallback (when LLM is unavailable)
 * Clearly marks as rule-based â€” never pretends to be LLM output.
 */
function enrichWithRulesFallback(
  queryText: string,
  intentResponse: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...intentResponse,
    enrichedQuestions: [],
    refinedQuery: queryText,
    enrichment_source: 'rule-based-fallback',
    enriched_at: new Date().toISOString(),
    note: 'Using rule-based fallback (LLM unavailable)',
  };
}

/**
 * Main enrichment function: Try real LLM, optionally fall back to rules.
 * forceRealLLM=true means NEVER save rule-based fallback as "enriched" â€” return null if LLM fails.
 */
export async function enrichWithRealLLM(
  queryText: string,
  intentResponse: Record<string, unknown>,
  modelId: string,
  forceRealLLM: boolean = false
): Promise<EnrichmentResult | null> {
  if (!queryText || typeof queryText !== 'string' || queryText.trim().length < 3) {
    return null;
  }

  let result: EnrichmentResult | null = null;

  if (modelId === 'gemini-flash') {
    result = await enrichWithGemini(queryText, intentResponse);
  } else if (modelId === 'groq-llama') {
    result = await enrichWithGroq(queryText, intentResponse);
  } else if (modelId === 'openrouter-free') {
    result = await enrichWithOpenRouter(queryText, intentResponse);
  } else if (modelId === 'claude-opus') {
    result = await enrichWithClaude(queryText, intentResponse);
  } else if (modelId === 'gpt-4-turbo') {
    result = await enrichWithOpenAI(queryText, intentResponse, 'gpt-4-turbo');
  } else if (modelId === 'gpt-3.5-turbo') {
    result = await enrichWithOpenAI(queryText, intentResponse, 'gpt-3.5-turbo');
  } else {
    // 'auto' — try free models first, then paid
    result = await enrichWithGemini(queryText, intentResponse);
    if (!result) result = await enrichWithGroq(queryText, intentResponse);
    if (!result) result = await enrichWithOpenRouter(queryText, intentResponse);
    if (!result) result = await enrichWithClaude(queryText, intentResponse);
    if (!result) result = await enrichWithOpenAI(queryText, intentResponse, 'gpt-4-turbo');
    if (!result) result = await enrichWithOpenAI(queryText, intentResponse, 'gpt-3.5-turbo');
  }

  if (result) return result;

  // LLM not available
  if (forceRealLLM) {
    // Don't save rule-based as AI enriched â€” return null so caller can skip this record
    return null;
  }

  // Allow rule-based fallback
  const enriched = enrichWithRulesFallback(queryText, intentResponse);
  return { enriched, tokensUsed: 0, source: 'rule-based', model: 'rule-based-fallback' };
}


