# DelegateCart — Technical KT (Knowledge Transfer) Documentation

## For Staff Engineer & AI Architect Interview Preparation

---

## 1. Repository Structure & Build System

### 1.1 Monorepo Architecture (Turborepo + pnpm)

```
delegatecart/                      # Root monorepo
├── turbo.json                     # Turborepo pipeline config
├── pnpm-workspace.yaml            # pnpm workspace definition
├── package.json                   # Root scripts & devDependencies
├── tsconfig.json                  # Root TypeScript config
├── docker-compose.yml             # All services orchestration
├── apps/                          # Application packages
│   ├── api/                       # NestJS Backend (Port 3001)
│   ├── web/                       # Next.js Frontend (Port 3000)
│   ├── ai-service/                # FastAPI Python (Port 8000)
│   ├── autopilot-engine/          # NestJS Autonomous Engine
│   ├── intent-parser/             # FastAPI NLP Service
│   ├── product-aggregator/        # FastAPI Aggregator
│   └── product-ranking-engine/    # FastAPI ML Ranking
├── packages/                      # Shared libraries
│   ├── types/                     # Shared TypeScript types
│   ├── ui/                        # Shared React components
│   └── config/                    # Shared configs
├── infra/                         # Infrastructure configs
│   ├── docker/                    # Dockerfiles per service
│   ├── kafka/                     # Kafka topic configs
│   ├── kubernetes/                # K8s manifests
│   └── postgres/                  # DB scripts
└── scripts/                       # Utility & migration scripts
```

**Why Monorepo?**
- **Atomic changes**: Frontend + backend changes in a single commit
- **Shared types**: TypeScript interfaces shared between apps/api and apps/web
- **Dependency deduplication**: pnpm hoists shared dependencies
- **Unified CI/CD**: Single pipeline builds and tests everything
- **Consistent tooling**: ESLint, TypeScript, Prettier configs shared

### 1.2 Build Pipeline (Turborepo)

```json
// turbo.json pipeline configuration
{
  "pipeline": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["build"] }
  }
}
```

**Key Commands**:
```bash
pnpm dev              # Start all apps in dev mode (parallel)
pnpm build            # Build all apps (respects dependency graph)
pnpm lint             # Lint all packages
pnpm test             # Run all tests
docker compose up -d  # Start infrastructure (Postgres, Redis, Kafka)
```

---

## 2. NestJS API — Deep Technical Walkthrough

### 2.1 Module System & Dependency Injection

NestJS uses a hierarchical module system with dependency injection (DI). Every feature is encapsulated in a module.

**Module Registration Pattern**:
```typescript
// app.module.ts — Root module
@Module({
  imports: [
    AuthModule,
    ProductModule,
    CartModule,
    OrderModule,
    CheckoutModule,
    WalletModule,
    PaymentModule,
    AIMemoryModule,
    AIChatModule,
    AIExecutionModule,
    AgentModule,
    BuyRequestModule,
    SellerCopilotModule,
    ACPModule,
    FeatureFlagModule,
    AddressModule,
    KafkaModule,
    WebSocketModule,
    CoreServicesModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService, RedisService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware, RateLimitMiddleware, TimeoutMiddleware)
      .forRoutes('*');
  }
}
```

### 2.2 Request Lifecycle

```
HTTP Request Arrives
    │
    ▼
┌─────────────────────────────────────────────┐
│ Middleware Chain (executed in order)          │
│  1. CorrelationIdMiddleware                  │
│     → Assign X-Correlation-ID header         │
│  2. RateLimitMiddleware                      │
│     → Check Redis token bucket               │
│  3. TimeoutMiddleware                        │
│     → Set 30s request timeout                │
│  4. IdempotencyMiddleware                    │
│     → Check Redis for duplicate request key   │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│ Guards (authentication + authorization)      │
│  1. JwtGuard                                │
│     → Extract Bearer token                   │
│     → Verify JWT signature                   │
│     → Attach user to request                 │
│  2. RBACGuard (if decorated)                │
│     → Check user.role against required role  │
│  3. CSRFGuard (if state-changing)           │
│     → Verify CSRF token                      │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│ Interceptors (cross-cutting concerns)        │
│  LoggingInterceptor                          │
│     → Log request method, URL, timing        │
│     → Log response status, duration          │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│ Pipe (validation)                            │
│  ValidationPipe (global)                     │
│     → class-validator decorators             │
│     → Transform & whitelist DTO              │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│ Controller Handler                           │
│     → Route to correct method                │
│     → Delegate to Service layer              │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│ Service Layer                                │
│     → Business logic execution               │
│     → Prisma ORM for DB operations           │
│     → Redis for caching                      │
│     → Kafka for event publishing             │
└──────────────────┬──────────────────────────┘
                   ▼
                Response
```

