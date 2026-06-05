# Product Aggregator Service - Integration Guide

Complete guide for integrating the Product Aggregator with existing services.

## 🔗 Integration Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      DelegateCart Platform                  │
└─────────────────────────────────────────────────────────────┘
         ▲
         │
    [Event Bus - Kafka]
         ▲
         │
  ┌──────┴──────┐
  │             │
  │             ▼
  │      ┌─────────────────────┐
  │      │ Product Aggregator  │
  │      │ Service (NEW)       │
  │      └─────────────────────┘
  │             ▲
  │             │
  │      ┌──────┴───────────────────────────────────────┐
  │      │                                              │
  │      ▼                 ▼                    ▼       ▼
  │   [Cache]         [Internal DB]      [Amazon]  [Flipkart]
  │   (Redis)         (Adapter)          (Adapter) (Adapter)
  │
  ▼
[Intent Parser Service]
  ▲
  │
[Buy Request Service]
  ▲
  │
[Frontend]
```

### Event Flow Diagram

```
Timeline (Example):
────────────────────────────────────────────────────────────────

10:30:00 - User creates BuyRequest on frontend
          │ POST /buy-request
          ├─> NestJS API
          ├─> Save to DB
          ├─> Emit: buy_request.created (Kafka)
          └─> Return: requestId=123, status=pending

10:30:01 - Intent Parser Service
          │ Listen: buy_request.created
          ├─> Process with LLM
          ├─> Generate intent insights
          ├─> Emit: intent.processed (Kafka)
          └─> [Includes: keywords, categories, brands, budget]

10:30:03 - Product Aggregator Service
          │ Listen: intent.processed
          ├─> Check Cache ──> Hit? Return [100ms]
          │                    Miss? Query adapters [2s]
          ├─> Parallel search:
          │   ├─> Internal DB: 7 products [500ms]
          │   ├─> Amazon API: 4 products [1200ms] (+ retry)
          │   └─> Flipkart API: 5 products [800ms]
          ├─> Aggregate & Rank: 16 products [100ms]
          ├─> Cache result [50ms]
          ├─> Emit: products.fetched (Kafka)
          └─> Total: ~2300ms

10:30:05 - Product Matcher Service (Downstream)
          │ Listen: products.fetched
          ├─> Analyze products
          ├─> Generate recommendations
          ├─> Create Product Recommendations
          └─> User sees results

────────────────────────────────────────────────────────────────
Total: ~5 seconds from user request to recommendations
```

## 📥 Consuming Events

### Input: intent.processed

**Source**: Intent Parser Service  
**Topic**: `intent.processed`  
**Format**: Kafka JSON message

```json
{
  "event_type": "intent.processed",
  "requestId": 123,
  "userId": 5,
  "timestamp": "2026-03-22T10:30:01Z",
  "data": {
    "requestId": 123,
    "userId": 5,
    "normalized_category": {
      "primary_category": "Audio/Headphones",
      "secondary_category": "Wireless",
      "category_confidence": 0.95
    },
    "refined_keywords": [
      {
        "keyword": "wireless",
        "priority": 0.9,
        "type": "feature"
      },
      {
        "keyword": "noise cancellation",
        "priority": 0.8,
        "type": "feature"
      }
    ],
    "inferred_use_case": {
      "primary_use_case": "personal_audio",
      "secondary_use_cases": ["travel"],
      "inferred_features": ["ANC", "long_battery"],
      "missing_details": [],
      "inference_confidence": 0.88
    },
    "brand_priority_score": {
      "specified_brands": ["Sony", "Bose"],
      "brand_confidence": 0.85,
      "alternative_brands": ["Sennheiser"]
    },
    "budget_clarity_score": {
      "min_budget": 5000,
      "max_budget": 30000,
      "budget_range": 25000,
      "price_sensitivity": "medium",
      "price_clarity_score": 0.9
    },
    "overall_confidence": 0.88
  }
}
```

### Processing Steps

1. **Validate Event**: Check schema, timestamps, required fields
2. **Extract Intent**: Parse keywords, categories, budget
3. **Query Adapters**: Call each adapter in parallel
4. **Aggregate Results**: Combine from all sources
5. **Rank Results**: Apply relevance scoring algorithm
6. **Cache Results**: Store for future identical searches
7. **Return Response**: Unified ProductDTO list
8. **Emit Event**: Produce products.fetched to Kafka

## 📤 Producing Events

### Output: products.fetched

**Target**: Any downstream service  
**Topic**: `products.fetched`  
**Format**: Kafka JSON message  
**Frequency**: One per search request

```json
{
  "event_type": "products.fetched",
  "requestId": 123,
  "userId": 5,
  "productCount": 16,
  "sources": ["internal", "amazon", "flipkart"],
  "durationMs": 2345.67,
  "timestamp": "2026-03-22T10:30:03Z"
}
```

### Event Semantics

- **requestId**: Links to original BuyRequest
- **userId**: Links to user profile
- **productCount**: Total products returned
- **sources**: Which adapters were queried
- **durationMs**: Search execution time (for monitoring)
- **timestamp**: When search completed

### Usage by Downstream Services

#### Product Matcher Service example:

```javascript
// Listen to products.fetched
consumer.on('message', async (message) => {
  const event = JSON.parse(message.value);

  // Fetch full products from aggregator
  const response = await fetch(`http://product-aggregator:3003/search`, {
    method: 'POST',
    body: JSON.stringify({
      intent: await getIntent(event.requestId),
    }),
  });

  const products = await response.json();

  // Generate recommendations
  const recommendations = generateRecommendations(products);

  // Save to DB
  await saveRecommendations(event.requestId, recommendations);
});
```

## 🔄 Integration Patterns

### Pattern 1: Synchronous REST Call

**When to use**: Need results immediately, no async processing needed

```
┌─────────────────┐
│  Frontend/Service│
└────────┬────────┘
         │
         │ POST /search {intent}
         ▼
    [Product Aggregator]
         │
         │ Wait ~2-3s
         ▼
      Response: {products}
