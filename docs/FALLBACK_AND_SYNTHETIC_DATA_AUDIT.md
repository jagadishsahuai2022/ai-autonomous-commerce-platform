# Fallback & Synthetic Data Audit

**Created**: 2025-01  
**Scope**: Full codebase — web app (`apps/web`), API (`apps/api`), mobile (`delegatecart-mobile`), scripts  
**Purpose**: Track every location where fake/synthetic/hardcoded data is returned to users instead of real DB data

---

## Summary Table

| #   | File                                                        | Pattern                                                                                     | Trigger                                                                                        | Priority  | Status                       |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------- | ---------------------------- |
| 1   | `apps/web/app/api/intent/analyze/route.ts`                  | `CATALOG` (mirrors MOCK_CATALOG) used for brand/price question generation                   | Used as fallback when DB unavailable for brand/price enrichment                                | 🔴 HIGH   | Active                       |
| 2   | `apps/web/app/api/intent/answer-question/route.ts`          | v1-fallback path — returns `[]` products when NestJS API is unreachable                     | NestJS API call fails                                                                          | 🟡 MEDIUM | Active (safe, returns empty) |
| 3   | `apps/web/app/api/admin/validation-data/route.ts`           | `generateSyntheticProduct()` — seeded RNG products with `synth-{seed}-{idx}` IDs            | When `ValidationSession` table has fewer than needed records                                   | 🟡 MEDIUM | Admin-only                   |
| 4   | `apps/web/app/api/auth/session/route.ts`                    | Returns synthetic session from `DEMO_USERS` (no DB)                                         | Token starts with `admin-` or `demo-`, or no token + known email                               | 🟡 MEDIUM | Intentional demo path        |
| 5   | `apps/web/app/api/user/profile/route.ts`                    | Returns synthetic profile from `DEMO_USERS` map                                             | DB unavailable + known demo email + demo-prefix token                                          | 🟡 MEDIUM | Intentional demo path        |
| 6   | `apps/web/app/api/user/addresses/route.ts`                  | Demo token path — returns empty/synthetic addresses                                         | Token starts with `admin-` or `demo-`                                                          | 🟡 MEDIUM | Intentional demo path        |
| 7   | `apps/web/app/api/wallet/route.ts`                          | Demo token path — returns synthetic wallet data                                             | `sess_`/`admin-`/`demo-` token prefix check                                                    | 🟡 MEDIUM | Intentional demo path        |
| 8   | `apps/web/app/api/user/wishlist/route.ts`                   | Demo token path — returns synthetic wishlist                                                | `sess_`/`admin-`/`demo-` token prefix check                                                    | 🟡 MEDIUM | Intentional demo path        |
| 9   | `apps/web/lib/fallback-data.ts`                             | `FALLBACK_PRODUCTS` — 7 hardcoded items with `fb-{n}` IDs, fake brands                      | UI-level fallback when API calls fail                                                          | 🟡 MEDIUM | UI display only              |
| 10  | `apps/web/lib/smart-intent/synthetic-catalog.ts`            | `getSyntheticCatalog()` — seeded RNG generates 1000+ in-memory products                     | Used by smart intent engine when DB search returns zero results                                | 🔴 HIGH   | Active in pipeline           |
| 11  | `apps/web/app/shopping-assistant/page.tsx`                  | `DEMO_PRODUCTS` (3 headphones) + `DEMO_APPROVAL` (Sony WH-1000XM5)                          | Initial state before any real query; reset target in `onClearAll`                              | 🟡 MEDIUM | UI placeholder only          |
| 12  | `apps/web/app/shopping-assistant/metrics/products/page.tsx` | Local `DEMO_PRODUCTS` — 3 headphones used if no real products available                     | Products page renders before real data loads                                                   | 🟡 MEDIUM | UI placeholder               |
| 13  | `apps/web/app/signin/page.tsx`                              | `'mock-jwt-token-' + Date.now()` for `demo@example.com`                                     | Legacy demo email path (email `demo@example.com`)                                              | 🔴 HIGH   | Active fallback              |
| 14  | `apps/api/src/shopping/shopping-assistant.service.ts`       | `mockGetProducts()` returns 3 hardcoded products (TechBrand, ValueBrand, ProTech)           | Always called — no real product aggregator integration yet                                     | 🔴 HIGH   | Always active in NestJS      |
| 15  | `apps/api/src/shopping/shopping-assistant.service.ts`       | `mockAnalyzeIntent()` returns hardcoded intent with static questions                        | Always called — no real intent parser integration yet                                          | 🔴 HIGH   | Always active in NestJS      |
| 16  | `delegatecart-mobile/src/lib/mock.ts`                       | `sampleProducts` — 6 hardcoded audio products (Sony, Apple, Bose, Samsung, JBL, Sennheiser) | Mobile mock exports: `mock.products`, `mock.recommendations()`, `mock.cart()`, `mock.orders()` | 🟡 MEDIUM | Mobile dev only              |

