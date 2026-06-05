# Autopilot Engine - Integration Guide

This document explains how the Autopilot Engine integrates with other services in the Delegate Cart ecosystem.

## System Architecture

```
┌─────────────────┐
│   React/Next.js │
│   Web Frontend  │
│   (apps/web)    │
└────────┬────────┘
         │ HTTP
         ▼
    ┌────────────────────────────────────┐
    │    API Gateway / Load Balancer     │
    └────┬──────────────────────────┬────┘
         │                          │
         ▼ HTTP                     ▼ gRPC
    ┌──────────────┐        ┌─────────────────┐
    │  NestJS API  │        │  Auth Service   │
    │  (apps/api)  │        │  (if separate)  │
    └──────┬───────┘        └─────────────────┘
           │
           ▼ Events (Kafka)
    ┌──────────────────────────────────────────┐
    │          Kafka Event Bus                 │
    │  ┌──────────────────────────────────┐   │
    │  │ Topics:                           │   │
    │  │ - price.updates                  │   │
    │  │ - ranking.scores                 │   │
    │  │ - intent.parsed                  │   │
    │  │ - purchase.completed             │   │
    │  │ - autopilot.*                    │   │
    │  └──────────────────────────────────┘   │
    └───────┬──────────────────────┬──────────┘
            │                      │
      ┌─────▼──────┐    ┌─────────▼────────────────────┐
      │  Ranking   │    │  Autopilot Engine            │
      │  Engine    │    │  ┌─────────────────────────┐ │
      │  (Python)  │    │  │ Rule Engine             │ │
      │            │    │  │ Decision Engine         │ │
      │            │    │  │ Safety Layer            │ │
      │            │    │  │ Explainability Layer    │ │
      │            │    │  └─────────────────────────┘ │
      └────┬───────┘    └──────────────┬───────────────┘
           │                           │
           └──────────────┬────────────┘
                          │
           ┌──────────────┼──────────────┐
           ▼              ▼              ▼
    ┌────────────┐ ┌──────────┐ ┌────────────┐
    │ PostgreSQL │ │  Redis   │ │  RabbitMQ  │
    │ (Database) │ │ (Cache)  │ │(Async Jobs)│
    └────────────┘ └──────────┘ └────────────┘
```

## Service Integration Points

### 1. NestJS API Service (apps/api)

**Connection**: HTTP + Kafka Events

#### API Endpoints Called by Autopilot:

```typescript
// Get user data
GET /api/v1/users/:userId

// Get product details
GET /api/v1/products/:productId

// Create order (when autopilot executes)
POST /api/v1/orders
{
  userId: string;
  items: Array<{ productId: string; quantity: number }>;
  source: 'autopilot';  // Tag as autopilot purchase
  metadata: { ruleId, decisionId };
}

// Update order status
PUT /api/v1/orders/:orderId
{ status: 'autopilot-approved', automatedBy: ruleId }

// Get user wallet balance (for validation)
GET /api/v1/wallet/:userId
```

#### Events Published to Kafka:

```
Topic: autopilot.rules.created
{
  type: 'rule.created',
  ruleId: string,
  userId: string,
  timestamp: Date
}

Topic: autopilot.triggered
{
  type: 'decision.triggered',
  ruleId: string,
  userId: string,
  productId: string,
  decisionId: string,
  confidence: number
}

Topic: autopilot.executed
{
  type: 'autopilot.executed',
  ruleId: string,
  userId: string,
  productId: string,
  orderId: string,
  success: boolean,
  timestamp: Date
}
```

#### Events Consumed from Kafka:

```
Topic: purchase.completed
{
  orderId: string,
  userId: string,
  items: Array<{productId, price}>,
  timestamp: Date
}

Topic: user.profile.updated
{
  userId: string,
  changes: { creditScore?, preferredCategories?, etc }
}
```

**Integration Pattern**: REST for data, Kafka for events

### 2. Ranking Engine (apps/product-ranking-engine)

**Connection**: Kafka Events

#### Events Consumed:

```
Topic: ranking.scores
{
  productId: string,
  score: number,     // 0-100
  factors: {
    quality: number,
    popularity: number,
    price_factor: number,
    user_affinity: number
  },
  timestamp: Date
}
```

**Used By**: DecisionEngine.calculateConfidenceScore()