```

**Implementation**:

```python
import httpx

# Synchronous call
response = httpx.post(
    "http://product-aggregator:3003/search",
    json={
        "intent": intent_data,
        "limit": 20,
        "sort_by": "relevance"
    },
    timeout=5.0
)

products = response.json()["products"]
```

### Pattern 2: Async Event Processing

**When to use**: Fire-and-forget, process asynchronously

```
┌─────────────────┐
│ Intent Parser   │
└────────┬────────┘
         │
         │ Emit: intent.processed
         ▼
      [Kafka Topic]
         │
         │ Product Aggregator listens
         │ Processes in background
         ▼
      Emit: products.fetched
         │
         ▼
    [Downstream Service]
```

**Implementation**:

```python
# In product aggregator
async def handle_intent_event(message: dict):
    intent = ProcessedIntent(**message["data"])
    response = await aggregator_service.search(intent)

    # Produce downstream event
    await kafka_service.produce_message(
        "products.fetched",
        KafkaService.products_fetched_event(
            response.request_id,
            response.user_id,
            response.total_products,
            response.sources_searched,
            response.search_duration_ms
        )
    )
```

### Pattern 3: Cached Read + Async Update

**When to use**: Show cached results immediately, refresh in background

```
┌─────────────────┐
│  Frontend       │
└────────┬────────┘
         │
         │ Request products
         ▼
    [Check Cache]
         │
    ┌────┴─────┐
    │           │
   Hit?        Miss?
    │           │
    ▼           ▼
 Return    [Parallel Query]
 Cached      10 sources
 + Refresh   + Cache
```

**Implementation**:

```python
# Pseudo-code for cache-first pattern
async def get_products(intent_id: int, user_id: int):
    # Check cache
    cached = await cache_service.get(user_id, intent_id)
    if cached:
        # Return immediately
        background_tasks.add_task(refresh_cache, intent_id, user_id)
        return cached

    # Cache miss: fetch
    refresh_cache(intent_id, user_id)
```

## 🔌 API Integration Examples

### Search Endpoint

**Endpoint**: `POST /search`  
**Response Time**: 50ms (cache hit) | 2-3s (cache miss)  
**Reliability**: 99.9% (with fallbacks)

```bash
# Request
curl -X POST http://product-aggregator:3003/search \
  -H "Content-Type: application/json" \
  -d '{
    "intent": {...},
    "limit": 20,
    "sort_by": "relevance"
  }'

# Response 200 OK
{
  "request_id": 123,
  "user_id": 5,
  "total_products": 16,
  "products": [
    {
      "id": "AMZN_001",
      "name": "Sony WH-1000XM5",
      "price": 24999,
      "rating": 4.5,
      "source": "amazon",
      "relevance_score": 0.98,
      ...
    }
  ],
  "sources_searched": ["internal", "amazon", "flipkart"],
  "search_duration_ms": 2345.67,
  "cache_hit": false
}
```

### Health Check Endpoint

**Endpoint**: `GET /health`  
**Response Time**: <100ms  
**Use**: Monitor service dependencies

```bash
curl http://product-aggregator:3003/health

