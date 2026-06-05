# DelegateCart — Technical Architecture Deep Dive

## For Staff Engineer & AI Architect Interview Preparation

---

## 1. Executive Summary

**DelegateCart** is an AI-powered autonomous commerce platform built using a modern microservices architecture. It enables intelligent, delegated shopping — where AI agents can autonomously discover products, make purchase decisions, and execute checkout flows on behalf of users, governed by configurable rules, spending limits, and human-in-the-loop approval workflows.

**Key Differentiator**: Unlike traditional e-commerce platforms, DelegateCart introduces an **Agentic Commerce Protocol (ACP)** — a standardized protocol enabling AI shopping agents to interact with multiple merchant APIs (Amazon, Flipkart, internal sellers) through a unified adapter layer, with built-in safety guardrails, fraud detection, and explainable AI decision-making.

---

## 2. High-Level Architecture

### 2.1 Architecture Pattern: Event-Driven Microservices

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                  │
│   Next.js 14 (SSR + App Router) │ React 18 │ Tailwind │ Zustand    │
│   WebSocket (Socket.io) │ TanStack Query │ NextAuth                 │
└──────────────┬──────────────────┬──────────────────────────────────┘
               │ REST/WS          │ SSR
┌──────────────▼──────────────────▼──────────────────────────────────┐
│                        API GATEWAY LAYER                            │
│         NestJS 10 (Node.js 20+) │ Port 3001                        │
│   JWT Auth │ RBAC │ Rate Limiting │ CSRF │ Correlation IDs         │
│   Circuit Breaker │ Idempotency │ Request Timeout                  │
└──────┬──────────┬──────────────┬───────────┬──────────────────────┘
       │          │              │           │
       ▼          ▼              ▼           ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐
│PostgreSQL│ │  Redis   │ │  Kafka   │ │  AI Service      │
│ 16-alpine│ │ 7-alpine │ │  7.5.0   │ │  FastAPI/Python  │
│  (Prisma │ │ (Cache + │ │ (Event   │ │  Port 8000       │
│   ORM)   │ │ Sessions)│ │ Streams) │ │                  │
└──────────┘ └──────────┘ └────┬─────┘ └──────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
     ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
     │Intent Parser │ │  Product     │ │Product Ranking    │
     │(FastAPI/Py)  │ │ Aggregator   │ │Engine (FastAPI)   │
     │ NLP + LLMs   │ │(FastAPI/Py)  │ │ML Scoring         │
     └──────────────┘ └──────────────┘ └──────────────────┘
              │                │                │
              ▼                ▼                ▼
     ┌──────────────────────────────────────────────┐
     │           Autopilot Engine (NestJS)           │
     │  Rule Engine │ Decision Engine │ Safety Layer │
     │  Explainability │ HITL Approvals              │
     └──────────────────────────────────────────────┘
```

### 2.2 Architecture Decisions & Rationale

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Monorepo** | Turborepo + pnpm | Shared types, atomic deployments, dependency deduplication |
| **API Framework** | NestJS | Module-based architecture for enterprise-grade DI, guards, interceptors |
| **Frontend** | Next.js 14 App Router | SSR for SEO, Server Components, streaming, built-in API routes |
| **ORM** | Prisma 7.5 | Type-safe queries, migration management, connection pooling |
| **Event Bus** | Apache Kafka | Durable event log, replay capability, ordered partitioning |
| **AI Runtime** | FastAPI (Python) | ML ecosystem compatibility (scikit-learn, numpy, pandas) |
| **Cache** | Redis 7 | Sub-millisecond latency, TTL support, pub/sub for real-time |
| **State Mgmt** | Zustand | Minimal boilerplate vs Redux, excellent TypeScript support |

---

## 3. Service Architecture Detail

### 3.1 NestJS API Service (Core Backend)

**Responsibilities**: Authentication, authorization, business logic orchestration, data persistence, event publishing

**Module Architecture**:
```
AppModule (Root)
├── AuthModule          → JWT login/register, bcrypt hashing
├── ProductModule       → Product CRUD, search, filtering
├── CartModule          → Shopping cart operations
├── OrderModule         → Order lifecycle management
├── CheckoutModule      → Multi-step checkout validation
├── WalletModule        → Digital wallet, spending limits
├── PaymentModule       → Razorpay integration, webhooks
├── BuyRequestModule    → Smart purchase requests
├── AIMemoryModule      → User behavior & preference storage
├── AIChatModule        → Shopping assistant conversations
├── AIExecutionModule   → AI-powered order execution
├── AgentModule         → Shopping agent orchestration
├── SellerCopilotModule → AI seller analytics & tools
├── ACPModule           → Agentic Commerce Protocol
├── FeatureFlagModule   → Feature toggles & A/B testing
├── AddressModule       → User address management
├── KafkaModule         → Event streaming producer/consumer
├── WebSocketModule     → Real-time communication gateway
└── CoreServicesModule  → Shared infrastructure services
    ├── HITLApprovalService
    ├── WalletSecurityService
    ├── WalletFraudDetectionService
    ├── VerificationLayerService
    ├── ZeroPartyDataService
    ├── ObservabilityService
    ├── DecisionGuardrailEngine
    ├── RetryUtilityService
    ├── CircuitBreakerService
    ├── IdempotencyKeyService
    ├── MetricsService
    └── StructuredLoggerService