### 2.3 Authentication Implementation

```typescript
// auth.service.ts
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    // 1. Hash password with bcrypt (10 salt rounds)
    const passwordHash = await bcrypt.hash(dto.password, 10);
    
    // 2. Create user with default role
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        role: 'customer',
        subscriptionPlan: 'BASIC',
      },
    });
    
    // 3. Create associated wallet
    await this.prisma.wallet.create({
      data: { userId: user.id, balance: 0 },
    });
    
    // 4. Generate JWT
    return { token: this.jwtService.sign({ userId: user.id, email: user.email, role: user.role }) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return { token: this.jwtService.sign({ userId: user.id, email: user.email, role: user.role }) };
  }
}
```

### 2.4 Prisma ORM Integration

```typescript
// prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();  // Connection pooling handled by Prisma
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

// Usage in services — type-safe queries
const products = await this.prisma.product.findMany({
  where: {
    category: { contains: query, mode: 'insensitive' },
    price: { lte: maxPrice },
  },
  orderBy: { price: 'asc' },
  take: 20,
  include: { businessMetrics: true },
});
```

### 2.5 Redis Caching Strategy

```typescript
// redis.service.ts
@Injectable()
export class RedisService {
  private client: Redis;
  
  constructor() {
    this.client = new Redis(process.env.REDIS_URL);
  }

  // Cache-aside pattern
  async getOrSet<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
    const cached = await this.client.get(key);
    if (cached) return JSON.parse(cached);
    
    const value = await factory();
    await this.client.setex(key, ttlSeconds, JSON.stringify(value));
    return value;
  }

  // Rate limiting with token bucket
  async checkRateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
    const count = await this.client.incr(key);
    if (count === 1) await this.client.expire(key, windowSec);
    return count <= limit;
  }
}
```

### 2.6 Kafka Producer/Consumer

```typescript
// kafka.service.ts
@Injectable()
export class KafkaService implements OnModuleInit {
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;

  async onModuleInit() {
    this.kafka = new Kafka({
      clientId: 'api-service',
      brokers: [process.env.KAFKA_BROKERS],
    });
    this.producer = this.kafka.producer();
    await this.producer.connect();
  }

  async publish(topic: string, event: DomainEvent) {
    await this.producer.send({
      topic,
      messages: [{
        key: event.aggregateId,
        value: JSON.stringify(event),
        headers: { correlationId: event.metadata.correlationId },
      }],
    });
  }

  async subscribe(topic: string, groupId: string, handler: (message) => Promise<void>) {
    const consumer = this.kafka.consumer({ groupId });
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });
    await consumer.run({ eachMessage: handler });
  }
}
```

### 2.7 WebSocket Gateway

```typescript
// websocket.gateway.ts
@WebSocketGateway({
  cors: { origin: process.env.WEB_URL, credentials: true },
  namespace: '/ws',
})
export class WebSocketGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;

  handleConnection(client: Socket) {
    const userId = this.extractUserId(client);
    client.join(`user:${userId}`);
  }

  // Push order status updates to specific user
  notifyOrderUpdate(userId: number, order: OrderUpdate) {
    this.server.to(`user:${userId}`).emit('order:status', order);
  }

  // Push recommendation updates
  notifyRecommendation(userId: number, recommendations: Product[]) {
    this.server.to(`user:${userId}`).emit('recommendations', recommendations);
  }
}
```

