# Integration Guide - Product Ranking Engine

How the Product Ranking Engine integrates with the e-commerce platform's microservices.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     E-Commerce Platform                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐    ┌──────────┐    ┌────────────┐    ┌──────────┐ │
│  │  Web UI │───▶│   Account│───▶│   Intent   │───▶│ Aggregator
│  │   &     │    │  Service │    │   Parser   │    │ Service  │
│  │  Mobile │    └──────────┘    └────────────┘    └──────────┘ │
│  │ Clients │           │               │               │       │
│  └─────────┘           │               │               │       │
│                        │               │               ▼       │
│  ┌──────────────────────────────── KAFKA BROKER ───────────┐   │
│  │                                                          │   │
│  │ • buy-requests                                         │   │
│  │ • intent-requests  (Intent Parser)                    │   │
│  │ • products.fetched (Aggregator → HERE)               │   │
│  │ • products.ranked  (HERE → Recommendations)          │   │
│  │ • order-requests   (Recommendations → Order)         │   │
│  │                                                          │   │
│  └────────────────────────────────────────────────────────┘   │
│                        ▲                                       │
│                        │                                       │
│                   [RANKING ENGINE] ◄───────────────────────── │
│                   (THIS SERVICE)                              │
│                        │                                       │
│                        ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │            Downstream Consumers                          │ │
│  │  • Recommendation Engine                               │ │
│  │  • Order Processing                                    │ │
│  │  • Analytics                                           │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. User Initiates Search

```
User (Web/Mobile)
    ↓
Account Service (user preferences)
    ↓
Intent Parser
    • Extracts intent: "top headphones under 50k"
    • Creates: BuyRequest → intent-requests topic
```

### 2. Product Discovery

```
Product Aggregator Service
    • Consumes: intent-requests
    • Fetches from: Internal DB + Amazon + Flipkart
    • Produces: products.fetched → Kafka

    Event Format:
    {
      "event_type": "products.fetched",
      "request_id": "req-123",
      "user_id": "user-456",
      "products": [product1, product2, ...],
      "budget_min": 5000,
      "budget_max": 50000,
      "preferred_brands": ["Sony", "Bose"],
      "quality_threshold": 0.7,
      "preferred_delivery_days": 5
    }
```

### 3. Product Ranking (THIS SERVICE)

```
Product Ranking Engine
    • Consumes: products.fetched
    • Algorithm:
        ├─ Score budget fit (price vs budget)
        ├─ Score quality (brand, features, build)
        ├─ Score brand preference (user's favorite brands)
        ├─ Score delivery speed (timing vs preference)
        └─ Score ratings (customer feedback)
    • Combines: Weighted scoring formula
    • Produces: products.ranked → Kafka

    Event Format:
    {
      "event_type": "products.ranked",
      "request_id": "req-123",
      "user_id": "user-456",
      "timestamp": "2024-01-15T10:30:00",
      "total_products_ranked": 12,
      "best_product_id": "prod-sony-123",
      "best_product_score": 0.857,
      "average_confidence": 0.92
    }
```

### 4. Downstream Processing

```
products.ranked topic
    ├─▶ Recommendation Engine
    │   • Generates personalized recommendations
    │   • Applies user history + collaborative filtering
    │
    ├─▶ Order Processing
    │   • Pre-loads top 3 products for user
    │   • Enables 1-click ordering
    │
    ├─▶ Analytics Service
    │   • Tracks ranking effectiveness
    │   • A/B tests weight configurations
    │
    └─▶ Real-time Dashboard
        • Shows trending products
        • Live ranking metrics
```

## Integration Points

### 1. From Product Aggregator

**Topic**: `products.fetched`

**Expected Format**:

```python
{
    "event_type": "products.fetched",
    "request_id": str,           # Unique request ID
    "user_id": str,              # User identifier
    "products": [                # List of ProductDTO
        {
            "id": str,
            "name": str,
            "brand": str,
            "price": float,
            "rating": float,
            "review_count": int,
            "delivery_time": str,
            "key_features": list[str],
            "source": str,           # internal|amazon|flipkart|etc
            "discount_percent": float,  # optional
            "original_price": float     # optional
        },
        ...
    ],
    "budget_min": float,
    "budget_max": float,
    "preferred_brands": list[str],
    "quality_threshold": float,
    "preferred_delivery_days": int
}
```

