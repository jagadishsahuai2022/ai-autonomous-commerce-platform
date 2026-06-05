# LLM Integration: SDK vs API Call Analysis

## Overview

DelegateCart uses **5 LLM providers** across 2 services. The web app uses **raw HTTP `fetch()` calls** exclusively, while the Python intent-parser uses **official SDKs**.

## Provider Matrix

| Provider | Model(s) | Tier | Web App | Intent Parser |
|---|---|---|---|---|
| Anthropic | `claude-3-opus-20240229` | Paid | `fetch()` → REST API | `anthropic` SDK v0.7.0 |
| OpenAI | `gpt-4-turbo-preview`, `gpt-3.5-turbo` | Paid | `fetch()` → REST API | `openai` SDK v1.3.0 |
| Google Gemini | `gemini-2.0-flash` | Free | `fetch()` → REST API | — |
| Groq | `llama-3.3-70b-versatile` | Free | `fetch()` → REST API | — |
| OpenRouter | `meta-llama/llama-3.3-70b-instruct:free` | Free | `fetch()` → REST API | — |

## Service-Level Breakdown

### Next.js Web App (`apps/web/`)

**Method:** Raw `fetch()` HTTP calls — no SDK dependencies

**Primary File:** `lib/llm-enrichment.ts`

Each provider has 2 call sites:
1. **`checkModelConnectivity()`** — health-check ping to verify API key/model availability
2. **`enrichWith<Provider>()`** — actual product enrichment call

| Provider | Endpoint | Call Sites |
|---|---|---|
| Anthropic | `https://api.anthropic.com/v1/messages` | L123, L538 |
| OpenAI | `https://api.openai.com/v1/chat/completions` | L187, L608 |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent` | L251, L683 |
| Groq | `https://api.groq.com/openai/v1/chat/completions` | L313, L753 |
| OpenRouter | `https://openrouter.ai/api/v1/chat/completions` | L376, L822 |

### Python Intent Parser (`apps/intent-parser/`)

**Method:** Official SDKs

**Primary File:** `services/llm_service.py`

```python
# OpenAI — using official SDK
import openai
client = openai.OpenAI(api_key=settings.openai_api_key)
response = client.chat.completions.create(model="gpt-4-turbo-preview", ...)

# Anthropic — using official SDK
import anthropic
client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
response = client.messages.create(model="claude-3-opus-20240229", ...)
```

### Services with NO LLM Calls

| Service | Notes |
|---|---|
| `apps/api/` (NestJS) | Has `aiModel` DTO field but no actual LLM invocations |
| `apps/ai-service/` | Placeholder comments ("In production, would use NLP/LLM"), currently rule-based |
| `apps/autopilot-engine/` | No LLM usage |
| `apps/product-ranking-engine/` | Pure algorithmic scoring, no LLM |

## SDK vs Raw API — Trade-off Analysis

| Dimension | Raw `fetch()` (Web App) | Official SDK (Intent Parser) |
|---|---|---|
| **Bundle size** | Zero dependency overhead | Adds `openai` (1.1MB), `anthropic` (0.5MB) |
| **Type safety** | Manual response parsing | SDK provides typed responses |
| **Error handling** | Manual HTTP status checks | SDK throws typed exceptions |
| **Retry/backoff** | Must implement manually | Built-in retry logic |
| **Streaming** | Must parse SSE manually | `stream=True` with async iterators |
| **Auth** | Manual header: `Authorization: Bearer ...` | Pass `api_key` once at init |
| **Rate limiting** | Manual 429 handling | SDK has built-in retry-after |
| **Breaking changes** | Must track API changelog manually | SDK version pins protect you |
| **Server-side only?** | Can run in browser (dangerous) or server | Always server-side |

## Recommendation

**Keep current architecture** — the hybrid approach is pragmatic:

1. **Web app raw `fetch()` is fine** — the calls are server-side (API routes / server components), and adding 5 SDKs would bloat `node_modules` for minimal gain. The raw calls are well-structured with proper error handling.

2. **Intent parser SDKs are correct** — Python SDKs add retry logic, typed responses, and handle streaming natively. The `openai` and `anthropic` packages are lightweight in Python.

3. **If consolidating**, consider adding SDKs to the web app only if:
   - Streaming chat responses are needed (SDK handles SSE parsing)
   - Rate-limit 429 retries become a problem
   - Provider APIs introduce breaking changes frequently

## Environment Variables

| Variable | Used By |
|---|---|
| `ANTHROPIC_API_KEY` | Web, Intent Parser |
| `OPENAI_API_KEY` | Web, Intent Parser |
| `GOOGLE_GEMINI_API_KEY` | Web only |
| `GROQ_API_KEY` | Web only |
| `OPENROUTER_API_KEY` | Web only |
| `LLM_PROVIDER` | Web (default: `anthropic`) |

---

# Auto-Checkout Feature Analysis

## Architecture

Auto-checkout is implemented in `apps/web/app/api/shopping-list/route.ts` as part of the shopping list POST handler.

### Flow

```
User submits shopping list (with autoCheckout: true)
    ↓
Search products in mock PRODUCT_CATALOG
    ↓
Query native DB products (SELECT FROM "Product" WHERE name LIKE ...)
    ↓
┌──────────────────────────────────────┐
│ Native DB products found?            │
│                                      │
│  YES → Proceed with auto-checkout    │
│  NO  → Return EXTERNAL_RESTRICTED   │
└──────────────────────────────────────┘
    ↓ (YES path)
Validate per-order threshold (default ₹5,00,000)
    ↓
Validate monthly budget (default ₹20,00,000)
    ↓
Check stock availability
    ↓
Create order via createOrderWithWalletPayment()
    ↓
Debit wallet atomically
    ↓
Return order confirmation
```

### Restriction Policy

| Product Source | Auto-Checkout | Reason |
|---|---|---|
| **Native DB products** (DelegateCart inventory) | **Allowed** | App has full control over inventory, pricing, fulfilment |
| **External aggregator** (Amazon, Flipkart) | **Blocked permanently** | App cannot place/fulfil orders on third-party platforms |

### Safety Guards

1. **Product source check** — Only products confirmed in `"Product"` DB table proceed
2. **Per-order threshold** — Default ₹5,00,000 per order (configurable per user)
3. **Monthly budget cap** — Default ₹20,00,000/month for AI-assisted orders
4. **Stock validation** — Products must have `stock > 0`
5. **Wallet balance** — Atomic debit; fails if insufficient funds
6. **AI authorization** — Wallet must have `isAiAuthorized = true`

### Response Codes

| Code | Meaning |
|---|---|
| `AUTO_CHECKOUT_EXTERNAL_RESTRICTED` | No native DB products found; external products blocked |
| `PRODUCT_OUT_OF_STOCK` | Native products found but out of stock |
| `ORDER_BUDGET_EXCEEDED` | Order total exceeds per-order threshold |
| `MONTHLY_BUDGET_EXCEEDED` | Would exceed monthly AI spend limit |
| `INSUFFICIENT_BALANCE` | Wallet balance too low |
| `WALLET_NOT_AI_AUTHORIZED` | Wallet not authorized for AI transactions |
| `SYSTEM_ERROR` | Unexpected failure during order creation |

### UI Representation

The Profile page (`/profile`) shows an "Agentic Auto-Checkout" card with:
- **Blue "Native Only" badge** indicating the restriction
- Explanation that external aggregator products are permanently blocked
- Note that native products auto-checkout via wallet payment
