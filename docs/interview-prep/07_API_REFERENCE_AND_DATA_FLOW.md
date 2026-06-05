# API Reference & Data Flow Documentation

## DelegateCart — Complete API & Data Flow Guide

---

## OVERVIEW

DelegateCart exposes **~180 API endpoints** across two layers:
- **NestJS Backend (Port 3001)**: 20 controllers, ~113 endpoints — core business logic
- **Next.js BFF (Port 3000)**: ~48 API route files, ~68 handlers — frontend proxy layer

The Next.js API routes act as a **Backend-for-Frontend (BFF)** layer — aggregating, authenticating, and formatting backend calls for the React frontend.

---

## 1. AUTHENTICATION & AUTHORIZATION

### Auth Controller — `@Controller('auth')`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | Public | Register new user |
| POST | `/auth/login` | Public | Login with email/password |
| POST | `/auth/forgot-password` | Public | Send reset email |
| POST | `/auth/reset-password` | Public | Reset with token |
| GET | `/auth/verify-reset-token` | Public | Validate reset token |
| POST | `/auth/oauth/google` | Public | Google OAuth login |
| POST | `/auth/oauth/microsoft` | Public | Microsoft OAuth login |
| POST | `/auth/health` | Public | Auth service health |

**Flow: Login**
```
Client → POST /auth/login { email, password }
  → AuthService.validateUser() → bcrypt.compare()
  → IF valid: sign JWT (userId, email, role) → return { accessToken, user }
  → IF invalid: 401 Unauthorized
```

**Flow: Registration**
```
Client → POST /auth/register { email, password, name }
  → Validate DTO (class-validator)
  → Check email uniqueness (Prisma)
  → Hash password (bcrypt, 10 rounds)
  → Create User + Wallet (Prisma transaction)
  → Sign JWT → return { accessToken, user }
```

---

## 2. PRODUCT CATALOG

### Product Controller — `@Controller('products')`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/products` | Public | List with filters & pagination |
| GET | `/products/categories` | Public | All categories |
| GET | `/products/featured` | Public | Featured/promoted products |
| GET | `/products/category/:category` | Public | Filter by category |
| GET | `/products/:id` | Public | Single product detail |

**Flow: Product Search**
```
Client → GET /products?search=samsung&category=phones&minPrice=10000&maxPrice=30000&page=1
  → Redis cache check (key: search:{hash})
  → IF cache hit: return cached results
  → IF cache miss:
    → Prisma query with WHERE conditions, ORDER BY, pagination
    → Cache result (1hr TTL)
    → Return { products[], total, page, pageSize }
```

---

## 3. SHOPPING CART

### Cart Controller — `@Controller('cart')`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/cart/:userId` | JWT | Get user's cart |
| POST | `/cart/:userId/add` | JWT | Add item to cart |

### Next.js BFF Cart Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cart` | Get current user's cart |
| PUT | `/api/cart` | Update cart item quantity |
| DELETE | `/api/cart` | Remove item from cart |

---

## 4. CHECKOUT & ORDERS

### Checkout Controller — `@Controller('checkout')`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/checkout/validate` | JWT | Validate cart for checkout |
| POST | `/checkout/preview` | JWT | Calculate totals, shipping |
| POST | `/checkout/complete` | JWT | Create order, process payment |

**Flow: Complete Checkout**
```
Client → POST /checkout/complete { cartId, addressId, paymentMethod }
  → Validate cart items (stock check)
  → Calculate totals (subtotal + tax + shipping)
  → IF wallet: Hold funds → Create WalletTransaction(HOLD)
  → IF razorpay: Create Razorpay order
  → Create Order + OrderItems (Prisma transaction)
  → Clear cart
  → Publish to Kafka[commerce-events]
  → Return { order, paymentDetails }
```

