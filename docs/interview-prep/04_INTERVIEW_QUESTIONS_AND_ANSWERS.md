# DelegateCart — Interview Questions & Answers

## 150+ Questions for Staff Engineer & AI Architect Role

---

# SECTION A: PROJECT OVERVIEW & VISION

### Q1: Tell me about your flagship project.
**A**: DelegateCart is an AI-powered autonomous commerce platform I architected and built. Unlike traditional e-commerce where users manually browse-compare-checkout, DelegateCart introduces **delegated shopping** — AI agents can autonomously discover products across multiple merchants (Amazon, Flipkart, internal sellers), make purchase decisions using ML-powered ranking, and execute checkouts within user-defined safety guardrails. The platform is built as a monorepo with 7 microservices, uses event-driven architecture with Kafka, and includes production-grade features like RBAC, digital wallets with fraud detection, HITL approval workflows, and explainable AI decisions.

### Q2: What problem does DelegateCart solve?
**A**: Three core problems:
1. **Repetitive shopping fatigue** — Users spend hours on routine purchases. DelegateCart's Autopilot Engine automates recurring purchases.
2. **Cross-platform comparison inefficiency** — Finding the best deal requires checking multiple sites. Our Product Aggregator searches Amazon, Flipkart, and internal sellers simultaneously.
3. **Trust gap in AI commerce** — Users don't trust AI with their money. We built explainable decision engines with confidence scoring, spending limits, HITL approvals, and full audit trails to bridge this gap.

### Q3: What makes your architecture unique?
**A**: The **Agentic Commerce Protocol (ACP)** — a standardized protocol that defines how AI shopping agents interface with heterogeneous merchant APIs. Using the Adapter Pattern, we abstract away API differences so adding a new merchant requires only implementing a single adapter interface (`search`, `quote`, `checkout`). Combined with the verification layer (budget, trust, fraud checks), circuit breakers, and idempotent operations, it creates a production-ready framework for autonomous commerce.

### Q4: How would you pitch this to a CTO?
**A**: "DelegateCart is the infrastructure layer for autonomous commerce. Just as Stripe standardized payments, we're standardizing how AI agents transact. Our ACP protocol enables any AI agent to search, compare, and purchase across multiple merchants with built-in safety guarantees — spending limits, fraud detection, explainable decisions, and human approval workflows. The event-driven architecture on Kafka scales to millions of transactions, and the ML ranking engine ensures every autonomous purchase optimizes for the user's stated preferences."

---

# SECTION B: ARCHITECTURE & SYSTEM DESIGN

### Q5: Walk me through the high-level architecture.
**A**: The system is a **monorepo** (Turborepo + pnpm) with 7 services:
- **Frontend**: Next.js 14 with App Router, SSR, React 18, Tailwind CSS
- **API Gateway**: NestJS 10 with modular architecture — 15+ feature modules, JWT auth, RBAC, rate limiting, circuit breakers
- **AI Service**: FastAPI (Python) — ML recommendations, behavior tracking, chat service
- **Intent Parser**: FastAPI — NLP-powered intent extraction using GPT-4/Claude 3
- **Product Aggregator**: FastAPI — Multi-source search (Amazon, Flipkart, internal) with Redis caching
- **Ranking Engine**: FastAPI — 5-factor weighted ML scoring
- **Autopilot Engine**: NestJS — Rule-based autonomous shopping with decision engine, safety layer, and HITL

All services communicate via **Apache Kafka** (11+ topics, choreography pattern). PostgreSQL 16 is the primary store (Prisma ORM, 30+ models). Redis 7 handles caching, sessions, rate limiting, and circuit breaker state.

### Q6: Why did you choose a monorepo?
**A**: Four key reasons:
1. **Type safety across boundaries** — The `packages/types` shared package ensures frontend and backend use identical TypeScript interfaces. Breaking API changes are caught at compile time.
2. **Atomic deployments** — When a schema change affects both API responses and frontend rendering, it ships as one commit.
3. **Developer experience** — `pnpm dev` starts all services. Hot-reload works across packages.
4. **Dependency management** — pnpm deduplicates shared packages like `class-validator`, reducing `node_modules` size by ~40%.

### Q7: Why NestJS over Express?
**A**: NestJS provides an **opinionated module system** that's essential at our complexity level:
- **Dependency Injection** — Every service is injectable, enabling clean testing with mock providers
- **Guards/Interceptors/Pipes** — Cross-cutting concerns (auth, logging, validation) are declarative, not duplicated
- **Module encapsulation** — Each feature is a self-contained module with its own controllers, services, and DTOs
- **First-class decorators** — `@UseGuards(JwtGuard)`, `@Roles('admin')`, `@Body()` reduce boilerplate
- **Swagger auto-generation** — API documentation stays in sync with code

