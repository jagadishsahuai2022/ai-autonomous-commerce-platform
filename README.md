# DelegateCart — AI-Powered E-Commerce Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.2.3-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2.0-61DAFB?logo=react)](https://react.dev)
[![NestJS](https://img.shields.io/badge/NestJS-11.1.19-E0234E?logo=nestjs)](https://nestjs.com)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115.5-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![Prisma](https://img.shields.io/badge/Prisma-7.5.0-2D3748?logo=prisma)](https://prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791?logo=postgresql)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7.4_LTS-DC382D?logo=redis)](https://redis.io)
[![Kafka](https://img.shields.io/badge/Apache_Kafka-7.7.1-231F20?logo=apache-kafka)](https://kafka.apache.org)
[![Turborepo](https://img.shields.io/badge/Turborepo-1.10-EF4444)](https://turbo.build)
[![pnpm](https://img.shields.io/badge/pnpm-9.0.0-F69220?logo=pnpm)](https://pnpm.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **DelegateCart** is a production-grade, AI-first e-commerce platform that lets users **delegate their shopping** to an intelligent multi-agent system. The platform combines a Smart Shopping Copilot, a Smart Intent Engine, an Agentic Auto-Checkout pipeline, a real-time Approval Workflow, and a Seller AI Copilot — all orchestrated over Apache Kafka in a polyglot monorepo.

---

## 🗂️ Table of Contents

- [Key Features](#-key-features)
- [Architecture Overview](#️-architecture-overview)
- [Tech Stack](#-tech-stack-at-a-glance)
- [Monorepo Structure](#-monorepo-structure)
- [Database Schema Highlights](#️-database-schema-highlights)
- [Prerequisites](#-prerequisites)
- [Getting Started](#-getting-started)
- [Available Scripts](#️-available-scripts)
- [API Reference](#-api-reference)
- [Environment Variables](#-environment-variables)
- [Docker Deployment](#-docker-deployment)
- [Testing](#-testing)
- [RBAC & Roles](#-rbac--roles)
- [Contributing](#-contributing)

---

## ✨ Key Features

### 🤖 Smart Shopping Copilot (`/shopping-assistant`)
- Conversational AI chat interface powered by LLMs (Anthropic Claude / OpenAI / Groq / Google Gemini)
- Real-time product recommendations displayed in a swipeable carousel
- **Pipeline → Decision → Approval** three-tab workflow
- Intelligent approval workflow with configurable risk scoring (Low / Medium / High)
- Countdown timer on high-value approval requests to prevent decision fatigue
- One-click cart addition from AI recommendations

### 🛒 Shopping List & Smart Intent Engine (`/shopping-list`)
- Submit a structured shopping list (product name, brand, budget, quantity, delivery days)
- **Smart Intent Engine** parses natural-language intent and matches products from the catalogue
- Multi-objective AI scoring: budget fit, quality score, brand preference, delivery speed, ratings
- Cross-user anonymous comparison view
- WhatsApp / Email notification triggers after matching
- "Add to Cart & Checkout" bulk action from matched results

### 🤝 Agentic Auto-Checkout
- Autonomous end-to-end checkout pipeline (address → payment → confirmation)
- AI authorises wallet deductions below configured spending thresholds
- Manual approval modal for high-value or first-time-category purchases
- Full audit trail in `ApprovalRequest` and `AIDecisionLog` tables

### 💰 Wallet System
- User-controlled digital wallet with top-up, debit, refund flows
- AI spending limits, daily caps, per-order limits
- Lock / unlock on suspicious activity
- Complete transaction history with balance snapshots

### 🧠 AI Memory & Personalisation
- `UserPreferences`, `UserMemory`, `RankingPersonalization` persist across sessions
- Auto-decisions log for reinforcement learning
- Preference quiz onboarding for new users

### 🏪 Seller AI Copilot
- AI-generated product listing templates (title, description, bullet points)
- Dynamic pricing suggestions based on demand metrics
- Competitor price tracking and demand forecasting
- Seller analytics dashboard (revenue lift, forecast accuracy, conversion rates)

### 🔍 Dynamic Island Search
- Navbar-integrated expanding search island (voice 🎤, image 📷, text)
- Real-time product filter sync on `/products` page
- Browser Speech Recognition API for voice input (`en-IN`)

### 🔐 RBAC (Role-Based Access Control)
- Roles: `admin`, `analytics`, `observability`, `reinforced-learning`, `aiplus`, `basic`, `customer`
- Admin impersonation of any demo user with one-click session resume
- Feature-gated UI sections per role

### 📊 Observability & Metrics
- Prometheus metrics endpoint (`prom-client`)
- `ValidationSession` tracking for AI recommendation accuracy
- Self-learning dashboard for reinforcement feedback loop
- Scoring dimension weights managed through admin UI

### 🧪 Comprehensive Test Suite
- **128+ Playwright E2E specs** covering every major flow
- Vitest unit & integration tests for the Next.js frontend
- Jest tests for the NestJS API
- Python unit tests for all three Python microservices
- Performance / load tests (k6)

### 🛍️ Standard E-Commerce Features
- Product catalogue with categories, sub-categories, tags, and business metrics
- Shopping cart with DB persistence (PostgreSQL) + localStorage sync
- Order management with status tracking
- Wishlist with multi-collection support
- Addresses management
- Payment methods management (Razorpay integration)
- Dark / light theme with system preference detection

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│               Next.js 16 / React 19  (Port 3000)                  │
│  App Router · Tailwind CSS · Framer Motion · Zustand · TanStack   │
│  Dynamic Island Search · Smart Assistant · Shopping List           │
└────────────┬─────────────────────────────────┬───────────────────┘
             │  REST / Internal Fetch           │  Socket.IO (WS)
             ▼                                  ▼
┌────────────────────────┐         ┌────────────────────────────────┐
│  NestJS 11 API         │         │  FastAPI AI Service (Port 8000) │
│  (Port 3001)           │         │  Recommendations · Consumers    │
│  Fastify adapter       │         └──────────┬─────────────────────┘
│  Modules:              │                    │
│  ├─ Auth (JWT)         │         ┌──────────▼─────────────────────┐
│  ├─ Product            │         │  Intent Parser (Port 8002)      │
│  ├─ Cart               │         │  LLM-powered NL→Intent          │
│  ├─ Order              │         └──────────┬─────────────────────┘
│  ├─ Checkout (Agentic) │                    │
│  ├─ Wallet             │         ┌──────────▼─────────────────────┐
│  ├─ Buy Request        │         │  Product Aggregator (Port 8003) │
│  ├─ AI Memory          │         │  Catalogue matching + Redis     │
│  ├─ Seller Copilot     │         └──────────┬─────────────────────┘
│  ├─ Feature Flags      │                    │
│  ├─ Websocket          │         ┌──────────▼─────────────────────┐
│  └─ Observability      │         │  Ranking Engine (Port 8004)    │
└────────────┬───────────┘         │  Multi-objective scoring        │
             │                     └──────────┬─────────────────────┘
             └──────────┬──────────────────────┘
                        │
               ┌────────▼────────┐
               │  Apache Kafka   │  Topics: buy_request.created,
               │  (Confluent     │  intent.processed, products.fetched,
               │   7.7.1)        │  products.ranked, order-events,
               └────────┬────────┘  user-activity, product-updates
                        │
          ┌─────────────┼────────────┐
          ▼             ▼            ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │PostgreSQL│  │  Redis   │  │ Prisma 7 │
    │    17    │  │ 7.4 LTS  │  │  ORM     │
    └──────────┘  └──────────┘  └──────────┘
```

---

## 🔧 Tech Stack at a Glance

| Layer | Technology | Version |
|---|---|---|
| Frontend | Next.js (App Router) | 16.2.3 |
| UI Library | React | 19.2.0 |
| Styling | Tailwind CSS | 3.4 |
| Animation | Framer Motion | 12.x |
| State | Zustand | 5.x |
| Data Fetching | TanStack Query + SWR | 5.x / 2.x |
| Backend API | NestJS (Fastify adapter) | 11.1.19 |
| ORM | Prisma | 7.5.0 |
| Database | PostgreSQL | 17 |
| Cache | Redis | 7.4 LTS |
| Message Broker | Apache Kafka (Confluent) | 7.7.1 |
| AI Services | FastAPI + Uvicorn | 0.115.5 |
| Language (Python) | Python | 3.12+ |
| Language (Node) | TypeScript | 5.7 |
| Monorepo | Turborepo + pnpm workspaces | 1.10 / 9.x |
| Auth | NextAuth v4 + JWT (NestJS) | — |
| Payments | Razorpay | — |
| Realtime | Socket.IO | 4.x |
| Metrics | Prometheus (prom-client) | — |
| E2E Tests | Playwright | 1.58 |
| Unit Tests | Vitest (web) / Jest (api) | — |
| Package Manager | pnpm | 9.0.0 |
| Node Runtime | Node.js | ≥ 22 |
| Containerisation | Docker + Docker Compose | — |

---

## 📁 Monorepo Structure

```
delegatecart/
├── apps/
│   ├── web/                          # Next.js 16 frontend (App Router)
│   │   ├── app/                      # Route segments (60+ pages)
│   │   │   ├── shopping-assistant/   # Smart Shopping Copilot
│   │   │   ├── shopping-list/        # Smart Intent Engine / Shopping List
│   │   │   ├── cart/                 # Shopping Cart
│   │   │   ├── checkout/             # Checkout flow
│   │   │   ├── products/             # Product catalogue + filters
│   │   │   ├── orders/               # Order history
│   │   │   ├── wishlist/             # Wishlists (multi-collection)
│   │   │   ├── wallet/               # Wallet dashboard
│   │   │   ├── admin/                # Admin dashboard + user management
│   │   │   ├── observability/        # Observability dashboard
│   │   │   ├── ai-plus/              # AI+ feature page
│   │   │   ├── dashboard/            # User dashboard
│   │   │   └── ...                   # 40+ additional routes
│   │   ├── components/               # Shared React components
│   │   │   ├── approval/             # Approval modal
│   │   │   ├── product/              # Product cards (Amazon, DC, generic)
│   │   │   ├── checkout/             # Checkout components
│   │   │   ├── decision/             # AI decision panel
│   │   │   ├── comparison/           # Product comparison
│   │   │   ├── commerce/             # Commerce-specific UI
│   │   │   ├── dashboard/            # Dashboard widgets
│   │   │   └── ui/                   # Design system primitives
│   │   ├── services/                 # API client services
│   │   │   ├── cart.service.ts
│   │   │   ├── product.service.ts
│   │   │   ├── order.service.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── ai.service.ts
│   │   │   └── ...
│   │   ├── store/                    # Zustand global stores
│   │   │   ├── chatStore.ts
│   │   │   ├── buyRequestStore.ts
│   │   │   └── useSphereStore.ts
│   │   ├── hooks/                    # Custom React hooks
│   │   ├── lib/                      # Utilities, contexts, query client
│   │   ├── types/                    # Frontend-specific TypeScript types
│   │   └── e2e/                      # 128+ Playwright E2E test specs
│   │
│   ├── api/                          # NestJS 11 backend
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/             # JWT auth, refresh tokens
│   │   │   │   ├── product/          # Product catalogue CRUD
│   │   │   │   ├── cart/             # Cart operations
│   │   │   │   ├── order/            # Order processing
│   │   │   │   ├── wallet/           # Wallet + transactions
│   │   │   │   ├── buy-request/      # Smart buy requests
│   │   │   │   ├── ai-memory/        # User preferences + memory
│   │   │   │   ├── agent/            # Agentic orchestration
│   │   │   │   ├── ai-chat/          # AI chat history
│   │   │   │   ├── ai-execution/     # AI execution pipeline
│   │   │   │   ├── chat/             # Chat sessions
│   │   │   │   ├── seller-copilot/   # Seller AI features
│   │   │   │   ├── feature-flag/     # Feature flags
│   │   │   │   └── mobile/           # Mobile API variants
│   │   │   ├── checkout/             # Agentic checkout pipeline
│   │   │   ├── payments/             # Payment processing
│   │   │   ├── shopping/             # Shopping orchestration
│   │   │   ├── orders/               # Order management
│   │   │   ├── addresses/            # Address management
│   │   │   ├── websocket/            # Socket.IO gateway
│   │   │   ├── kafka/                # Kafka producers/consumers
│   │   │   └── common/               # Guards, interceptors, pipes
│   │   └── prisma/
│   │       ├── schema.prisma         # Full DB schema (1200+ lines)
│   │       └── seed.ts               # Comprehensive seed data
│   │
│   ├── ai-service/                   # FastAPI — recommendations + event consumers
│   ├── intent-parser/                # FastAPI — LLM-powered NL intent extraction
│   ├── product-aggregator/           # FastAPI — catalogue matching + Redis cache
│   ├── product-ranking-engine/       # FastAPI — multi-objective product scoring
│   └── autopilot-engine/             # TypeScript — autonomous checkout orchestration
│
├── packages/
│   ├── types/                        # Shared TypeScript types (workspace:*)
│   ├── ui/                           # Shared UI component library
│   └── config/                       # Shared ESLint, TypeScript configs
│
├── infra/
│   ├── docker/                       # Per-service Dockerfiles (latest stack)
│   ├── kafka/                        # Kafka topic configuration
│   └── postgres/                     # DB init scripts
│
├── tests/                            # Root-level integration tests
├── performance-tests/                # k6 load test scripts
├── docker-compose.yml                # Standard compose (dev)
├── docker-compose.latest.yml         # Latest stack (non-conflicting ports)
├── docker-compose.prod.yml           # Production compose
├── turbo.json                        # Turborepo pipeline config
├── pnpm-workspace.yaml               # pnpm workspace definition
├── package.json                      # Root scripts + shared deps
└── .env.example                      # Full environment template
```

---

## 🗄️ Database Schema Highlights

The Prisma schema (`apps/api/prisma/schema.prisma`) defines the full relational model:

| Model | Purpose |
|---|---|
| `User` | Accounts, RBAC roles, subscription plans |
| `Product` | Catalogue with generic name, eligibility flags, metrics |
| `ProductCategory` / `ProductSubCategory` | Hierarchical taxonomy |
| `ProductCategoryMap` / `ProductSubCategoryMap` | Many-to-many classification |
| `ProductTag` / `ProductTagMap` | Structured enrichment taxonomy |
| `ProductBusinessMetrics` | Margin, inventory, sales velocity, conversion/return rates |
| `ScoringDimension` | Admin-managed ranking weight config |
| `Cart` / `CartItem` | Per-user persistent cart (DB-backed) |
| `Order` / `OrderItem` | Order lifecycle |
| `BuyRequest` | Smart buy request with auto-execute & notification channels |
| `Wallet` / `WalletTransaction` | Digital wallet with full audit trail |
| `WalletAuthorization` | AI spending authorisation records |
| `WalletSpendingLimit` | User-defined spending rules |
| `WalletAuditLog` | Immutable change audit |
| `ChatMessage` | AI assistant conversation history |
| `ActivityLog` | User behaviour events for ML/analytics |
| `FeatureFlag` | Gradual rollout + targeted user flags |
| `ApprovalRequest` / `AIDecisionLog` | Agentic checkout approvals |
| `UserPreferences` / `UserMemory` | Persistent AI personalisation |
| `RankingPersonalization` | Per-user ranking weight overrides |
| `AutoDecisionLog` | RL feedback signal |
| `PreferenceQuiz` | Onboarding preference capture |
| `ValidationSession` | Recommendation accuracy metrics |
| `Seller` / `SellerProduct` | Seller accounts + listings |
| `ListingTemplate` | AI-generated listing templates |
| `PriceHistory` / `DemandMetrics` | Pricing intelligence |
| `SellerAiAnalytics` | Aggregated seller AI KPIs |
| `WishlistCollection` / `WishlistItem` | Multi-collection wishlists |
| `RefreshToken` | Secure JWT refresh token rotation |

---

## 📋 Prerequisites

| Requirement | Version |
|---|---|
| Node.js | ≥ 22.0.0 |
| pnpm | ≥ 9.0.0 |
| Python | ≥ 3.12 |
| Docker & Docker Compose | Latest stable |
| Git | Any |

> **Windows users:** PowerShell 7+ or Git Bash is recommended.

---

## 🚀 Getting Started

### Option 1 — Full Local Development (all services)

```bash
# 1. Clone the repository
git clone https://github.com/jagadishsahuai2022/delegatecart.git
cd delegatecart

# 2. Copy environment file and fill in your secrets
cp .env.example .env

# 3. Install all workspace dependencies
pnpm install

# 4. Start infrastructure (Postgres, Redis, Kafka) via Docker
docker compose -f docker-compose.latest.yml up postgres redis kafka zookeeper -d

# 5. Run database migrations and seed
pnpm db:migrate
pnpm db:seed

# 6. Start all apps concurrently (web + api + ai services)
pnpm dev
```

Apps will be available at:

| Service | URL |
|---|---|
| Next.js Frontend | http://localhost:3000 |
| NestJS API | http://localhost:3001 |
| FastAPI AI Service | http://localhost:8000 |
| Intent Parser | http://localhost:8002 |
| Product Aggregator | http://localhost:8003 |
| Product Ranking Engine | http://localhost:8004 |

### Option 2 — Frontend Only (quickest start)

```bash
pnpm install
# Requires a running API — set NEXT_PUBLIC_API_URL in apps/web/.env.local
pnpm dev:web
```

### Option 3 — Full Docker Stack (latest versions)

```bash
# Start all 9 services with non-conflicting ports
docker compose -p delegatecard-tech-stack-latest-version \
               -f docker-compose.latest.yml up -d

# View logs
docker compose -f docker-compose.latest.yml logs -f

# Stop
docker compose -f docker-compose.latest.yml down
```

Docker port mapping (latest stack):

| Service | Host Port | Container Port |
|---|---|---|
| Frontend (Next.js) | 3010 | 3000 |
| API (NestJS) | 3002 | 3001 |
| AI Service | 8001 | 8000 |
| Intent Parser | 8002 | 8000 |
| Product Aggregator | 8003 | 8000 |
| Ranking Engine | 8004 | 8000 |
| PostgreSQL | 5433 | 5432 |
| Redis | 6380 | 6379 |
| Kafka | 9093 | 9093 |

### Option 4 — Python Microservices (manual)

```bash
cd apps/intent-parser          # or product-aggregator / product-ranking-engine
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8002
```

---

## 🛠️ Available Scripts

### Root level (`pnpm <script>`)

```bash
# ── Development ────────────────────────────────────────────────────
pnpm dev                  # Run all apps in parallel (Turborepo)
pnpm dev:web              # Next.js frontend only
pnpm dev:api              # NestJS API only
pnpm dev:ai               # FastAPI AI service only

# ── Build & Production ─────────────────────────────────────────────
pnpm build                # Build all apps
pnpm start                # Start production builds
pnpm start:prod           # Production start for all apps

# ── Database ───────────────────────────────────────────────────────
pnpm db:migrate           # Run Prisma migrations (dev)
pnpm db:push              # Push schema changes without migration
pnpm db:seed              # Seed the database with demo data
pnpm db:reset             # Reset + re-migrate + re-seed
pnpm db:studio            # Open Prisma Studio (DB GUI)

# ── Testing ────────────────────────────────────────────────────────
pnpm test                 # Run all tests
pnpm test:unit            # Unit tests only
pnpm test:integration     # Integration tests only
pnpm test:e2e             # Playwright E2E tests
pnpm test:coverage        # Coverage report
pnpm test:all             # unit + integration + e2e + performance
pnpm load-test            # k6 load test (1000 users, 5 min)
pnpm load-test:stress     # k6 stress test (10 000 users, 20 min)

# ── Code Quality ───────────────────────────────────────────────────
pnpm lint                 # ESLint all packages
pnpm format               # Prettier format
pnpm format:check         # Prettier check
pnpm type-check           # TypeScript type checking
pnpm check                # type-check + lint (combined)

# ── Docker ─────────────────────────────────────────────────────────
pnpm docker:build         # Build Docker images
pnpm docker:up            # Start containers (detached)
pnpm docker:down          # Stop containers
pnpm docker:logs          # Tail all container logs

# ── Kubernetes ─────────────────────────────────────────────────────
pnpm k8s:deploy           # kubectl apply manifests
pnpm k8s:status           # Get pods in delegatecart namespace
pnpm k8s:logs             # Tail API pod logs
pnpm k8s:delete           # Delete namespace

# ── Metrics & Health ───────────────────────────────────────────────
pnpm metrics              # Print Prometheus metrics URL
pnpm health               # Quick health check (curl + jq)
pnpm health:ready          # Readiness probe

# ── Utilities ─────────────────────────────────────────────────────
pnpm clean                # Remove all build artifacts + node_modules
pnpm setup                # Run production setup script (bash)
pnpm setup:windows        # Run production setup script (Windows bat)
pnpm ci                   # lint + build + test (CI pipeline)
```

### Web app scripts (`pnpm --filter web <script>`)

```bash
pnpm --filter web test:e2e          # Playwright tests
pnpm --filter web test:e2e:ui       # Playwright UI mode
pnpm --filter web test:coverage     # Vitest coverage
```

### API scripts (`pnpm --filter api <script>`)

```bash
pnpm --filter api seed              # Seed via ts-node
pnpm --filter api test:coverage     # Jest coverage
```

---

## 📡 API Reference

### Health

```
GET  /health                  — API health check
GET  /health/ready            — Readiness probe
GET  /metrics                 — Prometheus metrics
```

### Authentication

```
POST /auth/register           — Register a new user
POST /auth/login              — Login (returns JWT)
POST /auth/refresh            — Refresh access token
POST /auth/logout             — Invalidate refresh token
GET  /auth/me                 — Current user profile
```

### Products

```
GET  /products                — List products (filters, pagination, search)
GET  /products/:id            — Product details
POST /products                — Create product (admin)
PUT  /products/:id            — Update product (admin)
DELETE /products/:id          — Delete product (admin)
GET  /products/categories     — List categories
GET  /products/featured       — Featured products
```

### Cart

```
GET  /cart                    — Get current user's cart
POST /cart/items              — Add item to cart
PUT  /cart/items/:itemId      — Update item quantity
DELETE /cart/items/:itemId    — Remove item from cart
DELETE /cart                  — Clear entire cart
POST /cart/coupon             — Apply coupon code
DELETE /cart/coupon           — Remove coupon code
GET  /cart/count              — Get cart item count
POST /cart/validate           — Validate cart before checkout
```

### Orders

```
GET  /orders                  — List user orders
POST /orders                  — Create order
GET  /orders/:id              — Order details
PUT  /orders/:id/status       — Update order status (admin)
```

### Checkout (Agentic)

```
POST /checkout/initiate       — Start agentic checkout pipeline
POST /checkout/approve        — Approve a pending checkout
POST /checkout/reject         — Reject a pending checkout
GET  /checkout/status/:id     — Checkout pipeline status
```

### Wallet

```
GET  /wallet                  — Wallet balance + limits
POST /wallet/topup            — Add funds
GET  /wallet/transactions     — Transaction history
PUT  /wallet/limits           — Update spending limits
POST /wallet/ai-authorize     — Grant AI spending authority
```

### Buy Requests (Smart Intent)

```
POST /buy-requests            — Create a shopping list buy request
GET  /buy-requests            — List user's buy requests
GET  /buy-requests/:id        — Buy request details
PUT  /buy-requests/:id/cancel — Cancel a request
```

### AI Chat

```
POST /chat/message            — Send message to AI copilot
GET  /chat/history            — Get chat history
DELETE /chat/history          — Clear chat history
```

### Feature Flags

```
GET  /feature-flags           — List all flags
GET  /feature-flags/:name     — Get specific flag
POST /feature-flags           — Create / update flag (admin)
```

### Seller Copilot

```
POST /seller/listings/generate    — AI-generate listing content
GET  /seller/demand-metrics       — Demand forecast for seller
GET  /seller/price-recommendations — AI price suggestions
GET  /seller/analytics            — Seller AI KPIs
```

### AI / Python Services

```
# FastAPI AI Service (port 8000 / 8001 in Docker)
GET  /                        — Service status
GET  /health                  — Health check
GET  /recommend/:userId       — Get personalised recommendations
POST /feedback                — Submit recommendation feedback

# Intent Parser (port 8002)
POST /parse                   — Parse natural language intent

# Product Aggregator (port 8003)
POST /aggregate               — Match products for intent

# Product Ranking Engine (port 8004)
POST /rank                    — Score and rank a product list
GET  /health                  — Health check
```

---

## 🔑 Environment Variables

Copy `.env.example` to `.env` (root) and `apps/web/.env.local`. Key variables:

```bash
# ── Database ────────────────────────────────────────────────────────
DATABASE_URL=postgresql://admin:password@localhost:5432/delegatecart

# ── Redis ───────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ── Kafka ───────────────────────────────────────────────────────────
KAFKA_BROKERS=localhost:9092

# ── Auth ────────────────────────────────────────────────────────────
JWT_SECRET=your-super-secret-key
NEXTAUTH_SECRET=delegatecart-secret-key
NEXTAUTH_URL=http://localhost:3000

# ── LLM Providers ───────────────────────────────────────────────────
LLM_PROVIDER=anthropic                     # anthropic | openai | groq | gemini
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
GOOGLE_GEMINI_API_KEY=AIza...

# ── Payments ────────────────────────────────────────────────────────
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
NEXT_PUBLIC_ENABLE_MOCK_PAYMENT=false

# ── Next.js Public ──────────────────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_AI_SERVICE_URL=http://localhost:8000

# ── Service URLs (server-side) ──────────────────────────────────────
API_INTERNAL_URL=http://api:3001
RANKING_SERVICE_URL=http://product-ranking-engine:8000

# ── CORS ────────────────────────────────────────────────────────────
CORS_ORIGIN=http://localhost:3000
```

See [ENV_CONFIGURATION.md](./ENV_CONFIGURATION.md) for the full reference.

---

## 🐳 Docker Deployment

### Development / Staging

```bash
# Build and start (latest stack — recommended)
docker compose -p delegatecard-tech-stack-latest-version \
               -f docker-compose.latest.yml up -d --build

# Check service health
docker compose -f docker-compose.latest.yml ps

# Tail logs for a specific service
docker compose -f docker-compose.latest.yml logs -f api

# Stop and remove containers (keep volumes)
docker compose -f docker-compose.latest.yml down

# Full teardown including volumes
docker compose -f docker-compose.latest.yml down -v
```

### Production

```bash
# Use the production compose file
docker compose -f docker-compose.prod.yml up -d --build

# Or use the automated setup script
bash setup-production.sh          # Linux / macOS
call setup-production.bat         # Windows
```

### Pre-deployment Checklist

```bash
pnpm type-check       # Zero TypeScript errors
pnpm lint             # Zero lint warnings
pnpm test             # All tests pass
pnpm build            # Production build succeeds
```

---

## 🧪 Testing

### E2E Tests (Playwright)

```bash
# Run all 128+ specs headlessly
pnpm test:e2e

# Interactive UI mode
pnpm --filter web test:e2e:ui

# Debug a specific spec
pnpm --filter web test:e2e:debug -- e2e/shopping-assistant.spec.ts

# Show last HTML report
pnpm --filter web test:e2e:report
```

Key spec files:

| File | Coverage |
|---|---|
| `shopping-assistant.spec.ts` | AI copilot chat, recommendations, approval |
| `shopping-list.spec.ts` | Smart Intent Engine end-to-end |
| `checkout.spec.ts` | Agentic checkout pipeline |
| `add-to-cart.spec.ts` | Cart add / remove / persistence |
| `round63-autocheckout-fix.spec.ts` | Auto-checkout regression |
| `round67-shopping-list-refinement.spec.ts` | Search quality |
| `autonomous-system-e2e.spec.ts` | Full autonomous purchase flow |
| `wallet-validation.spec.ts` | Wallet operations |
| `returns.spec.ts` | Returns and refund flow |
| `enterprise-features.spec.ts` | RBAC, admin, observability |

### Unit & Integration Tests

```bash
# Frontend (Vitest)
pnpm --filter web test:unit
pnpm --filter web test:coverage

# API (Jest)
pnpm --filter api test:unit
pnpm --filter api test:coverage

# Python services
cd apps/product-ranking-engine && python -m pytest test_ranking_engine.py -v
cd apps/intent-parser          && python -m pytest test_intent_parser.py -v
cd apps/product-aggregator     && python -m pytest test_product_aggregator.py -v
```

### Performance / Load Tests

```bash
# k6 must be installed: https://k6.io/docs/getting-started/installation/
pnpm load-test              # 1 000 VUs × 5 min
pnpm load-test:stress       # 10 000 VUs × 20 min
```

---

## 🔐 RBAC & Roles

| Role | Description | Admin Dashboard | AI Preferences | Observability | Self-Learning | Scoring Dims | Impersonate |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `admin` | Full platform access | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `analytics` | Data + metrics access | — | ✅ | ✅ | ✅ | — | — |
| `observability` | System health monitoring | — | ✅ | ✅ | — | — | — |
| `reinforced-learning` | RL feedback & learning | — | ✅ | — | ✅ | — | — |
| `aiplus` | AI+ subscription features | — | ✅ | — | — | — | — |
| `basic` | Standard logged-in user | — | — | — | — | — | — |
| `customer` | Guest / new user | — | — | — | — | — | — |

Demo users for testing are seeded automatically via `pnpm db:seed`.

---

## 🔗 Useful Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [NestJS Documentation](https://docs.nestjs.com)
- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Kafka (Confluent) Documentation](https://docs.confluent.io)
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Detailed system design
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) — Full schema reference
- [API_REFERENCE.md](./API_REFERENCE.md) — Complete API docs
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Deployment guide
- [COMMANDS.md](./COMMANDS.md) — All commands reference
- [ENV_CONFIGURATION.md](./ENV_CONFIGURATION.md) — Environment variables

---

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/my-feature`
3. **Implement** your changes following the existing patterns
4. **Test** thoroughly: `pnpm test && pnpm lint && pnpm type-check`
5. **Commit** with a descriptive message
6. **Open** a Pull Request

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

**Version:** 2.0.0  
**Maintained by:** [Jagadish Sahu](https://github.com/jagadishsahuai2022)  
**Created:** 2026
