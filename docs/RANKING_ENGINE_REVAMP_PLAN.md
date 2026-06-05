# Ranking Engine Revamp Plan v3.1 — Fully Dynamic + Self-Learning Ranking Engine

> **Status**: DRAFT v3.1 — Pending Review  
> **Author**: Principal Software Engineer & AI Technical Architect  
> **Scope**: Make EVERY ranking factor a configurable dimension + self-learning feedback loop + one-click ML optimization  
> **Goal**: 100% dynamic, auditable, future-proof ranking engine that learns and improves with every search  
> **Revision Note**: v3.1 supersedes v3 — added Section 19: One-Click "Optimize Weights" (async background ML job triggered from admin Scoring Dimensions page, with progress polling, ETA, before/after comparison, and Apply/Discard workflow)

---

## 1. Problem Statement

### Current State (Broken)

| Component | What It Claims | What It Actually Does |
|-----------|---------------|----------------------|
| **Validation Dashboard** | Shows 9 dimension scores with admin-configurable weights | Computes scores client-side, purely for display — **zero ranking influence** |
| **Admin Panel** | Lets admin configure dimension weights (must sum to 1.0) | Weights saved to DB, fetched at login — **only control bar chart widths** |
| **Ranking Engine V2** | 12-factor 100pt scoring | Uses **hardcoded** factors with fixed point allocations — no connection to dimensions |
| **Ranking Engine V3** | 10-factor autonomous scoring | Uses `RankingWeightsConfig` — no connection to dimensions |

### The Disconnect

```
WHAT THE USER SEES (Validation Page):
  "Budget Fit: 85% | Brand Trust: 90% | Delivery: 65% | ..."
  → Implies these scores DETERMINED the product's ranking position

WHAT ACTUALLY HAPPENED:
  Product ranked by: categoryMatch(30) + priceMatch(20) + featureMatch(20) + rating(15) + ...
  → The 9 dimension scores were NEVER consulted
```

### What v1 Plan Missed

The v1 plan still hardcoded Intent Relevance at 30pts, Business Blend at 30%, Personalization at 20pts, Learning Boost at 15pts. The user's requirement is: **EVERYTHING must be configurable**. If admin wants to set Business Score to 50% or disable Learning Boost entirely, they should be able to — from the admin panel, saved in DB, with an audit trail.

---

## 2. Design Philosophy — Zero Hardcoded Scoring

### Principle: Every Point Earned Must Come from a Dimension Row in the Database

```
IF a factor contributes points to the ranking score,
THEN it MUST exist as a row in the ScoringDimension table,
AND its weight MUST be admin-configurable,
AND it MUST be activatable/deactivatable,
AND every change MUST be audited.
```

No exceptions. Not intent relevance. Not business score. Not personalization. **Everything.**

### The Complete Dimension Set (22 Dimensions)

All current V2 + V3 hardcoded factors + the 9 trust dimensions, unified:

| # | Group | Dimension Key | Default Weight | Source | Status |
|---|-------|--------------|---------------|--------|--------|
| **GROUP: INTENT RELEVANCE** | | | | | |
| 1 | Intent | `category_match` | 0.08 | Category alignment with query | **NEW** |
| 2 | Intent | `brand_match` | 0.04 | Brand alignment with query | **NEW** |
| 3 | Intent | `use_case_match` | 0.03 | Use-case subcategory alignment | **NEW** |
| 4 | Intent | `feature_match` | 0.05 | Explicit feature keyword hits | Was hardcoded 20pts in V2 |
| **GROUP: PRODUCT QUALITY (Trust)** | | | | | |
| 5 | Quality | `budget_fit` | 0.08 | Price vs. user budget range | Was hardcoded 20pts in V2 |
| 6 | Quality | `spec_match` | 0.06 | Feature specification richness | Was hardcoded 5pts (attributeDepth) |
| 7 | Quality | `warranty_coverage` | 0.05 | Warranty term from product text | Was display-only |
| 8 | Quality | `manufacturer_profile` | 0.04 | Brand tier, R&D, reputation | Was display-only |
| 9 | Quality | `brand_trust` | 0.04 | Brand trust + user preference overlap | Was display-only |
| 10 | Quality | `delivery_performance` | 0.05 | Delivery speed & on-time history | Was display-only |
| 11 | Quality | `verified_ratings` | 0.06 | OTP-verified rating + review volume | Was hardcoded 15pts (ratingScore) |
| 12 | Quality | `eligible_for_return` | 0.04 | Return eligibility flag | Was display-only |
| 13 | Quality | `eligible_for_replacement` | 0.04 | Replacement eligibility flag | Was display-only |
| **GROUP: ENGAGEMENT SIGNALS** | | | | | |
| 14 | Engagement | `popularity` | 0.04 | Review count log-scale | Was hardcoded 10pts in V2 |
| 15 | Engagement | `learning_boost` | 0.03 | CTR/cart/purchase reinforcement | Was hardcoded +15 bonus |
| 16 | Engagement | `trending_score` | 0.02 | Product trending velocity | V3 only, was hardcoded 20pts |
| **GROUP: PERSONALIZATION** | | | | | |
| 17 | Personal | `preferred_brand_boost` | 0.03 | User's preferred brand match | Was hardcoded +10 bonus |
| 18 | Personal | `recent_click_boost` | 0.02 | Recent click brand affinity | Was hardcoded +5 bonus |
| 19 | Personal | `price_range_fit` | 0.02 | User's historical price range fit | Was hardcoded +5 bonus |
| 20 | Personal | `session_affinity` | 0.03 | Category/brand/price session signals | V3 only, was hardcoded 25pts |
| **GROUP: BUSINESS OBJECTIVES** | | | | | |
| 21 | Business | `conversion_potential` | 0.05 | Conversion rate + margin + inventory | Was hardcoded at 30% blend |
| 22 | Business | `budget_penalty` | 0.10 | Over-budget hard penalty (negative) | Was hardcoded −70 max |
| | | **TOTAL** | **1.00** | | |

### Admin Can Now:

- **Change any weight** → e.g., set `warranty_coverage` to 20% to heavily favor warranted products
- **Deactivate any dimension** → e.g., disable `trending_score` if data is stale
- **Add new custom dimensions** → e.g., add `eco_friendly` with a scorer function
- **See exactly how weights sum** → existing 100% validation enforced
- **Audit every change** → full history with old/new weights, timestamp, who changed it

---

## 3. Database Schema Changes

### 3.1 Enhanced `ScoringDimension` Table (ALTER)

Add columns to current table:

```sql
ALTER TABLE "ScoringDimension"
  ADD COLUMN IF NOT EXISTS "group"         TEXT NOT NULL DEFAULT 'quality',
  ADD COLUMN IF NOT EXISTS "scorerKey"     TEXT,           -- maps to scorer function in code
  ADD COLUMN IF NOT EXISTS "maxRawScore"   FLOAT NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS "isNegative"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "minWeightage"  FLOAT NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS "maxWeightage"  FLOAT NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS "version"       INTEGER NOT NULL DEFAULT 1;
```

| New Column | Purpose |
|-----------|---------|
| `group` | UI grouping: `intent`, `quality`, `engagement`, `personal`, `business` |
| `scorerKey` | Maps to a registered scorer function (e.g., `computeBudgetFitScore`) — allows code to know which function to call |
| `maxRawScore` | Maximum raw score the scorer can return (1.0 for 0-1 scorers, can be higher for custom) |
| `isNegative` | `true` for `budget_penalty` — score subtracts instead of adds |
| `minWeightage` / `maxWeightage` | Guard rails — admin can't set budget_penalty weight to 0% (min 0.05) |
| `version` | Auto-incremented on every save — used for audit trail FK |

### 3.2 NEW: `ScoringDimensionAudit` Table (Audit Trail)

```sql
CREATE TABLE IF NOT EXISTS "ScoringDimensionAudit" (
  id            SERIAL PRIMARY KEY,
  "snapshotId"  UUID NOT NULL DEFAULT gen_random_uuid(),
  "changedBy"   INTEGER NOT NULL REFERENCES "User"(id),
  "changedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "changeType"  TEXT NOT NULL,          -- 'weight_update' | 'activate' | 'deactivate' | 'add' | 'remove' | 'bulk_update'
  "reason"      TEXT,                   -- optional admin-provided reason for change
  -- Full snapshot of ALL dimensions at this point in time
  "snapshot"    JSONB NOT NULL,         -- [{key, label, weightage, isActive, group, sortOrder, ...}, ...]
  -- Delta for quick scanning
  "changes"     JSONB,                  -- [{key, field, oldValue, newValue}, ...]
  -- Metadata
  "ipAddress"   TEXT,
  "userAgent"   TEXT
);

CREATE INDEX idx_scoring_audit_snapshot ON "ScoringDimensionAudit"("snapshotId");
CREATE INDEX idx_scoring_audit_changed_at ON "ScoringDimensionAudit"("changedAt" DESC);
CREATE INDEX idx_scoring_audit_changed_by ON "ScoringDimensionAudit"("changedBy");
```

**Why JSONB snapshot?** For legal/dispute situations, you need to know exactly what weights were active at any point in time. A full snapshot (not just deltas) means you can reconstruct the exact ranking logic that was in effect when a specific product was ranked — no need to replay deltas.

### 3.3 NEW: `RankingAuditLog` Table (Per-Search Audit — Optional, for disputes)

```sql
CREATE TABLE IF NOT EXISTS "RankingAuditLog" (
  id              SERIAL PRIMARY KEY,
  "sessionId"     TEXT,
  "userId"        INTEGER,
  "query"         TEXT NOT NULL,
  "rankedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "engineVersion" TEXT NOT NULL,           -- 'v2' | 'v3'
  "dimensionSnapshotId" UUID,              -- FK to ScoringDimensionAudit.snapshotId
  "topProducts"   JSONB,                   -- [{productId, finalScore, scoreBreakdown}, ...] — top 20
  "totalProducts" INTEGER,
  "processingMs"  INTEGER
);

CREATE INDEX idx_ranking_audit_session ON "RankingAuditLog"("sessionId");
CREATE INDEX idx_ranking_audit_date ON "RankingAuditLog"("rankedAt" DESC);
```

**Purpose**: If a buyer disputes "why was product X ranked #1?", you can look up the exact search, the exact dimension weights that were in effect (via `dimensionSnapshotId`), and the exact score breakdown for every product. Complete legal protection.

---

## 4. Unified Scoring Architecture

### 4.1 The Formula — Everything Dynamic

```
totalScore = 0
For each ACTIVE dimension D in ScoringDimension table:
  rawScore_D = run_scorer(D.scorerKey, product, intent, userContext)   // 0.0 – D.maxRawScore
  normalizedScore_D = rawScore_D / D.maxRawScore                       // normalize to 0.0 – 1.0
  IF D.isNegative:
    totalScore -= normalizedScore_D × D.weightage × TOTAL_POINT_BUDGET
  ELSE:
    totalScore += normalizedScore_D × D.weightage × TOTAL_POINT_BUDGET

finalScore = max(0, round(totalScore))
```