### Q8: Why Kafka over RabbitMQ or Redis Streams?
**A**: Three key differentiators:
1. **Durable event log** — Kafka retains events for replay. Essential for our audit trail and debugging autonomous purchases.
2. **Ordered partitions** — Events for the same user go to the same partition, maintaining causality (view → cart → purchase).
3. **Consumer groups** — Each microservice independently reads the same event stream at its own pace. If the AI service goes down, it resumes processing from where it left off.

RabbitMQ would require explicit queues per consumer. Redis Streams lack Kafka's durability and partitioning guarantees.

### Q9: Explain the event-driven flow for a buy request.
**A**: 
1. User creates buy request: "Samsung phone under 30K" → API publishes to `buy_request.created`
2. **Intent Parser** consumes → extracts: category=smartphones, brand=Samsung, budget=30000 → publishes to `intent.processed`
3. **Product Aggregator** consumes → searches Internal+Amazon+Flipkart in parallel → publishes to `products.fetched`
4. **Ranking Engine** consumes → scores products with 5-factor ML algorithm → publishes to `products.ranked`
5. **Autopilot Engine** consumes → evaluates user rules → decision engine scores confidence
6. If confidence ≥ 80%: safety checks → auto-execute checkout
7. If confidence 50-79%: create HITL approval request → notify user via WebSocket
8. If confidence < 50%: block, log reasoning, notify for manual review

This uses the **choreography pattern** — no central orchestrator. Each service reacts to events independently.

### Q10: How do you handle distributed transactions?
**A**: We use the **Saga Pattern** with compensating transactions:
```
1. Hold wallet funds (HOLD transaction)
2. Create order (pending status)
3. Execute merchant checkout via ACP
4. If success: Debit wallet (HOLD → DEBIT), confirm order
5. If failure: Release hold (RELEASE), cancel order, notify user
```
Each step publishes events. If step 3 fails, the compensating actions in steps 5 reverse the earlier state. The idempotency middleware ensures retries don't duplicate operations.

### Q11: How does the circuit breaker work?
**A**: Three states:
- **CLOSED** (normal): Requests pass through. Failures are counted.
- **OPEN** (tripped): After N failures within M seconds, circuit opens. All requests fail fast with `ServiceUnavailableException`.
- **HALF_OPEN** (testing): After cooldown period, one request is allowed through. If it succeeds, circuit closes. If it fails, circuit reopens.

This prevents cascade failures — if the Flipkart adapter is down, the circuit breaker ensures we don't overwhelm it with requests, and the aggregator gracefully falls back to Amazon + internal results.

### Q12: How do you ensure idempotency?
**A**: The `IdempotencyMiddleware` uses Redis:
```
1. Client sends request with X-Idempotency-Key header
2. Middleware checks Redis: key exists?
   - YES: Return cached response (same status, body)
   - NO: Process request, cache response with 24h TTL
```
Critical for payment operations — if a user double-clicks "Pay", only one order is created.

### Q13: Describe the caching strategy.
**A**: Multi-layer caching with Redis:
| Layer | Key Pattern | TTL | Purpose |
|-------|-------------|-----|---------|
| Product cache | `product:{id}` | 1 hour | Avoid repeated DB hits |
| Search cache | `search:{hash}:{userId}` | 1 hour | User-specific search results |
| Rate limits | `ratelimit:{ip}:{path}` | 1 minute | Token bucket counters |
| Sessions | `session:{token}` | Configurable | User sessions |
| Idempotency | `idempotent:{key}` | 24 hours | Duplicate prevention |
| Circuit state | `circuit:{service}` | Variable | Service health |
| Recommendations | `recommend:{userId}` | 30 minutes | ML output cache |

Cache invalidation follows **write-through**: database writes invalidate relevant cache keys.

### Q14: How would you scale this to 100K concurrent users?
**A**: 
1. **API layer**: Kubernetes HPA scales NestJS pods (CPU-based, 3-10 replicas)
2. **Database**: Prisma connection pooling (50 connections), read replicas for queries
3. **Kafka**: Increase partitions to 12+ per topic, add consumer instances per group
4. **Redis**: Redis Cluster for horizontal sharding, Sentinel for HA
5. **WebSocket**: Sticky sessions via Ingress, or Redis adapter for Socket.io
6. **AI Service**: FastAPI is async — scales well with uvicorn workers
7. **CDN**: Next.js static assets served via CDN (Vercel/CloudFront)

The event-driven architecture inherently scales — adding Kafka consumers scales processing linearly.

---

# SECTION C: AI & ML ARCHITECTURE

### Q15: Explain the AI/ML architecture.
**A**: Four AI subsystems:
1. **Intent Parser** — Uses GPT-4/Claude to extract structured shopping intent from natural language. Outputs: categories, brands, budget, quality preferences, keywords.
2. **Product Ranking Engine** — Weighted multi-factor ML scoring: Budget Fit (25%), Quality (25%), Brand Preference (20%), Delivery Speed (15%), Ratings (15%).
3. **Recommendation Engine** — Combines collaborative filtering, category affinity, brand preference, and price range fitting from user behavior history.
4. **Autopilot Decision Engine** — Confidence scoring based on rule matching, historical success rate, price stability, and risk assessment.

