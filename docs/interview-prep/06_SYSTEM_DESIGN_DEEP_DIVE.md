# System Design Deep-Dive — DelegateCart

## Staff Engineer Interview Reference

---

## 1. SYSTEM DESIGN: AUTONOMOUS SHOPPING PLATFORM

### Problem Statement
Design an AI-powered e-commerce system where users can delegate shopping tasks to autonomous agents that search, compare, and purchase products from multiple merchants.

### Functional Requirements
1. Users submit natural language buy requests ("Samsung phone under 30K")
2. AI parses intent and searches multiple merchants simultaneously
3. ML-powered ranking selects optimal products
4. Autonomous checkout within user-defined safety limits
5. Human-in-the-loop approval for uncertain decisions
6. Real-time status updates

### Non-Functional Requirements
- Latency: < 2s for search, < 5s for full buy-request processing
- Availability: 99.9% uptime
- Throughput: 10K concurrent users, 1K buy requests/minute
- Consistency: Eventual (search/recommendations), Strong (payments/wallet)
- Security: OWASP Top 10 compliance, PII protection

### High-Level Design

```
┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
│   Next.js    │───▶│   NestJS     │───▶│   PostgreSQL     │
│   Frontend   │    │   API        │    │   (Primary DB)   │
│   (SSR)      │◀──│   Gateway    │◀──│   30+ Models     │
└──────────────┘    └──────┬───────┘    └──────────────────┘
       ▲                   │                      ▲
       │              ┌────▼────┐                 │
       │              │  Kafka  │                 │
       │              │ Cluster │                 │
       │              └────┬────┘                 │
       │                   │                      │
  ┌────┴───┐    ┌─────────┼─────────┐            │
  │WebSocket│   ▼         ▼         ▼            │
  │Gateway  │ Intent   Product   Ranking         │
  │(Real-   │ Parser   Aggre    Engine           │
  │ time)   │ (Python) gator    (Python)         │
  └─────────┘          (Python)                   │
                                                   │
              ┌────────────────────┐               │
              │  Autopilot Engine  │───────────────┘
              │  (Decision + HITL) │
              └────────────────────┘
```

### Deep Dive: Data Flow

**Buy Request Flow (Critical Path)**:
```
User → API (validate + persist) → Kafka[buy_request.created]
  → Intent Parser (NLP extract) → Kafka[intent.processed]
  → Product Aggregator (parallel search 3 sources) → Kafka[products.fetched]
  → Ranking Engine (5-factor ML score) → Kafka[products.ranked]
  → Autopilot Engine (rule eval + decision) →
    IF confidence ≥ 80%: → Safety Layer → Wallet Hold → Merchant Checkout → Kafka[autopilot.executed]
    IF confidence 50-79%: → HITL ApprovalRequest → WebSocket notification → User approves/rejects
    IF confidence < 50%: → Block + notify user
```

### Deep Dive: Database Schema

**Core Entities and Relationships**:
```
User (1) ─────── (N) Order
  │                    │
  │ (1:1)              │ (1:N)
  ▼                    ▼
Wallet            OrderItem ──── Product
  │                              ▲
  │ (1:N)                        │ (N:1)
  ▼                              │
WalletTransaction           CartItem ──── Cart (1:1 User)
WalletSpendingLimit
WalletAuditLog

User (1) ────── (N) BuyRequest
User (1) ────── (N) AutopilotRule
User (1) ────── (N) AutopilotDecision
User (1) ────── (N) ApprovalRequest
User (1) ────── (N) UserMemory ──── (N) MemoryInsight
```

**Wallet Transaction State Machine**:
```
CREDIT ──→ (balance increases)
DEBIT  ──→ (balance decreases)
HOLD   ──→ DEBIT (confirmed) OR RELEASE (cancelled)
REFUND ──→ (reversal of DEBIT)
```

### Deep Dive: Scaling Strategy

**Bottleneck Analysis**:
1. **Product Aggregator** — 3 external API calls per request → Solution: Parallel execution, Redis cache (1hr TTL), circuit breakers per merchant
2. **PostgreSQL** — Single primary → Solution: Read replicas for queries, connection pooling (PgBouncer)
3. **Kafka** — Consumer lag under load → Solution: Increase partitions (12+), add consumer instances per group
4. **WebSocket** — Stateful connections → Solution: Redis adapter for Socket.io, sticky sessions