```

**Request Pipeline**:
```
Incoming Request
    → CorrelationIdMiddleware (assign trace ID)
    → RateLimitMiddleware (token bucket)
    → TimeoutMiddleware (30s default)
    → IdempotencyMiddleware (prevent duplicates)
    → JwtGuard (authentication)
    → RBACGuard (authorization)
    → CSRFGuard (cross-site protection)
    → LoggingInterceptor (request/response logging)
    → Controller Handler
    → Service Layer
    → Prisma ORM → PostgreSQL
    → Kafka Producer (emit events)
    → Response with correlation ID
```

### 3.2 Next.js Web Application (Frontend)

**Key Architecture Patterns**:

1. **App Router with Server Components**: Leveraging React Server Components for data fetching at the server level, reducing client-side JavaScript bundle
2. **API Route Handlers**: Backend-for-frontend (BFF) pattern — Next.js API routes proxy to NestJS backend for SSR data requirements
3. **Client State with Zustand**: Lightweight stores for client-only state (cart UI, chat messages, user preferences)
4. **Server State with TanStack Query**: Caching, deduplication, and background refresh of server data
5. **WebSocket Integration**: Socket.io client for real-time order updates, live recommendations
6. **NextAuth**: Session management with JWT strategy

**Page Categories**:
- **Public Pages**: Home, Products, About, Features, Pricing, Blog, Press, Contact, Privacy, Terms
- **Auth Pages**: Sign In, Sign Up, Forgot Password
- **Shopping Pages**: Cart, Checkout, Orders, Wishlist, Price Alerts
- **AI Pages**: Shopping Assistant, AI Preferences, Smart Delegate, Purchase Predictor, Copilot, Memory, Insights
- **Financial Pages**: Wallet, Budget Tracker, Spending, Payment Methods
- **Admin Pages**: Admin Dashboard, Learning Metrics, Observability

### 3.3 AI Service (FastAPI/Python)

**Responsibilities**: ML-powered recommendations, event processing, behavior tracking, chat service

**Architecture**:
```
FastAPI Application
├── Event Consumer Layer (Kafka)
│   ├── KafkaEventConsumer      → Consumes from multiple topics
│   └── AsyncEventConsumer      → Non-blocking event processing
├── Service Layer
│   ├── UserBehaviorTracker     → Track views, clicks, abandonments
│   ├── OrderEventProcessor     → Process order lifecycle events
│   ├── RecommendationEngine    → Generate personalized recommendations
│   └── ChatService             → NLP-powered chat with intent detection
├── API Layer
│   ├── GET /recommend/{userId} → Personalized recommendations
│   ├── GET /user-profile/{userId} → User behavior profile
│   ├── POST /chat              → Conversational shopping
│   ├── POST /feedback          → Feedback collection
│   └── GET /stats              → Service metrics
└── Data Layer
    └── In-memory stores + Redis cache
