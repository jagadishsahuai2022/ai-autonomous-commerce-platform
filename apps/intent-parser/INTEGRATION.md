# Intent Parser - Integration Guide

## 🏗️ Architecture Overview

```
BUY REQUEST FLOW:
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  1. Frontend/API                                                │
│     └─ User creates buy request                                 │
│        POST /api/buy-request                                    │
│                                                                  │
│  2. Buy Request API (NestJS)                                    │
│     └─ Saves to database                                        │
│     └─ Emit: buy_request.created event to Kafka                │
│                                                                  │
│  3. Kafka Topic: buy_request.created                            │
│     └─ Event published with full BuyRequest data               │
│                                                                  │
│  4. Intent Parser Service (FastAPI)  ← THIS SERVICE            │
│     └─ Consume: buy_request.created                             │
│     └─ Call LLM: Extract intent (2-3 seconds)                  │
│     └─ Emit: intent.processed event to Kafka                   │
│                                                                  │
│  5. Kafka Topic: intent.processed                               │
│     └─ Event published with ProcessedIntentResponse            │
│                                                                  │
│  6. Downstream Services                                         │
│     ├─ Product Matcher (FastAPI)                               │
│     │  └─ Consume: intent.processed                             │
│     │  └─ Find matching products                               │
│     │  └─ Emit: products.matched                               │
│     │                                                            │
│     ├─ Recommendation Engine                                    │
│     │  └─ Use normalized_category + keywords                    │
│     │  └─ Improved recommendations                              │
│     │                                                            │
│     └─ Analytics Pipeline                                       │
│        └─ Track intent trends                                  │
│        └─ Category distribution                                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔗 Connection Points

### 1. Receiving Buy Requests

**Source:** NestJS Buy Request API (`apps/api/src/modules/buy-request/`)

**Event Format:**

```json
{
  "event_type": "buy_request.created",
  "buyRequest": {
    "id": 123,
    "userId": 1,
    "productName": "Wireless Headphones",
    "description": "Premium noise-cancelling",
    "budgetMin": 200,
    "budgetMax": 500,
    "qualityScore": 8,
    "preferredBrands": ["Sony", "Bose"],
    "deliveryDate": "2026-04-15",
    "autoExecute": true,
    "notifyChannels": ["email"],
    "status": "pending",
    "createdAt": "2026-03-22T10:30:00Z",
    "updatedAt": "2026-03-22T10:30:00Z"
  },
  "metadata": {
    "timestamp": "2026-03-22T10:30:00Z",
    "source": "api"
  }
}
```

**Kafka Topic:** `buy_request.created`

To emit this event from NestJS:

```typescript
// In buy-request.service.ts or controller

import { KafkaService } from '../kafka/kafka.service';

@Inject()
private kafkaService: KafkaService;

