# AI/ML Architecture — DelegateCart

## Deep Dive for AI Architect Interview

---

## 1. AI SUBSYSTEM OVERVIEW

DelegateCart's AI layer consists of **6 interconnected subsystems**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AI ARCHITECTURE                               │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │  1. Intent    │  │ 2. Product   │  │ 3. Ranking   │               │
│  │  Parser       │  │ Aggregator   │  │ Engine       │               │
│  │  (NLP/LLM)   │  │ (Multi-src)  │  │ (ML Scoring) │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
│         │                  │                  │                        │
│         └──────────────────┼──────────────────┘                       │
│                            │                                           │
│  ┌──────────────┐  ┌──────▼───────┐  ┌──────────────┐               │
│  │ 4. Recommend │  │ 5. Autopilot │  │ 6. Seller    │               │
│  │ Engine       │  │ Decision     │  │ Copilot AI   │               │
│  │ (Collab+CF)  │  │ Engine       │  │ (Generative) │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│                                                                       │
│  Infrastructure: Kafka | Redis | PostgreSQL | Multi-LLM Providers    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. SUBSYSTEM 1: INTENT PARSER

### Purpose
Convert natural language shopping requests into structured, machine-readable intent.

### Input/Output
```
INPUT:  "I need a Samsung phone under 30K with good camera, deliver by Friday"
OUTPUT: {
  "category": "smartphones",
  "brand": "Samsung",
  "maxBudget": 30000,
  "features": ["good camera"],
  "deliveryUrgency": "high",
  "deliveryDeadline": "2025-01-17",
  "keywords": ["phone", "Samsung", "camera"],
  "confidence": 0.92
}
```

### Architecture
```
User Message → FastAPI Endpoint
  → Preprocessing (sanitize, normalize)
  → Prompt Engineering:
      System: "You are a shopping intent parser. Extract structured data."
      User: "{message}"
      Format: JSON schema with required fields
  → LLM Provider (configurable):
      Primary: Claude 3 Sonnet (high reasoning quality)
      Fallback: GPT-4 (reliable, widely available)
      Cost-opt: Groq (fast, cheaper for simple intents)
  → Response Parsing (JSON extraction)
  → Intent Validation (IntentGuardrailService)
  → Publish to Kafka[intent.processed]
```

### Prompt Engineering Strategy
- **System prompt**: Defines role, output schema, and constraints
- **Few-shot examples**: 3-5 curated examples in the prompt
- **Output format**: Strict JSON schema with field descriptions
- **Guardrails**: Post-processing validates required fields, budget ranges, category mapping
- **Clarifying questions**: If confidence < 0.7, returns questions instead of intent

### LLM Provider Architecture (Strategy Pattern)
```python
class LLMProvider(ABC):
    @abstractmethod
    async def complete(self, prompt: str, system: str) -> str: ...
    
class OpenAIProvider(LLMProvider):
    async def complete(self, prompt, system):
        response = await openai.ChatCompletion.acreate(
            model="gpt-4", messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt}
            ], temperature=0.1  # Low for deterministic extraction
        )
        return response.choices[0].message.content

class AnthropicProvider(LLMProvider):
    async def complete(self, prompt, system):
        response = await anthropic.messages.create(
            model="claude-3-sonnet", system=system,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1
        )
        return response.content[0].text
```

Selection is config-driven (`LLM_PROVIDER` env var). Circuit breaker wraps each provider with automatic fallback.

---

## 3. SUBSYSTEM 2: PRODUCT AGGREGATOR

### Purpose
Search multiple merchant sources simultaneously and return unified product data.

### Architecture
```
Kafka[intent.processed] → Consumer
  → Parse intent
  → Fan out parallel searches:
      ┌── InternalAdapter.search(intent) → Prisma DB query
      ├── AmazonAdapter.search(intent)   → Amazon API (simulated)
      └── FlipkartAdapter.search(intent) → Flipkart API (simulated)
  → Await all (with timeout + circuit breaker per source)
  → Normalize results to common schema:
      { id, title, price, brand, rating, reviewCount, source, imageUrl, deliveryDays }
  → Deduplicate (same product from multiple sources)
  → Publish to Kafka[products.fetched]
```