### Q16: How does the recommendation engine work?
**A**: It tracks user behavior via Kafka events:
- **Product views** → Category affinity scores
- **Cart additions** → Interest signals
- **Cart abandonments** → Price sensitivity indicators
- **Completed purchases** → Brand/category confirmation
- **Ratings/reviews** → Quality preferences

The engine computes scores per product using:
```
score = α(category_affinity) + β(brand_preference) + γ(price_fit) + δ(collaborative_signal)
```
Where α=0.3, β=0.25, γ=0.25, δ=0.2. Recommendations are cached in Redis for 30 minutes and pushed to users via WebSocket.

### Q17: How do you handle LLM provider switching?
**A**: The Intent Parser uses a **Strategy Pattern** with pluggable providers:
```python
class LLMProvider(ABC):
    @abstractmethod
    async def complete(self, prompt: str) -> str: ...

class OpenAIProvider(LLMProvider): ...
class AnthropicProvider(LLMProvider): ...
class GroqProvider(LLMProvider): ...
```
The provider is selected via `LLM_PROVIDER` environment variable. We support OpenAI GPT-4, Anthropic Claude 3, Google Gemini, and Groq — all with automatic fallback if the primary provider fails.

### Q18: What AI safety measures are in place?
**A**: Five layers:
1. **Decision Guardrail Engine** — Validates every AI decision against safety rules
2. **Intent Guardrail Service** — Validates parsed intents for reasonableness
3. **AI Execution Guardrails** — Pre-execution validation of autonomous purchases
4. **Confidence Thresholds** — Actions below 50% confidence are blocked; 50-80% require human approval
5. **Wallet Security Service** — AI-specific spending limits, separate from user limits

### Q19: Explain the explainability layer.
**A**: Every autonomous decision stores structured reasoning:
```json
{
  "decision": "approve",
  "confidence": 87,
  "factors": {
    "ruleMatch": { "score": 95, "details": "All 4 conditions matched" },
    "priceStability": { "score": 82, "details": "Price stable for 7 days" },
    "historicalSuccess": { "score": 90, "details": "9/10 similar purchases succeeded" },
    "riskAssessment": { "score": 78, "details": "Low risk: known brand, within budget" }
  },
  "reasoning": "Product matches all user rules. Samsung Galaxy S24 at ₹29,999 is within ₹30,000 budget. Brand 'Samsung' is in preferred list. Rating 4.6 exceeds 4.0 minimum. Historical purchases of similar items have 90% satisfaction rate."
}
```
This is displayed to users in the decision review UI, building trust in autonomous purchases.

### Q20: How does the product ranking algorithm work?
**A**: Five weighted factors scored 0-1:
1. **Budget Fit (25%)**: `1.0 - |price - budget| / budget` — highest when price equals budget, penalizes both over and under
2. **Quality Score (25%)**: Composite of brand reputation, feature completeness, build quality ratings
3. **Brand Preference (20%)**: `1.0` if brand is in user's preferred list, `0.5` if neutral, `0.1` if unknown
4. **Delivery Speed (15%)**: `1.0 / delivery_days × urgency_factor` — faster delivery scores higher, weighted by user's urgency
5. **Ratings (15%)**: `(avg_rating / 5.0) × confidence(review_count)` — ratings weighted by statistical confidence (100+ reviews = full confidence)

Final score = weighted sum, range [0, 1]. Products ranked by descending score.

---

# SECTION D: SECURITY & SAFETY

### Q21: Describe your security architecture.
**A**: 9-layer defense-in-depth:
1. Rate limiting (Redis token bucket)
2. CORS (explicit origin whitelist)
3. CSRF protection (token guard)
4. Request timeout (30s)
5. JWT authentication
6. RBAC authorization (7 roles)
7. Input validation (class-validator DTOs)
8. SQL injection prevention (Prisma parameterized queries)
9. XSS prevention (CSP headers)

Plus: Bcrypt password hashing (10 rounds), idempotent operations (Redis), wallet fraud detection, AI spending limits, and comprehensive audit logging.

### Q22: How does the wallet fraud detection work?
**A**: Four detection mechanisms:
1. **Velocity Check** — If a user makes > N transactions within M minutes, flag as suspicious
2. **Amount Anomaly** — If transaction amount is > 3σ away from user's historical average, flag
3. **Pattern Detection** — ML model watches for known fraud patterns (sudden large purchases, new address + high amount)
4. **Auto Lockout** — After 3 fraud flags, the wallet is automatically locked (isLocked=true), blocking all transactions

Each check saves results to `WalletAuditLog`. The user is notified and can request manual review.

### Q23: How do you prevent AI from making unauthorized purchases?
**A**: Triple-gate mechanism:
1. **User-level**: `isAiAuthorized` must be `true` on wallet (user explicitly opts in)
2. **Limit-level**: Per-order, daily, weekly, monthly spending limits checked before every AI transaction
3. **Decision-level**: Confidence scoring must pass threshold, and decision engine must classify risk as "low"

