# DelegateCart — Functional KT (Knowledge Transfer) Documentation

## For Staff Engineer & AI Architect Interview Preparation

---

## 1. Product Vision & Problem Statement

### The Problem
Traditional e-commerce forces users into a repetitive cycle: browse → compare → add to cart → checkout. For repeat purchases, routine shopping, and known preferences, this manual process is **wasteful and inefficient**. Users spend hours doing what an AI could do in seconds — if the AI had the right context, trust boundaries, and merchant integrations.

### The Solution — DelegateCart
DelegateCart is an **AI-first commerce platform** that lets users **delegate** their shopping to intelligent agents. Users define rules ("buy Samsung phones under ₹30K with 4.5+ ratings"), set spending limits, and the platform's AI autonomously:

1. **Parses intent** from natural language
2. **Aggregates products** from multiple merchants
3. **Ranks options** using ML-powered scoring
4. **Makes decisions** with explainable confidence scores
5. **Executes purchases** within safety guardrails
6. **Seeks approval** when confidence is low or amounts exceed limits

### Target Users

| Persona | Use Case | Key Features |
|---------|----------|--------------|
| **Busy Professional** | Routine purchases (groceries, supplies) | Autopilot rules, recurring orders |
| **Tech Enthusiast** | Best deal hunting across platforms | Multi-source aggregation, price alerts |
| **Budget-Conscious Buyer** | Spending control with AI assistance | Wallet limits, budget tracker |
| **Enterprise Buyer** | Delegated procurement | RBAC, approval workflows, audit trails |
| **Seller/Merchant** | AI-powered store management | Seller Copilot, demand prediction |

---

## 2. Core Feature Modules

### 2.1 User Authentication & Identity

**Functional Flow**:
```
New User → Sign Up → Email + Password + Name
         → Bcrypt hash password
         → Assign role (customer by default)
         → Create wallet with ₹0 balance
         → Redirect to dashboard

Returning User → Sign In → Email + Password
              → Validate credentials
              → Generate JWT token
              → Load user profile & preferences
              → Redirect to dashboard (or last page)
```

**Roles & Access Matrix**:

| Feature | Admin | Analytics | AI Plus | Observability | RL | Basic | Customer |
|---------|:-----:|:---------:|:-------:|:------------:|:--:|:-----:|:--------:|
| Product Browse | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cart & Checkout | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Order History | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| AI Assistant | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Smart Delegate | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Autopilot Rules | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Purchase Predictor | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Wallet Management | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Admin Dashboard | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Observability | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Learning Metrics | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |

### 2.2 Product Discovery & Search

**User Journey**:
```
User opens Products page
    → Sees product grid with filters
    → Can search by keyword
    → Can filter by category, price range, brand
    → Can sort by price, rating, relevance
    → Clicks product → Modal with full details
    → Can add to cart, wishlist, or price alert
    → If AI Plus: sees AI-powered recommendations
```

**Multi-Source Aggregation**:
- Internal product database (primary)
- Amazon API (external marketplace)
- Flipkart API (external marketplace)
- Results are unified into a common schema, ranked, and cached

### 2.3 Shopping Cart

**Operations**:
- Add item to cart (with quantity)
- Update quantity
- Remove item
- View cart total
- Apply discount codes (future)
- Cart persists across sessions (database-backed)

**Business Rules**:
- Each user has one active cart
- Cart items reference real products (validated)
- Stock availability checked at checkout
- Price locked at time of cart addition (with staleness warning)

### 2.4 Checkout Flow

**Multi-Step Process**:
```
Step 1: Cart Validation
    → Verify all items in stock
    → Verify prices haven't changed significantly
    → Validate user authentication
    → Check wallet balance (if wallet payment)

Step 2: Checkout Preview
    → Calculate subtotal, taxes, delivery charges
    → Apply spending limit checks
    → Show payment method options
    → Display delivery address selection

Step 3: Payment Processing
    → Razorpay integration (card, UPI, netbanking)
    → Wallet debit (if wallet payment)
    → Payment verification webhook
    → Idempotent order creation

Step 4: Order Confirmation
    → Create order record
    → Update inventory
    → Send confirmation (email/push)
    → Emit commerce-events to Kafka
    → Clear cart
```

### 2.5 Order Management

**Order Lifecycle**:
```
pending → confirmed → processing → shipped → out_for_delivery → delivered
    │         │           │           │
    └─cancelled           └─cancelled  └─returned/refunded
```

**Features**:
- Real-time order status tracking (WebSocket)
- Order history with filtering
- Order cancellation (pre-shipment)
- Failed order recovery
- Order insights & analytics