### Adapter Pattern
```python
class MerchantAdapter(ABC):
    @abstractmethod
    async def search(self, query: SearchQuery) -> List[Product]: ...
    
    @abstractmethod
    async def get_quote(self, product_id: str) -> Quote: ...

class AmazonAdapter(MerchantAdapter):
    async def search(self, query):
        # Call Amazon Product Advertising API
        # Map response to common Product schema
        # Apply circuit breaker wrapper
        ...

class InternalAdapter(MerchantAdapter):  
    async def search(self, query):
        # Direct Prisma query against PostgreSQL
        # Fastest source, no external API dependency
        ...
```

### Caching Strategy
- Search results cached in Redis: `agg_search:{intent_hash}` → 1 hour TTL
- Individual product data cached: `product:{source}:{id}` → 1 hour TTL
- Cache key includes user preferences for personalized deduplication

### Resilience
- **Timeout**: 5s per source, 10s total
- **Circuit breaker**: Per-adapter (3 failures → open for 30s)
- **Graceful degradation**: If Amazon is down, return Flipkart + internal results
- **Retry**: 1 retry with exponential backoff

---

## 4. SUBSYSTEM 3: PRODUCT RANKING ENGINE

### Purpose
Score and rank products based on a weighted multi-factor ML algorithm personalized to user preferences.

### Algorithm: 5-Factor Weighted Scoring

```python
def compute_score(product, user_prefs, intent):
    """
    Compute product score on [0, 1] scale using 5 weighted factors.
    """
    # Factor 1: Budget Fit (25%)
    budget = intent.max_budget
    price = product.price
    budget_fit = max(0, 1.0 - abs(price - budget) / budget)
    # Penalty for over-budget, slight penalty for under-budget (too cheap)
    
    # Factor 2: Quality Score (25%)
    quality = compute_quality(product)
    # Composite: brand_tier (0-1) × 0.3 + feature_score (0-1) × 0.4 + build_quality (0-1) × 0.3
    
    # Factor 3: Brand Preference (20%)
    if product.brand in user_prefs.preferred_brands:
        brand_score = 1.0
    elif product.brand in user_prefs.neutral_brands:
        brand_score = 0.5
    else:
        brand_score = 0.2  # Unknown brand, small penalty
    
    # Factor 4: Delivery Speed (15%)
    urgency = intent.delivery_urgency  # 1.0 (high) to 0.3 (low)
    delivery_score = 1.0 / max(product.delivery_days, 1) * urgency
    delivery_score = min(delivery_score, 1.0)
    
    # Factor 5: Ratings & Reviews (15%)
    confidence = min(product.review_count / 100, 1.0)  # 100+ reviews = full confidence
    rating_score = (product.avg_rating / 5.0) * confidence
    
    # Weighted sum
    score = (
        0.25 * budget_fit +
        0.25 * quality +
        0.20 * brand_score +
        0.15 * delivery_score +
        0.15 * rating_score
    )
    
    return round(score, 4)
```

### Personalization Layer
Weights are adjusted per user based on historical behavior:
```python
def personalize_weights(user_memory):
    """
    Shift weights based on user's demonstrated preferences.
    """
    base = {"budget": 0.25, "quality": 0.25, "brand": 0.20, "delivery": 0.15, "rating": 0.15}
    
    if user_memory.price_sensitivity > 0.7:
        base["budget"] += 0.10
        base["quality"] -= 0.05
        base["brand"] -= 0.05
    
    if user_memory.brand_loyalty > 0.7:
        base["brand"] += 0.10
        base["rating"] -= 0.05
        base["delivery"] -= 0.05
    
    # Normalize to sum = 1.0
    total = sum(base.values())
    return {k: v/total for k, v in base.items()}
```