If any gate fails, the transaction is blocked and an audit log entry is created.

### Q24: How do you handle PII and sensitive data?
**A**: 
- Passwords: Bcrypt with 10 salt rounds (never stored in plain text)
- JWT tokens: HTTP-only secure cookies + short expiry
- Payment data: Tokenized via Razorpay (never touches our servers)
- Database: Prisma parameterized queries prevent SQL injection
- Logs: PII is redacted in structured logs
- Audit trail: IP address and user agent tracked for forensics

### Q25: Explain your RBAC implementation.
**A**: 7 roles with hierarchical permissions:
- **Admin**: Full access + user CRUD
- **Analytics**: Read access + analytics dashboards
- **AI Plus**: Full shopping + all AI features (autonomous, predictions, copilot)
- **Observability**: System monitoring pages
- **Reinforced Learning**: ML learning metrics
- **Basic**: Standard e-commerce (no AI)
- **Customer**: Public pages only

Enforced at two levels:
1. **Backend**: NestJS `@UseGuards(RBACGuard)` decorator on controllers
2. **Frontend**: Route-level access check in Next.js middleware + hidden UI elements

---

# SECTION E: DATABASE & DATA MODELING

### Q26: Describe your database schema design.
**A**: PostgreSQL 16 with Prisma 7.5 ORM. 30+ models organized into domains:
- **User & Auth**: User, with roles and subscriptions
- **Commerce**: Product, Cart, CartItem, Order, OrderItem, ProductBusinessMetrics
- **Financial**: Wallet, WalletTransaction, WalletSpendingLimit, WalletAuthorization, WalletAuditLog
- **AI**: UserMemory, MemoryInsight, UserPreferences, BuyingPattern, RankingPersonalization
- **Automation**: AutopilotRule, AutopilotDecision, ApprovalRequest
- **Seller**: Seller, SellerProduct, ListingTemplate, PriceHistory, DemandMetrics
- **Chat**: ChatMessage, BuyRequest
- **Config**: FeatureFlag

Design principles: Enum-based status machines, JSON fields for flexible data (conditions, reasoning), balance snapshots per transaction for audit, foreign key constraints for referential integrity.

### Q27: How do you handle database migrations?
**A**: Prisma Migrate — declarative schema changes:
```bash
# Development
npx prisma migrate dev --name add_wallet_limits
# Production
npx prisma migrate deploy
```
Each migration is versioned in `prisma/migrations/`. We also have custom SQL scripts in `scripts/` for data migrations and seed scripts.

### Q28: Why JSON fields for AutopilotRule conditions?
**A**: Flexibility. Each rule can have a different set of conditions — some check price + brand, others check category + rating + time. A rigid relational schema would require a complex EAV (Entity-Attribute-Value) model. JSON gives us:
- Schema flexibility per rule
- Easy serialization/deserialization
- PostgreSQL JSON operators for querying if needed
- Simpler client-side rendering

---

# SECTION F: FRONTEND ARCHITECTURE

### Q29: Why Next.js 14 with App Router?
**A**: Four key reasons:
1. **SSR for SEO** — Product pages are pre-rendered on the server for search engine indexing
2. **Server Components** — Data fetching on the server reduces client JavaScript by 40%+
3. **Streaming** — Loading UI streams as data arrives, improving perceived performance
4. **API Routes** — BFF (Backend-for-Frontend) pattern — Next.js proxies to NestJS backend

### Q30: Explain your state management strategy.
**A**: Two-layer approach:
- **Server State (TanStack Query)**: All data from the API — products, orders, wallet. Handles caching, deduplication, background refetch, optimistic updates.
- **Client State (Zustand)**: Local-only state — cart UI interactions, chat messages, toggle states. Lightweight stores with TypeScript support, no boilerplate.

Why not Redux? Zustand has 80% fewer lines of code and doesn't need actions/reducers/selectors for simple state.

### Q31: How do you handle real-time updates?
**A**: Socket.io WebSocket connection from the frontend to a NestJS WebSocket Gateway. Events flow:
```
Backend event → Kafka → WebSocket Bridge → Socket.io Server → Client
```
Event types: order status changes, recommendation updates, approval request notifications, wallet balance updates, price alerts. TanStack Query's cache invalidation is triggered by WebSocket events for instant UI updates.

### Q32: How does the shopping assistant chat work?
**A**: 
1. User types message → POST /api/chat
2. Backend detects intent (keyword matching + LLM fallback)
3. Based on intent:
   - `product_search`: Triggers product aggregation → ranking → returns top results
   - `order_status`: Queries user's orders → formats status
   - `price_check`: Looks up current prices
   - `comparison`: Side-by-side product comparison
4. Response rendered in `<ChatWindow>` component with product cards, status badges, etc.

---

# SECTION G: PERFORMANCE & SCALABILITY