### 2.8 Circuit Breaker Pattern

```typescript
// circuit-breaker.service.ts
@Injectable()
export class CircuitBreakerService {
  private circuits: Map<string, CircuitState> = new Map();

  async execute<T>(serviceName: string, operation: () => Promise<T>): Promise<T> {
    const state = this.getState(serviceName);
    
    if (state.status === 'OPEN') {
      if (Date.now() - state.lastFailure > state.cooldownMs) {
        state.status = 'HALF_OPEN';  // Try one request
      } else {
        throw new ServiceUnavailableException(`${serviceName} circuit is open`);
      }
    }

    try {
      const result = await operation();
      this.recordSuccess(serviceName);
      return result;
    } catch (error) {
      this.recordFailure(serviceName);
      if (state.failures >= state.threshold) {
        state.status = 'OPEN';
        state.lastFailure = Date.now();
      }
      throw error;
    }
  }
}
```

### 2.9 HITL Approval Service

```typescript
// hitl-approval.service.ts
@Injectable()
export class HITLApprovalService {
  constructor(
    private prisma: PrismaService,
    private websocket: WebSocketGateway,
    private kafka: KafkaService,
  ) {}

  async createApprovalRequest(decision: AutopilotDecision): Promise<ApprovalRequest> {
    const request = await this.prisma.approvalRequest.create({
      data: {
        userId: decision.userId,
        decisionId: decision.id,
        status: 'pending',
        reason: this.buildReason(decision),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    // Notify user via WebSocket
    this.websocket.notifyApprovalRequest(decision.userId, request);
    
    // Publish event
    await this.kafka.publish('approval-events', {
      type: 'APPROVAL_REQUESTED',
      data: request,
    });

    return request;
  }

  async approve(requestId: number, userId: number): Promise<void> {
    const request = await this.prisma.approvalRequest.update({
      where: { id: requestId, userId, status: 'pending' },
      data: { status: 'approved', approvedAt: new Date() },
    });
    
    // Trigger order execution
    await this.executeDecision(request.decisionId);
  }

  async reject(requestId: number, userId: number, reason: string): Promise<void> {
    await this.prisma.approvalRequest.update({
      where: { id: requestId, userId },
      data: { status: 'rejected', rejectedAt: new Date() },
    });
  }
}
```

---

## 3. Next.js Frontend — Technical Deep Dive

### 3.1 App Router Architecture (Next.js 14)

```
app/
├── layout.tsx          # Root layout (providers, global state)
├── page.tsx            # Home page (Server Component)
├── products/
│   ├── page.tsx        # Product listing (Server Component → client hydration)
│   └── [id]/
│       └── page.tsx    # Product detail (dynamic route)
├── dashboard/
│   └── page.tsx        # Auth-gated dashboard
├── api/
│   └── auth/
│       └── [...nextauth]/
│           └── route.ts  # NextAuth API route handler
```

**Server vs Client Components**:
- Server Components: Data fetching on server, zero client JS
- Client Components: User interactions, hooks, state
- Pattern: Server Component wraps Client Component, passing data as props

### 3.2 State Management Strategy

```typescript
// Zustand store — client state
const useCartStore = create<CartState>((set) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (id) => set((state) => ({ items: state.items.filter(i => i.id !== id) })),
  clearCart: () => set({ items: [] }),
}));

// TanStack Query — server state with caching
const { data: products, isLoading } = useQuery({
  queryKey: ['products', { category, page }],
  queryFn: () => apiClient.get('/products', { params: { category, page } }),
  staleTime: 5 * 60 * 1000,  // 5 min cache
  cacheTime: 30 * 60 * 1000, // 30 min in memory
});
```

### 3.3 API Client Pattern

```typescript
// lib/api-client.ts
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  timeout: 30000,
  withCredentials: true,
});

// Interceptor: attach JWT to every request
apiClient.interceptors.request.use((config) => {
  const token = getSessionToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Interceptor: handle 401 → redirect to login
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/signin';
    }
    return Promise.reject(error);
  }
);
```