**TOTAL_POINT_BUDGET = 100** (this is the only hardcoded constant — it's a scale factor)

Since all active dimension weights sum to 1.0, and all raw scores are normalized to 0.0–1.0, the maximum possible score is 100 (when every dimension returns its max). The budget_penalty dimension subtracts because `isNegative = true`.

### 4.2 Scorer Registry — Mapping `scorerKey` to Functions

```ts
// lib/scoring/scorer-registry.ts

type ScorerFn = (product: ScorerInput, context: ScorerContext) => number;

const SCORER_REGISTRY: Record<string, ScorerFn> = {
  // Intent Relevance
  'category_match':          scoreCategoryMatch,
  'brand_match':             scoreBrandMatch,
  'use_case_match':          scoreUseCaseMatch,
  'feature_match':           scoreFeatureMatch,
  // Product Quality
  'budget_fit':              scoreBudgetFit,
  'spec_match':              scoreSpecMatch,
  'warranty_coverage':       scoreWarrantyCoverage,
  'manufacturer_profile':    scoreManufacturerProfile,
  'brand_trust':             scoreBrandTrust,
  'delivery_performance':    scoreDeliveryPerformance,
  'verified_ratings':        scoreVerifiedRatings,
  'eligible_for_return':     scoreReturnEligibility,
  'eligible_for_replacement': scoreReplacementEligibility,
  // Engagement
  'popularity':              scorePopularity,
  'learning_boost':          scoreLearningBoost,
  'trending_score':          scoreTrendingScore,
  // Personalization
  'preferred_brand_boost':   scorePreferredBrand,
  'recent_click_boost':      scoreRecentClickBrand,
  'price_range_fit':         scorePriceRangeFit,
  'session_affinity':        scoreSessionAffinity,
  // Business
  'conversion_potential':    scoreConversionPotential,
  'budget_penalty':          scoreBudgetPenalty,
};

export function getScorer(scorerKey: string): ScorerFn | null {
  return SCORER_REGISTRY[scorerKey] ?? null;
}

export function registerScorer(key: string, fn: ScorerFn): void {
  SCORER_REGISTRY[key] = fn;
}
```

**Why a registry?** When admin adds a new custom dimension, the `scorerKey` tells the engine which function to call. If no scorer is registered for a new dimension, it defaults to returning 0 (neutral) — the dimension still appears in the admin panel and audit trail, ready for a developer to wire up a scorer function.

### 4.3 Scorer Input / Context Types

```ts
export interface ScorerInput {
  id: string;
  name: string;
  brand: string;
  price: number;
  category: string;
  subCategory: string;
  rating: number;
  reviewCount: number;
  attributes: Record<string, string>;
  features: string[];              // key_features text
  delivery: { daysMin: number; daysMax: number; free: boolean };
  eligibleForReturn?: boolean;
  eligibleForReplacement?: boolean;
  // Business metrics (from generateMetrics)
  conversionRate?: number;
  marginPercentage?: number;
  inventoryCount?: number;
  returnRate?: number;
  // Learning signals
  learningBoost?: number;
  trendingScore?: number;
}

export interface ScorerContext {
  intent: {
    category: string | null;
    brand: string | null;
    budget: { min: number; max: number } | null;
    use_case: string | null;
    features: string[];
  };
  userContext?: {
    preferredBrands?: string[];
    preferredCategories?: string[];
    priceRange?: { min: number; max: number };
    recentClickBrands?: string[];
  };
  sessionContext?: {
    viewedCategories?: Record<string, number>;
    clickedBrands?: Record<string, number>;
    priceHistory?: number[];
  };
}
```

### 4.4 Each Scorer Function Returns 0.0–1.0

Every scorer function is a pure function: `(product, context) → number` in range `[0.0, 1.0]`.

Here are the 22 scorer implementations (all derived from existing code, refactored from hardcoded):

| # | Scorer Key | Logic (from current code) | Output Range |
|---|-----------|--------------------------|-------------|
| 1 | `category_match` | `intent.category === product.category ? 1.0 : 0.0` | 0.0–1.0 |
| 2 | `brand_match` | `intent.brand === product.brand ? 1.0 : 0.0` | 0.0–1.0 |
| 3 | `use_case_match` | Subcategory contains use-case keyword → 1.0, else 0.0 | 0.0–1.0 |
| 4 | `feature_match` | `(attrHits + intentFeatureHits) / totalExpected` — from V2's use_case_attr_prefs + explicit features | 0.0–1.0 |
| 5 | `budget_fit` | New `computeBudgetFitScore(price, budget)` — sweet spot (75-100% of max) = 1.0, decays with distance | 0.0–1.0 |
| 6 | `spec_match` | `computeSpecScore(features).score` — feature richness (0–4+ features mapped to 0.20–0.95) | 0.0–1.0 |
| 7 | `warranty_coverage` | `computeWarrantyInfo(features).score` — 5yr=1.0, 3yr=0.90, 1yr=0.65, none=0.30 | 0.0–1.0 |
| 8 | `manufacturer_profile` | `getBrandTier(brand).score` — premium=0.90, rising=0.70, standard=0.55 | 0.0–1.0 |
| 9 | `brand_trust` | `getBrandTier(brand).score` + preferred brand bonus (+0.10) | 0.0–1.0 |
| 10 | `delivery_performance` | `parseDeliveryInfo(delivery).score` — same day=1.0, 3-5d=0.65, 7+d=0.35 | 0.0–1.0 |
| 11 | `verified_ratings` | `computeVerifiedRating(rating, reviewCount).verifiedScore` — rating × trust weight | 0.0–1.0 |
| 12 | `eligible_for_return` | `computeReturnEligibility(flag, features).score` — eligible=1.0, unknown=0.5 | 0.0–1.0 |
| 13 | `eligible_for_replacement` | `computeReplacementEligibility(flag, features).score` — eligible=1.0, unknown=0.5 | 0.0–1.0 |
| 14 | `popularity` | `min(1.0, log10(reviewCount) / 4.48)` — from V2 | 0.0–1.0 |
| 15 | `learning_boost` | `min(1.0, getLearningBoost(id) / 15)` — normalized from capped +15 | 0.0–1.0 |
| 16 | `trending_score` | `min(1.0, trendingScore / 10)` — from V3 | 0.0–1.0 |
| 17 | `preferred_brand_boost` | User's preferred brand list contains product brand → 1.0, else 0.0 | 0.0–1.0 |
| 18 | `recent_click_boost` | Recently clicked brand → 1.0, else 0.0 | 0.0–1.0 |
| 19 | `price_range_fit` | Price within user's historical range → 1.0, else 0.0 | 0.0–1.0 |
| 20 | `session_affinity` | Category view ratio + brand click ratio + price similarity — from V3 | 0.0–1.0 |
| 21 | `conversion_potential` | Normalized business score: `(convScore + marginScore + invScore) / 50` — from V2's business-scoring | 0.0–1.0 |
| 22 | `budget_penalty` | Over-budget ratio → 0 if within budget, scaled to 1.0 if >300% over (`isNegative=true`) | 0.0–1.0 |

---

## 5. Data Flow — End to End

### 5.1 Admin Configures Weights

```
Admin Panel (Scoring Dimensions Page)
    │
    ├─ View all 22 dimensions grouped by category
    ├─ Adjust sliders (weight per dimension)
    ├─ Activate/deactivate any dimension
    ├─ Add custom dimensions (key, label, group, weight)
    ├─ Optionally provide "reason for change" (for audit)
    │
    ▼
PUT /api/admin/scoring-dimensions
    │
    ├─ Validate: active weights sum to 1.0 (±0.01)
    ├─ Validate: min/max weight guard rails respected
    ├─ Compute delta (old vs new)
    ├─ Save snapshot to ScoringDimensionAudit (JSONB)
    ├─ Update ScoringDimension table
    ├─ Invalidate server-side cache
    │
    ▼
Database (ScoringDimension + ScoringDimensionAudit)
```

### 5.2 Search Request → Ranking

```
User searches "laptop under 50000"
    │
    ▼
/api/intent/analyze (V2) or /api/search (V3)
    │
    ├─ Parse intent
    ├─ Search products
    │
    ▼
Ranking Engine (unified)
    │
    ├─ Fetch active dimensions from DB (60s server cache)
    ├─ For each product:
    │     For each ACTIVE dimension:
    │       rawScore = SCORER_REGISTRY[dim.scorerKey](product, context)
    │       normalized = rawScore / dim.maxRawScore
    │       points = normalized × dim.weightage × 100
    │       IF dim.isNegative: totalScore -= points
    │       ELSE: totalScore += points
    │     finalScore = max(0, round(totalScore))
    │
    ├─ Sort by finalScore DESC, id ASC (stable)
    ├─ Optionally log to RankingAuditLog (for dispute-grade tracing)
    │
    ▼
Response includes:
  - products[] with finalScore + per-dimension breakdown
  - dimensionWeightsUsed {} (snapshot of active weights)
  - dimensionSnapshotId (for audit trail linkage)
```

### 5.3 Validation Page — Provably Authentic

```
Validation Page receives:
  - Each product's scoreBreakdown with ALL dimension scores
  - The exact weights that were used for ranking
  - Snapshot ID for audit trail

Displays:
  ┌──────────────────────────────────────────────────────┐
  │ Budget Fit       ████████░░  85%  ×  8% = 6.8 pts   │
  │ Spec Match       ██████░░░░  65%  ×  6% = 3.9 pts   │
  │ Warranty         █████████░  92%  ×  5% = 4.6 pts   │
  │ ...                                                   │
  │ Budget Penalty   ██░░░░░░░░  0%   × 10% = 0.0 pts   │
  │ ──────────────────────────────────────────────────── │
  │ TOTAL SCORE:  78.3/100        Weights: Admin Config  │
  │ Audit Trail: snapshot #a7b3c9  │ 2026-04-16 14:30   │
  └──────────────────────────────────────────────────────┘
```

---

## 6. Server-Side Weight Fetching

### `lib/scoring/dimension-weights.ts` (NEW)

```ts
import { query } from '@/lib/db';

export interface DimensionConfig {
  key: string;
  label: string;
  weightage: number;
  group: string;
  scorerKey: string;
  maxRawScore: number;
  isNegative: boolean;
  isActive: boolean;
  sortOrder: number;
}

// In-memory cache with TTL
let cachedDimensions: DimensionConfig[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

export async function getActiveDimensions(): Promise<DimensionConfig[]> {
  const now = Date.now();
  if (cachedDimensions && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedDimensions;
  }
  try {
    const rows = await query(
      `SELECT key, label, weightage, "group", "scorerKey",
              "maxRawScore", "isNegative", "isActive", "sortOrder"
       FROM "ScoringDimension"
       WHERE "isActive" = true
       ORDER BY "sortOrder" ASC`
    );
    cachedDimensions = rows as DimensionConfig[];
    cacheTimestamp = now;
    return cachedDimensions;
  } catch {
    return getDefaultDimensions(); // graceful fallback
  }
}

export function invalidateCache(): void {
  cachedDimensions = null;
  cacheTimestamp = 0;
}

function getDefaultDimensions(): DimensionConfig[] {
  // ... 22 default dimensions matching the seed SQL
}
```

---

## 7. Audit Trail — Legal Protection

### 7.1 On Every Save — Full Snapshot

When admin clicks "Save Changes", the API:

1. **Reads current state** from DB (before update)
2. **Computes delta** — which fields changed on which dimensions
3. **Saves full snapshot** to `ScoringDimensionAudit`:
   - `snapshot`: JSONB array of ALL dimensions (active + inactive) with all fields
   - `changes`: JSONB array of deltas: `[{key: "budget_fit", field: "weightage", old: 0.10, new: 0.15}, ...]`
   - `changedBy`: admin user ID
   - `reason`: optional admin-provided justification
   - `ipAddress`, `userAgent`: request context
4. **Increments version** on each modified dimension row

### 7.2 On Every Search (Optional — Configurable)

When ranking products, the engine:
1. Records `dimensionSnapshotId` — a reference to the most recent audit snapshot, so we know exactly which weights were in effect
2. Optionally logs top-20 product scores to `RankingAuditLog` (can be enabled/disabled via env var `RANKING_AUDIT_ENABLED=true`)

### 7.3 Dispute Resolution Workflow

```
Dispute: "Why was Product X ranked #1 on April 14?"

Step 1: Look up RankingAuditLog for the session/date
 → Shows: dimensionSnapshotId = "a7b3c9...", topProducts = [{id: X, score: 87, breakdown: {...}}]

Step 2: Look up ScoringDimensionAudit by snapshotId
 → Shows: exact weights in effect: {budget_fit: 0.15, brand_trust: 0.08, ...}

Step 3: Reproduce the ranking
 → Apply snapshot weights to Product X → confirms score = 87
 → Full transparency, legally defensible
```

### 7.4 Admin Audit History UI

Add a "Change History" tab to the Scoring Dimensions page:

| Date | Admin | Change | Reason |
|------|-------|--------|--------|
| Apr 16 14:30 | admin@dc.com | budget_fit: 10%→15%, brand_trust: 10%→5% | "Prioritize price sensitivity for summer sale" |
| Apr 14 09:00 | admin@dc.com | warranty_coverage: 10%→12% | "Warranty complaints trending on support" |
| Apr 10 16:45 | admin@dc.com | Added: eco_friendly (3%) | "Green initiative launch" |

---

## 8. Implementation Plan — File by File

### Phase 1: Database & Foundation (Non-Breaking)

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `scripts/r59-scoring-engine-revamp.sql` | **CREATE** | Migration: ALTER ScoringDimension (add columns), CREATE ScoringDimensionAudit, CREATE RankingAuditLog, SEED 22 dimensions |
| 2 | `apps/web/lib/scoring/scorer-registry.ts` | **CREATE** | Scorer registry: 22 scorer functions + `getScorer()` + `registerScorer()` |
| 3 | `apps/web/lib/scoring/dimension-weights.ts` | **CREATE** | Server-side dimension fetcher with 60s cache |
| 4 | `apps/web/lib/scoring/product-scoring.ts` | **MODIFY** | Add `computeBudgetFitScore()`, `computeEnhancedSpecScore()`, `computeBrandTrustScore()` — new standalone functions used by scorers |

### Phase 2: Ranking Engine Rewrite

| # | File | Action | Description |
|---|------|--------|-------------|
| 5 | `apps/web/lib/smart-intent/ranking-engine.ts` | **MAJOR REWRITE** | Replace all hardcoded scoring with dimension-driven loop. Make `rankProducts` async. Call scorer registry for each active dimension. |
| 6 | `apps/web/lib/smart-intent/autonomous-ranking.ts` | **MAJOR REWRITE** | Same dimension-driven approach for V3. Remove hardcoded weight constants. |
| 7 | `apps/web/lib/smart-intent/types.ts` | **MODIFY** | Extend `RankedProduct.scoreBreakdown` to have all dimension keys + `dimensionWeightsUsed` + `dimensionSnapshotId` |
| 8 | `apps/web/lib/smart-intent/index.ts` | **MODIFY** | Update re-export of `rankProducts` (now async) |
| 9 | `apps/web/lib/smart-intent/business-scoring.ts` | **MODIFY** | Refactor `computeBusinessScore` to return normalized 0–1 score (used by `conversion_potential` scorer) |

### Phase 3: API Route Updates

| # | File | Action | Description |
|---|------|--------|-------------|
| 10 | `apps/web/app/api/admin/scoring-dimensions/route.ts` | **MAJOR MODIFY** | Add audit trail on PUT/POST, validate guard rails, return groups, invalidate cache |
| 11 | `apps/web/app/api/intent/analyze/route.ts` | **MODIFY** | `await rankProducts(...)`, pass dimensionSnapshotId in response |
| 12 | `apps/web/app/api/search/route.ts` | **MODIFY** | Fetch dimensions, pass to V3 rankProducts, include snapshot in response |

### Phase 4: Admin UI Upgrade

| # | File | Action | Description |
|---|------|--------|-------------|
| 13 | `apps/web/app/admin/scoring-dimensions/page.tsx` | **MAJOR MODIFY** | Group-based UI (accordion per group), min/max weight guard rails, reason-for-change input, audit history tab |
| 14 | `apps/web/lib/store/scoring-dimensions.store.ts` | **MODIFY** | Extend `ScoringDimension` interface with new fields (group, scorerKey, isNegative, etc.) |

### Phase 5: Validation Page Authenticity

| # | File | Action | Description |
|---|------|--------|-------------|
| 15 | `apps/web/app/shopping-assistant/metrics/validation/page.tsx` | **MODIFY** | Show per-dimension weighted contribution, weight source badge, audit snapshot link |

**Total: 3 new files + 12 modified files**

---

## 9. Migration SQL — `r59-scoring-engine-revamp.sql`

```sql
BEGIN;

-- ── 1. Add new columns to ScoringDimension ──────────────────────────────────
ALTER TABLE "ScoringDimension"
  ADD COLUMN IF NOT EXISTS "group"         TEXT NOT NULL DEFAULT 'quality',
  ADD COLUMN IF NOT EXISTS "scorerKey"     TEXT,
  ADD COLUMN IF NOT EXISTS "maxRawScore"   FLOAT NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS "isNegative"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "minWeightage"  FLOAT NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS "maxWeightage"  FLOAT NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS "version"       INTEGER NOT NULL DEFAULT 1;

-- ── 2. Update existing 9 dimensions with scorerKey and group ────────────────
UPDATE "ScoringDimension" SET "group" = 'quality', "scorerKey" = 'budget_fit'              WHERE key = 'budget_fit';
UPDATE "ScoringDimension" SET "group" = 'quality', "scorerKey" = 'spec_match'              WHERE key = 'spec_match';
UPDATE "ScoringDimension" SET "group" = 'quality', "scorerKey" = 'warranty_coverage'       WHERE key = 'warranty_coverage';
UPDATE "ScoringDimension" SET "group" = 'quality', "scorerKey" = 'manufacturer_profile'    WHERE key = 'manufacturer_profile';
UPDATE "ScoringDimension" SET "group" = 'quality', "scorerKey" = 'brand_trust'             WHERE key = 'brand_trust';
UPDATE "ScoringDimension" SET "group" = 'quality', "scorerKey" = 'delivery_performance'    WHERE key = 'delivery_performance';
UPDATE "ScoringDimension" SET "group" = 'quality', "scorerKey" = 'verified_ratings'        WHERE key = 'verified_ratings';
UPDATE "ScoringDimension" SET "group" = 'quality', "scorerKey" = 'eligible_for_return'     WHERE key = 'eligible_for_return';
UPDATE "ScoringDimension" SET "group" = 'quality', "scorerKey" = 'eligible_for_replacement' WHERE key = 'eligible_for_replacement';

-- ── 3. Rebalance existing 9 dimension weights for 22-dimension universe ─────
-- Old: 9 dims sum to 1.0. New: 22 dims sum to 1.0.
-- Existing quality dims get reduced weights to make room for 13 new dims.
UPDATE "ScoringDimension" SET weightage = 0.08 WHERE key = 'budget_fit';
UPDATE "ScoringDimension" SET weightage = 0.06 WHERE key = 'spec_match';
UPDATE "ScoringDimension" SET weightage = 0.05 WHERE key = 'warranty_coverage';
UPDATE "ScoringDimension" SET weightage = 0.04 WHERE key = 'manufacturer_profile';
UPDATE "ScoringDimension" SET weightage = 0.04 WHERE key = 'brand_trust';
UPDATE "ScoringDimension" SET weightage = 0.05 WHERE key = 'delivery_performance';
UPDATE "ScoringDimension" SET weightage = 0.06 WHERE key = 'verified_ratings';
UPDATE "ScoringDimension" SET weightage = 0.04 WHERE key = 'eligible_for_return';
UPDATE "ScoringDimension" SET weightage = 0.04 WHERE key = 'eligible_for_replacement';

-- ── 4. Insert 13 new dimensions ─────────────────────────────────────────────
INSERT INTO "ScoringDimension" (key, label, weightage, description, "sortOrder", "group", "scorerKey", "isNegative", "minWeightage") VALUES
  ('category_match',        'Category Match',          0.08, 'Category alignment with search query',          10, 'intent',     'category_match',        false, 0.02),
  ('brand_match',           'Brand Match',             0.04, 'Brand alignment with search query',             11, 'intent',     'brand_match',           false, 0.0),
  ('use_case_match',        'Use Case Match',          0.03, 'Use-case subcategory alignment',                12, 'intent',     'use_case_match',        false, 0.0),
  ('feature_match',         'Feature Match',           0.05, 'Explicit feature keyword match score',          13, 'intent',     'feature_match',         false, 0.0),
  ('popularity',            'Popularity',              0.04, 'Review count log-scale popularity',             20, 'engagement', 'popularity',            false, 0.0),
  ('learning_boost',        'Learning Boost',          0.03, 'CTR/cart/purchase reinforcement signal',        21, 'engagement', 'learning_boost',        false, 0.0),
  ('trending_score',        'Trending Score',          0.02, 'Product trending velocity',                     22, 'engagement', 'trending_score',        false, 0.0),
  ('preferred_brand_boost', 'Preferred Brand Boost',   0.03, 'User preferred brand match',                    30, 'personal',   'preferred_brand_boost', false, 0.0),
  ('recent_click_boost',    'Recent Click Boost',      0.02, 'Recent click brand affinity',                   31, 'personal',   'recent_click_boost',    false, 0.0),
  ('price_range_fit',       'Price Range Fit',         0.02, 'User historical price range fit',               32, 'personal',   'price_range_fit',       false, 0.0),
  ('session_affinity',      'Session Affinity',        0.03, 'Category/brand/price session signals',          33, 'personal',   'session_affinity',      false, 0.0),
  ('conversion_potential',  'Conversion Potential',    0.05, 'Conversion rate + margin + inventory score',    40, 'business',   'conversion_potential',  false, 0.0),
  ('budget_penalty',        'Budget Penalty',          0.10, 'Over-budget hard penalty (reduces score)',       41, 'business',   'budget_penalty',        true,  0.05)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  weightage = EXCLUDED.weightage,
  description = EXCLUDED.description,
  "sortOrder" = EXCLUDED."sortOrder",
  "group" = EXCLUDED."group",
  "scorerKey" = EXCLUDED."scorerKey",
  "isNegative" = EXCLUDED."isNegative",
  "minWeightage" = EXCLUDED."minWeightage",
  "updatedAt" = NOW();

-- ── 5. Create Audit Trail Table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ScoringDimensionAudit" (
  id            SERIAL PRIMARY KEY,
  "snapshotId"  UUID NOT NULL DEFAULT gen_random_uuid(),
  "changedBy"   INTEGER NOT NULL,
  "changedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "changeType"  TEXT NOT NULL,
  "reason"      TEXT,
  "snapshot"    JSONB NOT NULL,
  "changes"     JSONB,
  "ipAddress"   TEXT,
  "userAgent"   TEXT
);

CREATE INDEX IF NOT EXISTS idx_scoring_audit_snapshot ON "ScoringDimensionAudit"("snapshotId");
CREATE INDEX IF NOT EXISTS idx_scoring_audit_changed_at ON "ScoringDimensionAudit"("changedAt" DESC);
CREATE INDEX IF NOT EXISTS idx_scoring_audit_changed_by ON "ScoringDimensionAudit"("changedBy");

-- ── 6. Create Ranking Audit Log (optional per-search audit) ─────────────────
CREATE TABLE IF NOT EXISTS "RankingAuditLog" (
  id                    SERIAL PRIMARY KEY,
  "sessionId"           TEXT,
  "userId"              INTEGER,
  "query"               TEXT NOT NULL,
  "rankedAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "engineVersion"       TEXT NOT NULL,
  "dimensionSnapshotId" UUID,
  "topProducts"         JSONB,
  "totalProducts"       INTEGER,
  "processingMs"        INTEGER
);

CREATE INDEX IF NOT EXISTS idx_ranking_audit_session ON "RankingAuditLog"("sessionId");
CREATE INDEX IF NOT EXISTS idx_ranking_audit_date ON "RankingAuditLog"("rankedAt" DESC);

-- ── 7. Seed an initial audit snapshot ───────────────────────────────────────
INSERT INTO "ScoringDimensionAudit" ("changedBy", "changeType", "reason", "snapshot")
SELECT 1, 'initial_seed', 'R59: Ranking engine revamp — initial 22-dimension configuration',
  (SELECT json_agg(row_to_json(d)) FROM "ScoringDimension" d)::jsonb;

COMMIT;
```

---

## 10. Admin UI Changes — Grouped Dimension Management

### Current UI Capabilities (Already Built)

The existing admin page already supports:
- ✅ View all dimensions with weight sliders
- ✅ Edit weights (range slider + numeric input)
- ✅ Edit labels inline
- ✅ Toggle isActive checkbox
- ✅ Remove dimensions
- ✅ Add new dimensions (key, label, weight, description)
- ✅ Equalize weights button
- ✅ Weight total validation (must sum to 100%)
- ✅ Visual weight distribution bar chart
- ✅ Reset to saved state
- ✅ Save changes

### New UI Additions

| Feature | Description |
|---------|-------------|
| **Group Accordions** | Dimensions grouped into: Intent Relevance, Product Quality, Engagement, Personalization, Business — collapsible sections |
| **Guard Rail Indicators** | Show min/max weight bounds per dimension (e.g., budget_penalty min=5%) |
| **Negative Dimension Badge** | Red "−" badge on budget_penalty to show it subtracts from score |
| **Reason Input on Save** | Modal prompts admin for optional "reason for change" before saving — stored in audit trail |
| **Audit History Tab** | New tab showing chronological change log from `ScoringDimensionAudit` table |
| **Scorer Status Indicator** | Green dot if `scorerKey` has a registered function, amber if unregistered (new custom dimensions) |
| **Group Subtotal** | Shows weight subtotal per group (e.g., "Intent: 20% | Quality: 46% | Engagement: 9% | Personal: 10% | Business: 15%") |

---

## 11. Backward Compatibility & Safety

| Risk | Mitigation |
|------|-----------|
| **22 dims don't sum to 1.0 after migration** | Migration SQL carefully sets weights that sum to exactly 1.00 |
| **Budget penalty weight set to 0%** | `minWeightage = 0.05` guard rail prevents this — over-budget products always penalized |
| **Admin deactivates ALL quality dimensions** | frontend shows warning if any group's total weight drops below 5% — but doesn't block (admin has total control) |
| **Custom dimension added but no scorer registered** | `getScorer(key)` returns null → dimension contributes 0 points (neutral) until developer wires up a scorer |
| **DB unavailable** | `getActiveDimensions()` falls back to hardcoded DEFAULT_DIMENSIONS (all 22 with default weights) |
| **`rankProducts` now async** | Only 2 call sites: `intent/analyze` route and `smart-intent/index.ts` — both already in async contexts |
| **Audit table grows unbounded** | Index on `changedAt` + future cleanup job can prune records older than N years (configurable) |
| **Client Zustand store out of sync** | Store still fetches from same GET endpoint — now returns all 22 dimensions with new fields |

---

## 12. Testing Strategy

| Test Type | What to Verify |
|-----------|---------------|
| **Unit: scorer-registry** | Each scorer returns 0.0–1.0, handles missing data, edge cases |
| **Unit: dynamic ranking** | With mock dimensions from DB, verify weighted scoring produces expected ordering |
| **Unit: weight change → order change** | Change `warranty_coverage` from 5% to 30% → verify warranty-heavy products rise |
| **Unit: deactivated dimension** | Deactivate `trending_score` → verify it contributes 0 points |
| **Unit: negative dimension** | `budget_penalty` with `isNegative=true` → verify over-budget products drop |
| **Unit: custom dimension with no scorer** | Dimension key with no registered scorer → contributes 0, no crash |
| **Integration: audit trail** | PUT dimensions → verify ScoringDimensionAudit row created with correct snapshot and delta |
| **Integration: end-to-end ranking** | Search API → verify response includes per-dimension breakdown and snapshotId |
| **Regression: budget penalty** | Over-budget products at >125% still sink to bottom |
| **Migration: r59 SQL** | Run on existing DB → verify all 22 dimensions seeded, audit table created |

---

## 13. Key Design Decisions (For Review)

### Decision 1: Everything Is a Dimension — No Exceptions
Every single factor that contributes to ranking score (intent match, business score, personalization, penalties) is a row in `ScoringDimension`. Admin has total control.

**Tradeoff**: More complexity in admin panel (22 rows vs 9). Mitigated by grouping UI.

### Decision 2: Scorer Registry Pattern
Each dimension's `scorerKey` maps to a registered function. This decouples "what to score" (DB config) from "how to score" (code logic).

**Future-proof**: To add a new dimension, admin adds a row in the UI → developer registers a scorer function → done. No ranking engine code changes needed.

### Decision 3: Full JSONB Snapshot for Audit (Not Just Deltas)
Each audit record stores the COMPLETE state of all dimensions, not just what changed.

**Why**: For legal disputes, you need to reconstruct exact ranking logic at any point in time. With full snapshots, it's a single query — no delta replay needed.

**Tradeoff**: More storage. At ~2KB per snapshot and maybe 5 changes/day, that's <4MB/year.

### Decision 4: Budget Penalty Has a Minimum Weight Guard Rail
`minWeightage = 0.05` (5%) ensures admin can't set it to 0% and allow over-budget products to rank high.

**Rationale**: UX safety net. Users who search "laptop under 50000" should never see a 200,000 laptop ranked first. This is a business-critical constraint.

### Decision 5: Per-Search Audit is Optional (ENV Flag)
`RankingAuditLog` only written when `RANKING_AUDIT_ENABLED=true`.

**Rationale**: Writing to DB on every search adds latency (~5ms). For most use cases, the dimension snapshot audit is sufficient. Enable per-search audit only when dispute-grade tracing is needed.

### Decision 6: 60-Second Server Cache
Dimension config is cached for 60 seconds on the server. Admin changes take effect within 60 seconds.

**Rationale**: Avoid DB query on every search. 60 seconds is acceptable — admin weight tweaks are not latency-critical. Cache is invalidated immediately when the PUT endpoint is called from the same process.

---

## 14. Comparison: v1 Plan vs v2 Plan

| Aspect | v1 Plan (Previous) | v2 Plan (This Document) |
|--------|-------------------|------------------------|
| Configurable dimensions | 9 trust dimensions only | **All 22 factors** — intent, quality, engagement, personalization, business |
| Intent relevance | Hardcoded 30pts | **Configurable** — 4 dimensions in "Intent" group |
| Business score | Hardcoded 30% blend | **Configurable** — `conversion_potential` dimension + weight |
| Personalization | Hardcoded +20 bonus | **Configurable** — 4 dimensions in "Personal" group |
| Learning boost | Hardcoded +15 cap | **Configurable** — `learning_boost` dimension + weight |
| Budget penalty | Hardcoded −70 | **Configurable** — `budget_penalty` dimension with `minWeightage` guard rail |
| Formula | Two-layer (intent 30 + quality 70) | **Single unified loop** — all dimensions equal citizens |
| Scoring approach | Mix of additive + multiplicative + blend | **Pure additive** — all 0–1 scores × weights × 100 |
| Negative dimensions | Not supported | **Supported** — `isNegative` flag for subtractive dimensions |
| Custom dimensions | Not planned | **Supported** — admin adds row, developer registers scorer |
| Audit trail | Not included | **Full audit** — dimension snapshots + per-search logs |
| Guard rails | Not included | **Built-in** — min/max weight per dimension |
| Grouping | Not included | **5 groups** — collapsible in admin UI |
| Dispute resolution | Not addressed | **Complete** — snapshot → ranking log → reproduce exact score |

---

## 15. Summary — What Admin Gets

After implementation, the admin panel for Scoring Dimensions becomes the **single control plane** for all ranking logic:

1. **22 dimensions** across 5 groups — every ranking factor visible and adjustable
2. **Weight sliders** with numeric precision — drag to fine-tune any factor
3. **Activate/deactivate toggle** — turn any factor on/off instantly
4. **Add new dimensions** — future-proof extensibility (eco_friendly, AR_support, etc.)
5. **Guard rails** — min/max weight bounds prevent dangerous misconfigurations
6. **Reason for change** — required/optional justification saved with every update
7. **Full audit history** — complete snapshot of every configuration ever applied
8. **Per-search audit log** — optional detailed logging for dispute resolution
9. **60-second propagation** — changes take effect across all API routes within 1 minute
10. **Zero downtime** — no code deployment needed for weight adjustments

---

## 16. PHASE 6 — Self-Learning Ranking Engine

> **This is the most significant addition in v3.** The ranking engine becomes a living system that captures every ranking decision and its outcome, learns from user behavior, and auto-tunes dimension weights to maximize relevance over time — with full admin visibility and override control.

### 16.1 Problem: Current Learning Systems Are Broken

**Critical Finding from Code Analysis:**

| System | DB Table Exists? | Code Reads/Writes DB? | Actual Persistence |
|--------|:---:|:---:|---|
| `product-learning.ts` | ✅ `ProductLearning` | ❌ **Never** | In-memory `Map<>` — **lost on restart** |
| `feedback-tracker.ts` | ✅ `UserBehavior` | ❌ **Never** | In-memory `Map<>` — **lost on restart** |
| `query-learning.ts` | ✅ `QueryLearning` | ❌ **Never** | In-memory `Map<>` — **lost on restart** |
| `signal-processor.ts` | ❌ None | N/A | 1-hour rolling window — **lost on restart** |
| `auto-tuning.ts` | ✅ `RankingWeights` | ❌ **Never** | Module-level vars — **lost on restart** |
| `business-metrics.ts` | ❌ None | N/A | Deterministic seed — **no real data** |
| `RankingPersonalization` | ✅ Table exists | ❌ **No code anywhere** reads/writes it | Completely orphaned table |

**6 DB tables exist for learning but have ZERO active read/write code paths.** All learning data lives in in-memory Maps and is lost on every server restart, Docker rebuild, or process crash. The system never actually learns.

**Events NOT captured at all:**
- Product `dismiss` / explicit rejection (defined in types, never called)
- `ignored` events (function exists in feedback-tracker, never invoked)
- Session duration / time-on-page
- Scroll depth / viewport exposure 
- Cart abandonment (only cart_add tracked, not cart_remove)
- Position bias data (where in the list was the product when clicked?)
- Comparative signals (user saw A, B, C — clicked B, bought B)

### 16.2 Design: Three-Layer Learning Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    LAYER 1: DATA CAPTURE                         │
│  Every ranking decision + every user outcome → RankingEventLog   │
│  Position, scores, dimension breakdowns, user actions, sessions  │
└─────────────────────────┬────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                  LAYER 2: SIGNAL AGGREGATION                     │
│  Per-product: CTR, conversion, satisfaction signals  (DB-backed) │
│  Per-query: success rate, result quality metrics     (DB-backed) │
│  Per-dimension: predictive power, correlation stats  (DB-backed) │
│  Per-user: personalization profile                   (DB-backed) │
└─────────────────────────┬────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                LAYER 3: LEARNING & ADAPTATION                    │
│  A) Reward computation: which ranking decisions led to good      │
│     outcomes (click, cart, purchase) vs. bad (ignore, bounce)?   │
│  B) Weight optimizer: gradient-free optimization of dimension    │
│     weights based on reward signals                              │
│  C) Scorer tuning: individual scorer function calibration        │
│  D) ML export: training data → future model-based re-ranking    │
└──────────────────────────────────────────────────────────────────┘
```

### 16.3 Layer 1: RankingEventLog — Capture Everything

#### New Table: `RankingEventLog`

This is the **gold mine**. Every single ranking served to a user is captured with full context, enabling any future analysis or ML training.

```sql
CREATE TABLE IF NOT EXISTS "RankingEventLog" (
  id                  BIGSERIAL PRIMARY KEY,
  -- Who & When
  "sessionId"         TEXT NOT NULL,
  "userId"            INTEGER,
  "query"             TEXT NOT NULL,
  "rankedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Engine context
  "engineVersion"     TEXT NOT NULL,                 -- 'v2' | 'v3'
  "dimensionSnapshotId" UUID,                        -- FK to ScoringDimensionAudit
  -- Results served
  "totalResults"      INTEGER NOT NULL,
  "products"          JSONB NOT NULL,                -- [{productId, position, finalScore, dimensionScores: {key: rawScore}, ...}]
  -- Intent context
  "parsedIntent"      JSONB,                         -- {category, brand, budget, use_case, features, confidence}
  -- Outcome tracking (updated async as events arrive)
  "clickedProductIds" INTEGER[] DEFAULT '{}',        -- products user clicked
  "clickPositions"    INTEGER[] DEFAULT '{}',         -- at what positions were they shown
  "cartedProductIds"  INTEGER[] DEFAULT '{}',         -- products added to cart
  "purchasedProductIds" INTEGER[] DEFAULT '{}',       -- products purchased
  "ignoredCount"      INTEGER DEFAULT 0,             -- shown but not interacted
  "sessionDurationMs" INTEGER,                        -- time spent on results page
  "bounced"           BOOLEAN DEFAULT false,          -- user left without clicking anything
  -- Computed reward signal (calculated by aggregation job)
  "rewardScore"       FLOAT,                         -- -1.0 (terrible) to +1.0 (perfect) 
  "outcomeType"       TEXT,                          -- 'purchase' | 'cart' | 'click' | 'bounce' | 'refine'
  -- Metadata
  "deviceType"        TEXT,                          -- 'mobile' | 'desktop' | 'tablet'
  "responseTimeMs"    INTEGER
);