### Q33: What's your caching strategy?
**A**: Redis 7 with cache-aside pattern. Product search caches at 1-hour TTL (search results change slowly). Recommendations at 30 minutes (personalized, regenerated by ML). Rate limits at 1 minute (per-IP). Feature flags at 5 minutes (rarely changed). Cache warm-up on service start for popular products. Cache invalidation on writes (database write → delete cache key → next read repopulates).

### Q34: How do you handle API performance?
**A**: 
- **Connection pooling**: Prisma manages 10-50 DB connections
- **Redis caching**: 90%+ cache hit rate on product queries
- **Kafka async processing**: Heavy operations (ML, aggregation) are event-driven, not blocking HTTP requests
- **Response streaming**: Next.js Server Components stream partial renders
- **Pagination**: All list endpoints use cursor-based pagination
- **Indexing**: Prisma `@@index` on frequently queried columns

### Q35: How would you benchmark this system?
**A**: We have k6 load tests (`performance-tests/k6-load-test.js`) that simulate:
- 200 concurrent users browsing products
- 50 concurrent users adding to cart
- 20 concurrent checkout flows
- 10 autonomous buy requests

Metrics tracked: p95 latency, throughput (req/sec), error rate, Kafka consumer lag.

---

# SECTION H: DEVOPS & DEPLOYMENT

### Q36: Describe the deployment architecture.
**A**: 
- **Development**: Docker Compose — all 7 services + infra in one command
- **Staging/Production**: Kubernetes with Helm charts
  - API: 3-10 pods (HPA on CPU)
  - Web: 2-5 pods (HPA on CPU)
  - AI Service: 2-5 pods (HPA on custom metrics)
  - Stateful services: PostgreSQL and Kafka as StatefulSets with PVCs
  - Ingress: Nginx with TLS termination

### Q37: How do you handle environment configuration?
**A**: 
- Docker Compose: `.env` files with defaults
- Kubernetes: ConfigMaps (non-sensitive) + Secrets (sensitive)
- NextAuth/JWT secrets: Kubernetes Secrets (base64 encoded)
- LLM API keys: Kubernetes Secrets with strict RBAC
- No secrets in code or Docker images

---

# SECTION I: STAFF ENGINEER LEVEL QUESTIONS

### Q38: How do you make architectural decisions?
**A**: I use a structured process:
1. **Identify the constraint** — Is it performance, developer productivity, cost, or reliability?
2. **Evaluate options** — Write a lightweight tech spec comparing 2-3 approaches
3. **Consider reversibility** — Prefer choices that are easy to reverse (e.g., swappable LLM providers)
4. **Prototype** — For uncertain decisions, build a small PoC
5. **Document the decision** — Record the decision, alternatives considered, and rationale

For DelegateCart, key decisions: Kafka over RabbitMQ (durability), NestJS over Express (module system), Prisma over TypeORM (type safety), Zustand over Redux (simplicity).

### Q39: How do you handle technical debt?
**A**: I categorize debt: 
- **Deliberate debt** (time-boxed trade-offs) — Tracked in issues with "tech-debt" label. Scheduled in regular maintenance sprints.
- **Accidental debt** (discovered during work) — Fixed if scope is small (<1 hour). Otherwise, logged.
- **Bit rot** (dependency updates) — Monthly dependency update cycle with CI validation.

In DelegateCart, examples: Feature flags currently use database storage (deliberate — LaunchDarkly integration planned). Some error handling is generic (accidental — improving to domain-specific errors).

### Q40: How do you mentor and lead a team on a project like this?
**A**: 
1. **Architecture documentation** — Detailed docs so anyone can understand the system (we have 5+ docs)
2. **Module ownership** — Each developer owns a NestJS module end-to-end
3. **Code review standards** — Focus on correctness, security, performance; not style (Prettier handles that)
4. **Pair programming** — For complex features (e.g., Kafka integration, HITL flows)
5. **Runbooks** — Documented procedures for common operations (deploy, rollback, debug)

### Q41: How do you handle cross-team dependencies?
**A**: The monorepo + Kafka architecture minimizes dependencies:
- Shared types package ensures API contracts are clear
- Kafka topics are the interfaces between services — any team can produce/consume
- Feature flags enable independent deployments
- Circuit breakers ensure one team's broken service doesn't bring down others

### Q42: What would you do differently if starting over?
**A**: Three things:
1. **GraphQL API** — For frontend flexibility. REST forces over-fetching or custom endpoints.
2. **Schema registry** — Kafka events lack schema validation. Avro/Protobuf schema registry would prevent breaking changes.
3. **OpenTelemetry from day 1** — Distributed tracing across all 7 services. Currently using correlation IDs which is good but OpenTelemetry would be better.

### Q43: How do you evaluate build-vs-buy decisions?
**A**: For DelegateCart:
- **Built**: Wallet system, HITL approvals, ranking engine — core differentiators, must be custom
- **Bought**: Razorpay (payments), Kafka (messaging), PostgreSQL (database) — commodity infrastructure
- **Pluggable**: LLM providers (OpenAI, Anthropic, Groq) — all supported, swap with config change