### 3.4 WebSocket Real-Time Integration

```typescript
// lib/realtime.ts
const socket = io(process.env.NEXT_PUBLIC_API_URL, {
  path: '/ws',
  auth: { token: getSessionToken() },
});

// Listen for order status changes
socket.on('order:status', (update) => {
  queryClient.invalidateQueries(['orders', update.orderId]);
  showToast(`Order ${update.orderId}: ${update.status}`);
});

// Listen for live recommendations
socket.on('recommendations', (products) => {
  queryClient.setQueryData(['recommendations'], products);
});
```

### 3.5 RBAC Implementation (Frontend)

```typescript
// lib/admin-auth.ts
const ROLE_ACCESS: Record<Role, string[]> = {
  admin: ['/*'],  // Full access
  analytics: ['/dashboard', '/products', '/orders', '/analytics', ...],
  aiplus: ['/dashboard', '/products', '/orders', '/ai-assistant', '/smart-delegate', ...],
  observability: ['/observability', '/dashboard', '/products'],
  'reinforced-learning': ['/admin/learning', '/dashboard'],
  basic: ['/dashboard', '/products', '/cart', '/checkout', '/orders'],
  customer: ['/products', '/about', '/pricing'],
};

function canAccess(userRole: Role, path: string): boolean {
  const allowedPaths = ROLE_ACCESS[userRole] || [];
  return allowedPaths.some(p => p === '/*' || path.startsWith(p));
}
```

---

## 4. AI Service — Technical Deep Dive

### 4.1 FastAPI Event Consumer Architecture

```python
# kafka_consumer.py
class KafkaEventConsumer:
    def __init__(self):
        self.consumer = KafkaConsumer(
            'commerce-events', 'user-behavior', 'product-events',
            bootstrap_servers=os.environ.get('KAFKA_BROKERS', 'localhost:9092'),
            group_id='ai-service',
            auto_offset_reset='latest',
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
        )
    
    async def start_consuming(self):
        for message in self.consumer:
            event = DomainEvent(**message.value)
            await self.route_event(event)
    
    async def route_event(self, event: DomainEvent):
        handlers = {
            EventType.PRODUCT_VIEWED: self.tracker.handle_product_viewed,
            EventType.CART_ITEM_ADDED: self.tracker.handle_cart_item_added,
            EventType.CART_ABANDONED: self.tracker.handle_cart_abandoned,
            EventType.ORDER_CREATED: self.order_processor.handle_order_created,
            EventType.ORDER_COMPLETED: self.order_processor.handle_order_completed,
        }
        handler = handlers.get(event.type)
        if handler:
            await handler(event)
```

### 4.2 Recommendation Engine

```python
# event_processor.py
class RecommendationEngine:
    def generate_recommendations(self, user_id: int) -> list[Product]:
        # 1. Load user behavior from memory
        behavior = self.behavior_tracker.get_profile(user_id)
        
        # 2. Category affinity scoring
        category_scores = self._compute_category_affinity(behavior.viewed_categories)
        
        # 3. Brand preference scoring
        brand_scores = self._compute_brand_preference(behavior.purchased_brands)
        
        # 4. Price range fitting
        price_range = self._infer_price_range(behavior.purchase_prices)
        
        # 5. Collaborative filtering (users who bought X also bought Y)
        collaborative = self._collaborative_filter(user_id)
        
        # 6. Combine scores with weights
        candidates = self._merge_and_rank(category_scores, brand_scores, price_range, collaborative)
        
        return candidates[:20]  # Top 20 recommendations
```

### 4.3 Chat Service with Intent Detection