{
  "status": "healthy",
  "version": "1.0.0",
  "redis_connected": true,
  "kafka_connected": true,
  "timestamp": "2026-03-22T10:30:00Z"
}
```

## 🏗️ Data Model Integration

### Product DTO Mapping

**From aggregator** → **To frontend/downstream**:

```
ProductDTO
├── id (string)              → Product ID
├── name (string)            → Display Title
├── price (float)            → Listed Price
├── currency (string)        → Currency Code
├── rating (float 0-5)       → Star Rating
├── review_count (int)       → Review Count
├── brand (string)           → Brand Name
├── delivery_time (string)   → Delivery Estimate
├── source (enum)            → Marketplace Source
├── url (string)             → Product Link
├── image_url (string)       → Product Image
├── in_stock (bool)          → Stock Status
├── discount_percent (float) → Discount %
├── original_price (float)   → Original Price
├── key_features (list)      → Features List
└── relevance_score (0-1)    → Match Quality
```

### SearchResponse Mapping

```
SearchResponse
├── request_id → Links to BuyRequest
├── user_id → Links to User
├── query → Original search query
├── total_products → Result count
├── products → List of ProductDTO
├── sources_searched → Adapter list used
├── search_duration_ms → Performance metric
├── cache_hit → Cache utilization flag
└── search_timestamp → When search occurred
```

## 📊 Usage Patterns

### Use Case 1: Display Products on Frontend

```
1. User searches on frontend
2. Frontend calls POST /search with intent
3. Aggregator returns products in ~2-3 seconds
4. Frontend displays products
5. User clicks "Add to Cart"
```

### Use Case 2: Background Product Recommendations

```
1. Intent Parser emits intent.processed
2. Product Aggregator consumes event
3. Aggregator searches in parallel
4. Aggregator emits products.fetched
5. Product Matcher consumes event
6. Matcher generates recommendations
7. Recommendations appear on user dashboard
```

### Use Case 3: Refresh Cached Results

```
1. User views search results (cached)
2. System shows "Updated 30 minutes ago"
3. Backend refreshes cache in background
4. User gets fresh results on next search
```

## 🔐 Security Integration

### API Authentication

```
All calls to product aggregator should include:
- API Key header: X-API-Key: <key>
- Rate limiting: 100 req/min per user
- Request validation: Pydantic models
```

### Data Privacy

```
- User IDs in events/cache should be hashed for logs
- Product URLs/images from external APIs may be cached
- Cache cleared on user deletion
- Audit logs for problematic searches
```

### Error Handling

```
- Timeout: 10s max per search
- Partial results: Return what's available
- API failure: Fallback to mock data
- Graceful degradation: Never crash
```

## 📈 Performance Integration

### Expected Latencies

| Operation          | Latency | Notes                 |
| ------------------ | ------- | --------------------- |
| Health check       | <50ms   | No I/O                |
| Cache hit          | <100ms  | Redis lookup          |
| Cache miss (web)   | 1-2s    | 3 parallel HTTP calls |
| Cache miss (local) | 2-3s    | Full search           |

### Scaling Strategy

1. **Horizontal**: Run multiple aggregator instances
2. **Caching**: Increase Redis cluster
3. **Adapter pools**: Connection pooling for external APIs
4. **Load balancing**: Nginx/HAProxy round-robin

### Monitoring Integration

```python
# Export metrics for Prometheus
# Search latency histogram
search_duration_histogram.observe(2345.67)

# Cache hit ratio
cache_hits.inc()
cache_misses.inc()

# Adapter failures
adapter_failures.labels(adapter="amazon").inc()
```

## 🧩 Deployment Integration

### Docker Compose Addition

```yaml
# Add to main docker-compose.yml
product-aggregator:
  build: ./apps/product-aggregator
  depends_on:
    - kafka
    - redis
  environment:
    KAFKA_BOOTSTRAP_SERVERS: kafka:29092
    REDIS_URL: redis://redis:6379/0
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: product-aggregator
spec:
  replicas: 3 # Scale horizontally
  selector:
    matchLabels:
      app: product-aggregator
  template:
    spec:
      containers:
        - name: product-aggregator
          image: product-aggregator:1.0.0
          ports:
            - containerPort: 3003
          env:
            - name: REDIS_URL
              valueFrom:
                configMapKeyRef:
                  name: app-config
                  key: redis-url
          livenessProbe:
            httpGet:
              path: /health
              port: 3003
            initialDelaySeconds: 10
            periodSeconds: 5
```

## 🔍 Monitoring & Debugging

### Key Metrics to Monitor

```
1. Search latency (p50, p95, p99)
2. Cache hit ratio (%)
3. Adapter response times
4. Adapter failure rates (%)
5. Queue depth (Kafka)
6. Memory usage (Redis)
7. Error rates (500s, timeouts)
```

### Debugging Checklist

- [ ] Service is running: `curl /health`
- [ ] Redis connected: Check health response
- [ ] Kafka connected: Check health response
- [ ] Adapters working: Test `/mock-intent` endpoint
- [ ] Cache populated: `curl /cache/stats`
- [ ] Logs for errors: `docker-compose logs`

## ✅ Integration Checklist

- [ ] **Kafka Topics Created**
  - [ ] `intent.processed` exists
  - [ ] `products.fetched` exists
  - [ ] Retention policy set

- [ ] **Dependencies Running**
  - [ ] Redis accessible at `redis:6379`
  - [ ] Kafka accessible at `kafka:29092`
  - [ ] Intent Parser emitting events

- [ ] **Configuration**
  - [ ] API URLs correct in .env
  - [ ] Timeout values appropriate
  - [ ] Cache TTL suitable for use case

- [ ] **Testing**
  - [ ] `/health` endpoint responds
  - [ ] `/search` returns valid products
  - [ ] Cache working (repeat search is fast)
  - [ ] Events flowing through Kafka

- [ ] **Monitoring**
  - [ ] Logs being captured
  - [ ] Metrics being exported
  - [ ] Alerts configured

- [ ] **Documentation**
  - [ ] Team understands event schema
  - [ ] Integration documented
  - [ ] Runbooks created

---

**Ready to integrate?** Contact the Product Aggregator team or refer to QUICKSTART.md for immediate next steps.