async create(userId: number, dto: CreateBuyRequestDto) {
  // ... validation ...

  const buyRequest = await this.prisma.buyRequest.create({ data: {...} });

  // Emit event
  await this.kafkaService.emit('buy_request.created', {
    event_type: 'buy_request.created',
    buyRequest: buyRequest,
    metadata: {
      timestamp: new Date().toISOString(),
      source: 'api'
    }
  });

  return buyRequest;
}
```

---

### 2. Processing Intents

**Service:** Intent Parser (`apps/intent-parser/main.py`)

**Flow:**

1. Consume `buy_request.created` events
2. Extract BuyRequest data
3. Call LLM with structured prompt
4. Parse and validate LLM response
5. Calculate confidence scores
6. Produce `intent.processed` event

**Response Format:**

```json
{
  "event_type": "intent.processed",
  "requestId": 123,
  "userId": 1,
  "processedIntent": {
    "normalized_category": {
      "primary_category": "Audio Equipment > Headphones",
      "secondary_category": "Wireless Headphones",
      "category_confidence": 0.95
    },
    "refined_keywords": [
      { "keyword": "noise_cancelling", "priority": 0.95, "type": "feature" },
      { "keyword": "premium", "priority": 0.85, "type": "quality" },
      { "keyword": "wireless", "priority": 0.9, "type": "feature" }
    ],
    "inferred_use_case": {
      "primary_use_case": "professional_audio",
      "secondary_use_cases": ["travel", "casual_listening"],
      "inferred_features": ["active_noise_cancelling", "long_battery_life"],
      "missing_details": ["preferred_color", "connectivity_preference"],
      "inference_confidence": 0.88
    },
    "brand_priority_score": {
      "specified_brands": ["Sony", "Bose"],
      "brand_confidence": 0.92,
      "alternative_brands": ["Apple", "Sennheiser", "Audio-Technica"]
    },
    "budget_clarity_score": {
      "min_budget": 200,
      "max_budget": 500,
      "budget_range": 300,
      "price_sensitivity": "medium",
      "price_clarity_score": 0.95
    },
    "overall_confidence": 0.91,
    "processing_timestamp": "2026-03-22T10:32:00Z",
    "llm_model_used": "gpt-4-turbo-preview"
  },
  "metadata": {
    "llmModel": "gpt-4-turbo-preview",
    "source": "intent-parser-service"
  }
}
```

**Kafka Topic:** `intent.processed`

---

### 3. Consuming Processed Intents

**Example:** Product Matcher Service

```typescript
// products-matcher.service.ts

@Inject()
private kafkaService: KafkaService;

async onModuleInit() {
  await this.kafkaService.subscribe('intent.processed',
    this.handleIntentProcessed.bind(this)
  );
}

private async handleIntentProcessed(event: any) {
  const { requestId, userId, processedIntent } = event;

  const {
    normalized_category,
    refined_keywords,
    inferred_use_case,
    brand_priority_score,
    budget_clarity_score,
    overall_confidence
  } = processedIntent;

  // Skip if low confidence
  if (overall_confidence < 0.6) {
    logger.warn(`Low confidence for request ${requestId}, skipping match`);
    return;
  }

  // Search products using normalized intent
  const matchedProducts = await this.findProducts({
    category: normalized_category.primary_category,
    keywords: refined_keywords.map(k => k.keyword),
    brands: brand_priority_score.specified_brands,
    budgetMin: budget_clarity_score.min_budget,
    budgetMax: budget_clarity_score.max_budget,
    minQuality: 7 // Inferred from qualityScore
  });

  // Rank products by keyword matches
  const rankedProducts = this.rankByKeywordMatch(
    matchedProducts,
    refined_keywords
  );

  // Store matches
  await this.prisma.productMatch.create({
    data: {
      buyRequestId: requestId,
      userId,
      matchedProducts: rankedProducts,
      confidenceScore: overall_confidence,
      createdAt: new Date()
    }
  });

  // Emit event for next stage
  await this.kafkaService.emit('products.matched', {
    requestId,
    userId,
    matchedProducts: rankedProducts,
    matchConfidence: overall_confidence
  });
}
```

---

## 📊 Data Usage Examples

### Using Normalized Category

```typescript
// Frontend: Show category-specific UI
const categoryUI = {
  'Electronics > Headphones': <HeadphoneFilters />,
  'Fashion > Shoes': <ShoeFilters />,
  'Home > Furniture': <FurnitureFilters />
}[intent.normalized_category.primary_category];
```

### Using Refined Keywords

```typescript
// Search: Use keywords for better matching
query = {
  fullText: refined_keywords.map((k) => k.keyword).join(' '),
  boosted: refined_keywords.filter((k) => k.priority > 0.8).map((k) => k.keyword),
};
```

### Using Inferred Use Case

```typescript
// Recommendations: Show relevant accessories
if (inferred_use_case.primary_use_case === 'gaming_and_content_creation') {
  // Show: high-performance GPU, fast SSD, gaming mouse, microphone
}