Decision framework: If it's a competitive advantage, build it. If it's infrastructure, use proven tools. If it's a commodity feature, buy/integrate.

### Q44: How do you handle incidents in production?
**A**: 
1. **Detection**: Prometheus alerts on error rate spikes, Kafka consumer lag
2. **Response**: Circuit breakers isolate failing services automatically
3. **Debugging**: Correlation IDs trace a request across all 7 services
4. **Resolution**: Feature flags disable problematic features without redeployment
5. **Post-mortem**: Document root cause, timeline, and prevention measures

---

# SECTION J: AI ARCHITECT SPECIFIC QUESTIONS

### Q45: How do you evaluate AI/ML model performance?
**A**: For the recommendation engine:
- **Precision@K** — Of the top K recommendations, how many did the user engage with?
- **Click-through rate** — How often recommended products are clicked
- **Conversion rate** — Recommendations that led to purchases
- **A/B testing** — Feature flags enable comparing recommendation algorithms

For the autopilot decision engine:
- **Approval rate** — How often HITL-reviewed decisions are approved (target: >80%)
- **Reversal rate** — How often auto-executed decisions are cancelled/returned (target: <5%)

### Q46: How do you handle cold-start for new users?
**A**: Three strategies:
1. **Zero-party data collection** — `ZeroPartyDataService` proactively asks users about preferences (categories, brands, budget) during onboarding
2. **Popular items fallback** — New users see trending/featured products until behavior data accumulates
3. **Demographic-based** — If user provides profile info, we use cohort-level preferences

The system transitions from cold-start to personalized within ~10 interactions.

### Q47: How would you add a new ML model?
**A**: The architecture makes this straightforward:
1. Create new Kafka consumer for relevant events
2. Implement model in Python (FastAPI microservice)
3. Publish results to a new Kafka topic
4. Consuming services pick up the new signals
5. Feature flag to control rollout

Completely decoupled from existing services.

### Q48: How do you handle AI bias in product recommendations?
**A**: 
- **Diversity constraints** — Recommendations include products from multiple brands/sellers, not just the highest-scoring
- **Exploration vs exploitation** — 20% of recommendations are from outside the user's usual categories
- **Audit logging** — Every recommendation is logged with scoring breakdown for bias analysis
- **A/B testing** — Feature flags enable comparing diverse vs. focused recommendation strategies

### Q49: What's your approach to LLM integration?
**A**: Pluggable provider architecture with fallback chain:
```
Primary: Anthropic Claude 3 (high quality, reasoning)
Fallback 1: OpenAI GPT-4 (reliable, widely available)
Fallback 2: Google Gemini (cost-effective)
Fallback 3: Groq/OpenRouter (latency-optimized)
```
Each provider implements the same interface. Selection is config-driven. Timeouts and circuit breakers prevent LLM failures from blocking the pipeline.

### Q50: How do you ensure responsible AI?
**A**: 
1. **Explainability** — Every decision has structured reasoning stored and displayed
2. **Human-in-the-loop** — Medium-confidence decisions require approval
3. **Spending limits** — Hard caps on AI spending (daily, monthly, per-order)
4. **Audit trail** — Complete log of every AI action with performer field
5. **Opt-in** — Users must explicitly enable AI spending
6. **Confidence transparency** — Users see the confidence score and risk level
7. **Easy override** — Users can approve/reject any AI decision

---

# SECTION K: CODING & IMPLEMENTATION

### Q51: How does the Prisma schema migration work?
**A**: Prisma uses declarative migrations. We modify `schema.prisma`, run `prisma migrate dev`, and Prisma generates SQL migration files. In production, `prisma migrate deploy` runs pending migrations. The migration history is stored in `prisma/migrations/` (version controlled). We also have custom migration scripts in `scripts/` for data-level changes.

### Q52: How do you structure a NestJS module?
**A**: Each module follows the pattern:
```
module/
├── module-name.module.ts        # Module definition
├── module-name.controller.ts    # HTTP routes
├── module-name.service.ts       # Business logic
├── module-name.entity.ts        # Prisma model interfaces
├── dto/
│   └── module-name.dto.ts       # Request/response DTOs with validation
└── module-name.spec.ts          # Unit tests
```
Modules export their service for cross-module injection. DTOs use `class-validator` decorators for automatic validation.

### Q53: How does the checkout flow handle payment failure?
**A**: Saga pattern with compensating transactions:
1. **Hold wallet funds** — `WalletTransaction(type: 'hold')`
2. **Initiate Razorpay payment** — Create payment intent
3. **If webhook confirms success**: Convert hold to debit, create confirmed order
4. **If webhook reports failure**: Release hold, mark order as failed, redirect to `/checkout-failures` page where user can retry
5. **If no webhook within timeout**: Background job checks payment status, releases hold if abandoned