### Input/Output
```
INPUT (from Kafka):
  { products: [...50 items], intent: { budget: 30000, brand: "Samsung" }, userId: 42 }

OUTPUT (to Kafka):
  { rankedProducts: [
      { id: "p1", title: "Samsung S24", price: 29999, score: 0.91, rank: 1,
        scoreBreakdown: { budget: 0.99, quality: 0.85, brand: 1.0, delivery: 0.8, rating: 0.9 }
      },
      { id: "p2", title: "Samsung A55", price: 24999, score: 0.78, rank: 2, ... },
      ...
    ]
  }
```

---

## 5. SUBSYSTEM 4: RECOMMENDATION ENGINE

### Purpose
Generate personalized product recommendations by tracking and analyzing user behavior.

### Data Pipeline
```
User Actions (tracked via Kafka[user-behavior]):
  - product_view → category affinity +1
  - cart_add → product interest signal
  - purchase → brand + category confirmation
  - cart_abandon → price sensitivity signal
  - rating → quality preference

AI Service (Consumer):
  → Update UserMemory model
  → Compute MemoryInsight entries
  → Generate new recommendations
  → Cache in Redis (30 min TTL)
  → Push via WebSocket
```

### Recommendation Algorithm
```python
class RecommendationEngine:
    async def generate(self, user_id: int) -> List[Product]:
        memory = await self.get_user_memory(user_id)
        
        # Strategy 1: Category affinity (score from view/purchase history)
        category_candidates = await self.get_by_category_affinity(
            memory.top_categories, limit=20
        )
        
        # Strategy 2: Brand preference (from purchase/rating history)
        brand_candidates = await self.get_by_brand_preference(
            memory.preferred_brands, limit=20
        )
        
        # Strategy 3: Price range fit (from purchase price distribution)
        price_candidates = await self.get_in_price_range(
            memory.avg_purchase_price * 0.7,
            memory.avg_purchase_price * 1.5,
            limit=20
        )
        
        # Strategy 4: Collaborative filtering signal
        similar_users = await self.find_similar_users(user_id)
        collab_candidates = await self.get_popular_among(
            similar_users, exclude=memory.purchased_products
        )
        
        # Merge & score
        all_candidates = deduplicate(
            category_candidates + brand_candidates + 
            price_candidates + collab_candidates
        )
        
        scored = [
            (product, self.score(product, memory))
            for product in all_candidates
        ]
        scored.sort(key=lambda x: x[1], reverse=True)
        
        return scored[:10]  # Top 10
    
    def score(self, product, memory):
        return (
            0.30 * memory.category_affinity.get(product.category, 0) +
            0.25 * (1.0 if product.brand in memory.preferred_brands else 0.3) +
            0.25 * self.price_fit(product.price, memory) +
            0.20 * memory.collaborative_signal.get(product.id, 0)
        )
```

### Cold-Start Handling
```python
async def handle_cold_start(self, user_id: int):
    interaction_count = await self.count_interactions(user_id)
    
    if interaction_count < 3:
        # Phase 1: Zero-party data (ask preferences)
        return await self.zero_party_service.get_quiz_recommendations(user_id)
    
    elif interaction_count < 10:
        # Phase 2: Hybrid (mix popular + early signals)
        popular = await self.get_trending(limit=5)
        early_signal = await self.generate(user_id)[:5]
        return interleave(popular, early_signal)
    
    else:
        # Phase 3: Fully personalized
        return await self.generate(user_id)
```

---

## 6. SUBSYSTEM 5: AUTOPILOT DECISION ENGINE

### Purpose
Evaluate whether to autonomously execute a purchase, request human approval, or block.

### Architecture
```
Kafka[products.ranked] → Autopilot Engine Consumer
  → Rule Engine: Match user's AutopilotRules
  → Decision Engine: Compute confidence score
  → Safety Layer: Validate spending limits, fraud
  → Explainability Layer: Generate reasoning
  → Action:
      confidence ≥ 80% → Auto-execute
      confidence 50-79% → HITL approval
      confidence < 50% → Block
```