```

### 3.4 Autopilot Engine

**Purpose**: Autonomous purchase execution governed by user-defined rules

**Components**:
```
Autopilot Engine
├── RuleEngine              → Evaluate complex conditions
│   ├── Price conditions    → price <= 15000
│   ├── Category matching   → category == "electronics"
│   ├── Brand filtering     → brand in ["Samsung", "Apple"]
│   ├── Quality thresholds  → rating >= 4.5
│   ├── Stock checks        → stock > 5
│   └── Time windows        → hour between 9-17
├── DecisionEngine          → Multi-factor confidence scoring
│   ├── Rule match score
│   ├── Historical success rate
│   ├── Price stability analysis
│   └── Risk assessment
├── SafetyLayer             → Guardrails & limits
│   ├── Daily spend limits
│   ├── Per-order limits
│   ├── Anomaly detection
│   └── Rate limiting
├── ExplainabilityLayer     → Decision transparency
│   ├── Factor breakdown
│   ├── Reasoning chain
│   └── Confidence justification
└── HITL Integration        → Human-in-the-loop
    ├── Approval requests
    ├── 24-hour TTL
    └── Notification channels
```

### 3.5 Intent Parser Service

**Purpose**: NLP-powered extraction of shopping intent from natural language

**Pipeline**:
```
User Input: "Find me a good Samsung phone under 30k"
    → LLM Processing (GPT-4 / Claude 3)
    → Category Normalization → "smartphones"
    → Brand Extraction → ["Samsung"]
    → Budget Parsing → { max: 30000, currency: "INR" }
    → Quality Inference → rating >= 4.0
    → Keyword Enrichment → ["samsung", "phone", "smartphone", "mobile"]
    → Budget Clarity Score → 0.95
    → Publish to Kafka: intent.processed
```

### 3.6 Product Aggregator

**Purpose**: Multi-source product search with unified ranking

**Architecture**:
```
Search Request
    → Redis Cache Check (1-hour TTL)
    → If MISS:
        → Parallel Source Queries:
            ├── Internal DB Adapter
            ├── Amazon API Adapter
            ├── Flipkart API Adapter
            └── Fallback Mock Adapter
        → Unified Product Schema Mapping
        → Relevance Scoring
        → Cache Result
    → Return Ranked Products
```

### 3.7 Product Ranking Engine

**Purpose**: ML-powered scoring with weighted multi-factor analysis

**Scoring Algorithm**:
```
Final Score = Σ (Weight_i × Factor_i)

Factors:
├── Budget Fit (25%)     → |price - budget| / budget
├── Quality Score (25%)  → brand_reputation × feature_score × build_quality
├── Brand Pref (20%)     → user_brand_history × brand_match
├── Delivery (15%)       → 1 / delivery_days × urgency_factor
└── Ratings (15%)        → avg_rating × confidence(review_count)
```

---

## 4. Data Architecture

### 4.1 Database Design (PostgreSQL + Prisma)

**Core Domain Models**:

| Model | Fields | Purpose |
|-------|--------|---------|
| `User` | id, email, name, passwordHash, role, subscriptionPlan | User identity & access |
| `Product` | id, name, price, category, description, imageUrl, featured | Product catalog |
| `ProductBusinessMetrics` | margin, inventory, salesVelocity, conversion, returnRate | Business intelligence |
| `Cart` / `CartItem` | userId, productId, quantity | Shopping cart |
| `Order` / `OrderItem` | userId, total, status, tracking | Order management |
| `Wallet` | balance, maxPerOrder, dailyLimit, isAiAuthorized, isLocked | Digital wallet |
| `WalletTransaction` | type, amount, balanceBefore, balanceAfter, ipAddress | Transaction audit |
| `WalletSpendingLimit` | limitType, amount, startDate, endDate | Spending controls |
| `WalletAuditLog` | action, performer, changesBefore, changesAfter | Audit trail |
| `AutopilotRule` | userId, conditions, action, maxSpendPerMonth | Automation rules |
| `AutopilotDecision` | confidence, reasoning, riskLevel, requiresApproval | AI decisions |
| `ApprovalRequest` | status, reason, expiresAt | HITL approvals |
| `FeatureFlag` | name, isEnabled, rolloutPercentage, targetUserIds | Feature toggles |
| `ChatMessage` | userId, role, content, intent, extractedKeywords | Conversation history |
| `BuyRequest` | budget, quality, brand, delivery, autoExecute | Purchase requests |
| `UserPreferences` | categories, brands, priceRanges, features | Preferences |
| `BuyingPattern` | frequency, patterns, trends | Behavior analysis |
| `UserMemory` | behavior/preference history | AI memory store |
| `MemoryInsight` | generated insights | AI insights |
| `Seller` | store info, metrics, AI settings | Seller profiles |
| `SellerProduct` | listings, performance metrics | Seller inventory |

### 4.2 Caching Strategy (Redis)

```
Cache Layer Strategy:
├── Product Cache          → Key: product:{id}, TTL: 1 hour
├── Search Cache           → Key: search:{query_hash}:{userId}, TTL: 1 hour
├── User Session           → Key: session:{token}, TTL: configurable
├── Rate Limit Counters    → Key: ratelimit:{ip}:{endpoint}, TTL: 1 minute
├── Idempotency Keys       → Key: idempotent:{key}, TTL: 24 hours
├── Feature Flags          → Key: feature:{name}, TTL: 5 minutes
├── Recommendation Cache   → Key: recommend:{userId}, TTL: 30 minutes
└── Circuit Breaker State  → Key: circuit:{service}, TTL: configurable
```

### 4.3 Event Schema (Kafka)

**Topic Design**:

| Topic | Partition Count | Consumer Group | Purpose |
|-------|----------------|----------------|---------|
| `commerce-events` | 3 | ai-service, autopilot | Orders, cart updates |
| `user-behavior` | 3 | ai-service | Views, clicks, abandonments |
| `product-events` | 3 | ai-service, aggregator | Product updates |
| `ml-events` | 3 | ai-service | ML model outputs |
| `analytics` | 3 | analytics-service | Business metrics |
| `recommendations` | 3 | web-bridge | Generated recommendations |
| `intent.processed` | 3 | aggregator, ranking | Parsed intents |
| `products.fetched` | 3 | ranking-engine | Aggregated products |
| `products.ranked` | 3 | autopilot-engine | Ranked products |
| `autopilot.triggered` | 3 | autopilot-engine | Rule triggers |
| `autopilot.executed` | 3 | api-service | Execution results |

---

## 5. Security Architecture

### 5.1 Authentication Flow

```
User Credentials
    → POST /auth/login
    → Bcrypt.compare(password, hash)  [10 salt rounds]
    → Generate JWT { userId, email, role }
    → Set secure HTTP-only cookie + return token
    → Client stores token for API calls
    → JWT verified on every protected endpoint