-- Indexes for learning queries
CREATE INDEX idx_ranking_event_session ON "RankingEventLog"("sessionId");
CREATE INDEX idx_ranking_event_user ON "RankingEventLog"("userId");
CREATE INDEX idx_ranking_event_date ON "RankingEventLog"("rankedAt" DESC);
CREATE INDEX idx_ranking_event_query ON "RankingEventLog" USING gin(to_tsvector('english', "query"));
CREATE INDEX idx_ranking_event_outcome ON "RankingEventLog"("outcomeType");
CREATE INDEX idx_ranking_event_reward ON "RankingEventLog"("rewardScore" DESC NULLS LAST);

-- Partitioning by month for performance (optional for production scale)
-- CREATE TABLE "RankingEventLog_2026_04" PARTITION OF "RankingEventLog" 
--   FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
```

#### What Gets Stored Per Product in `products` JSONB

```jsonc
{
  "productId": 1234,
  "position": 1,              // rank position shown to user
  "finalScore": 78.3,
  "dimensionScores": {        // raw 0-1 score per dimension
    "budget_fit": 0.85,
    "spec_match": 0.70,
    "warranty_coverage": 0.92,
    "manufacturer_profile": 0.90,
    "brand_trust": 0.90,
    "delivery_performance": 0.65,
    "verified_ratings": 0.78,
    "eligible_for_return": 1.0,
    "eligible_for_replacement": 1.0,
    "category_match": 1.0,
    "brand_match": 0.0,
    "use_case_match": 1.0,
    "feature_match": 0.60,
    "popularity": 0.55,
    "learning_boost": 0.12,
    "trending_score": 0.0,
    "preferred_brand_boost": 0.0,
    "recent_click_boost": 0.0,
    "price_range_fit": 1.0,
    "session_affinity": 0.3,
    "conversion_potential": 0.45,
    "budget_penalty": 0.0
  },
  "weightedContributions": {  // raw × weight × 100 per dimension
    "budget_fit": 6.8,
    "spec_match": 4.2,
    // ... all 22 values
  },
  "price": 42990,
  "category": "laptops",
  "brand": "lenovo"
}
```

#### Why This Design Is Powerful

1. **Position bias correction**: We know what position each product was shown at. A click on position #1 is less meaningful than a click on position #8 (position bias). ML models can learn to correct for this.

2. **Counterfactual analysis**: For products shown but NOT clicked, we have their scores, dimensions, price, brand — allowing analysis of "what would have happened if we ranked differently?"

3. **Dimension-level attribution**: Each product's per-dimension raw scores let us calculate which dimensions are most predictive of good outcomes (clicks/carts/purchases).

4. **Query-level learning**: Same query served on different days with different weights → compare outcomes → learn which weight configs work best for which query types.

5. **Full reproducibility**: With `dimensionSnapshotId`, we can reconstruct exactly which weights were active and verify every score.

### 16.4 Layer 1: Enhanced Event Capture

#### New Events to Track via `/api/track/event`

| Event Type | Triggers When | Data Captured | Current Status |
|-----------|--------------|---------------|---------------|
| `impression` | Product shown in results | productId, position, query | ✅ Exists (in-memory only) |
| `click` | User clicks product card | productId, position, query, sessionId | ✅ Exists (partial DB) |
| `cart_add` | Added to cart | productId, price, query | ✅ Exists (partial DB) |
| `cart_remove` | Removed from cart | productId, price | ❌ **NEW** |
| `purchase` | Completed purchase | productId, price, quantity | ✅ Exists (partial DB) |
| `bounce` | Left results without clicking | sessionId, query, resultCount | ✅ Exists (in-memory only) |
| `search` | Search executed | query, resultCount, success | ✅ Exists (in-memory only) |
| `dismiss` | User explicitly hides/rejects product | productId, position, query | ❌ **NEW** |
| `dwell` | Time spent viewing product details | productId, dwellTimeMs | ❌ **NEW** |
| `compare` | User compares multiple products | productIds[], query | ❌ **NEW** |
| `refine` | User modifies search/applies filter | originalQuery, refinedQuery, filters | ❌ **NEW** |
| `return` | User returned to search results | sessionId, query | ❌ **NEW** |
| `session_end` | Session concludes (timeout or explicit) | sessionId, totalDurationMs, totalClicks | ❌ **NEW** |

#### Outcome Stitching — Linking Events to RankingEventLog

When a user searches, we create a `RankingEventLog` entry. As they interact, events update that entry:

```
Search "laptop under 50000" → RankingEventLog(id=5001, products=[...], clickedProductIds=[])
  ↓ 3 seconds later