**Integration Pattern**: Async Kafka events

### 3. Intent Parser (apps/intent-parser)

**Connection**: Kafka Events (Real-time user intent)

#### Events Consumed:

```
Topic: intent.parsed
{
  userId: string,
  intent: string,           // 'search', 'buy', 'compare', etc
  category: string,         // Product category
  budget: number,           // User's budget
  confidence: number,       // 0-100
  keywords: string[],
  timestamp: Date
}
```

**Used By**: DecisionEngine for intent scoring

**Integration Pattern**: Event-driven intent signals

### 4. Product Aggregator (apps/product-aggregator)

**Connection**: HTTP (Catalog queries)

#### API Endpoints Called:

```
GET /api/v1/products?category=smartphones
  Returns: ProductData[]

GET /api/v1/products/:productId/details
  Returns: Full product information

GET /api/v1/products/search?query=iphone&maxPrice=50000
  Returns: Filtered products
```

**Integration Pattern**: REST for catalog queries

### 5. PostgreSQL Database

**Connection**: Prisma ORM

#### Tables (to be created):

```sql
-- Autopilot rules
CREATE TABLE autopilot_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  conditions JSONB NOT NULL,
  action JSONB NOT NULL,
  status TEXT DEFAULT 'active',
  max_spend_per_month DECIMAL,
  max_order_value DECIMAL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  trigger_count INT DEFAULT 0,
  success_count INT DEFAULT 0,
  failure_count INT DEFAULT 0,
  last_triggered_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Decision logs
CREATE TABLE autopilot_decisions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  rule_id TEXT,
  product_id TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  should_proceed BOOLEAN,
  confidence DECIMAL,
  risk_level TEXT,
  reasoning JSONB,
  requires_approval BOOLEAN,
  status TEXT, -- 'pending', 'approved', 'executed', 'rejected'
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (rule_id) REFERENCES autopilot_rules(id)
);

-- Anomalies
CREATE TABLE autopilot_anomalies (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  detection_type TEXT,
  severity TEXT, -- 'low', 'medium', 'high'
  details JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Approval requests
CREATE TABLE autopilot_approvals (
  id TEXT PRIMARY KEY,
  decision_id TEXT,
  user_id TEXT NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP,
  response_reason TEXT,
  FOREIGN KEY (decision_id) REFERENCES autopilot_decisions(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Integration Pattern**: Prisma models and repositories

### 6. Redis Cache

**Connection**: node-redis client

#### Cache Keys:

```typescript
// Cache user purchase history
`user:${userId}:purchase-history` -> UserPurchaseHistory

// Cache active rules for user
`user:${userId}:rules:active` -> AutopilotRule[]

// Cache product ranking score
`product:${productId}:ranking` -> RankingScore

// Cache decision results (for 5 minutes)
`decision:${decisionId}` -> AutopilotDecision

// Rate limiting
`ratelimit:autopilot:${userId}` -> number
```

**Usage Pattern**:

- Cache user data for faster decision making
- Store decision results for audit trail
- Rate limiting on API endpoints

**Integration Pattern**: Async cache with TTL

### 7. Kafka Consumer Groups

**Consumer Group**: `autopilot-engine-group`

**Partition Strategy**:

- Partition by `userId` for in-order processing
- Ensures all events for a user are processed sequentially

**Offset Management**: Auto-commit after successful processing

## Data Flow Examples

### Example 1: User Creates Autopilot Rule

```
1. User (Frontend)
   POST /api/v1/autopilot/rules { name, conditions, maxSpend, etc }

2. AutopilotController
   → RuleEngine.createRule()
   → Save to database
   → KafkaProducerService.publishRuleCreated()

3. Kafka Topic: autopilot.rules.created
   → Event published

4. API Service (listening)
   → Update user profile: "has active autopilot rules"

5. Response to Frontend
   {
     success: true,
     data: { id, name, status, createdAt },
     message: "Rule created successfully"
   }

6. Frontend
   → Show notification: "Autopilot rule activated"
   → Add to user's dashboard
```

### Example 2: Matching Product Triggers Decision

```
1. Price Update Event (Kafka: price.updates)
   {
     productId: "prod-123",
     newPrice: 12000,
     oldPrice: 15000
   }