---

## Category 1 — Active Runtime Fallbacks (🔴 HIGH — immediate action required)

### 1.1 Intent Analyze Route — Hardcoded CATALOG for Question Generation

**File**: `apps/web/app/api/intent/analyze/route.ts`  
**Lines**: ~4–760 (CATALOG constant), ~1248–1291 (DB-with-fallback logic)

**What it does**: A large `CATALOG` constant (mirrors the deleted `MOCK_CATALOG`) is embedded in the route. It has 10+ subcategories of electronics (Smartphones, Laptops, Headphones, Smart Watches, Tablets, Cameras, Televisions, Air Purifiers, etc.) with hardcoded brands, names, and prices.

**When it activates**:

- v1 path (line ~1248): Tries to fetch real DB brands/prices first. If DB call fails, falls through to `CATALOG` data for generating clarifying question options (brand list, price range).
- The comment explicitly says: _"Attempt to fetch real DB brands and prices — fall back to MOCK_CATALOG if DB is unavailable"_

**ID pattern**: Products use DB IDs when available; falls back to catalog entry indices.

**Remediation**: The DB-fetch path is already the primary path. The fallback is only triggered on DB error. Consider returning an error or empty options rather than stale hardcoded data. If the DB is down, inform the user instead of silently using outdated brand lists.

---

### 1.2 Smart Intent Synthetic Catalog

**File**: `apps/web/lib/smart-intent/synthetic-catalog.ts`

**What it does**: `getSyntheticCatalog()` uses seeded RNG (deterministic, stable across restarts) to generate 1000+ in-memory products across 5 major categories: phones, laptops, headphones, televisions, appliances — plus additional categories (fashion, footwear, watches). Products use Unsplash image URLs.

**When it activates**: Called by the smart intent pipeline when DB search returns zero matching products. Acts as a Tier C fallback after Tier A (NestJS API) and Tier B (direct PostgreSQL) both return empty.

**ID pattern**: `synth-{n}` (numeric index from the in-memory array)

**Risk**: Users see products that do not exist in any database. No way to add to cart, track, or fulfil. Silently misleads users.

**Remediation**: Remove the synthetic catalog tier. When DB returns zero results, return empty `[]` with a user-facing message: _"No products found for your query. Try broadening your search."_ This is already the philosophy applied to `answer-question/route.ts` (see §2.2).

---

### 1.3 Sign-in Page — Legacy `mock-jwt-token`

**File**: `apps/web/app/signin/page.tsx`  
**Lines**: ~163–165

**What it does**:

```ts
if (email === 'demo@example.com') {
  token = 'mock-jwt-token-' + Date.now();
}
```

Issues a fake JWT for the legacy `demo@example.com` email without any DB validation.

**Risk**: Any user who knows this email can sign in without authentication. The `mock-jwt-token-` prefix is not validated by any real session system.

**Remediation**: Remove this block entirely. The `demo@example.com` address is not in `DEMO_USERS` and is not seeded in the DB. If needed for testing, add it to `DEMO_USERS` with a proper `admin-{timestamp}` flow.

---

### 1.4 NestJS Shopping Assistant — `mockGetProducts()` and `mockAnalyzeIntent()`

**File**: `apps/api/src/shopping/shopping-assistant.service.ts`  
**Lines**: ~216 (`mockGetProducts` call), ~224–274 (`mockAnalyzeIntent`), ~275–316 (`mockGetProducts`)

**What it does**:

- `mockAnalyzeIntent(text)` — keyword-based intent extraction (no ML). Returns hardcoded questions for "phone" queries; generic fallback otherwise.
- `mockGetProducts(intent, limit)` — always returns 3 hardcoded products:
  - `prod-1`: "Premium Smartphone Model X" — TechBrand — ₹45,000
  - `prod-2`: "Budget Smartphone Y" — ValueBrand — ₹15,000
  - `prod-3`: "Mid-Range Pro Phone Z" — ProTech — ₹32,000

**When it activates**: **Always.** The `getProductsForIntent()` method has a TODO comment referencing the Product Aggregator Service but always calls `mockGetProducts()` instead. These are not real products.

**Note**: The web app's smart intent engine (Next.js API routes) handles the real product lookups via direct PostgreSQL queries. The NestJS shopping assistant service is a separate code path used when the web app calls `apps/api` directly.

**Remediation**: Integrate the Product Aggregator Service (port 3003/Kafka). Remove `mockGetProducts` and `mockAnalyzeIntent` after integration. In the interim, add a clear comment and consider a 503 response when real data is not available.

---

## Category 2 — UI Placeholder Data (🟡 MEDIUM — visible to users but not production-critical)

### 2.1 `FALLBACK_PRODUCTS` in `lib/fallback-data.ts`

**File**: `apps/web/lib/fallback-data.ts`

**What it does**: Exports 7 hardcoded products with fake brands:
| ID | Name | Brand | Price |
|----|------|-------|-------|
| `fb-1` | Wireless Bluetooth Headphones | SoundMax | ₹2,499 |
| `fb-2` | Smart Watch Pro | TechWear | ₹4,999 |
| `fb-3` | USB-C Fast Charger 65W | PowerPro | ₹1,299 |
| `fb-4` | Mechanical Gaming Keyboard | KeyForce | ₹3,499 |
| `fb-5` | Portable Bluetooth Speaker | SoundMax | ₹1,899 |
| `fb-6` | Laptop Stand Adjustable | ErgoDesk | ₹899 |
| `fb-7` | Wireless Mouse Ergonomic | TechWear | ₹799 |

Also exports `FallbackUserProfile` — placeholder profile template.

**When it activates**: Components that can't reach the API render these as a "service unavailable" placeholder. IDs have `fb-` prefix.

**Remediation**: These are acceptable as a UI-level loading/error skeleton as long as they are clearly labelled as "unavailable" rather than presented as real inventory. Ensure no "Add to Cart" action is possible for `fb-*` IDs.

---

### 2.2 Shopping Assistant Page — `DEMO_PRODUCTS` and `DEMO_APPROVAL`

**File**: `apps/web/app/shopping-assistant/page.tsx`  
**Lines**: ~32–161 (`DEMO_PRODUCTS`), ~129–175 (`DEMO_APPROVAL`)

**`DEMO_PRODUCTS`** (3 items with `prod-001/002/003` IDs):

- Sony WH-1000XM5 — ₹27,990 (score: 0.94)
- Apple AirPods Pro 2 — ₹21,900 (score: 0.89)
- Bose QuietComfort 45 — ₹22,500 (score: 0.81)

**`DEMO_APPROVAL`**: Sony WH-1000XM5, ₹27,990, expires +24h from page load

**When it activates**:

- `compareProducts` initialises to `DEMO_PRODUCTS` (before first real query returns)
- `liveApproval` initialises to `DEMO_APPROVAL` when `hydratedState.approval === null`
- Both are reset to demo values in `onClearAll()`

**Note**: As of the current session fix, `liveApproval` and `pendingApprovalProduct` are now persisted to `chatStore` via `useEffect` hooks, so returning to the page after a real query restores the real product.

**Remediation**: Replace initial state with `[]` / `null` and render an empty-state UI ("Start a query to see product recommendations") instead of showing fake products on first load.

---

### 2.3 Shopping Assistant Metrics/Products Page — Local `DEMO_PRODUCTS`

**File**: `apps/web/app/shopping-assistant/metrics/products/page.tsx`  
**Lines**: ~235–241

**What it does**:

```ts
const DEMO_PRODUCTS: RankedProduct[] =
  products.length > 0
    ? []
    : [
        /* 3 headphones */
      ];
const displayProducts = products.length > 0 ? filtered : DEMO_PRODUCTS;
```

Falls back to 3 hardcoded headphones if no real products are available from the metrics store.