```

### 5.2 Authorization Model (RBAC)

```
7-Role Hierarchy:
├── Admin         → Full access + user management
├── Analytics     → Viewing + analytics dashboards
├── AI Plus       → Shopping + AI features
├── Observability → System monitoring
├── Reinforced Learning → Learning system
├── Basic         → Core shopping
└── Customer      → Public pages only

Subscription Tiers:
├── AI_PLUS → Access to autonomous shopping, AI chat, predictions
└── BASIC   → Standard e-commerce features
```

### 5.3 Security Middleware Stack

```
Layer 1: Rate Limiting      → Token bucket algorithm, per-IP
Layer 2: CORS               → Explicit origin whitelist
Layer 3: CSRF Guard         → Token verification
Layer 4: Request Timeout    → 30-second default
Layer 5: JWT Verification   → RS256/HS256 signature validation
Layer 6: RBAC Guard         → Role-based endpoint access
Layer 7: Input Validation   → class-validator + class-transformer
Layer 8: SQL Injection      → Prisma parameterized queries
Layer 9: XSS Prevention     → Content-Security-Policy headers
```

### 5.4 AI Safety Guardrails

```
Decision Guardrail Engine:
├── Budget Verification     → Check wallet balance + spending limits
├── Anomaly Detection       → Unusual purchase patterns
├── Fraud Risk Scoring      → Transaction velocity, amount patterns
├── Confidence Thresholds   → Minimum confidence for auto-execute
├── HITL Trigger Rules      → When to require human approval
├── Account Lockout         → Auto-lock on detected fraud
└── Audit Trail             → Every decision logged with reasoning
```

---

## 6. Scalability Architecture

### 6.1 Horizontal Scaling

```
┌─────────────────────────────────────────┐
│           Load Balancer (Nginx)          │
└────────┬────────┬────────┬─────────────┘
         ▼        ▼        ▼
    ┌─────────┐ ┌─────┐ ┌─────────┐
    │ Web (N) │ │API(N)│ │AI Svc(N)│
    └─────────┘ └─────┘ └─────────┘
         │        │        │
    ┌────▼────────▼────────▼────┐
    │    Kafka Cluster (3+)      │
    └────────────┬──────────────┘
         ┌───────┼───────┐
         ▼       ▼       ▼
    ┌─────────┐ ┌─────┐ ┌──────┐
    │Postgres │ │Redis │ │Redis │
    │(Primary)│ │(Prim)│ │(Repl)│
    └─────────┘ └─────┘ └──────┘