Click on product #42 at position 3 → UPDATE RankingEventLog SET clickedProductIds = clickedProductIds || {42}, clickPositions = clickPositions || {3}
  ↓ 15 seconds later
Add to cart product #42 → UPDATE RankingEventLog SET cartedProductIds = cartedProductIds || {42}
  ↓ 2 minutes later  
Purchase product #42 → UPDATE RankingEventLog SET purchasedProductIds = purchasedProductIds || {42}, outcomeType = 'purchase'
```

This is done via a lightweight `rankingEventId` parameter passed down through the session:

```ts
// Response from /api/intent/analyze now includes:
{
  products: [...],
  rankingEventId: 5001,   // client stores this, sends back with every subsequent event
  dimensionSnapshotId: "a7b3c9..."
}
```

### 16.5 Layer 2: Signal Aggregation — DB-Backed Product & Query Learning

#### Fix: Wire In-Memory Stores to DB

The biggest gap is that `product-learning.ts`, `query-learning.ts`, and `feedback-tracker.ts` use in-memory Maps that are lost on restart. DB tables already exist. We wire them up.

**New file: `lib/learning/db-learning-sync.ts`**

```ts
/**
 * Bridges in-memory learning stores with DB persistence.
 * 
 * Strategy: Write-behind with batched async updates.
 * - In-memory store remains the hot path (zero-latency reads)
 * - Every 30 seconds, dirty records are flushed to DB
 * - On startup, DB is loaded into in-memory store
 */