```python
# chat_service.py
class ChatService:
    INTENTS = {
        IntentType.PRODUCT_SEARCH: ['find', 'search', 'looking for', 'show me', 'recommend'],
        IntentType.PRICE_CHECK: ['price', 'cost', 'how much', 'expensive', 'cheap'],
        IntentType.ORDER_STATUS: ['order', 'tracking', 'shipped', 'delivery', 'where is'],
        IntentType.COMPARISON: ['vs', 'compare', 'better', 'difference between'],
    }
    
    async def process_message(self, user_id: int, message: str) -> dict:
        intent = self._detect_intent(message)
        entities = self._extract_entities(message)
        
        if intent == IntentType.PRODUCT_SEARCH:
            products = await self._search_products(entities)
            return self._format_product_response(products)
        elif intent == IntentType.ORDER_STATUS:
            orders = await self._get_user_orders(user_id)
            return self._format_order_status(orders)
        # ... other intents
```

---

## 5. Autopilot Engine — Technical Deep Dive

### 5.1 Rule Engine

```typescript
// rule-engine.ts
class RuleEngine {
  evaluate(product: Product, rule: AutopilotRule): MatchResult {
    const conditions = rule.conditions;
    const results: ConditionResult[] = [];

    // Price condition
    if (conditions.maxPrice) {
      results.push({
        condition: 'price',
        passed: product.price <= conditions.maxPrice,
        actual: product.price,
        expected: conditions.maxPrice,
      });
    }

    // Category condition
    if (conditions.category) {
      results.push({
        condition: 'category',
        passed: product.category.toLowerCase() === conditions.category.toLowerCase(),
        actual: product.category,
        expected: conditions.category,
      });
    }

    // Brand condition
    if (conditions.brands?.length) {
      results.push({
        condition: 'brand',
        passed: conditions.brands.includes(product.brand),
        actual: product.brand,
        expected: conditions.brands,
      });
    }

    // Rating condition
    if (conditions.minRating) {
      results.push({
        condition: 'rating',
        passed: product.rating >= conditions.minRating,
        actual: product.rating,
        expected: conditions.minRating,
      });
    }

    const allPassed = results.every(r => r.passed);
    return { matched: allPassed, results, matchScore: results.filter(r => r.passed).length / results.length };
  }
}
```

### 5.2 Decision Engine — Confidence Scoring

```typescript
// decision-engine.ts
class DecisionEngine {
  decide(match: MatchResult, context: DecisionContext): Decision {
    const factors = {
      ruleMatchScore: match.matchScore * 30,              // 30% weight
      historicalSuccess: context.userSuccessRate * 25,     // 25% weight
      priceStability: context.priceStabilityScore * 20,   // 20% weight
      riskAssessment: (1 - context.riskScore) * 25,       // 25% weight
    };

    const confidence = Object.values(factors).reduce((sum, v) => sum + v, 0);
    
    const riskLevel = 
      confidence >= 80 ? 'low' :
      confidence >= 50 ? 'medium' :
      confidence >= 30 ? 'high' : 'critical';

    return {
      shouldProceed: confidence >= 80,
      confidence,
      riskLevel,
      requiresApproval: confidence < 80 && confidence >= 50,
      confidenceFactors: factors,
      reasoning: this.buildReasoning(match, factors, riskLevel),
    };
  }
}
```

---

## 6. Product Ranking Engine — ML Scoring

### 6.1 Multi-Factor Weighted Algorithm

```python
# ranking_engine.py
class ProductRankingEngine:
    WEIGHTS = {
        'budget_fit': 0.25,
        'quality_score': 0.25,
        'brand_preference': 0.20,
        'delivery_speed': 0.15,
        'ratings': 0.15,
    }
    
    def score_product(self, product: dict, user_prefs: dict) -> float:
        scores = {
            'budget_fit': self._budget_fit(product['price'], user_prefs['budget']),
            'quality_score': self._quality_score(product),
            'brand_preference': self._brand_match(product['brand'], user_prefs['brands']),
            'delivery_speed': self._delivery_score(product['delivery_days']),
            'ratings': self._rating_confidence(product['rating'], product['review_count']),
        }
        
        final_score = sum(
            scores[factor] * self.WEIGHTS[factor]
            for factor in scores
        )
        return round(final_score, 4)
    
    def _budget_fit(self, price: float, budget: float) -> float:
        """ 1.0 if price == budget, decreasing as price diverges """
        if price <= budget:
            return 1.0 - (budget - price) / budget * 0.3  # Slight penalty for too cheap
        else:
            return max(0, 1.0 - (price - budget) / budget)  # Heavy penalty for over budget
    
    def _rating_confidence(self, rating: float, count: int) -> float:
        """ Rating weighted by review count for statistical confidence """
        confidence = min(1.0, count / 100)  # 100+ reviews = full confidence
        return (rating / 5.0) * confidence
```