**Remediation**: Replace with an empty-state UI component.

---

### 2.4 Observability Page — `FALLBACK_REGISTRY`

**File**: `apps/web/app/observability/page.tsx`  
**Lines**: ~1084–1213

**What it does**: `FALLBACK_REGISTRY` describes known fallback paths in the system (Ranked products → hardcoded demo products fallback, etc.). Used by the observability dashboard to show which fallback mechanisms are active.

**When it activates**: Observability dashboard page loads. Attempts to fetch real runtime data first, merges with `FALLBACK_REGISTRY` entries.

**Note**: This is a meta-registry about fallbacks, not a data fallback itself. It documents runtime fallback paths for operators.

---

## Category 3 — Admin/Internal Synthetic Generation (🟡 MEDIUM — admin-only, clearly labelled)

### 3.1 Validation Data Route — `generateSyntheticProduct()`

**File**: `apps/web/app/api/admin/validation-data/route.ts`  
**Lines**: ~37–230

**What it does**:

- Uses seeded deterministic RNG (`seededRng(seed)`)
- `generateSyntheticProduct(seed, idx)` produces products with:
  - IDs: `synth-{seed}-{idx}`
  - Brands: Sony, Apple, Samsung, Dell, HP, LG, Bose, Realme, OnePlus, Canon
  - Names: WH-1000XM5 Headphones, MacBook Air M3, Galaxy S24 Ultra, etc. (10 templates)
  - Price: ₹5,000–₹85,000 (seeded RNG)
- Generates 15 synthetic sessions (5 users × 3 sessions) when `ValidationSession` table has limited data

**When it activates**:

- `GET /api/admin/validation-data` (requires `admin` or `analytics` role)
- Only fills gaps when real `ValidationSession` records are fewer than needed
- Response includes `isSynthetic: true` flag on synthetic entries and `syntheticCount` in metadata

**Hardcoded fallback users** (when `User` table returns empty):

```
admin@delegatecart.com, analytics@delegatecart.com, aiplusdemo@delegatecart.com,
observability@delegatecart.com, reenforcedlearning@delegatecart.com
```

**Remediation**: This is acceptable for an admin validation dashboard. The `isSynthetic` flag allows the UI to clearly label these entries. As `ValidationSession` data grows with real usage, synthetic gap-filling will naturally reduce.

---

### 3.2 Auth Session Route — Synthetic Session for Demo Users

**File**: `apps/web/app/api/auth/session/route.ts`  
**Lines**: ~44–70

**What it does**: Returns a synthetic authenticated session object for known demo users when:

1. Token starts with `admin-` or `demo-` (demo-prefix check), AND
2. `x-user-email` header matches a `DEMO_USERS` entry

No DB query for the session itself — session data is constructed in-memory from `DEMO_USERS`.

**When it activates**: Always triggers for demo users logging in through the quick-fill mechanism.

**Note**: This is intentional by design — demo users do not have real DB sessions. The `DEMO_USERS` list in `lib/admin-auth.ts` controls who qualifies.

---

## Category 4 — Development/Seeding Scripts (🟢 LOW — not in app runtime)

### 4.1 Scripts Ingest Pipeline

**File**: `scripts/ingest/pipeline.ts`

**What it does**: CLI script. `generateSyntheticCatalog(count)` generates in-memory products for batch ingestion testing. Not called by any Next.js or NestJS route.

---

### 4.2 NestJS Prisma Seed

**File**: `apps/api/prisma/seed.ts`

**What it does**: One-time DB seed script. Contains hand-crafted `ELECTRONICS_PRODUCTS`, `GROCERY_PRODUCTS`, etc. Run with `npx prisma db seed`. Not a runtime fallback.

---

### 4.3 Mobile App Mock Library

**File**: `delegatecart-mobile/src/lib/mock.ts`

**What it does**: Exports `mock.products`, `mock.recommendations()`, `mock.cart()`, `mock.orders()` for mobile development/testing. Contains 6 audio products (Sony, Apple, Bose, Samsung, JBL, Sennheiser) with `id: 1–6`.

**When it activates**: Only when mobile screens directly import `mock` — i.e., when real API calls are not yet wired up in a given screen.

**Remediation**: As each mobile screen is connected to the real API, replace `mock.*` calls with `useQuery` hooks pointing to the DelegateCart API. Track remaining `mock.*` usages per screen.