if (inferred_use_case.primary_use_case === 'travel_audio') {
  // Show: wireless headphones, compact design, long battery
}
```

### Using Brand Priority

```typescript
// Personalization: Remember brand preferences
userProfile.preferredBrands = brand_priority_score.specified_brands;
userProfile.alternativeBrands = brand_priority_score.alternative_brands;

// Product ranking: Boost preferred brands in search results
rankedResults = results.sort((a, b) => {
  const aBrandBoost = brand_priority_score.specified_brands.includes(a.brand) ? 1.5 : 1.0;
  const bBrandBoost = brand_priority_score.specified_brands.includes(b.brand) ? 1.5 : 1.0;
  return b.relevance * bBrandBoost - a.relevance * aBrandBoost;
});
```

### Using Budget Clarity

```typescript
// Filter: Apply budget constraints
const priceSensitivity = budget_clarity_score.price_sensitivity;

if (priceSensitivity === 'low') {
  // Strict budget adherence, show exact range
  filter.price = {
    $gte: budget_clarity_score.min_budget,
    $lte: budget_clarity_score.max_budget,
  };
} else if (priceSensitivity === 'high') {
  // Flexible budget, slightly expand range for options
  const expandedRange = budget_clarity_score.budget_range * 0.15;
  filter.price = {
    $gte: budget_clarity_score.min_budget - expandedRange,
    $lte: budget_clarity_score.max_budget + expandedRange,
  };
}
```

---

## 🔄 Kafka Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  TIME ──────────────────────────────────────────────────────>  │
│                                                                 │
│  API Service (NestJS)                                          │
│  ├─ T+0: Receive POST /api/buy-request                        │
│  ├─ T+50ms: Save to database                                  │
│  └─ T+100ms: Publish event to Kafka                           │
│                    │                                            │
│       ┌────────────▼─────────────┐                             │
│       │ Kafka: buy_request.      │                             │
│       │ created topic            │                             │
│       └────────────┬─────────────┘                             │
│                    │                                            │
│  Intent Parser                                                 │
│  ├─ T+150ms: Consume event                                    │
│  ├─ T+200ms: Build LLM prompt                                 │
│  ├─ T+2500ms: LLM response received                           │
│  ├─ T+2600ms: Parse & validate                               │
│  └─ T+2700ms: Publish to Kafka                               │
│                    │                                            │
│       ┌────────────▼─────────────┐                             │
│       │ Kafka: intent.           │                             │
│       │ processed topic          │                             │
│       └────────────┬─────────────┘                             │
│                    │                                            │
│  Product Matcher                                               │
│  ├─ T+2750ms: Consume event                                   │
│  ├─ T+2800ms: Query products                                  │
│  ├─ T+3500ms: Ranking complete                                │
│  └─ T+3600ms: Store matches & emit                            │
│                                                                 │
│  Frontend                                                      │
│  ├─ T+100ms: Polling API for intent                           │
│  ├─ T+2000ms: Show "Processing..."                            │
│  ├─ T+3600ms: Display matched products                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Total Time: ~3.5 seconds from user submission to product display
```

---

## 🚀 Deployment Integration

### Docker Compose (All Services)

```yaml
version: '3.8'

services:
  # Existing NestJS API
  api:
    build: ./apps/api
    ports: ['3001:3001']
    depends_on: [postgres, kafka, redis]
    environment:
      KAFKA_BROKERS: kafka:29092
      KAFKA_TOPICS: buy_request.created,intent.processed

  # New Intent Parser Service
  intent-parser:
    build: ./apps/intent-parser
    ports: ['3002:3002']
    depends_on: [kafka]
    environment:
      KAFKA_BOOTSTRAP_SERVERS: kafka:29092
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      LLM_PROVIDER: openai

  # Kafka
  kafka:
    image: confluentinc/cp-kafka:7.5.0
    environment:
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092
    depends_on: [zookeeper]

  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181

  # Database
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: delegatecart
      POSTGRES_PASSWORD: postgres

  # Cache
  redis:
    image: redis:7-alpine

  # Frontend
  web:
    build: ./apps/web
    ports: ['3000:3000']
    depends_on: [api]

networks:
  default:
    driver: bridge
```