2. AutopilotEngine (listening)
   → Get user's active rules
   → Check rule conditions (price <= 15000? ✓)
   → Fetch product details from aggregator
   → Get user's purchase history from Redis

3. DecisionEngine.makeDecision()
   → Calculate confidence score (85%)
   → Generate reasoning
   → Check safety limits
   → Create decision record

4. Publish to Kafka: autopilot.triggered
   {
     type: 'decision.triggered',
     decisionId: "dec-456",
     confidence: 0.85,
     requiresApproval: false
   }

5. If shouldProceed && confidence > 0.8:
   → Call API Service: POST /orders
   → API creates order

6. Publish to Kafka: autopilot.executed
   {
     orderId: "ord-789",
     success: true,
     timestamp: Date
   }

7. Frontend (WebSocket listener)
   → Receives execution event
   → Updates dashboard: "Order placed automatically"
   → Shows decision details & reasoning
```

### Example 3: Safety Layer Triggers Approval

```
1. Decision with medium confidence (0.72)
   OR
1. Unusual purchase pattern detected

2. DecisionEngine
   → requiresApproval = true
   → Publish to Kafka: autopilot.approval_required

3. API Service
   → Create approval request record
   → Send notification to user (SMS/Email/Push)

4. User Reviews & Approves
   → Dashboard shows: "Autopilot approval needed"
   → Displays decision reason & details
   → User clicks "Approve" or "Reject"

5. Frontend
   → PUT /api/approvals/:id { status: 'approved' }

6. AutopilotEngine
   → Receive approval event
   → Call API: POST /orders
   → Publish: autopilot.executed

7. Feedback loop
   → Record: User approved medium-confidence decision
   → ML learns from user behavior
```

## Environment & Configuration

### Cross-Service Communication

```env
# In apps/autopilot-engine/.env

# API Service connection
API_SERVICE_URL=http://api:3001/api/v1

# Other services
RANKING_SERVICE_URL=http://ranking-engine:8000
INTENT_PARSER_URL=http://intent-parser:8001
PRODUCT_AGGREGATOR_URL=http://aggregator:8002

# Shared Kafka brokers
KAFKA_BROKERS=kafka1:9092,kafka2:9092,kafka3:9092

# Shared PostgreSQL
DATABASE_URL=postgresql://user:pass@postgres:5432/delegate_cart

# Shared Redis
REDIS_URL=redis://redis:6379
```

## Error Handling

### Resilience Patterns

1. **Service Unavailable**:

   ```typescript
   try {
     const ranking = await fetchRankingScore(productId);
   } catch (error) {
     // Fallback to default score
     const ranking = 50;
   }
   ```

2. **Kafka Broker Down**:
   - Retry with exponential backoff
   - Queue events in memory temporarily
   - Log for manual investigation

3. **Database Connection Error**:
   - Use cached data if available
   - Return degraded service response
   - Alert on-call engineer

## Testing Integration

### Unit Tests

- Mock Kafka producer/consumer
- Mock API calls via axios
- Use in-memory maps for storage

### Integration Tests

- Use TestContainers for PostgreSQL/Redis/Kafka
- Run against local docker-compose stack
- Test real event flow

### E2E Tests

- Test complete workflow through web app
- Create rule → Trigger product → Approve → Order placed

## Performance Considerations

1. **Latency Budget**:
   - Rule evaluation: <100ms
   - Decision scoring: <250ms
   - Total E2E: <2 seconds

2. **Scale**:
   - Support 100K+ concurrent rules
   - Handle 10K events/second from Kafka
   - Process 1M+ decisions/day

3. **Optimization**:
   - Index rules by userId + category
   - Cache confidence factors
   - Use Kafka partitioning for parallelism

## Monitoring & Alerting

### Key Metrics

- Rules created/modified/deleted per day
- Decision accuracy (user confirmation rate)
- Average confidence score
- Kafka consumer lag
- Database query latency
- API response times

### Alerts

- Consumer lag > 10 seconds
- Decision failures > 5%
- API latency > 2 seconds
- Database connections exhausted
- Kafka broker unavailable

---

For detailed API documentation, see [API_REFERENCE.md](../../API_REFERENCE.md)
For deployment details, see [DEPLOYMENT_GUIDE_LOCAL.md](../../DEPLOYMENT_GUIDE_LOCAL.md)