---

## 7. Infrastructure Technical Details

### 7.1 Docker Compose Service Dependencies

```
postgres (healthcheck: pg_isready)
  ↑
redis (healthcheck: redis-cli ping)
  ↑
kafka → depends_on: zookeeper
  ↑
api → depends_on: postgres (healthy), redis (healthy), kafka (started)
  ↑
web → depends_on: api, postgres
  ↑
ai-service → depends_on: kafka, redis
```

### 7.2 Network Architecture

```
ai-commerce-network (Docker bridge)
  - All services communicate via container names
  - postgres:5432 (internal)
  - redis:6379 (internal)
  - kafka:29092 (internal), kafka:9092 (host)
  - api:3001 (internal + host)
  - web:3000 (internal + host)
  - ai-service:8000 (internal + host)
```

### 7.3 Environment Configuration

**Critical Environment Variables**:
```
DATABASE_URL=postgresql://admin:password@postgres:5432/ai_commerce
REDIS_URL=redis://redis:6379
KAFKA_BROKERS=kafka:29092
JWT_SECRET=<strong-secret>
NEXTAUTH_SECRET=<auth-secret>
NEXT_PUBLIC_API_URL=http://localhost:3001
LLM_PROVIDER=anthropic           # or openai, groq, gemini
ANTHROPIC_API_KEY=<key>
RAZORPAY_KEY_ID=<razorpay-key>
```

### 7.4 Observability Setup

```
Prometheus Metrics Endpoint: GET /metrics
├── http_request_total{method, path, status}
├── http_request_duration_seconds{method, path}
├── kafka_consumer_lag{topic, partition}
├── redis_cache_hits_total
├── redis_cache_misses_total
├── circuit_breaker_state{service}
├── wallet_transaction_total{type}
├── autopilot_decision_total{risk_level}
└── recommendation_generated_total
```

---

## 8. Testing Strategy

### 8.1 Test Types

| Type | Tool | Coverage |
|------|------|----------|
| **Unit Tests** | Jest + ts-jest | Services, utilities |
| **Integration Tests** | Jest + Supertest | API endpoints |
| **E2E Tests** | Playwright | Full user flows |
| **Performance Tests** | k6 | Load testing |

### 8.2 Test Structure

```
apps/api/
├── src/**/*.spec.ts         # Unit tests co-located with source
├── test/
│   ├── app.e2e-spec.ts      # E2E API tests
│   └── jest-e2e.json        # E2E Jest config
tests/
├── comprehensive-page-tests.spec.ts  # Full page tests
└── performance/
    └── k6-load-test.js     # k6 load test scripts
```

---

## 9. Key Design Patterns Used

| Pattern | Where | Why |
|---------|-------|-----|
| **Dependency Injection** | NestJS modules | Testability, loose coupling |
| **Repository Pattern** | Prisma service layer | Data access abstraction |
| **Adapter Pattern** | ACP merchant adapters | Unified merchant interface |
| **Observer Pattern** | Kafka pub/sub | Decoupled event handling |
| **Strategy Pattern** | LLM provider selection | Swappable AI backends |
| **Circuit Breaker** | External API calls | Fault tolerance |
| **Saga Pattern** | Autonomous checkout | Distributed transactions |
| **CQRS-lite** | Separate read/write paths | Performance optimization |
| **Event Sourcing** | Kafka event log | Audit trail, replay |
| **Decorator Pattern** | NestJS guards/interceptors | Cross-cutting concerns |
| **Factory Pattern** | Merchant adapter creation | Dynamic adapter instantiation |
| **Token Pattern** | Payment tokenization | Security |