### 2.6 Digital Wallet System

**Core Capabilities**:

| Feature | Description |
|---------|-------------|
| **Top-Up** | Add funds to wallet (Razorpay or test mode) |
| **Balance Check** | Real-time balance display |
| **Spending Limits** | Daily, weekly, monthly, per-order limits |
| **AI Authorization** | Enable/disable AI to spend from wallet |
| **Transaction History** | Complete audit trail with balance snapshots |
| **Fraud Detection** | Anomaly detection, velocity checks, account lockout |
| **Holds & Releases** | Authorize amount, hold, then debit or release |

**Wallet Transaction Types**:
- `topup` — Adding funds
- `debit` — Spending (manual or AI-initiated)
- `refund` — Returned to wallet
- `hold` — Reserved for pending purchase
- `release` — Released hold (cancelled purchase)

**Security Features**:
- Every transaction logs `ipAddress` and `userAgent`
- Balance is tracked with `balanceBefore` and `balanceAfter` per transaction
- Admin can lock/unlock wallets
- AI spending requires explicit opt-in (`isAiAuthorized`)

### 2.7 AI Shopping Assistant

**Conversational Interface**:
```
User: "I need a good laptop for coding under 80K"

AI Assistant:
    → Intent Detection: product_search
    → Entity Extraction: { category: "laptops", use_case: "coding", budget: 80000 }
    → Product Search (multi-source)
    → ML Ranking (budget fit, quality, brand match)
    → Response: "Here are the top 3 laptops for coding under ₹80K..."
        1. MacBook Air M2 — ₹79,990 (Score: 0.92)
        2. ThinkPad X1 Carbon — ₹74,500 (Score: 0.88)
        3. ASUS ROG Zephyrus — ₹78,000 (Score: 0.85)
    → Follow-up: "Want me to add any of these to your cart?"
```

**Supported Intents**:
- `product_search` — Find products
- `price_check` — Check current prices
- `order_status` — Track an order
- `recommendation` — Get personalized picks
- `comparison` — Compare products
- `general_help` — Platform guidance

### 2.8 Smart Buy Requests

**User creates a buy request**:
```json
{
  "description": "Samsung Galaxy S24 Ultra",
  "budget": { "min": 90000, "max": 130000 },
  "quality": "premium",
  "preferredBrands": ["Samsung"],
  "deliveryPreference": "fast",
  "autoExecute": true,
  "notifyChannels": ["email", "push"]
}
```

**Processing Pipeline**:
```
Buy Request Created
    → Publish to Kafka: buy_request.created
    → Intent Parser consumes: extracts structured intent
    → Publish to Kafka: intent.processed
    → Product Aggregator consumes: searches multiple sources
    → Publish to Kafka: products.fetched
    → Ranking Engine consumes: scores & ranks products
    → Publish to Kafka: products.ranked
    → If autoExecute:
        → Autopilot Engine evaluates rules
        → Decision Engine scores confidence
        → If confidence >= threshold:
            → Safety Layer validates limits
            → Execute purchase
        → Else:
            → Create ApprovalRequest
            → Notify user for HITL approval
    → Update buy request status
```

### 2.9 Autopilot (Autonomous Shopping)

**Rule Configuration**:
```json
{
  "name": "Monthly Phone Accessories",
  "conditions": {
    "category": "phone-accessories",
    "maxPrice": 2000,
    "minRating": 4.0,
    "brands": ["Spigen", "Ringke", "Samsung"]
  },
  "action": {
    "type": "auto_purchase",
    "paymentMethod": "wallet"
  },
  "maxSpendPerMonth": 5000,
  "maxOrderValue": 2000,
  "requireApproval": false
}
```

**Decision Flow**:
```
Product Match Found
    → RuleEngine.evaluate(product, rules)
    → Match Score Calculation
    → DecisionEngine.decide(match, userHistory)
    → Confidence Score (0-100)
    → Risk Level Assessment (low/medium/high/critical)
    → If riskLevel == "low" && confidence >= 80:
        → SafetyLayer.validate(amount, limits)
        → Auto-execute purchase
    → If riskLevel == "medium" || confidence 50-79:
        → Create ApprovalRequest with 24h TTL
        → Notify user
    → If riskLevel == "high" || confidence < 50:
        → Block and notify
    → ExplainabilityLayer.explain(decision)
    → Store decision with full reasoning
```

### 2.10 Human-in-the-Loop (HITL) Approvals