```

### 6.2 Performance Patterns

| Pattern | Implementation | Impact |
|---------|---------------|--------|
| **Connection Pooling** | Prisma connection pool (10-50 connections) | Prevents DB exhaustion |
| **Redis Caching** | Multi-layer cache with TTL | 90%+ cache hit rate |
| **Event Sourcing** | Kafka durable log | Replay events, audit |
| **Circuit Breaker** | Per-service circuit breaker | Prevent cascade failures |
| **Idempotency** | Redis-backed key store | Safe retries |
| **Batch Processing** | Kafka consumer groups | Parallel event processing |
| **WebSocket** | Socket.io with Kafka bridge | Real-time without polling |

### 6.3 Observability

```
Observability Stack:
├── Structured Logging    → JSON logs with correlation IDs
├── Prometheus Metrics    → GET /metrics endpoint
│   ├── Request count/duration histograms
│   ├── Kafka consumer lag
│   ├── Cache hit/miss ratios
│   ├── Circuit breaker state
│   └── Business metrics
├── Health Checks         → GET /health (deep + shallow)
└── Tracing               → Correlation ID propagation
```

---

## 7. Deployment Architecture

### 7.1 Docker Compose (Development)

```yaml
Services:
  postgres:16-alpine    → Port 5432, persistent volumes
  redis:7-alpine        → Port 6379, persistent volumes
  zookeeper:7.5.0       → Port 2181, Kafka coordination
  kafka:7.5.0           → Ports 9092/29092, event streaming
  api (NestJS)          → Port 3001, depends on postgres+redis+kafka
  web (Next.js)         → Port 3000, depends on api
  ai-service (FastAPI)  → Port 8000, depends on kafka+redis
```

### 7.2 Kubernetes (Production)

```
Namespace: delegatecart
├── Deployments
│   ├── api-deployment        (replicas: 3, HPA: 3-10)
│   ├── web-deployment        (replicas: 2, HPA: 2-5)
│   ├── ai-service-deployment (replicas: 2, HPA: 2-5)
│   ├── autopilot-deployment  (replicas: 1)
│   ├── intent-parser         (replicas: 1)
│   ├── product-aggregator    (replicas: 1)
│   └── ranking-engine        (replicas: 1)
├── StatefulSets
│   ├── postgres-statefulset  (replicas: 1, PVC: 20Gi)
│   ├── redis-statefulset     (replicas: 1)
│   └── kafka-statefulset     (replicas: 3)
├── Services
│   ├── api-service           (ClusterIP, port 3001)
│   ├── web-service           (ClusterIP, port 3000)
│   └── ai-service            (ClusterIP, port 8000)
├── Ingress
│   └── delegatecart-ingress  (nginx, TLS termination)
├── ConfigMaps & Secrets
└── HPA (Horizontal Pod Autoscaler)
```

---

## 8. Technology Stack Summary

### Backend
- **Runtime**: Node.js 20+, Python 3.11+
- **Frameworks**: NestJS 10, FastAPI 0.104
- **ORM**: Prisma 7.5 with PostgreSQL adapter
- **Auth**: JWT + Bcrypt + NextAuth
- **Validation**: class-validator, class-transformer, Pydantic

### Frontend
- **Framework**: Next.js 14 (App Router, Server Components)
- **UI**: React 18, Tailwind CSS 3.4, Radix UI
- **State**: Zustand (client), TanStack Query (server)
- **Real-time**: Socket.io client
- **Charts**: Recharts
- **Animations**: Framer Motion

### Infrastructure
- **Database**: PostgreSQL 16 (relational), Redis 7 (cache)
- **Messaging**: Apache Kafka 7.5 (Confluent Platform)
- **Containers**: Docker, Docker Compose, Kubernetes
- **Build**: Turborepo, pnpm workspaces
- **Metrics**: Prometheus, prom-client

### AI/ML
- **LLM Providers**: OpenAI GPT-4, Anthropic Claude 3, Google Gemini, Groq, OpenRouter
- **ML Tasks**: Recommendation engine, intent parsing, product ranking, demand prediction
- **Libraries**: scikit-learn, numpy, pandas (Python ecosystem)