export async function loadLearningFromDB(): Promise<void>
  // Load ProductLearning rows → _learningStore Map
  // Load QueryLearning rows → _queryStore Map
  // Load RankingPersonalization for current user → session context

export async function flushLearningToDB(): Promise<void>
  // Batch UPSERT dirty ProductLearning records
  // Batch UPSERT dirty QueryLearning records
  // Runs every 30 seconds via setInterval

export async function flushOnShutdown(): Promise<void>
  // Graceful shutdown: flush all pending writes
```

#### New Aggregation Table: `DimensionEffectiveness`

Tracks which dimensions are most predictive of positive outcomes:

```sql
CREATE TABLE IF NOT EXISTS "DimensionEffectiveness" (
  id                SERIAL PRIMARY KEY,
  "dimensionKey"    TEXT NOT NULL,
  "periodStart"     DATE NOT NULL,
  "periodEnd"       DATE NOT NULL,
  -- Aggregated stats
  "totalRankings"   INTEGER NOT NULL DEFAULT 0,
  "clickCorrelation"    FLOAT,     -- Pearson correlation: dimension score vs. click probability
  "cartCorrelation"     FLOAT,     -- Pearson correlation: dimension score vs. cart probability
  "purchaseCorrelation" FLOAT,     -- Pearson correlation: dimension score vs. purchase probability
  "avgScoreClicked"     FLOAT,     -- avg dimension score for clicked products
  "avgScoreIgnored"     FLOAT,     -- avg dimension score for ignored products
  "predictivePower"     FLOAT,     -- (avgClicked - avgIgnored) / stddev — effect size
  "currentWeight"       FLOAT,     -- weight that was in effect during this period
  "suggestedWeight"     FLOAT,     -- weight suggested by learning algorithm
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_dim_effectiveness_period UNIQUE ("dimensionKey", "periodStart")
);

CREATE INDEX idx_dim_effectiveness_key ON "DimensionEffectiveness"("dimensionKey");
CREATE INDEX idx_dim_effectiveness_period ON "DimensionEffectiveness"("periodStart" DESC);
```

This table answers the critical question: **"Is this dimension actually helpful for ranking?"**

If `delivery_performance` has a high click correlation (users click products with good delivery scores) but low weight (5%), the system can suggest increasing it. Conversely, if `trending_score` has near-zero correlation with purchases, it wastes weight budget.

### 16.6 Layer 3: The Learning Algorithms

#### 16.6.1 Reward Computation

Every `RankingEventLog` entry eventually gets a `rewardScore` (-1.0 to +1.0):

```ts
function computeReward(event: RankingEventLog): number {
  // Purchase is the strongest positive signal
  if (event.purchasedProductIds.length > 0) {
    // Reward = +1.0 if the purchased product was in top 3, decays with position
    const purchasePositions = event.purchasedProductIds.map(id => 
      event.products.findIndex(p => p.productId === id)
    );
    const bestPosition = Math.min(...purchasePositions);
    return 0.5 + 0.5 * Math.max(0, 1 - bestPosition / 10); // top 1 = 1.0, position 10 = 0.5
  }
  
  // Cart add without purchase = moderate positive
  if (event.cartedProductIds.length > 0) {
    const cartPositions = event.cartedProductIds.map(id =>
      event.products.findIndex(p => p.productId === id)
    );
    const bestPosition = Math.min(...cartPositions);
    return 0.2 + 0.3 * Math.max(0, 1 - bestPosition / 10); // top 1 = 0.5, position 10 = 0.2
  }
  
  // Click only = weak positive (depends on dwell time, position)
  if (event.clickedProductIds.length > 0) {
    const clickPositions = event.clickPositions;
    const avgPosition = clickPositions.reduce((a, b) => a + b, 0) / clickPositions.length;
    return 0.1 * Math.max(0, 1 - avgPosition / 20); // deep clicks worth more
  }
  
  // Bounce = negative signal
  if (event.bounced) return -0.5;
  
  // Search refinement = mild negative (our results weren't good enough)
  if (event.outcomeType === 'refine') return -0.2;
  
  return 0.0; // neutral (loaded but no clear outcome yet)
}
```

#### 16.6.2 Dimension Weight Optimizer — Gradient-Free Reinforcement Learning

This is the core intelligence. It uses a **contextual bandit** approach — for each search context (category, budget range, user segment), it learns which dimension weights produce the best outcomes.

**Algorithm: Online Weight Tuning via Reward-Weighted Regression**

```ts
/**
 * Weight Optimizer — runs as a scheduled job (e.g., daily at 2 AM)
 * 
 * Input:  Recent RankingEventLog entries with rewardScores
 * Output: Suggested dimension weight adjustments
 * 
 * Method: Reward-weighted regression
 *   For each dimension D:
 *     1. Collect all ranking events from the last N days
 *     2. For each event, compute: 
 *        effectiveContribution_D = rawScore_D × weight_D
 *        outcome = rewardScore
 *     3. Compute correlation(effectiveContribution_D, outcome)
 *     4. If correlation is significantly positive → suggest weight increase
 *     5. If correlation is near zero or negative → suggest weight decrease
 *     6. Apply dampening factor to prevent wild swings
 * 
 * Safety:
 *   - Max adjustment per cycle: ±2% of current weight
 *   - Budget penalty can never go below 5%
 *   - Total weights still must sum to 1.0 (normalize after adjustment)
 *   - Admin can accept/reject suggestions before they are applied
 */

export interface WeightSuggestion {
  dimensionKey: string;
  currentWeight: number;
  suggestedWeight: number;
  confidence: number;          // 0-1, how confident the algorithm is
  evidenceCount: number;       // number of ranking events analyzed
  avgRewardWhenHigh: number;   // avg reward when this dimension was a top contributor
  avgRewardWhenLow: number;    // avg reward when this dimension was a low contributor
  correlationWithPurchase: number;
  reasoning: string;           // human-readable explanation
}