### Rule Engine
```typescript
class RuleEngine {
  evaluate(rules: AutopilotRule[], product: RankedProduct): RuleResult {
    for (const rule of rules) {
      const conditions = rule.conditions; // JSON: { maxPrice, brands, categories, minRating }
      
      const matches = [
        !conditions.maxPrice || product.price <= conditions.maxPrice,
        !conditions.brands || conditions.brands.includes(product.brand),
        !conditions.categories || conditions.categories.includes(product.category),
        !conditions.minRating || product.rating >= conditions.minRating,
        !conditions.maxDeliveryDays || product.deliveryDays <= conditions.maxDeliveryDays,
      ];
      
      const matchCount = matches.filter(Boolean).length;
      const matchRatio = matchCount / matches.length;
      
      if (matchRatio >= 0.8) { // 80% conditions met
        return { matched: true, rule, matchRatio, matchedConditions: matches };
      }
    }
    return { matched: false, reason: 'No matching rules' };
  }
}
```

### Decision Engine (Confidence Scoring)
```typescript
class DecisionEngine {
  computeConfidence(ruleResult: RuleResult, context: DecisionContext): number {
    const factors = {
      // How well the product matches user rules (0-100)
      ruleMatch: ruleResult.matchRatio * 100,
      
      // Historical success of similar purchases (0-100)
      historicalSuccess: this.getHistoricalSuccessRate(context.userId, context.category),
      
      // Price stability over time (0-100)
      priceStability: this.getPriceStabilityScore(context.productId),
      
      // Risk assessment (0-100, higher = safer)
      riskAssessment: this.assessRisk(context),
    };
    
    // Weighted average
    const confidence = (
      factors.ruleMatch * 0.35 +
      factors.historicalSuccess * 0.25 +
      factors.priceStability * 0.20 +
      factors.riskAssessment * 0.20
    );
    
    return Math.round(confidence);
  }
  
  assessRisk(context: DecisionContext): number {
    let risk = 100; // Start at safe
    
    if (context.amount > context.avgPurchaseAmount * 2) risk -= 30; // Unusual amount
    if (context.isNewBrand) risk -= 15; // Unknown brand
    if (context.isNewCategory) risk -= 10; // New category
    if (context.sellerRating < 4.0) risk -= 20; // Low seller rating
    if (context.productAge < 30) risk -= 10; // New product (less reviews)
    
    return Math.max(0, risk);
  }
}
```

### Safety Layer
```typescript
class SafetyLayer {
  async validate(decision: Decision, userId: number): Promise<SafetyResult> {
    const checks = await Promise.all([
      this.checkWalletBalance(userId, decision.amount),
      this.checkSpendingLimits(userId, decision.amount),
      this.checkFraudIndicators(userId, decision),
      this.checkUserAuthorization(userId),
      this.checkProductSafety(decision.productId),
    ]);
    
    const failedChecks = checks.filter(c => !c.passed);
    
    return {
      passed: failedChecks.length === 0,
      failedChecks,
      canOverride: failedChecks.every(c => c.severity !== 'critical'),
    };
  }
}
```

### Explainability Layer
```typescript
class ExplainabilityLayer {
  generateExplanation(decision: Decision, factors: ConfidenceFactors): Explanation {
    return {
      decision: decision.action, // 'approve' | 'request_approval' | 'block'
      confidence: decision.confidence,
      summary: this.generateHumanSummary(decision, factors),
      factors: {
        ruleMatch: {
          score: factors.ruleMatch,
          details: `${factors.matchedCount}/${factors.totalConditions} conditions matched`,
        },
        historicalSuccess: {
          score: factors.historicalSuccess,
          details: `${factors.successfulPurchases}/${factors.totalPurchases} similar purchases were satisfactory`,
        },
        priceStability: {
          score: factors.priceStability,
          details: `Price has been stable for ${factors.stableDays} days`,
        },
        riskAssessment: {
          score: factors.riskAssessment,
          details: factors.riskFlags.length === 0 ? 'No risk factors detected' : 
            `Risk flags: ${factors.riskFlags.join(', ')}`,
        },
      },
      reasoning: this.generateDetailedReasoning(decision, factors),
    };
  }
}
```