### Order Controller — `@Controller('orders')`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/orders` | JWT | Create order |
| GET | `/orders` | JWT | List user orders |
| GET | `/orders/:id` | JWT | Get order detail |
| GET | `/orders/number/:orderNumber` | JWT | Get by order number |
| PATCH | `/orders/:id/status` | Admin | Update status |
| PATCH | `/orders/:id/cancel` | JWT | Cancel order |
| GET | `/orders/:id/tracking` | JWT | Tracking info |
| DELETE | `/orders/:id` | Admin | Delete order |

---

## 5. WALLET & PAYMENTS

### Wallet Controller — `@Controller('wallet')`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/wallet` | JWT | Wallet balance & status |
| POST | `/wallet/add` | JWT | Add funds (CREDIT) |
| POST | `/wallet/debit` | JWT | Debit funds |
| PUT | `/wallet/limits` | JWT | Set spending limits |
| POST | `/wallet/authorize-ai` | JWT | Toggle AI authorization |
| POST | `/wallet/authorize` | JWT | Create spending auth |
| GET | `/wallet/transactions` | JWT | Transaction history |

**Flow: AI-Authorized Purchase**
```
Autopilot Engine → POST /wallet/debit { amount, type: 'AI_PURCHASE' }
  → Check wallet.isAiAuthorized === true
  → Check per-order limit (amount <= maxPerOrder)
  → Check daily limit (today's AI spend + amount <= dailyLimit)
  → Check weekly/monthly limits
  → Fraud detection (velocity + anomaly check)
  → IF all pass:
    → Create WalletTransaction(DEBIT, performedBy: 'AI_AGENT')
    → Update wallet.balance
    → Create WalletAuditLog
    → Return { success: true, newBalance }
  → IF any fail: 403 with reason
```

### Payment Controller — `@Controller('payments')`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/payments/initiate` | JWT | Create Razorpay order |
| POST | `/payments/verify` | JWT | Verify payment signature |
| GET | `/payments/order/:orderId` | JWT | Payment by order |
| GET | `/payments/:id` | JWT | Payment details |
| GET | `/payments/webhook/razorpay` | Public | Razorpay webhook |

---

## 6. AI SHOPPING ASSISTANT

### AI Chat Controller — `@Controller('ai/chat')`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/ai/chat` | JWT | Send message to AI |
| GET | `/ai/chat/history/:userId` | JWT | Chat history |
| DELETE | `/ai/chat/history/:userId` | JWT | Clear history |
| GET | `/ai/chat/suggestions/:userId` | JWT | Suggested prompts |
| GET | `/ai/chat/health` | Public | AI service health |

### Intent Controller — `@Controller('api/intent')`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/intent/analyze` | JWT | Parse shopping intent |
| POST | `/api/intent/answer-question` | JWT | Answer clarification |

**Flow: Intent Analysis**
```
Client → POST /api/intent/analyze { message: "Samsung phone under 30K" }
  → AI Service (FastAPI) → LLM Provider (GPT-4/Claude)
  → Extract structured intent:
    {
      category: "smartphones",
      brand: "Samsung",
      maxBudget: 30000,
      keywords: ["phone"],
      urgency: "medium"
    }
  → Publish to Kafka[intent.processed]
  → Return { intent, clarifyingQuestions? }
```

### Chat Controller — `@Controller('api/chat')`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/chat/message` | JWT | SSE streaming chat |

---

## 7. AI MEMORY & PERSONALIZATION

### Memory Controller — `@Controller('api/memory')`

**Preferences & Patterns**:

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/memory/preferences` | JWT | User preferences |
| POST | `/api/memory/preferences` | JWT | Update preferences |
| PUT | `/api/memory/preferences` | JWT | Replace preferences |
| POST | `/api/memory/preferences/add-category` | JWT | Add category |
| POST | `/api/memory/preferences/remove-category` | JWT | Remove category |
| GET | `/api/memory/patterns` | JWT | Buying patterns |
| GET | `/api/memory/insights` | JWT | Memory insights |
| GET | `/api/memory/summary` | JWT | Full memory summary |

**Ranking & Recommendations**:

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/memory/ranking/weights` | JWT | Current ranking weights |
| GET | `/api/memory/ranking/payload` | JWT | Ranking input data |
| POST | `/api/memory/ranking/personalize` | JWT | Personalize products |
| GET | `/api/memory/recommendations` | JWT | Recommendations |
| POST | `/api/memory/recommendations/deals` | JWT | Deal alerts |