**Ensure Product Aggregator**:
✓ Populates all required fields
✓ Sets reasonable defaults
✓ Validates budget constraints
✓ Identifies user brand preferences

---

### 2. To Recommendation Engine

**Topic**: `products.ranked`

**Produced Format**:

```python
{
    "event_type": "products.ranked",
    "request_id": str,
    "user_id": str,
    "timestamp": str,
    "total_products_ranked": int,
    "best_product_id": str,
    "best_product_score": float,  # 0-1
    "average_confidence": float   # 0-1
}
```

**Recommendation Engine Should**:
✓ Consume this topic
✓ Fetch full ranked list via `/rank` endpoint (if needed)
✓ Apply additional filtering (inventory, promotions)
✓ Generate final recommendations
✓ Publish to `recommendations` topic

---

### 3. Configuration Synchronization

Ranking weights can be updated dynamically:

```bash
# Get current weights
curl http://ranking-engine:3004/config/weights

# Save to configuration service
POST /config-service/ranking-weights
{
  "version": "1.0",
  "weights": {
    "budget_fit": 0.25,
    "quality_score": 0.25,
    "brand_preference": 0.20,
    "delivery_speed": 0.15,
    "ratings": 0.15
  },
  "effective_at": "2024-01-20T00:00:00Z"
}
```

## API Integration Examples

### Example 1: Direct Ranking from Recommendation Engine

```python
import httpx

async def rank_products_directly(products, user_prefs):
    """Call ranking engine directly."""

    ranking_url = "http://ranking-engine:3004"

    payload = {
        "request_id": f"rank-{uuid4()}",
        "user_id": user_prefs.user_id,
        "products": products,
        "budget_min": user_prefs.budget_min,
        "budget_max": user_prefs.budget_max,
        "preferred_brands": user_prefs.brands,
        "quality_threshold": 0.7,
        "preferred_delivery_days": 5
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{ranking_url}/rank",
            json=payload,
            timeout=30.0
        )
        response.raise_for_status()
        return response.json()
```

### Example 2: Batch Ranking from Analytics

```python
async def analyze_ranking_performance():
    """Batch rank multiple request sets."""

    requests = [
        # Generate multiple ranking requests
        # from different user segments
    ]

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://ranking-engine:3004/rank/batch",
            json=requests
        )
        results = response.json()

        # Analyze:
        # - Average scores
        # - Confidence distribution
        # - Component influence
```

### Example 3: Kafka Consumer Integration

```python
from confluent_kafka import Consumer
import json

def process_ranked_products():
    """Consume ranked products and process."""

    consumer = Consumer({
        "bootstrap.servers": "kafka:9092",
        "group.id": "my-service",
    })

    consumer.subscribe(["products.ranked"])

    while True:
        msg = consumer.poll(timeout=1.0)
        if not msg:
            continue

        event = json.loads(msg.value())

        # Process ranked event:
        # - Store best product
        # - Track user preferences
        # - Generate recommendations
        # - Update cache
```

## Performance Considerations

### Response Times

**Direct API** (`/rank`):

- 10 products: ~20ms
- 100 products: ~50ms
- 1000 products: ~300ms

**Kafka Processing**:

- Consumer latency: ~100ms
- Ranking: <200ms
- Producer latency: ~50ms
- **Total**: ~350ms end-to-end

### Throughput

- **Peak throughput**: 2000 requests/minute
- **Sustained**: 500 requests/minute
- **Storage**: 1MB per 100 products in flight

### Optimization Tips

1. **Batch Requests**
   - Group similar requests together
   - Use `/rank/batch` endpoint

2. **Cache Results**
   - Store ranked results in Redis
   - TTL: 5 minutes per user
   - Cache key: `ranking:{user_id}:{product_hash}`

3. **Scale Out**
   - Run multiple ranking engine instances
   - Load balance via API gateway
   - Kafka handles distributed consumption

4. **Monitor Metrics**
   - Response time distribution
   - Average confidence scores
   - Component score trends

## Error Handling

### Common Issues & Solutions

#### Issue 1: Invalid Product Data

```
Error: "Price must be positive"
Solution:
- Product Aggregator validates prices
- Ensure source APIs return valid prices
- Set default fallback prices
```

#### Issue 2: Missing Brand Information