### Q54: How do you implement feature flags?
**A**: Database-backed with Redis cache:
```typescript
async isEnabled(flagName: string, userId?: number): Promise<boolean> {
  const flag = await this.redis.getOrSet(`feature:${flagName}`, 300, 
    () => this.prisma.featureFlag.findUnique({ where: { name: flagName } })
  );
  if (!flag || !flag.isEnabled) return false;
  if (flag.targetUserIds?.includes(userId)) return true;
  if (flag.rolloutPercentage < 100) {
    return (userId % 100) < flag.rolloutPercentage;  // Consistent hashing
  }
  return true;
}
```
Gradual rollout uses modulo-based consistent hashing so the same user always sees the same flag state.

---

# SECTION L: BEHAVIORAL & LEADERSHIP

### Q55: Tell me about a difficult technical decision you made.
**A**: Choosing between orchestration (Saga orchestrator) and choreography (event-driven) for the autonomous shopping flow. Orchestration gives central control but creates a bottleneck. Choreography is resilient but harder to debug. I chose choreography because: (1) services can evolve independently, (2) no single point of failure, (3) Kafka's durable log enables replay for debugging. The trade-off was addressed by implementing comprehensive correlation ID tracking and structured logging.

### Q56: How do you handle disagreements about technical approach?
**A**: Data-driven discussion. I'd build a comparison matrix: latency, reliability, developer experience, operational complexity, cost. If numbers are close, I prefer reversibility — choose the option that's easier to change later. For DelegateCart, I documented all architectural decisions in ARCHITECTURE.md for transparency.

### Q57: How do you stay current with AI/ML advances?
**A**: 
- Follow key papers (Attention is All You Need, RAG, ReAct agents)
- Use multiple LLM providers (practical experience with GPT-4, Claude, Gemini)
- Build projects that exercise new patterns (autonomous agents, tool use)
- Read engineering blogs from companies doing similar work (Shopify, Instacart, Amazon)

---

# SECTION M: RAPID-FIRE TECHNICAL QUESTIONS

### Q58: Difference between Server Components and Client Components in Next.js?
**A**: Server Components render on the server, produce zero client-side JavaScript, and can directly access databases. Client Components render on the client, can use hooks (useState, useEffect), and handle user interactions. Pattern: Server Component fetches data, passes as props to Client Component.

### Q59: How does Prisma handle connection pooling?
**A**: Prisma maintains a pool of database connections (default 5, configurable). When a query is made, it borrows a connection from the pool, executes, and returns it. This prevents running out of PostgreSQL connections under load.

### Q60: What is a Kafka consumer group?
**A**: A set of consumers that cooperatively consume from a topic. Each partition is assigned to exactly one consumer in the group. This enables parallel processing — 3 partitions + 3 consumers = 3x throughput. If a consumer dies, its partitions are rebalanced to surviving consumers.

### Q61: Explain NestJS guards vs interceptors.
**A**: **Guards** decide if a request should proceed (return true/false). Used for auth, role checks. Run before route handler. **Interceptors** add extra logic before/after the handler. Used for logging, response transformation, caching. Can modify input/output.

### Q62: What is the BFF pattern?
**A**: Backend-for-Frontend. Next.js API routes act as a proxy layer between the browser and NestJS. Benefits: (1) Aggregates multiple backend calls into one frontend call, (2) Server-side authentication (tokens never reach browser), (3) Response shaping specific to UI needs.

### Q63: How does Redis pub/sub differ from Kafka?
**A**: Redis pub/sub is fire-and-forget — if no subscriber is listening, the message is lost. Kafka persists messages on disk — consumers can read old messages. We use Kafka for critical events (orders, payments) and Redis for ephemeral signals (cache invalidation, real-time notifications).

### Q64: What is the Adapter Pattern?
**A**: Converts one interface to another. In our ACP, each merchant (Amazon, Flipkart) has a different API. The adapter wraps each API behind a common `MerchantAdapter` interface with `search()`, `getQuote()`, `checkout()` methods. The ACP Gateway works with the interface, not specific implementations.

### Q65: How do you handle database N+1 queries?
**A**: Prisma's `include` and `select` for eager loading. Instead of fetching orders then looping to fetch items, we use:
```typescript
prisma.order.findMany({ include: { items: { include: { product: true } } } })
```
This generates optimized JOINs rather than N+1 queries.

---

# SECTION N: ADDITIONAL ADVANCED QUESTIONS

### Q66-Q75: System Design Questions
**Q66**: How would you add a notification service? → New Kafka consumer on `notification-events` topic, separate service with channels (email, push, SMS).

**Q67**: How would you add product reviews? → New Prisma model `Review(userId, productId, rating, text)`, new module, Kafka event for real-time rating updates.

**Q68**: How would you implement a recommendation API for third parties? → Rate-limited REST API with API keys, standard output format, webhook callbacks for async results.

**Q69**: How would you add multi-currency support? → Currency field on products, exchange rate service, wallet per currency, conversion at checkout.

**Q70**: How would you implement A/B testing? → Already have feature flags with rollout%. Add experiment tracking: assign user to variant, log variant in events, compare metrics.