**Auto-Decisions**:

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/memory/auto-decisions/enabled` | JWT | Auto-decision status |
| POST | `/api/memory/auto-decisions/cart-add` | JWT | Auto-add to cart |
| POST | `/api/memory/auto-decisions/evaluate` | JWT | Evaluate auto-buy |
| GET | `/api/memory/auto-decisions/suggestions` | JWT | Smart suggestions |
| GET | `/api/memory/auto-decisions/history` | JWT | Decision log |
| POST | `/api/memory/auto-decisions/:id/feedback` | JWT | User feedback |

---

## 8. AUTONOMOUS AGENT

### Agent Controller — `@Controller('api/agent')`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/agent/search` | JWT | AI search with guardrails |
| POST | `/api/agent/verify` | JWT | Verify before execute |
| POST | `/api/agent/execute` | JWT | Execute autonomous order |

**Preference Quiz**:

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/agent/preferences/quiz` | JWT | Get quiz questions |
| POST | `/api/agent/preferences/quiz/start` | JWT | Start quiz |
| POST | `/api/agent/preferences/quiz/:quizId/answer` | JWT | Submit answer |
| POST | `/api/agent/preferences/quiz/:quizId/complete` | JWT | Complete quiz |

**HITL Approvals**:

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/agent/approvals` | JWT | Pending approvals |
| POST | `/api/agent/approvals/:approvalId/approve` | JWT | Approve decision |
| POST | `/api/agent/approvals/:approvalId/reject` | JWT | Reject decision |

### AI Execution Controller — `@Controller('execution')`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/execution/execute` | JWT | Execute AI order |
| POST | `/execution/validate` | JWT | Validate execution |
| POST | `/execution/approve` | JWT | Approve/reject execution |
| GET | `/execution/stats` | JWT | Execution statistics |

---

## 9. AGENTIC COMMERCE PROTOCOL (ACP)

### ACP Agent Controller — `@Controller('api/v1/agent')`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/agent/search` | JWT | Multi-merchant search |
| POST | `/api/v1/agent/quote` | JWT | Get product quote |
| POST | `/api/v1/agent/checkout` | JWT | Execute ACP checkout |
| GET | `/api/v1/agent/status/:correlationId` | JWT | Check status |

**Flow: ACP Multi-Merchant Search**
```
Agent → POST /api/v1/agent/search { query, budget, preferences }
  → ACP Gateway → Verification Layer (budget + trust)
  → Router → Fan out to all adapters in parallel:
    ├── AmazonAdapter.search()
    ├── FlipkartAdapter.search()
    └── InternalAdapter.search() (Prisma query)
  → Aggregate results
  → Apply ranking engine
  → Return { products[], sources[], confidence }
```

---

## 10. BUY REQUESTS

### Buy Request Controller — `@Controller('buy-request')`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/buy-request` | JWT | Create buy request |
| GET | `/buy-request` | JWT | List user's requests |
| GET | `/buy-request/:id` | JWT | Get request detail |
| PATCH | `/buy-request/:id` | JWT | Update request |
| DELETE | `/buy-request/:id` | JWT | Cancel request |

**Flow: Buy Request → Autonomous Purchase**
```
User → POST /buy-request { description: "Samsung phone under 30K" }
  → Create BuyRequest in DB (status: PENDING)
  → Publish to Kafka[buy_request.created]
  → Intent Parser → Kafka[intent.processed]
  → Product Aggregator → Kafka[products.fetched]
  → Ranking Engine → Kafka[products.ranked]
  → Autopilot Engine reads ranked products
    → Rule Engine: Match user's AutopilotRules
    → Decision Engine: Score confidence
    → Safety Layer: Validate spending limits, fraud
    → IF confidence ≥ 80%: Auto-execute checkout
    → IF confidence 50-79%: Create ApprovalRequest → WebSocket notify
    → IF confidence < 50%: Block, notify user
  → Update BuyRequest status
  → WebSocket: Push status update to user
```