**Capacity Estimation**:
- 10K users, 100 buy requests/min
- Each request: 3 merchant searches × 50 products = 150 DB reads
- 150 × 100 = 15,000 reads/min = 250 reads/sec → Prisma pool handles this
- Kafka: 100 msgs/min × 5 topics = 500 msgs/min → Well within single-partition capacity

---

## 2. SYSTEM DESIGN: WALLET & PAYMENT SYSTEM

### Requirements
- Digital wallet with credit/debit/hold/release/refund
- AI-authorized spending with per-order, daily, weekly, monthly limits
- Fraud detection with velocity checks and amount anomaly
- Full audit trail
- Idempotent operations

### Design

**Transaction Processing**:
```
Request ──→ Idempotency Check (Redis)
  ├──→ Cache Hit: Return cached response
  └──→ Cache Miss: Process transaction
         │
         ▼
    Wallet Service
    ├── Validate balance (sufficient funds?)
    ├── Check spending limits (daily/monthly exceeded?)
    ├── Fraud detection (velocity + anomaly)
    ├── Authorization check (AI authorized?)
    │
    ├── IF ALL PASS:
    │   ├── Create WalletTransaction
    │   ├── Update Wallet.balance
    │   ├── Create WalletAuditLog
    │   └── Publish to Kafka[wallet.transaction]
    │
    └── IF ANY FAIL:
        ├── Log failure reason
        ├── If fraud: lock wallet, alert user
        └── Return 403 with reason
```

**Spending Limit Design**:
```sql
-- Per-limit check
SELECT COALESCE(SUM(amount), 0) as spent
FROM "WalletTransaction"
WHERE "walletId" = $1
  AND "type" IN ('DEBIT', 'HOLD')
  AND "createdAt" >= NOW() - INTERVAL $period
  AND "status" = 'COMPLETED';

-- Check: spent + newAmount <= limit
```

Limits cascade: per-order → daily → weekly → monthly. All must pass.

---

## 3. SYSTEM DESIGN: REAL-TIME RECOMMENDATION ENGINE

### Requirements
- Personalized product recommendations based on user behavior
- Cold-start handling for new users
- Sub-200ms response time
- Explanation for each recommendation

### Design

**Data Pipeline**:
```
User Actions (browse, cart, buy, rate)
  │
  ▼
Kafka[user-behavior] ──→ AI Service Consumer
                              │
                              ▼
                         Process events:
                         - Update category_affinity scores
                         - Update brand_preference scores
                         - Compute price_sensitivity
                         - Update collaborative signals
                              │
                              ▼
                         Store in PostgreSQL (UserMemory, MemoryInsight)
                              │
                              ▼
                         Generate recommendations:
                         score = 0.3×category + 0.25×brand + 0.25×price + 0.2×collab
                              │
                              ▼
                         Cache in Redis (30 min TTL)
                              │
                              ▼
                         Push via WebSocket
```

**Cold-Start Strategy**:
```
IF user.interactions < 10:
  Use ZeroPartyDataService (ask preferences)
  Fall back to popular/trending products
  Use demographic cohort recommendations
ELSE:
  Full personalized recommendations
```

---

## 4. SYSTEM DESIGN: AGENTIC COMMERCE PROTOCOL (ACP)

### Requirements
- Standardized interface for AI agents to transact with any merchant
- Support heterogeneous APIs (Amazon, Flipkart, internal)
- Verification layer (budget, trust, fraud)
- Idempotent operations
- Extensibility for new merchants

### Design

**Architecture**:
```
AI Agent / Autopilot Engine
         │
         ▼
┌───────────────────────────────────────┐
│           ACP Gateway                  │
│  ┌─────────────┐  ┌────────────────┐  │
│  │ Verification │  │ Idempotency    │  │
│  │ Layer        │  │ Guard          │  │
│  │ - Budget     │  │ (Redis-backed) │  │
│  │ - Trust      │  │                │  │
│  │ - Fraud      │  │                │  │
│  └──────┬──────┘  └────────────────┘  │
│         │                              │
│  ┌──────▼──────┐                       │
│  │   Router    │                       │
│  └──┬───┬───┬──┘                       │
│     │   │   │                          │
│  ┌──▼┐ ┌▼──┐ ┌▼───────┐               │
│  │AMZ│ │FK │ │Internal│               │
│  │   │ │   │ │Adapter │               │
│  └───┘ └───┘ └────────┘               │
│  (Each implements MerchantAdapter)     │
└───────────────────────────────────────┘
```