**Approval Workflow**:
```
System generates ApprovalRequest
    → User receives notification (email/push/in-app)
    → User reviews:
        - Product details
        - AI confidence score
        - Decision reasoning
        - Risk factors
        - Amount & wallet impact
    → User approves OR rejects
    → If approved: Execute purchase
    → If rejected: Cancel and record feedback
    → If no response within 24 hours: Auto-expire
```

### 2.11 Seller Copilot

**AI-Powered Seller Tools**:
- **Dynamic Pricing**: AI suggests optimal prices based on demand, competition, and margins
- **Demand Prediction**: ML model predicts future demand for products
- **Listing Optimization**: AI-generated product descriptions and templates
- **Performance Analytics**: Sales velocity, conversion rates, return rates
- **Inventory Alerts**: Stock level warnings and reorder suggestions

### 2.12 Agentic Commerce Protocol (ACP)

**Standardized Agent-to-Merchant Interface**:
```
Agent Request Flow:
    POST /api/v1/agent/search    → Multi-merchant product search
    POST /api/v1/agent/quote     → Get pricing & availability
    POST /api/v1/agent/checkout  → Execute purchase
    GET  /api/v1/agent/status/:id → Track order status

Merchant Adapters:
    ├── AmazonMerchantAdapter    → Amazon API integration
    ├── FlipkartMerchantAdapter  → Flipkart API integration
    └── InternalSellerAdapter    → Internal marketplace
```

**Verification Layer**:
```
Before any agent checkout:
    ✓ Budget verification (wallet balance >= amount)
    ✓ Spending limit check (daily, monthly, per-order)
    ✓ Product availability check
    ✓ Trust score validation
    ✓ Fraud risk assessment
    ✓ AI authorization status check
```

### 2.13 Feature Flags

**Capabilities**:
- Enable/disable features without deployment
- Gradual rollout (0-100% of users)
- Per-user targeting (specific user IDs)
- A/B testing support
- Runtime toggle via admin API

### 2.14 User Memory & Behavior Learning

**Data Collected**:
- Product views (category, brand, price point)
- Cart additions & abandonments
- Purchase history
- Search queries
- Rating patterns
- Time-of-day preferences

**How Memory Is Used**:
- Personalized product recommendations
- Brand affinity scoring
- Price sensitivity estimation
- Category preference ranking
- Auto-populate buy request defaults
- Smart notifications timing

### 2.15 Budget & Spending Analytics

**Features**:
- Monthly spending overview
- Category-wise breakdown
- Budget vs. actual tracking
- Spending limit compliance
- Forecast based on buying patterns
- Visual charts (Recharts)

### 2.16 Real-Time Features

**WebSocket Events**:
- Order status changes
- New recommendation availability
- Approval request notifications
- Price alert triggers
- Wallet balance updates
- Chat messages

---

## 3. Business Rules Summary

### Wallet Rules
1. Wallet balance can never go negative
2. AI can only spend if `isAiAuthorized = true`
3. Transactions exceeding `maxPerOrder` are blocked
4. Daily total cannot exceed `dailyLimit`
5. Locked wallets block all transactions
6. Every transaction creates an audit log entry

### Autopilot Rules
1. Rules can be active, paused, or archived
2. Monthly spend per rule cannot exceed `maxSpendPerMonth`
3. Single order cannot exceed `maxOrderValue`
4. Decisions with `riskLevel = "critical"` are always blocked
5. Decisions with confidence < 50 require mandatory HITL approval
6. All decisions store explainable reasoning

### Order Rules
1. Orders can only be cancelled before shipment
2. Refunds go back to original payment method (or wallet)
3. Failed payments create retry-able failed order entries
4. Order status transitions follow defined state machine

### RBAC Rules
1. Customer role = read-only public pages
2. Basic role = shopping operations (no AI)
3. AI Plus = full AI features + autonomous shopping
4. Admin = everything + user management

---

## 4. Non-Functional Requirements

| Requirement | Target | Implementation |
|-------------|--------|----------------|
| **Response Time** | < 200ms (p95) | Redis caching, connection pooling |
| **Availability** | 99.9% uptime | Circuit breakers, health checks |
| **Throughput** | 1000 req/sec | Kafka async processing, horizontal scaling |
| **Data Durability** | Zero data loss | PostgreSQL WAL, Kafka durable log |
| **Security** | OWASP Top 10 compliant | JWT, CSRF, rate limiting, input validation |
| **Scalability** | 100K concurrent users | Kubernetes HPA, Kafka partitioning |
| **Observability** | Full request traceability | Correlation IDs, Prometheus metrics |
| **AI Latency** | < 2s for recommendations | Cached predictions, async processing |