---

## 11. SELLER COPILOT

### Seller Controller — `@Controller('sellers')`

**Profile Management**:

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/sellers/profile` | JWT+Seller | Create profile |
| GET | `/sellers/profile` | JWT+Seller | Get profile |
| PUT | `/sellers/profile` | JWT+Seller | Update profile |

**Product & Listings**:

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/sellers/listings/generate` | JWT+Seller | AI-generate listing |
| POST | `/sellers/products` | JWT+Seller | Create product |
| GET | `/sellers/products` | JWT+Seller | List products |
| GET | `/sellers/products/:productId/performance` | JWT+Seller | Performance metrics |
| PUT | `/sellers/products/:productId` | JWT+Seller | Update product |

**AI-Powered Intelligence**:

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/sellers/pricing/suggestions` | JWT+Seller | AI pricing suggestions |
| POST | `/sellers/pricing/suggestions/apply` | JWT+Seller | Apply suggestion |
| POST | `/sellers/demand/prediction` | JWT+Seller | Demand forecast |
| GET | `/sellers/demand/insights` | JWT+Seller | Demand insights |
| GET | `/sellers/dashboard` | JWT+Seller | Dashboard overview |

---

## 12. FEATURE FLAGS

### Feature Flag Controller — `@Controller('feature-flags')`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/feature-flags` | JWT+Admin | List all flags |
| GET | `/feature-flags/stats` | JWT+Admin | Aggregated stats |
| GET | `/feature-flags/check` | JWT | Check flag for user |
| GET | `/feature-flags/:id` | JWT+Admin | Get single flag |
| POST | `/feature-flags` | JWT+Admin | Create flag |
| PATCH | `/feature-flags/:id` | JWT+Admin | Update flag |
| DELETE | `/feature-flags/:id` | JWT+Admin | Delete flag |

---

## 13. USER ADDRESSES

### Address Controller — `@Controller('addresses')`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/addresses` | JWT | Create address |
| GET | `/addresses` | JWT | List addresses |
| GET | `/addresses/:id` | JWT | Get address |
| GET | `/addresses/user/default` | JWT | Get default |
| PATCH | `/addresses/:id` | JWT | Update address |
| DELETE | `/addresses/:id` | JWT | Delete address |
| POST | `/addresses/:id/default` | JWT | Set as default |

---

## 14. NEXT.JS BFF ROUTES (Frontend Proxy)

### Admin Routes
| Route | Methods | Backend Target |
|-------|---------|---------------|
| `/api/admin/analytics` | GET | Aggregated analytics |
| `/api/admin/learning` | GET, PATCH, DELETE, POST | ML learning management |
| `/api/admin/stats` | GET | System statistics |
| `/api/admin/users` | GET | User management |
| `/api/admin/validation-data` | GET | Validation data |

### AI Routes
| Route | Methods | Backend Target |
|-------|---------|---------------|
| `/api/ai-preferences` | GET, PUT | AI Memory Service |
| `/api/ai-shopping-list` | GET, POST | Shopping list mgmt |
| `/api/shopping-assistant` | POST | AI Chat Service |

### Search Routes
| Route | Methods | Backend Target |
|-------|---------|---------------|
| `/api/search` | GET | Product search |
| `/api/search/image` | POST | Visual search |
| `/api/search/voice` | POST | Voice search |
| `/api/search-metrics` | GET, POST | Search analytics |

### User Profile Routes
| Route | Methods | Backend Target |
|-------|---------|---------------|
| `/api/user/addresses` | GET, POST, PUT, DELETE | Address Service |
| `/api/user/behavior` | GET, POST | Behavior tracking |
| `/api/user/preferences` | GET, PUT | User preferences |
| `/api/user/profile` | GET, PUT | Profile CRUD |
| `/api/user/search-history` | GET | Search history |
| `/api/user/wishlist` | GET, POST, DELETE | Wishlist mgmt |