---

## Synthetic ID Patterns Reference

| Prefix                    | Source                                              | Location                       |
| ------------------------- | --------------------------------------------------- | ------------------------------ |
| `synth-{n}`               | `synthetic-catalog.ts` getSyntheticCatalog          | Smart intent pipeline Tier C   |
| `synth-{seed}-{idx}`      | `validation-data/route.ts` generateSyntheticProduct | Admin validation dashboard     |
| `synth-{n}` (session IDs) | `validation-data/route.ts` session IDs              | Admin validation dashboard     |
| `fb-{n}`                  | `lib/fallback-data.ts` FALLBACK_PRODUCTS            | UI-level API error fallback    |
| `prod-001/002/003`        | `shopping-assistant/page.tsx` DEMO_PRODUCTS         | Initial state placeholder      |
| `prod-1/2/3`              | `apps/api` mockGetProducts                          | NestJS shopping service        |
| `demo-{email}`            | `auth/session/route.ts`, `user/profile/route.ts`    | Demo user synthetic sessions   |
| `mock-jwt-token-{ts}`     | `signin/page.tsx`                                   | Legacy `demo@example.com` path |

---

## Token/Auth Fake Patterns Reference

| Pattern                       | File                                          | Trigger                            |
| ----------------------------- | --------------------------------------------- | ---------------------------------- |
| `admin-{timestamp}`           | `signin/page.tsx` (created during demo login) | Demo admin users autofill          |
| `demo-{timestamp}`            | Various API routes (detection pattern)        | Demo regular users                 |
| `mock-jwt-token-{Date.now()}` | `signin/page.tsx`                             | Legacy `demo@example.com` fallback |
| `sess_*`                      | Real sessions only — from `UserSession` table | Production users                   |

**Detection regex used in API routes**: `/^(sess_\|admin-\|demo-)/.test(token)`

---

## Remediation Roadmap

### Immediate (sprint)

1. **Remove `mock-jwt-token` path** in `signin/page.tsx` — delete the `if (email === 'demo@example.com')` block. No user should be able to get an unvalidated token.

2. **Remove `getSyntheticCatalog()` as a pipeline tier** in the smart intent engine. Replace with: return `{ products: [], message: 'No matching products found' }` when DB search returns empty. Do NOT fall through to synthetic data.

3. **Replace `DEMO_PRODUCTS` initial state** in `shopping-assistant/page.tsx` and `metrics/products/page.tsx` with `[]` / `null` and render an empty-state component.

### Short-term (next 2 sprints)

4. **NestJS `mockGetProducts` / `mockAnalyzeIntent`** — integrate the Product Aggregator Service and Intent Parser microservices. Remove mock implementations after integration.

5. **`lib/fallback-data.ts` FALLBACK_PRODUCTS** — ensure `fb-*` IDs can never be added to cart. Add a guard in the cart/checkout flow: reject any `productId` matching `/^fb-/`.

6. **`intent/analyze/route.ts` CATALOG fallback** — when DB is down, return empty brand/price options with an error flag instead of stale hardcoded data. Frontend should show a "Filters unavailable" message.

### Ongoing

7. **Mobile app `mock.*`** — track and replace `mock.*` usages in each screen as real API integration is implemented. Remove `mock.ts` entirely once all screens are wired.

8. **Admin `generateSyntheticProduct()`** — acceptable for now; monitor `ValidationSession` table growth. Remove synthetic gap-filling once ≥50 real sessions are consistently available.

---

## Environment Variable Controls

Currently **no** `ALLOW_SYNTHETIC` or similar feature flag exists to toggle synthetic data paths. Fallbacks are triggered purely by runtime errors (DB unavailable, API unreachable) or hardcoded logic.

**Recommendation**: Introduce an `ALLOW_SYNTHETIC_DATA=false` env var for production deployments. Any code path that returns synthetic data should check this flag first. This makes it easy to audit and enforce in CI.

---

_Last updated: 2025-01_  
_Maintained by: Engineering Team_  
_Related docs: [ARCHITECTURE.md](../ARCHITECTURE.md), [DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md), [FUNCTIONAL_REQUIREMENTS.md](../FUNCTIONAL_REQUIREMENTS.md)_