**Start Everything:**

```bash
docker-compose up -d
```

**Configuration:**

- API creates buy requests → Kafka
- Intent Parser subscribes to Kafka
- Both services connected via Kafka broker

---

## 🧪 Testing End-to-End Flow

### Test 1: Direct API Test

```bash
# Step 1: Create buy request via API
curl -X POST http://localhost:3001/api/buy-request \
  -H "Content-Type: application/json" \
  -d '{...}'  # Returns requestId=123

# Step 2: Directly parse intent
curl -X POST http://localhost:3002/intent/parse \
  -H "Content-Type: application/json" \
  -d '{
    "buyRequest": {...}
  }'  # Returns ProcessedIntentResponse

# Step 3: Verify fields
# - Check: normalized_category
# - Check: refined_keywords
# - Check: overall_confidence
```

### Test 2: Kafka Event Flow

```bash
# Terminal 1: Monitor intent.processed topic
docker-compose exec kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic intent.processed \
  --from-beginning \
  --max-messages 1 | jq .

# Terminal 2: Create buy request
curl -X POST http://localhost:3001/api/buy-request \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "Gaming Mouse",
    "budgetMin": 50,
    "budgetMax": 150,
    "qualityScore": 8,
    "preferredBrands": ["Razer", "SteelSeries"],
    "deliveryDate": "2026-03-28",
    "autoExecute": true
  }'

# Observe in Terminal 1:
# - Event appears in intent.processed topic
# - Check fields in output
```

---

## 📈 Monitoring & Observability

### Metrics to Track

```python
# In intent-parser services, add metrics:

from prometheus_client import Counter, Histogram, Gauge

intent_processing_time = Histogram(
    'intent_processing_seconds',
    'Time to process intent',
    buckets=(1, 2, 3, 5, 10)
)

intent_confidence_score = Gauge(
    'intent_overall_confidence',
    'Overall confidence of processed intent'
)

processing_errors = Counter(
    'intent_processing_errors_total',
    'Total processing errors',
    labelnames=['error_type']
)
```

### Alerting Rules

```yaml
groups:
  - name: intent-parser
    rules:
      - alert: IntentProcessingLatency
        expr: intent_processing_seconds_bucket{le="5"} < 0.8
        annotations:
          summary: 'Intent processing slower than expected'

      - alert: LowConfidenceIntents
        expr: intent_overall_confidence < 0.6
        annotations:
          summary: 'Low confidence processing detected'

      - alert: ProcessingErrors
        expr: rate(intent_processing_errors_total[5m]) > 0.01
        annotations:
          summary: 'Intent processing error rate elevated'
```

---

## 🔐 Security Considerations

1. **API Key Management**
   - Store OpenAI key in secrets manager
   - Never commit to Git
   - Use environment variables

2. **Kafka Security**
   - Use SSL/TLS in production
   - Add authentication (SASL)
   - Restrict topic permissions

3. **Data Privacy**
   - Log intent without sensitive data
   - PII handling in LLM prompts
   - GDPR compliance for EU users

4. **Rate Limiting**
   - Limit LLM API calls per user
   - Implement backpressure in Kafka
   - Queue overload scenarios

---

## ✅ Integration Checklist

- [ ] Intent Parser service running
- [ ] Kafka broker accessible
- [ ] NestJS API configured to emit events
- [ ] buy_request.created topic has messages
- [ ] Intent parser consuming events
- [ ] intent.processed topic has output
- [ ] Downstream services consuming results
- [ ] Monitoring/logging configured
- [ ] Error handling tested
- [ ] End-to-end flow verified

---

**Integration Complete!** Your e-commerce platform now has AI-powered intent processing. 🚀