### Commerce Routes
| Route | Methods | Backend Target |
|-------|---------|---------------|
| `/api/cart` | GET, PUT, DELETE | Cart Service |
| `/api/orders` | GET, POST | Order Service |
| `/api/orders/[id]` | GET | Order detail |
| `/api/checkout-failures` | GET | Failed checkouts |
| `/api/wallet` | GET, POST | Wallet Service |
| `/api/wallet/transactions` | GET | Transaction history |

### Tracking & Analytics
| Route | Methods | Backend Target |
|-------|---------|---------------|
| `/api/analytics` | GET, POST | Analytics engine |
| `/api/track/event` | GET, POST | Event tracking |
| `/api/monitoring` | GET | System monitoring |
| `/api/observability` | GET | Observability data |

---

## 15. KAFKA EVENT TOPICS & DATA FLOWS

### Topic Map

| Topic | Producer | Consumer(s) | Payload |
|-------|----------|-------------|---------|
| `buy_request.created` | API | Intent Parser | `{ requestId, userId, description }` |
| `intent.processed` | Intent Parser | Product Aggregator | `{ requestId, intent: { category, brand, budget } }` |
| `products.fetched` | Product Aggregator | Ranking Engine | `{ requestId, products[], sources[] }` |
| `products.ranked` | Ranking Engine | Autopilot Engine | `{ requestId, rankedProducts[], scores[] }` |
| `autopilot.triggered` | API | Autopilot Engine | `{ userId, ruleId, trigger }` |
| `autopilot.executed` | Autopilot Engine | API, Analytics | `{ requestId, decision, orderId? }` |
| `commerce-events` | API | AI Service, Analytics | `{ type, userId, data }` |
| `user-behavior` | API/Web | AI Service | `{ userId, action, productId?, metadata }` |
| `product-events` | API | AI Service, Cache | `{ type: 'created'|'updated'|'deleted', product }` |
| `ml-events` | AI Service | Analytics | `{ type, model, metrics }` |
| `recommendations` | AI Service | API (WebSocket) | `{ userId, products[], algorithm }` |

### Event Flow Diagram

```
USER ACTION                    KAFKA PIPELINE                     OUTCOME
─────────────────────────────────────────────────────────────────────────
Browse product ──→ user-behavior ──→ AI Service ──→ Update memory
Add to cart    ──→ commerce-events ──→ Analytics ──→ Track conversion
Submit buy req ──→ buy_request.created ──→ [4-stage pipeline] ──→ Purchase
Checkout       ──→ commerce-events ──→ AI Service ──→ Learn preferences
Rate product   ──→ user-behavior ──→ AI Service ──→ Update rankings
```

---

## 16. WEBSOCKET EVENTS

### Gateway: `WebSocketGateway(port 3001, namespace /ws)`

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `recommendation` | Server → Client | `{ products[], score[] }` | New recommendations |
| `order.status` | Server → Client | `{ orderId, status }` | Order status change |
| `approval.request` | Server → Client | `{ approvalId, decision }` | HITL approval needed |
| `wallet.update` | Server → Client | `{ balance, lastTx }` | Balance change |
| `price.alert` | Server → Client | `{ productId, oldPrice, newPrice }` | Price drop alert |
| `autopilot.update` | Server → Client | `{ requestId, status, result }` | Autopilot progress |

---

## 17. HEALTH CHECK ENDPOINTS

| Endpoint | Service | Checks |
|----------|---------|--------|
| GET `/health` | API | Server running |
| GET `/metrics` | API | Prometheus metrics |
| POST `/auth/health` | Auth | Auth service |
| GET `/ai/chat/health` | AI Chat | AI Service connection |
| GET `/api/v1/agent/status/:id` | ACP | Agent status |