```
Error: Brand not in quality score database
Solution:
- Ranking engine defaults brand score to 0.65
- Monitor: Request team to add brand
- Consider: Generic brand bootstrapping
```

#### Issue 3: Delivery Time Parse Error

```
Error: Can't parse delivery_time "some-time"
Solution:
- Ensure format: "X-Y days" or "X days"
- Examples: "2-3 days", "5 days"
- Fallback: Default to 7 days
```

#### Issue 4: Kafka Connection Lost

```
Error: KAFKA_BROKER_NOT_AVAILABLE
Solution:
- Check broker status: docker-compose ps
- Verify bootstrap servers: curl kafka:9092
- Restart consumer: Automatic with retries
```

## Testing Integration

### 1. Unit Test: Component Scorers

```python
def test_budget_fit_scores():
    """Test budget fit component independently."""
    service = ProductRankingService()

    product = ProductDTO(
        id="test-1",
        name="Test",
        price=25000,
        ...
    )

    request = RankingRequest(
        budget_max=50000,
        ...
    )

    score = service._calculate_budget_fit(product, request)
    assert score.score >= 0.7
```

### 2. Integration Test: Full Flow

```python
async def test_kafka_ranking_flow():
    """Test full Kafka-based ranking."""

    # Produce to products.fetched
    producer.produce("products.fetched", {...})

    # Wait for ranking engine to process
    await asyncio.sleep(1)

    # Consume from products.ranked
    event = consumer.poll()
    assert event["event_type"] == "products.ranked"
    assert event["best_product_score"] > 0
```

### 3. System Test: End-to-End

```bash
# 1. Start full stack
docker-compose up

# 2. Send test request
curl -X POST http://localhost:3004/rank \
  -H "Content-Type: application/json" \
  -d @test_products.json

# 3. Verify ranking results
# 4. Check Kafka events
docker-compose exec kafka kafka-console-consumer \
  --bootstrap-server kafka:9092 \
  --topic products.ranked

# 5. Validate response times
# 6. Check logs
docker-compose logs -f ranking-engine
```

## Monitoring & Observability

### Key Metrics

```
# Response Times
histogram_request_duration_ms{endpoint="/rank"}
- p50: 25ms
- p95: 80ms
- p99: 150ms

# Scores
histogram_final_score{user_segment="premium"}
- mean: 0.75
- distribution: [0.5-0.6: 5%, 0.6-0.7: 20%, ...]

# Component Influence
gauge_component_avg_score{component="quality"}
- value: 0.82

# Confidence Scores
histogram_confidence{ranking="top_1"}
- mean: 0.92
```

### Logging Integration

```python
# Each ranking request logs:
{
    "timestamp": "2024-01-15T10:30:00.123Z",
    "request_id": "req-123",
    "user_id": "user-456",
    "products_count": 10,
    "duration_ms": 45,
    "best_product_id": "prod-1",
    "best_product_score": 0.857,
    "confidence": 0.92,
    "status": "SUCCESS"
}
```

## Deployment

### Staging Environment

```bash
# Deploy to staging
docker build -t ranking-engine:staging .
kubernetes apply -f k8s/staging/

# Run smoke tests
pytest tests/integration/ --env=staging

# Monitor logs
kubectl logs -f deployment/ranking-engine
```

### Production Environment

```bash
# Blue-green deployment
# 1. Build new version
docker build -t ranking-engine:v2.0.0 .

# 2. Deploy to green environment
kubernetes apply -f k8s/production/blue/

# 3. Run health checks
curl https://prod-blue.example.com/health

# 4. Switch traffic
kubectl patch service ranking-engine \
  -p '{"spec":{"selector":{"version":"v2.0.0"}}}'

# 5. Monitor error rates
# 6. Keep old version ready for rollback
```

## Support & Escalation

### Issue Resolution Path

```
User/Integration Issue
    ↓
Check Service Health: /health
    ↓
Review Configuration: /config
    ↓
Check Logs: docker-compose logs ranking-engine
    ↓
Verify Kafka: Broker status, topic existence
    ↓
Test Directly: Send test request to /rank
    ↓
Escalate: Contact platform team
```

### Contact

- **Team**: Platform Engineering
- **Slack**: #ranking-engine
- **Docs**: https://platform.internal/ranking-engine
- **Issues**: https://jira.internal/browse/RANK

---

**Last Updated**: April 2026
**Status**: Production Ready
**Version**: 1.0.0