---

## 7. SUBSYSTEM 6: SELLER COPILOT AI

### Purpose
AI-powered tools for sellers: listing generation, pricing suggestions, demand forecasting.

### AI Listing Generation
```
Seller provides: product name, category, basic specs
  → SellerCopilotService.generateListing()
  → LLM prompt: "Generate an optimized product listing for {category}. Include title, description, features, SEO keywords."
  → Result: { title, description, features[], seoKeywords[], suggestedPrice }
```

### AI Pricing Suggestions
```
Input: Product category, competitor prices, seller costs
  → Analyze PriceHistory table for category trends
  → Analyze DemandMetrics for demand signals
  → Compute optimal price: cost_plus margin + competitive_positioning + demand_elasticity
  → Return: { suggestedPrice, reasoning, competitorComparison }
```

### Demand Forecasting
```
Input: Product category, time period
  → Query ProductBusinessMetrics for historical sales
  → Query DemandMetrics for demand signals
  → Apply trend analysis (moving average, seasonality)
  → Return: { forecastedDemand, confidence, seasonalFactors, recommendations }
```

---

## 8. MULTI-LLM PROVIDER ARCHITECTURE

### Provider Selection Matrix

| Provider | Model | Use Case | Latency | Cost | Quality |
|----------|-------|----------|---------|------|---------|
| Anthropic | Claude 3 Sonnet | Intent parsing, complex reasoning | ~2s | $$$ | Highest |
| OpenAI | GPT-4 | General purpose, reliable fallback | ~1.5s | $$$ | High |
| Google | Gemini Pro | Cost-effective bulk processing | ~1s | $$ | Good |
| Groq | Llama 3.1 70B | Low-latency, simple tasks | ~0.3s | $ | Good |
| OpenRouter | Various | Routing to cheapest available | Variable | $ | Variable |

### Fallback Chain
```python
class LLMService:
    providers = [
        AnthropicProvider(),   # Primary
        OpenAIProvider(),      # Fallback 1
        GoogleGeminiProvider(),# Fallback 2
        GroqProvider(),        # Fallback 3
    ]
    
    async def complete(self, prompt, system, timeout=10):
        for provider in self.providers:
            if provider.circuit_breaker.is_open:
                continue
            try:
                return await asyncio.wait_for(
                    provider.complete(prompt, system),
                    timeout=timeout
                )
            except (TimeoutError, APIError) as e:
                provider.circuit_breaker.record_failure()
                logger.warning(f"{provider.name} failed: {e}")
                continue
        raise AllProvidersFailedError()
```

---

## 9. AI SAFETY & GUARDRAILS

### Five-Layer Safety Architecture

```
Layer 1: Intent Guardrails
  → Validates parsed intents for reasonableness
  → Budget sanity check (not negative, not astronomical)
  → Category validation (known categories only)
  → Prevents prompt injection in user messages

Layer 2: Decision Guardrails  
  → Validates every autopilot decision
  → Confidence threshold enforcement
  → Maximum purchase amount cap
  → Rate limiting on AI purchases per user

Layer 3: Execution Guardrails
  → Pre-execution validation
  → Wallet balance verification
  → Spending limit enforcement (per-order, daily, weekly, monthly)
  → Fraud detection (velocity, anomaly)

Layer 4: HITL (Human-in-the-Loop)
  → Medium-confidence decisions require user approval
  → Approval request with full explainability
  → 24-hour timeout (auto-cancel if no response)
  → One-tap approve/reject

Layer 5: Wallet Security
  → isAiAuthorized flag (user opt-in required)
  → Separate spending limits for AI vs manual
  → WalletAuditLog for every AI transaction
  → Automatic wallet lock on fraud detection
```

### Prompt Injection Prevention
```python
def sanitize_user_input(message: str) -> str:
    """Prevent prompt injection in user messages."""
    # Remove known injection patterns
    injection_patterns = [
        r"ignore previous instructions",
        r"you are now",
        r"system prompt",
        r"<\|im_start\|>",
    ]
    for pattern in injection_patterns:
        message = re.sub(pattern, "", message, flags=re.IGNORECASE)
    
    # Limit message length (prevent context stuffing)
    return message[:2000]
```