**Q71**: How would you handle Black Friday traffic (10x)? → Pre-scale Kubernetes pods, increase Kafka partitions, pre-warm Redis caches, feature flag non-essential features, queue checkout with priority.

**Q72**: How would you add search auto-suggestions? → Elasticsearch/TypeSense for fuzzy matching, Redis for recent searches, debounced API calls from frontend.

**Q73**: How would you implement order returns? → New order status `return_requested`, return reason flow, wallet refund via compensating transaction, inventory update.

**Q74**: How would you secure the AI service? → mTLS between services, API key authentication, request signing, rate limiting, IP whitelisting in production.

**Q75**: How would you implement real-time inventory? → Kafka `inventory-events` topic, eventual consistency with Redis cache, stock reservation service with TTL holds.

### Q76-Q100: General Knowledge
**Q76**: Explain CAP theorem. → Consistency, Availability, Partition tolerance — can only guarantee 2 of 3. DelegateCart prioritizes AP (available + partition-tolerant) with eventual consistency via Kafka.

**Q77**: What is event sourcing? → Storing every state change as an immutable event (Kafka log). Current state is derived by replaying events. Benefits: audit trail, temporal queries, debugging.

**Q78**: Difference between horizontal and vertical scaling? → Horizontal: add more machines (Kubernetes pods). Vertical: bigger machine. DelegateCart uses horizontal for API/web, vertical for PostgreSQL.

**Q79**: What is a dead letter queue? → A Kafka topic where failed messages are sent after N retries. Enables manual review without blocking the consumer.

**Q80**: What is eventual consistency? → After a write, reads may return stale data temporarily, but will converge to the latest value. Our Redis cache has eventual consistency with PostgreSQL (controlled via TTL).

### Q81-Q100: More Implementation Questions
**Q81**: How do WebSockets scale? → Redis adapter for Socket.io enables multi-node WebSocket clusters. Each node publishes to Redis pub/sub, all nodes receive and emit.

**Q82**: What is a correlation ID? → A unique identifier attached to every request, propagated across all services. Enables tracing a single user action through 7 microservices.

**Q83**: How do you handle time zones? → All timestamps in UTC (PostgreSQL, Kafka). Conversion to user's timezone happens in the frontend.

**Q84**: What is content-based routing in Kafka? → Using message keys to route events to specific partitions. We use `userId` as key so all events for a user go to the same partition, maintaining order.

**Q85**: How do you handle partial failures? → Circuit breakers isolate failing services. Fallback responses for degraded mode. Kafka ensures events aren't lost during outages.

**Q86**: What is the strangler pattern? → Gradually replacing a monolith by routing traffic to new microservices. If DelegateCart started as a monolith, we'd extract modules into services incrementally.

**Q87**: How do you test microservices? → Unit tests per service, contract tests for API boundaries, integration tests with Docker Compose, E2E tests as smoke checks.

**Q88**: What is a sidecar pattern? → Deploying a helper container alongside the main container. Example: Envoy proxy sidecar for mTLS, observability.

**Q89**: How do you handle schema evolution in Kafka? → Use schema registry (Avro/Protobuf). Currently using JSON — schema changes must be backward-compatible (add fields, don't remove).

**Q90**: What is blue-green deployment? → Two production environments (blue/green). Deploy to inactive, test, then switch traffic. Zero-downtime deployment.

**Q91**: How would you implement rate limiting per user? → Redis `INCR` on key `ratelimit:{userId}:{endpoint}` with `EXPIRE`. Check count against limit.

**Q92**: What is backpressure? → When a consumer can't keep up with producer rate. Kafka handles this naturally — unconsumed messages stay in the log. Consumer processes at its own pace.

**Q93**: How do you handle database connection limits? → Prisma connection pool (default 5, max 50), pgBouncer for production, connection timeout with retry.

**Q94**: What is an API gateway? → A single entry point that routes requests to microservices. NestJS API serves as our gateway with rate limiting, auth, and routing.

**Q95**: How would you implement multi-tenancy? → Add `tenantId` to all models, row-level security in PostgreSQL, tenant isolation in Redis keys.

**Q96**: What is CQRS? → Command Query Responsibility Segregation. Separate models for reads (optimized for queries) and writes (optimized for consistency). Our ranking engine is read-optimized; order creation is write-optimized.

**Q97**: How do you handle long-running operations? → Kafka async processing. User submits buy request (fast), processing happens asynchronously across microservices, result pushed via WebSocket.

**Q98**: What is an anti-corruption layer? → A translation layer between your system and external systems (like Amazon/Flipkart APIs). Our merchant adapters serve this purpose.

**Q99**: How would you implement distributed caching? → Redis Cluster with consistent hashing. Same key always maps to same node. Replication for read scaling.

**Q100**: What is the outbox pattern? → Write to database + outbox table in same transaction. A relay process reads outbox and publishes to Kafka. Ensures at-least-once delivery without distributed transactions.