**MerchantAdapter Interface**:
```typescript
interface MerchantAdapter {
  search(query: SearchQuery): Promise<Product[]>;
  getQuote(productId: string): Promise<Quote>;
  checkout(order: CheckoutRequest): Promise<CheckoutResult>;
  getStatus(orderId: string): Promise<OrderStatus>;
}
```

Adding a new merchant = implementing 4 methods. Everything else (verification, routing, idempotency) is handled by the ACP Gateway.

---

## 5. SYSTEM DESIGN: HUMAN-IN-THE-LOOP APPROVAL

### Requirements
- AI creates approval requests for uncertain decisions
- User receives real-time notification
- User can approve/reject with one tap
- Approved actions execute automatically
- Timeout (24hr) auto-cancels pending approvals

### Design

```
Decision Engine (confidence 50-79%)
  │
  ▼
Create ApprovalRequest in DB
  │
  ▼
Publish to Kafka[approval.created]
  │
  ├──→ WebSocket Gateway ──→ Push notification to user
  │
  └──→ Timeout Worker (checks every hour)
       IF pending > 24hr: auto-cancel

User Action (approve/reject):
  │
  ▼
Update ApprovalRequest status
  │
  ├──→ IF approved: Resume Autopilot → Execute checkout
  └──→ IF rejected: Cancel buy request, log reason
```

**Key Design Decisions**:
- Approval requests stored in DB (not just Kafka) for durability
- WebSocket for push notifications (not polling)
- Timeout worker as cron job, not real-time timer (simpler, resilient to restarts)
- One-tap approve leverages saved wallet for instant execution

---

## 6. FAILURE SCENARIOS & RECOVERY

### Scenario 1: Kafka Down
- **Impact**: Events stop flowing between services
- **Detection**: Health check on Kafka broker
- **Recovery**: Messages are buffered in producer. Kafka's replication factor ensures broker restart recovers data. Short outage: no data loss. Long outage: API returns degraded mode (search only, no autonomous shopping).

### Scenario 2: AI Service Down
- **Impact**: No intent parsing, no recommendations
- **Detection**: Circuit breaker trips after 3 failures
- **Recovery**: Fallback to keyword-based search (no NLP). Circuit breaker enters half-open state after 30s cooldown.

### Scenario 3: Payment Provider Down
- **Impact**: Checkouts fail
- **Detection**: Razorpay webhook timeout
- **Recovery**: Wallet holds are released after timeout. User notified to retry. No double charges (idempotency).

### Scenario 4: Database Failover
- **Impact**: Writes fail during failover
- **Detection**: Prisma connection error
- **Recovery**: Connection pool retries. Read replicas continue serving reads. Failover completes in <30s.

### Scenario 5: Redis Down
- **Impact**: No caching, no rate limiting, no circuit breakers
- **Detection**: Redis health check
- **Recovery**: Requests go directly to DB (slower but functional). Rate limiting falls back to in-memory (per-instance, not cluster-wide).

---

## 7. TRADE-OFF ANALYSIS TABLE

| Decision | Option A | Option B | Chose | Why |
|----------|----------|----------|-------|-----|
| Communication | REST (sync) | Kafka (async) | Kafka | Durability, decoupling, replay |
| Coordination | Orchestration | Choreography | Choreography | No single point of failure |
| DB | MongoDB | PostgreSQL | PostgreSQL | ACID for financial transactions |
| ORM | TypeORM | Prisma | Prisma | Type safety, migration DX |
| Frontend | SPA (CRA) | SSR (Next.js) | Next.js | SEO, Server Components |
| State | Redux | Zustand | Zustand | Simplicity, less boilerplate |
| Cache | Memcached | Redis | Redis | Data structures, pub/sub |
| AI | Single LLM | Multi-provider | Multi-provider | Resilience, cost optimization |
| Deploy | VMs | Kubernetes | Kubernetes | Auto-scaling, self-healing |
| Monolith | Monolith | Microservices | Micro | Independent scaling/deployment |