---

## 10. DATA MODELS FOR AI

### PostgreSQL Models (Prisma Schema)

```prisma
model UserMemory {
  id              Int      @id @default(autoincrement())
  userId          Int      @unique
  preferences     Json     // { categories, brands, priceRange, quality }
  behaviorProfile Json     // { viewCount, cartCount, purchaseCount, ... }
  lastUpdated     DateTime @updatedAt
  insights        MemoryInsight[]
}

model MemoryInsight {
  id         Int      @id @default(autoincrement())
  memoryId   Int
  type       String   // 'category_affinity' | 'brand_preference' | 'price_sensitivity'
  key        String   // e.g., 'electronics', 'Samsung'
  value      Float    // Affinity score 0-1
  confidence Float    // Statistical confidence
  memory     UserMemory @relation(fields: [memoryId])
}

model AutopilotRule {
  id         Int      @id @default(autoincrement())
  userId     Int
  name       String
  conditions Json     // { maxPrice, brands[], categories[], minRating, maxDeliveryDays }
  isActive   Boolean  @default(true)
  decisions  AutopilotDecision[]
}

model AutopilotDecision {
  id          Int      @id @default(autoincrement())
  ruleId      Int
  userId      Int
  action      String   // 'auto_execute' | 'request_approval' | 'block'
  confidence  Int      // 0-100
  reasoning   Json     // Full explainability object
  productData Json     // Snapshot of product at decision time
  outcome     String?  // 'success' | 'cancelled' | 'returned'
  rule        AutopilotRule @relation(fields: [ruleId])
}

model RankingPersonalization {
  id              Int    @id @default(autoincrement())
  userId          Int    @unique
  budgetWeight    Float  @default(0.25)
  qualityWeight   Float  @default(0.25)
  brandWeight     Float  @default(0.20)
  deliveryWeight  Float  @default(0.15)
  ratingWeight    Float  @default(0.15)
}
```

---

## 11. METRICS & MONITORING

### AI-Specific Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| Intent parsing accuracy | % of correctly parsed intents | > 90% |
| Recommendation CTR | Click-through on recommendations | > 15% |
| Recommendation conversion | Purchase rate from recommendations | > 3% |
| Autopilot approval rate | HITL-reviewed decisions approved | > 80% |
| Autopilot reversal rate | Auto-executed purchases returned | < 5% |
| LLM latency (p95) | 95th percentile LLM response time | < 3s |
| LLM error rate | Failed LLM calls / total | < 1% |
| Ranking Kendall tau | Correlation with user preference order | > 0.6 |

### Kafka Monitoring
- Consumer lag per group (alerts if > 1000 messages)
- Message throughput per topic
- Error rate per consumer

---

## 12. INTERVIEW KEY POINTS

### "Why is this AI Architecture unique?"
It's a **full autonomous commerce pipeline** — from natural language understanding to autonomous checkout, with production-grade safety. Most AI commerce projects stop at recommendations. We go further: AI agents make purchasing decisions with explainable reasoning, spending guardrails, and human-in-the-loop approval.

### "What's the hardest ML problem you solved?"
The **confidence scoring for autonomous purchases**. It's not just ML accuracy — it's balancing user expectations, financial risk, and trust building. A false positive (bad purchase) erodes trust. A false negative (requiring approval for obvious purchases) creates friction. We tuned thresholds based on historical approval/rejection patterns and user feedback loops.

### "How would you improve this AI architecture?"
1. **Retrieval-Augmented Generation (RAG)** — Embed product catalogs in vector DB for semantic search
2. **Reinforcement Learning** — Learn optimal ranking weights from user feedback (vs. static weights)
3. **Multi-modal understanding** — Image-based product matching (visual search is partially implemented)
4. **Real-time A/B testing** — Feature flags + experiment tracking for model comparison
5. **Federated learning** — Learn across users without sharing PII