export async function computeWeightSuggestions(
  dayWindow: number = 7
): Promise<WeightSuggestion[]>
```

**Key Insight — Contextual Learning**:

The optimizer doesn't just learn global weights. It learns **per-context**:

| Context Segment | Example | Why Different Weights |
|---|---|---|
| **Electronics + Budget** | "laptop under 50000" | `spec_match` and `budget_fit` matter most |
| **Fashion + Premium** | "nike running shoes" | `brand_trust` and `delivery_performance` matter most |
| **Appliances + Any** | "washing machine" | `warranty_coverage` and `eligible_for_replacement` matter most |

```sql
CREATE TABLE IF NOT EXISTS "ContextualWeightProfile" (
  id              SERIAL PRIMARY KEY,
  "contextKey"    TEXT NOT NULL UNIQUE,   -- e.g. "electronics:budget", "fashion:premium"
  "category"      TEXT,
  "budgetTier"    TEXT,                    -- 'budget' | 'mid' | 'premium' | 'any'
  "weights"       JSONB NOT NULL,          -- {dimension_key: suggested_weight, ...}
  "confidence"    FLOAT NOT NULL DEFAULT 0.0,
  "sampleCount"   INTEGER NOT NULL DEFAULT 0,
  "avgReward"     FLOAT,
  "lastUpdated"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

When a search comes in for "laptop under 50000":
1. Engine looks up context profile: category=`laptops`, budgetTier=`mid`
2. If profile exists with confidence > 0.7 → use learned weights (blended with admin weights)
3. If no profile or low confidence → use admin-configured global weights
4. Result: **different product categories get different ranking emphasis automatically**

**Blend formula**:

```
effectiveWeight_D = adminWeight_D × (1 - contextConfidence) + contextWeight_D × contextConfidence
```

When contextConfidence = 0 → 100% admin weights (cold start).
When contextConfidence = 1.0 → 100% learned weights.
Admin always sets the floor — learning only modulates.

#### 16.6.3 Scorer Calibration — Individual Dimension Tuning

Beyond weight adjustment, scorers themselves might need calibration. For example, if `warranty_coverage` gives 0.30 to "not specified" products, but data shows those products have a 70% return rate, the scorer's default should be lower.

```sql
CREATE TABLE IF NOT EXISTS "ScorerCalibration" (
  id              SERIAL PRIMARY KEY,
  "scorerKey"     TEXT NOT NULL UNIQUE,
  "calibrationParams" JSONB,             -- scorer-specific tuning params
  "lastCalibrated"  TIMESTAMPTZ,
  "sampleCount"   INTEGER DEFAULT 0,
  "notes"         TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Example calibration for `warranty_coverage`:
```json
{
  "defaultScore": 0.25,          // was 0.30, reduced based on return data
  "5yr_multiplier": 1.0,        // unchanged
  "3yr_multiplier": 0.95,       // was 0.90, data shows 3yr is almost as good
  "unknown_multiplier": 0.20    // was 0.30, penalize unknown warranty more
}
```

Scorer functions check for calibration params at startup and use DB values if available, else hardcoded defaults.

### 16.7 ML Training Data Export

The `RankingEventLog` table is designed to be a **Machine Learning feature store**. Every row has:

- **Features**: product dimension scores (22 floats), intent context (category, budget, features), user context (preferred brands, session history)
- **Labels**: outcome (purchase=1.0, cart=0.5, click=0.1, bounce=-0.5)
- **Position bias data**: what position the product was shown at (for debiasing)

#### Export API: `/api/admin/ml-export`

```ts
// GET /api/admin/ml-export?format=csv&days=30&minReward=-1
// Returns training data in ML-ready format:
//
// query,category,budget_min,budget_max,product_id,position,
// dim_budget_fit,dim_spec_match,dim_warranty,...,dim_budget_penalty,
// final_score,clicked,carted,purchased,reward
//
// "laptop under 50000",laptops,0,50000,1234,1,0.85,0.70,0.92,...,0.0,78.3,1,1,1,1.0
// "laptop under 50000",laptops,0,50000,5678,2,0.65,0.80,0.30,...,0.0,72.1,0,0,0,-0.1
```

This data can be used to train:

| Model | Input | Output | Purpose |
|---|---|---|---|
| **Learning-to-Rank (LTR)** | Product features + query features | Relevance score | Replace/augment dimension-based scoring with ML model |
| **Click Prediction** | Product features + position | P(click) | Correct position bias in reward signals |
| **Conversion Prediction** | Product features + user features | P(purchase) | Optimize for actual purchases, not just clicks |
| **Query-Product Match** | Query embedding + product embedding | Match score | Better intent understanding |

The system is designed so that **ML models are optional upgrades** — the dimension-based system works perfectly without them. But the data is always being collected, ready for when you want to train models.

### 16.8 Admin Dashboard — Learning Insights

New section in the admin panel: **"Learning & Optimization"**

#### Tab 1: Ranking Performance Overview

| Metric | Definition | Visualization |
|--------|-----------|---------------|
| **Click-Through Rate (CTR)** | Clicks / Impressions per day | Line chart, 30-day trend |
| **Mean Reciprocal Rank (MRR)** | Avg(1/position_of_first_click) | Higher = users click higher-ranked products |
| **NDCG@10** | Normalized Discounted Cumulative Gain | Gold standard ranking metric |
| **Conversion Rate** | Purchases / Searches | Line chart with target band |
| **Bounce Rate** | Searches with zero clicks / Total searches | Should decrease over time |
| **Avg. Reward Score** | Mean rewardScore from RankingEventLog | Overall quality signal |

#### Tab 2: Dimension Effectiveness

Visual table showing each dimension's **predictive power**:

```
┌────────────────────────┬────────┬───────────┬──────────────┬──────────────┐
│ Dimension              │ Weight │ Click     │ Purchase     │ Suggested    │
│                        │        │ Corr.     │ Corr.        │ Weight       │
├────────────────────────┼────────┼───────────┼──────────────┼──────────────┤
│ budget_fit             │   8%   │  +0.72 🟢 │  +0.68 🟢    │   10% ▲      │
│ spec_match             │   6%   │  +0.45 🟡 │  +0.52 🟢    │    7% ▲      │
│ warranty_coverage      │   5%   │  +0.38 🟡 │  +0.61 🟢    │    6% ▲      │
│ brand_trust            │   4%   │  +0.22 🟡 │  +0.15 🔵    │    3% ▼      │
│ trending_score         │   2%   │  +0.05 🔴 │  -0.02 🔴    │    0% ▼ ⚠    │
│ ...                    │        │           │              │              │
└────────────────────────┴────────┴───────────┴──────────────┴──────────────┘
  🟢 Strong predictor  🟡 Moderate  🔵 Weak  🔴 Not predictive
  ▲ Suggest increase    ▼ Suggest decrease    ⚠ Consider deactivating
```

#### Tab 3: Weight Suggestions

When the optimizer has suggestions:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 📊 Weight Optimization Suggestions (Based on 12,450 ranking events)     │
│                                                                          │
│ The learning engine analyzed 7 days of ranking data and suggests:        │
│                                                                          │
│  warranty_coverage:  5% → 7%   (purchase correlation +0.61, high)        │
│  budget_fit:         8% → 10%  (click correlation +0.72, very high)      │
│  trending_score:     2% → 0%   (near-zero prediction, waste of budget)   │
│  brand_trust:        4% → 3%   (weak purchase correlation)               │
│                                                                          │
│  Estimated impact: +8% click-through, +5% conversion rate               │
│                                                                          │
│  [✅ Apply Suggestions]  [✏️ Review & Modify]  [❌ Dismiss]              │
│                                                                          │
│  Note: Applying saves current weights to audit trail before updating.    │
└──────────────────────────────────────────────────────────────────────────┘
```

**The admin has three choices:**
1. **Apply** — auto-applies suggestions (with audit trail, marked as "auto-tuned" source)
2. **Review & Modify** — opens the weight editor pre-filled with suggestions, admin can tweak
3. **Dismiss** — ignore this cycle's suggestions

#### Tab 4: Contextual Profiles

Shows learned per-category/budget weight profiles:

```
Category: Electronics | Budget: Under ₹50K | Confidence: 82% | Samples: 3,200
  budget_fit: 12% (+4% vs global) — users are extremely price-sensitive here
  spec_match: 9% (+3% vs global) — specs drive laptop decisions
  warranty: 8% (+3% vs global) — warranty matters for expensive electronics
  delivery: 3% (-2% vs global) — users willing to wait for right product
  
Category: Fashion | Budget: Premium | Confidence: 71% | Samples: 1,800  
  brand_trust: 15% (+11% vs global) — brand is everything in premium fashion
  delivery: 8% (+3% vs global) — fast delivery expected
  budget_fit: 2% (-6% vs global) — price not a concern for premium buyers
```

#### Tab 5: ML Training Data

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 🤖 ML Training Data Export                                               │
│                                                                          │
│ Total ranking events:  45,230                                            │
│ Events with outcomes:  38,150 (84.3%)                                    │
│ Date range:            2026-04-01 to 2026-04-16                          │
│                                                                          │
│ Export formats:                                                          │
│   [📥 CSV]  [📥 Parquet]  [📥 JSON Lines]                               │
│                                                                          │
│ Filter options:                                                          │
│   Category: [All ▼]  Date range: [Last 30 days ▼]                       │
│   Min outcome: [Any ▼]  Include position bias: [✓]                      │
│                                                                          │
│ Export includes:                                                          │
│   • 22 dimension scores per product per ranking event                    │
│   • Query intent features (category, budget, use_case, features)         │
│   • User context (preferred brands, session history)                     │
│   • Outcome labels (click, cart, purchase, bounce)                       │
│   • Position data for bias correction                                    │
│   • Dimension weights in effect at ranking time                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 16.9 Learning Engine — Scheduled Jobs

| Job | Frequency | Purpose |
|-----|-----------|---------|
| **Flush Learning to DB** | Every 30 seconds | Write dirty in-memory records (ProductLearning, QueryLearning) to DB |
| **Compute Rewards** | Every 15 minutes | Calculate rewardScore for RankingEventLog entries that have settled outcomes |
| **Aggregate Dimension Effectiveness** | Daily 2:00 AM | Compute DimensionEffectiveness stats for previous day |
| **Weight Suggestions** | Daily 3:00 AM | Run optimizer, generate WeightSuggestion entries |
| **Contextual Profile Update** | Daily 4:00 AM | Update ContextualWeightProfile from recent data |
| **Scorer Calibration** | Weekly Sunday 2:00 AM | Analyze scorer output distributions vs outcomes |
| **RankingEventLog Cleanup** | Monthly | Archive events older than 90 days to cold storage / compress |
| **ProductLearning Decay** | Daily 1:00 AM | Apply 10% decay to counters (already exists, just needs DB persistence) |

### 16.10 Implementation — Phased Rollout for Learning Engine

#### Phase 6A: Data Capture (Prerequisite — before any learning can happen)

| # | File | Action | Complexity |
|---|------|--------|-----------|
| 1 | `scripts/r59-scoring-engine-revamp.sql` | **EXTEND** — Add `RankingEventLog`, `DimensionEffectiveness`, `ContextualWeightProfile`, `ScorerCalibration` tables | Medium |
| 2 | `apps/web/lib/learning/ranking-event-logger.ts` | **CREATE** — Async logger that writes to `RankingEventLog` after every ranking | Medium |
| 3 | `apps/web/lib/learning/db-learning-sync.ts` | **CREATE** — Bridge in-memory stores ↔ DB with 30-second flush | Medium |
| 4 | `apps/web/app/api/track/event/route.ts` | **MODIFY** — Add new event types (dismiss, dwell, compare, refine, cart_remove, session_end), wire outcome stitching to RankingEventLog | Medium |
| 5 | `apps/web/lib/smart-intent/product-learning.ts` | **MODIFY** — Load from DB on startup, dirty-flag for flush | Low |
| 6 | `apps/web/lib/smart-intent/query-learning.ts` | **MODIFY** — Load from DB on startup, dirty-flag for flush | Low |
| 7 | `apps/web/lib/smart-intent/feedback-tracker.ts` | **MODIFY** — Load from DB on startup, persist via UserBehavior table | Low |

#### Phase 6B: Signal Aggregation & Reward Computation

| # | File | Action | Complexity |
|---|------|--------|-----------|
| 8 | `apps/web/lib/learning/reward-engine.ts` | **CREATE** — Compute rewardScore for settled RankingEventLog entries | Medium |
| 9 | `apps/web/lib/learning/dimension-effectiveness.ts` | **CREATE** — Compute per-dimension correlation/predictive power stats | High |
| 10 | `apps/web/lib/learning/aggregation-jobs.ts` | **CREATE** — Scheduled aggregation orchestrator (set up cron-like with setInterval) | Medium |

#### Phase 6C: Learning Algorithms

| # | File | Action | Complexity |
|---|------|--------|-----------|
| 11 | `apps/web/lib/learning/weight-optimizer.ts` | **CREATE** — Reward-weighted regression, contextual bandit, weight suggestions | High |
| 12 | `apps/web/lib/learning/contextual-profiles.ts` | **CREATE** — Per-category/budget weight profile learning | Medium |
| 13 | `apps/web/lib/learning/scorer-calibration.ts` | **CREATE** — Scorer parameter tuning from outcome data | Medium |
| 14 | `apps/web/lib/smart-intent/ranking-engine.ts` | **EXTEND** — Blend contextual weights with admin weights when available | Medium |

#### Phase 6D: Admin UI & ML Export

| # | File | Action | Complexity |
|---|------|--------|-----------|
| 15 | `apps/web/app/admin/learning-insights/page.tsx` | **CREATE** — New admin page: Performance overview, dimension effectiveness, weight suggestions, contextual profiles, ML export | High |
| 16 | `apps/web/app/api/admin/learning-insights/route.ts` | **CREATE** — API for learning metrics, suggestions, profile data | Medium |
| 17 | `apps/web/app/api/admin/ml-export/route.ts` | **CREATE** — CSV/JSON export of ML training data from RankingEventLog | Medium |
| 18 | `apps/web/app/admin/scoring-dimensions/page.tsx` | **EXTEND** — Add "Suggestions" badge when optimizer has recommendations | Low |

**Phase 6 Total: 11 new files + 7 modified files**

### 16.11 Reinforcement Learning Feedback Loop — The Virtuous Cycle

```
                              ┌──────────────────┐
                              │   User Searches   │
                              └────────┬─────────┘
                                       │
                                       ▼
                         ┌─────────────────────────────┐
                         │  Ranking Engine Scores &     │
                         │  Ranks Products Using        │
                         │  Current Dimension Weights   │──────── Log to RankingEventLog
                         └────────────┬────────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────────┐
                         │   User Interacts:            │
                         │   Click / Cart / Purchase /  │──────── Stitch Outcomes to
                         │   Bounce / Dismiss / Refine  │         RankingEventLog
                         └────────────┬────────────────┘
                                      │
                                      ▼
                    ┌──────────────────────────────────────┐
                    │  Reward Engine Computes:              │
                    │  rewardScore = f(outcomes, positions) │
                    └────────────────┬─────────────────────┘
                                     │
                                     ▼
              ┌───────────────────────────────────────────────┐
              │  Weight Optimizer Analyzes:                     │
              │  "Which dimensions predicted good outcomes?"    │
              │  "Which weights should increase/decrease?"      │
              │  → Generate WeightSuggestions                   │
              └──────────────────┬──────────────────────────────┘
                                 │
                                 ▼
              ┌───────────────────────────────────────────────┐
              │  Admin Reviews Suggestions:                     │
              │  [Apply] / [Modify] / [Dismiss]                │
              │  → Audit trail captures old+new weights         │
              └──────────────────┬──────────────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────┐
                    │  Updated Weights Applied     │
                    │  (within 60s cache refresh)  │
                    └────────────┬────────────────┘
                                 │
                                 └──── CYCLE REPEATS ────┘
```

Each cycle makes the ranking engine more accurate because:
1. **Positive reinforcement**: Dimensions that predict purchases get more weight
2. **Negative reinforcement**: Dimensions that don't predict anything get reduced
3. **Contextual specialization**: Different product categories learn different priorities
4. **Position bias correction**: The system learns that clicks at position 1 are "free" (users always look there), while clicks at position 8 are strong signals
5. **Continuous improvement**: Every search adds data → better weight tuning → better rankings → more conversions

### 16.12 Data Retention & Legal Protection

| Data Type | Retention | Purpose | Legal Protection |
|-----------|-----------|---------|------------------|
| `RankingEventLog` | 90 days hot, 365 days archive | Training data, dispute resolution | Full court-admissible ranking audit |
| `ScoringDimensionAudit` | Indefinite | Weight change history | Who changed what weight, when, why |
| `DimensionEffectiveness` | 365 days | Historical performance tracking | Evidence that weight changes improved outcomes |
| `ContextualWeightProfile` | Current only (versioned) | Active learned weights | Transparency of learning rationale |
| `ScorerCalibration` | Current + 1 previous | Scorer parameter history | Explains scorer behavior changes |
| `ProductLearning` | Rolling (decay handles staleness) | Per-product engagement stats | Verifiable product quality metrics |
| `QueryLearning` | Rolling | Per-query success metrics | Evidence of search quality improvement |

**For Disputation**: A complete audit chain exists:
1. `ScoringDimensionAudit` → What weights were in effect (admin-approved)
2. `DimensionEffectiveness` → Why those weights were recommended (data-driven)
3. `RankingEventLog` → Exact scores and position for every product in that search
4. `ProductLearning` → Historical engagement metrics for the product
5. `QueryLearning` → Historical success rate for that query type

---

## 17. Updated Files Changed Summary (v3 — All Phases Combined)

### Phase 1-5 (from v2): 3 new + 12 modified = 15 files

| File | Action | Phase |
|------|--------|-------|
| `scripts/r59-scoring-engine-revamp.sql` | CREATE | 1 |
| `apps/web/lib/scoring/scorer-registry.ts` | CREATE | 1 |
| `apps/web/lib/scoring/dimension-weights.ts` | CREATE | 1 |
| `apps/web/lib/scoring/product-scoring.ts` | MODIFY | 1 |
| `apps/web/lib/smart-intent/ranking-engine.ts` | MAJOR REWRITE | 2 |
| `apps/web/lib/smart-intent/autonomous-ranking.ts` | MAJOR REWRITE | 2 |
| `apps/web/lib/smart-intent/types.ts` | MODIFY | 2 |
| `apps/web/lib/smart-intent/index.ts` | MODIFY | 2 |
| `apps/web/lib/smart-intent/business-scoring.ts` | MODIFY | 2 |
| `apps/web/app/api/admin/scoring-dimensions/route.ts` | MAJOR MODIFY | 3 |
| `apps/web/app/api/intent/analyze/route.ts` | MODIFY | 3 |
| `apps/web/app/api/search/route.ts` | MODIFY | 3 |
| `apps/web/app/admin/scoring-dimensions/page.tsx` | MAJOR MODIFY | 4 |
| `apps/web/lib/store/scoring-dimensions.store.ts` | MODIFY | 4 |
| `apps/web/app/shopping-assistant/metrics/validation/page.tsx` | MODIFY | 5 |

### Phase 6 (NEW — Learning Engine): 11 new + 7 modified = 18 files

| File | Action | Phase |
|------|--------|-------|
| `apps/web/lib/learning/ranking-event-logger.ts` | **CREATE** | 6A |
| `apps/web/lib/learning/db-learning-sync.ts` | **CREATE** | 6A |
| `apps/web/lib/learning/reward-engine.ts` | **CREATE** | 6B |
| `apps/web/lib/learning/dimension-effectiveness.ts` | **CREATE** | 6B |
| `apps/web/lib/learning/aggregation-jobs.ts` | **CREATE** | 6B |
| `apps/web/lib/learning/weight-optimizer.ts` | **CREATE** | 6C |
| `apps/web/lib/learning/contextual-profiles.ts` | **CREATE** | 6C |
| `apps/web/lib/learning/scorer-calibration.ts` | **CREATE** | 6C |
| `apps/web/app/admin/learning-insights/page.tsx` | **CREATE** | 6D |
| `apps/web/app/api/admin/learning-insights/route.ts` | **CREATE** | 6D |
| `apps/web/app/api/admin/ml-export/route.ts` | **CREATE** | 6D |
| `apps/web/app/api/track/event/route.ts` | MODIFY | 6A |
| `apps/web/lib/smart-intent/product-learning.ts` | MODIFY | 6A |
| `apps/web/lib/smart-intent/query-learning.ts` | MODIFY | 6A |
| `apps/web/lib/smart-intent/feedback-tracker.ts` | MODIFY | 6A |
| `apps/web/lib/smart-intent/ranking-engine.ts` | EXTEND | 6C |
| `apps/web/app/admin/scoring-dimensions/page.tsx` | EXTEND | 6D |
| `scripts/r59-scoring-engine-revamp.sql` | EXTEND | 6A |

### Grand Total: 14 new files + 19 modified files = 33 files across 6 phases

---

## 18. Updated Key Design Decisions (v3 additions)

### Decision 7: Outcome-Stitched Event Logging
Every ranking is logged as a single `RankingEventLog` row. Subsequent user interactions (click, cart, purchase) are stitched back to that row via `rankingEventId`. This creates a complete picture of "we showed X, user did Y."

**Why not separate tables?** Joins are expensive at query time. Denormalizing outcomes into the ranking log row makes ML training data export trivial — one SELECT gets features + labels.

### Decision 8: Admin Approval Required for Auto-Tuned Weights
The learning engine SUGGESTS weight changes. It does NOT auto-apply them (by default). Admin reviews and approves.

**Why?** Legal and trust reasons. If rankings suddenly change and a seller complains, admin can point to the audit trail: "I reviewed the suggestion, here's the data that supported it, here's when I approved it."

**Optional**: An env flag `AUTO_APPLY_WEIGHT_SUGGESTIONS=true` can enable fully autonomous learning for scenarios where admin oversight is not needed.

### Decision 9: Contextual Weight Profiles are Blended, Not Replaced
Learned per-category weights are blended with admin weights using a confidence factor. Zero confidence = 100% admin weights. This ensures cold-start safety and admin always has a floor of control.

### Decision 10: RankingEventLog Captures Top-N Products Only
For efficiency, we log the top 50 products (not all search results). Products below position 50 are rarely seen and add storage bloat without learning value.

### Decision 11: ML Training Data Export is Read-Only
The ML export endpoint reads from `RankingEventLog` — it does NOT write any model predictions back into the ranking engine. Model-based re-ranking would be a separate future initiative that consumes these exports offline.

### Decision 12: One-Click Optimize is an Async Background Job
The "Optimize Now" button triggers a heavyweight server-side computation. The admin does NOT wait on the HTTP request — it returns immediately with a job ID, and the UI polls for status. This is consistent with how production ML pipelines work.

---

## 19. One-Click "Optimize Weights" — ML-Powered Admin Action

> **User Requirement**: A single button on the Scoring Dimensions page. Click it → the system uses all captured ranking data to compute the mathematically optimal weight configuration for every dimension → applies it automatically. Admin sees real-time progress and gets notified when complete.

### 19.1 The Button — UX Design

The Scoring Dimensions page header currently has: `[Equalize] [Reset] [Save Changes]`

**After this change:**

```
[⚡ Optimize Weights]  [Equalize]  [Reset]  [Save Changes]
```

The "Optimize Weights" button is a **gradient amber/orange** to distinguish it from regular actions. It's the most powerful button on the page.

#### Button States

| State | Appearance | Action |
|-------|-----------|--------|
| **Ready** | `⚡ Optimize Weights` — amber gradient, enabled | Click → trigger optimization |
| **No Data** | `⚡ Optimize Weights` — grayed out, tooltip: "Need at least 500 ranking events" | Disabled until enough data exists |
| **Running** | `⏳ Optimizing... (38%)` — pulsing amber, progress bar | Click does nothing (already running) |
| **Complete** | `✅ Optimized!` — green flash for 5 seconds, then returns to Ready | Weights auto-loaded into the editor |

#### Confirmation Dialog Before Running

Since this modifies ALL weights, a confirmation dialog appears:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ⚡ Optimize All Dimension Weights                                       │
│                                                                          │
│  This will analyze ALL ranking events captured by the system and         │
│  compute the mathematically optimal weight for every scoring             │
│  dimension using machine learning.                                       │
│                                                                          │
│  📊 Data available: 12,450 ranking events (last 30 days)                │
│  ⏱️  Estimated time: ~2-5 minutes                                       │
│  📋 Current weights will be saved to audit trail before replacing        │
│                                                                          │
│  What happens:                                                           │
│  • All 22 dimension weights will be recalculated                        │
│  • Weights are computed to maximize click-through and conversion         │
│  • A full before/after snapshot is saved for rollback                    │
│  • The page will auto-refresh to show progress                           │
│                                                                          │
│  ⚠️  This is an admin-only background process. You can navigate          │
│     away and come back — the job continues running.                      │
│                                                                          │
│         [🚀 Start Optimization]     [Cancel]                             │
└──────────────────────────────────────────────────────────────────────────┘
```

### 19.2 Async Job Architecture

```
Admin clicks "Optimize Weights"
        │
        ▼
POST /api/admin/optimize-weights
  → Create job row in OptimizationJob table (status='pending')
  → Return { jobId, estimatedDurationMs }
  → Kick off background worker (non-blocking)
        │
        ▼
Background Worker (runs server-side, NOT in request lifecycle):
  1. Load all RankingEventLog entries (last N days)
  2. Build feature matrix: per-product dimension scores + outcomes
  3. Run reward-weighted optimization algorithm
  4. Compute optimal weights (constrained: sum = 1.0, min/max per dimension)
  5. Validate results (compare against current weights, sanity checks)
  6. Save results to OptimizationJob row
  7. Update status → 'completed'
        │
        ▼
Admin UI polls GET /api/admin/optimize-weights/status?jobId=xxx
  → Every 60 seconds (configurable: 1 min or 5 min)
  → Shows: progress %, current phase, estimated time remaining
  → Timestamp of last fetch shown: "Last checked: 14:32:05 IST"
        │
        ▼
When status = 'completed':
  → UI loads optimized weights into the dimension editor
  → Admin sees before/after comparison
  → Admin can [Apply] or [Discard]
  → Applying saves old weights to ScoringDimensionAudit + updates DB
```

### 19.3 New DB Table: `OptimizationJob`

```sql
CREATE TABLE IF NOT EXISTS "OptimizationJob" (
  id                BIGSERIAL PRIMARY KEY,
  "jobId"           UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  "triggeredBy"     INTEGER NOT NULL,                -- admin userId who clicked the button
  "status"          TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  "progressPercent" INTEGER NOT NULL DEFAULT 0,       -- 0-100
  "currentPhase"    TEXT,                             -- human-readable: 'Loading data...' | 'Computing correlations...' | 'Optimizing weights...'
  "phasesCompleted" INTEGER NOT NULL DEFAULT 0,       -- out of total phases
  "totalPhases"     INTEGER NOT NULL DEFAULT 6,
  -- Input params
  "dataWindowDays"  INTEGER NOT NULL DEFAULT 30,      -- how many days of data to analyze
  "eventCount"      INTEGER,                          -- actual events analyzed
  "minEventsRequired" INTEGER NOT NULL DEFAULT 500,   -- won't run with fewer events
  -- Timing
  "startedAt"       TIMESTAMPTZ,
  "estimatedEndAt"  TIMESTAMPTZ,                      -- computed after Phase 1 (data loading)
  "completedAt"     TIMESTAMPTZ,
  "durationMs"      INTEGER,                          -- actual wall-clock time
  -- Results
  "currentWeights"  JSONB,                            -- snapshot of weights BEFORE optimization
  "optimizedWeights" JSONB,                           -- computed optimal weights
  "weightChanges"   JSONB,                            -- [{key, oldWeight, newWeight, changePercent, reason}]
  "performanceMetrics" JSONB,                         -- {expectedCtrLift, expectedConversionLift, confidenceScore}
  -- Error handling
  "errorMessage"    TEXT,
  "errorDetails"    JSONB,
  -- Metadata
  "applied"         BOOLEAN NOT NULL DEFAULT false,   -- admin clicked "Apply"
  "appliedAt"       TIMESTAMPTZ,
  "discarded"       BOOLEAN NOT NULL DEFAULT false,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_optimization_job_status ON "OptimizationJob"("status");
CREATE INDEX idx_optimization_job_latest ON "OptimizationJob"("createdAt" DESC);
```

### 19.4 The Optimization Algorithm — What Runs in the Background

The background worker executes 6 phases:

#### Phase 1: Data Loading (0% → 15%)

```ts
// Load all RankingEventLog entries with outcomes
const events = await db.query(`
  SELECT * FROM "RankingEventLog"
  WHERE "rankedAt" > NOW() - INTERVAL '${dataWindowDays} days'
    AND "rewardScore" IS NOT NULL
  ORDER BY "rankedAt" DESC
`);
// Update: status='running', currentPhase='Loading ranking data...', progressPercent=10
```

#### Phase 2: Feature Matrix Construction (15% → 30%)

```ts
// For each event, extract per-product dimension scores + outcome label
// Build a matrix: rows = (event × product), columns = dimension scores
// Label = 1 if product was purchased, 0.5 if carted, 0.2 if clicked, 0 if ignored, -0.3 if bounced

interface TrainingRow {
  dimensionScores: Record<string, number>;  // 22 dimension raw scores
  position: number;                          // rank position (for bias correction)
  outcome: number;                           // reward label
  queryCategory: string;                     // for contextual splits
}

const matrix: TrainingRow[] = [];
for (const event of events) {
  for (const product of event.products) {
    matrix.push({
      dimensionScores: product.dimensionScores,
      position: product.position,
      outcome: computeProductOutcome(event, product.productId),
    });
  }
}
// Update: currentPhase='Building feature matrix...', progressPercent=25
```

#### Phase 3: Correlation & Predictive Power Analysis (30% → 50%)

```ts
// For each dimension, compute:
// 1. Pearson correlation with positive outcomes
// 2. Predictive power = (mean_score_clicked - mean_score_ignored) / pooled_stddev
// 3. Position-debiased correlation (factor out position bias)

interface DimensionAnalysis {
  key: string;
  rawCorrelation: number;       // correlation with outcome
  debiasedCorrelation: number;  // after position bias correction
  predictivePower: number;      // effect size (Cohen's d)
  importance: number;           // 0-1, normalized importance
}

const analysis: DimensionAnalysis[] = dimensions.map(dim => ({
  key: dim.key,
  rawCorrelation: pearsonCorrelation(
    matrix.map(r => r.dimensionScores[dim.key] ?? 0),
    matrix.map(r => r.outcome)
  ),
  debiasedCorrelation: positionDebiasedCorrelation(matrix, dim.key),
  predictivePower: cohensD(
    matrix.filter(r => r.outcome > 0).map(r => r.dimensionScores[dim.key] ?? 0),
    matrix.filter(r => r.outcome <= 0).map(r => r.dimensionScores[dim.key] ?? 0),
  ),
  importance: 0, // computed next
}));
// Update: currentPhase='Analyzing dimension effectiveness...', progressPercent=45
```

#### Phase 4: Weight Optimization — Constrained Reward Maximization (50% → 75%)

This is the core ML step. We find weights that maximize the expected reward.

**Algorithm: Iterative Reward-Weighted Least Squares with Constraints**

```ts
/**
 * Objective: Find weights w[] such that:
 *   maximize Σ reward(event) × similarity(ranking(w), actual_positive_outcome)
 * 
 * Subject to:
 *   - Σ w[i] = 1.0           (weights sum to 100%)
 *   - w[i] >= minWeight[i]    (admin-set minimum per dimension)
 *   - w[i] <= maxWeight[i]    (admin-set maximum per dimension)
 *   - w[i] >= 0               (no negative weights, except budget_penalty)
 * 
 * Method: Projected Gradient Ascent
 *   1. Start from current admin weights (warm start)
 *   2. For each iteration:
 *      a. Compute gradient: ∂reward/∂w[i] for each dimension
 *      b. Update: w[i] += learningRate × gradient[i]
 *      c. Project onto constraint simplex (sum=1, min/max bounds)
 *   3. Repeat until convergence (< 0.1% change) or max iterations
 * 
 * The gradient computation:
 *   For dimension d with weight w_d:
 *   - Increase w_d slightly → recompute scores → measure reward change
 *   - ∂reward/∂w_d ≈ (reward(w_d + ε) - reward(w_d - ε)) / (2ε)
 *   - This is numerical gradient, which works without differentiation
 * 
 * Why not analytical gradient?
 *   The reward function involves ranking (sort), which is non-differentiable.
 *   Numerical gradient on aggregated data is stable and fast enough.
 */

function optimizeWeights(
  matrix: TrainingRow[],
  currentWeights: Record<string, number>,
  constraints: { min: Record<string, number>; max: Record<string, number> },
  maxIterations: number = 200,
  learningRate: number = 0.005
): Record<string, number> {
  let weights = { ...currentWeights };
  
  for (let iter = 0; iter < maxIterations; iter++) {
    const gradient: Record<string, number> = {};
    const epsilon = 0.001;
    
    for (const dim of Object.keys(weights)) {
      // Perturb weight up
      const wUp = { ...weights, [dim]: weights[dim] + epsilon };
      normalizeWeights(wUp);
      const rewardUp = evaluateWeightConfig(matrix, wUp);
      
      // Perturb weight down
      const wDown = { ...weights, [dim]: weights[dim] - epsilon };
      normalizeWeights(wDown);
      const rewardDown = evaluateWeightConfig(matrix, wDown);
      
      gradient[dim] = (rewardUp - rewardDown) / (2 * epsilon);
    }
    
    // Update weights along gradient
    for (const dim of Object.keys(weights)) {
      weights[dim] += learningRate * gradient[dim];
      // Enforce min/max constraints
      weights[dim] = Math.max(constraints.min[dim] ?? 0, weights[dim]);
      weights[dim] = Math.max(0, weights[dim]); // no negatives
      weights[dim] = Math.min(constraints.max[dim] ?? 1, weights[dim]);
    }
    
    // Project onto simplex (sum = 1.0)
    normalizeWeights(weights);
    
    // Check convergence
    if (maxGradientMagnitude(gradient) < 0.0001) break;
    
    // Update progress: 50% + (iter/maxIterations * 25%)
  }
  
  return weights;
}

function evaluateWeightConfig(
  matrix: TrainingRow[],
  weights: Record<string, number>
): number {
  // For each training row, compute weighted score
  // Then compute NDCG (how well this weight config would have ranked
  //   purchased/clicked products above ignored products)
  // Return average NDCG across all events — this is the reward
  let totalNDCG = 0;
  // ... group by event, re-rank products, compute NDCG
  return totalNDCG / eventCount;
}
// Update: currentPhase='Optimizing weights (iteration 142/200)...', progressPercent=68
```

#### Phase 5: Validation & Sanity Checks (75% → 90%)

```ts
// 1. Compare optimized weights to current weights
// 2. Flag any dimension with > 50% relative change (suspicious)
// 3. Compute expected performance lift using holdout data
// 4. Ensure budget_penalty weight hasn't been gamed to zero
// 5. Ensure no single dimension > 25% (monopoly guard)

const changes = Object.keys(optimized).map(key => ({
  key,
  oldWeight: current[key],
  newWeight: optimized[key],
  changePercent: ((optimized[key] - current[key]) / current[key]) * 100,
  reason: generateChangeReason(key, analysis, optimized[key], current[key]),
}));

const expectedLift = {
  ctrLift: computeExpectedCtrLift(holdoutData, current, optimized),
  conversionLift: computeExpectedConversionLift(holdoutData, current, optimized),
  confidenceScore: computeStatisticalConfidence(matrix.length),
};
// Update: currentPhase='Validating results...', progressPercent=85
```

#### Phase 6: Save Results (90% → 100%)

```ts
await db.query(`
  UPDATE "OptimizationJob" SET
    status = 'completed',
    "progressPercent" = 100,
    "currentPhase" = 'Complete — optimized weights ready for review',
    "optimizedWeights" = $1,
    "weightChanges" = $2,
    "performanceMetrics" = $3,
    "completedAt" = NOW(),
    "durationMs" = EXTRACT(EPOCH FROM (NOW() - "startedAt")) * 1000
  WHERE "jobId" = $4
`, [optimized, changes, expectedLift, jobId]);
```

### 19.5 Scoring Dimensions Page — Status Banner

When an optimization job exists (running or recently completed), a status banner appears at the top of the Scoring Dimensions page:

#### While Running:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ⏳ Optimization in Progress                                             │
│                                                                          │
│  ████████████████████░░░░░░  68%  —  Optimizing weights (iter 142/200)  │
│                                                                          │
│  Started: 14:28:15 IST  •  Estimated completion: ~14:33:00 IST          │
│  Events analyzed: 12,450  •  Dimensions: 22                              │
│                                                                          │
│  Last checked: 14:32:05 IST  •  Auto-refreshing every 1 minute          │
│                                              [🔄 Refresh Now]  [Cancel]  │
└──────────────────────────────────────────────────────────────────────────┘
```

#### When Complete:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ✅ Optimization Complete!                                               │
│                                                                          │
│  Completed at: 14:33:12 IST  •  Duration: 4m 57s                        │
│  Events analyzed: 12,450  •  Confidence: 87%                             │
│                                                                          │
│  Expected impact:                                                        │
│    📈 CTR improvement: +11.3%   📈 Conversion lift: +7.2%               │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐     │
│  │ Dimension             │ Current │ Optimized │  Change │ Reason  │     │
│  ├───────────────────────┼─────────┼───────────┼─────────┼─────────│     │
│  │ budget_fit            │   8.0%  │  10.2%    │  +2.2%  │ Strong  │     │
│  │                       │         │           │         │ purchase│     │
│  │                       │         │           │         │ signal  │     │
│  │ warranty_coverage     │   5.0%  │   7.1%    │  +2.1%  │ High    │     │
│  │                       │         │           │         │ repeat  │     │
│  │                       │         │           │         │ buyer   │     │
│  │                       │         │           │         │ corr.   │     │
│  │ trending_score        │   2.0%  │   0.5%    │  -1.5%  │ No      │     │
│  │                       │         │           │         │ outcome │     │
│  │                       │         │           │         │ signal  │     │
│  │ brand_trust           │   4.0%  │   3.2%    │  -0.8%  │ Weak    │     │
│  │                       │         │           │         │ click   │     │
│  │                       │         │           │         │ corr.   │     │
│  │ (14 unchanged dims)   │         │           │  < ±0.3%│         │     │
│  └─────────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  [✅ Apply Optimized Weights]  [✏️ Load Into Editor]  [❌ Discard]       │
│                                                                          │
│  Last checked: 14:34:05 IST  •  Auto-refresh paused (job complete)      │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Three Actions After Completion:

| Action | What Happens |
|--------|-------------|
| **Apply Optimized Weights** | Saves current weights to `ScoringDimensionAudit` (source: "ml_optimization"), then updates all dimension weights in DB to optimized values. Toast: "✅ Optimized weights applied! Ranking engine will use new weights within 60 seconds." |
| **Load Into Editor** | Loads optimized weights into the dimension cards below (does NOT save yet). Admin can manually tweak individual values before saving. |
| **Discard** | Marks job as discarded, dismisses the banner. Old weights unchanged. |

### 19.6 Auto-Refresh & Status Polling

The Scoring Dimensions page implements a polling mechanism:

```ts
// Polling configuration
const POLL_INTERVAL_RUNNING = 60_000;   // Every 1 minute while job is running
const POLL_INTERVAL_IDLE = 300_000;     // Every 5 minutes when no job is running (check for stale jobs)

const [optimizationStatus, setOptimizationStatus] = useState<OptimizationJobStatus | null>(null);
const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

useEffect(() => {
  const interval = setInterval(async () => {
    const status = await fetch('/api/admin/optimize-weights/status');
    const data = await status.json();
    setOptimizationStatus(data);
    setLastFetchTime(new Date());
  }, optimizationStatus?.status === 'running' ? POLL_INTERVAL_RUNNING : POLL_INTERVAL_IDLE);
  
  return () => clearInterval(interval);
}, [optimizationStatus?.status]);
```

**Status display shows:**
- `Last checked: 14:32:05 IST` — timestamp of last API poll
- `Auto-refreshing every 1 minute` (while running) / `every 5 minutes` (while idle)
- `[🔄 Refresh Now]` button for manual refresh at any time
- Estimated time to completion (calculated after Phase 1 completes, based on data volume)

### 19.7 Estimated Time Computation

After Phase 1 (data loading), the system estimates total duration:

```ts
function estimateOptimizationDuration(eventCount: number, dimensionCount: number): number {
  // Empirical formula (calibrated during development):
  // Base: ~30 seconds for algorithm setup
  // Per 1000 events: ~8 seconds for matrix construction
  // Per dimension: ~2 seconds per optimization iteration
  // Iterations: ~150 average (convergence varies)
  
  const baseMs = 30_000;
  const dataLoadMs = (eventCount / 1000) * 8_000;
  const optimizeMs = dimensionCount * 150 * 20; // 20ms per dimension per iteration
  const validationMs = 15_000;
  
  return baseMs + dataLoadMs + optimizeMs + validationMs;
}

// Example: 12,000 events, 22 dimensions
// = 30s + 96s + 66s + 15s = ~207 seconds ≈ 3.5 minutes
```

The estimated end time is stored in `OptimizationJob.estimatedEndAt` and displayed in the UI:
```
Estimated completion: ~14:33:00 IST (about 3 minutes remaining)
```

### 19.8 API Endpoints

#### `POST /api/admin/optimize-weights`

Triggers a new optimization job.

```ts
// Request: (no body needed — uses system defaults)
// Optional body: { dataWindowDays?: number }

// Response:
{
  "jobId": "a7b3c9d1-...",
  "status": "pending",
  "eventCount": 12450,
  "estimatedDurationMs": 207000,
  "message": "Optimization job started. Poll /api/admin/optimize-weights/status for progress."
}

// Errors:
// 409: "An optimization job is already running"
// 400: "Insufficient data — only 230 ranking events found (minimum: 500)"
// 403: "Admin access required"
```

#### `GET /api/admin/optimize-weights/status`

Returns the latest job status.

```ts
// Response:
{
  "jobId": "a7b3c9d1-...",
  "status": "running",
  "progressPercent": 68,
  "currentPhase": "Optimizing weights (iteration 142/200)...",
  "phasesCompleted": 3,
  "totalPhases": 6,
  "startedAt": "2026-04-16T14:28:15.000Z",
  "estimatedEndAt": "2026-04-16T14:33:00.000Z",
  "eventCount": 12450,
  // When completed:
  "optimizedWeights": null,      // filled when status='completed'
  "weightChanges": null,         // filled when status='completed'
  "performanceMetrics": null,    // filled when status='completed'
  "completedAt": null,
  "durationMs": null
}
```

#### `POST /api/admin/optimize-weights/apply`

Applies the optimized weights from a completed job.

```ts
// Request: { "jobId": "a7b3c9d1-..." }

// Response:
{
  "success": true,
  "auditId": "...",
  "message": "Optimized weights applied. 22 dimensions updated. Audit snapshot saved.",
  "changes": [
    { "key": "budget_fit", "oldWeight": 0.08, "newWeight": 0.102 },
    // ...
  ]
}
```

#### `POST /api/admin/optimize-weights/cancel`

Cancels a running job.

```ts
// Request: { "jobId": "a7b3c9d1-..." }
// Response: { "success": true, "message": "Optimization job cancelled." }
```

### 19.9 Safety & Guard Rails

| Guard Rail | Description |
|-----------|-------------|
| **Minimum 500 events** | Won't run optimization with insufficient data — results would be statistically unreliable |
| **One job at a time** | Only one optimization can run concurrently (409 if attempted) |
| **Max single dimension: 25%** | No dimension can receive more than 25% weight (prevents monopoly) |
| **Min weight per dimension: admin-set** | Respects `minWeightage` from `ScoringDimension` table (guard rail from v2 plan) |
| **budget_penalty floor: 5%** | Cannot be optimized below 5% (ensures over-budget products are still penalized) |
| **Old weights always saved** | Before any apply, current weights are snapshotted to `ScoringDimensionAudit` with source='ml_optimization' |
| **Suspicious change alert** | Any dimension changing by more than ±50% relative triggers a warning in the UI |
| **Job timeout: 30 minutes** | If a job runs longer than 30 min, it's auto-cancelled as failed |
| **Holdout validation** | 20% of data is held out; optimized weights must improve reward on holdout (not just training data) |

### 19.10 Implementation — Files for One-Click Optimize

| # | File | Action | Phase |
|---|------|--------|-------|
| 1 | `scripts/r59-scoring-engine-revamp.sql` | **EXTEND** — Add `OptimizationJob` table | 6A |
| 2 | `apps/web/lib/learning/weight-optimizer.ts` | **EXTEND** — Add full optimization pipeline (6 phases), correlation math, projected gradient ascent | 6C |
| 3 | `apps/web/app/api/admin/optimize-weights/route.ts` | **CREATE** — POST trigger + GET status endpoint | 6D |
| 4 | `apps/web/app/api/admin/optimize-weights/apply/route.ts` | **CREATE** — POST apply + discard endpoints | 6D |
| 5 | `apps/web/app/admin/scoring-dimensions/page.tsx` | **EXTEND** — Add Optimize button, status banner, polling, confirmation dialog, before/after table, apply/discard actions | 6D |
| 6 | `apps/web/lib/learning/math-utils.ts` | **CREATE** — Pearson correlation, Cohen's d, NDCG, simplex projection, position debiasing utilities | 6C |

**Phase 6 updated total: 14 new files + 7 modified files = 21 files**

### Grand Total Updated: 17 new files + 19 modified files = 36 files across 6 phases

---

## Awaiting Review

Please review this v3.1 plan and confirm:

1. ✅/❌ The 22-dimension universe (all factors as configurable dimensions)
2. ✅/❌ Scorer registry pattern (scorerKey → function mapping)
3. ✅/❌ Full JSONB snapshot audit trail + per-search audit (optional)
4. ✅/❌ Budget penalty min-weight guard rail (5% minimum)
5. ✅/❌ 5-group admin UI (Intent, Quality, Engagement, Personal, Business)
6. ✅/❌ 60-second server cache for dimension config
7. ✅/❌ **RankingEventLog** — capture every ranking + outcomes for learning
8. ✅/❌ **Reward computation** — scoring ranking quality from user behavior
9. ✅/❌ **Weight optimizer** — suggest dimension weight changes based on outcomes
10. ✅/❌ **Contextual weight profiles** — learn per-category/budget weight preferences
11. ✅/❌ **DimensionEffectiveness** — track which dimensions actually predict purchases
12. ✅/❌ **DB persistence fix** — wire in-memory learning stores to existing DB tables
13. ✅/❌ **ML training data export** — CSV/JSON export for future model training
14. ✅/❌ **Admin-approved learning** — suggestions require admin review before applying
15. ✅/❌ **One-Click Optimize** — `⚡ Optimize Weights` button on Scoring Dimensions page
16. ✅/❌ **Async job architecture** — background worker with `OptimizationJob` table, polling, estimated time
17. ✅/❌ **Status banner** — progress bar, phase info, auto-refresh every 1 min, last-checked timestamp
18. ✅/❌ **Before/after comparison** — table showing old vs. optimized weights with change reasons
19. ✅/❌ **Three post-optimization actions** — Apply / Load Into Editor / Discard
20. ✅/❌ **Safety guard rails** — min 500 events, max 25% per dimension, holdout validation, 30min timeout
21. ✅/❌ **6-phase rollout** with learning engine as Phase 6 (A→B→C→D)

Once confirmed, I will proceed with implementation following the 6-phase approach.
