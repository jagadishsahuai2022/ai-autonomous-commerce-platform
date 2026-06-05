# Product Aggregator Service - Quick Start Guide

Get up and running in 5 minutes.

## 🚀 Quick Start (5 min)

### Option 1: Docker Compose (Recommended)

```bash
# 1. Navigate to service
cd apps/product-aggregator

# 2. Start services
docker-compose up -d

# 3. Wait for services to be ready (15-20 seconds)
docker-compose logs -f product-aggregator

# 4. Check health
curl http://localhost:3003/health

# You should see:
{
  "status": "healthy",
  "version": "1.0.0",
  "redis_connected": true,
  "kafka_connected": true
}
```

### Option 2: Local Python

```bash
# 1. Navigate to service
cd apps/product-aggregator

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment (optional)
cp .env.example .env
# Edit .env if needed

# 4. Start service
python main.py

# 5. In another terminal, check health
curl http://localhost:3003/health
```

## 🧪 Test Scenarios

All scenarios use `/search` endpoint with a mock intent.

### Common Intent Object

```json
{
  "requestId": 1,
  "userId": 1,
  "normalized_category": {
    "primary_category": "Audio/Headphones",
    "secondary_category": "Wireless",
    "category_confidence": 0.95
  },
  "refined_keywords": [
    { "keyword": "wireless", "priority": 0.9, "type": "feature" },
    { "keyword": "headphones", "priority": 0.95, "type": "product_type" },
    { "keyword": "noise cancellation", "priority": 0.8, "type": "feature" }
  ],
  "inferred_use_case": {
    "primary_use_case": "personal_audio",
    "secondary_use_cases": ["travel", "commute"],
    "inferred_features": ["ANC", "long_battery", "comfort"],
    "missing_details": [],
    "inference_confidence": 0.88
  },
  "brand_priority_score": {
    "specified_brands": ["Sony", "Bose", "Apple"],
    "brand_confidence": 0.85,
    "alternative_brands": ["Sennheiser", "Beats"]
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
```

### Scenario 1: Premium Wireless Headphones

**Description**: User looking for premium wireless headphones with budget ~25K

**Expected Results**: 20+ products across all sources

```bash
curl -X POST http://localhost:3003/search \
  -H "Content-Type: application/json" \
  -d '{
    "intent": {
      "requestId": 1,
      "userId": 1,
      "normalized_category": {
        "primary_category": "Audio/Headphones",
        "secondary_category": "Wireless",
        "category_confidence": 0.95
      },
      "refined_keywords": [
        {"keyword": "wireless", "priority": 0.9, "type": "feature"},
        {"keyword": "headphones", "priority": 0.95, "type": "product_type"},
        {"keyword": "noise cancellation", "priority": 0.8, "type": "feature"}
      ],
      "inferred_use_case": {
        "primary_use_case": "personal_audio",
        "secondary_use_cases": ["travel", "commute"],
        "inferred_features": ["ANC", "long_battery", "comfort"],
        "missing_details": [],
        "inference_confidence": 0.88
      },
      "brand_priority_score": {
        "specified_brands": ["Sony", "Bose", "Apple"],
        "brand_confidence": 0.85,
        "alternative_brands": ["Sennheiser", "Beats"]
      },
      "budget_clarity_score": {
        "min_budget": 5000,
        "max_budget": 30000,
        "budget_range": 25000,
        "price_sensitivity": "medium",
        "price_clarity_score": 0.9
      },
      "overall_confidence": 0.88
    },
    "limit": 20,
    "sort_by": "relevance"
  }'
```

**What to check**:

- `total_products`: Should be 20+
- `sources_searched`: Should include all three
- `search_duration_ms`: Likely 1500-3000ms (first search)
- Products sorted by relevance score (descending)
- Cache: `cache_hit: false` on first run

**Repeat the same request**: Should get `cache_hit: true` and `search_duration_ms` < 50ms

### Scenario 2: Budget Headphones

**Description**: User looking for budget headphones with limited budget

**Expected Results**: 15+ products, weighted towards budget options

```bash
curl -X POST http://localhost:3003/search \
  -H "Content-Type: application/json" \
  -d '{
    "intent": {
      "requestId": 2,
      "userId": 1,
      "normalized_category": {
        "primary_category": "Audio/Headphones",
        "secondary_category": "Wired/Wireless",
        "category_confidence": 0.90
      },
      "refined_keywords": [
        {"keyword": "budget", "priority": 0.7, "type": "price"},
        {"keyword": "headphones", "priority": 0.95, "type": "product_type"}
      ],
      "inferred_use_case": {
        "primary_use_case": "casual_listening",
        "secondary_use_cases": [],
        "inferred_features": ["wireless", "decent_sound"],
        "missing_details": ["specific_use_case"],
        "inference_confidence": 0.72
      },
      "brand_priority_score": {
        "specified_brands": [],
        "brand_confidence": 0.3,
        "alternative_brands": ["Boat", "Realme", "JBL"]
      },
      "budget_clarity_score": {
        "min_budget": 2000,
        "max_budget": 5000,
        "budget_range": 3000,
        "price_sensitivity": "high",
        "price_clarity_score": 0.85
      },
      "overall_confidence": 0.65
    },
    "limit": 15,
    "sort_by": "price_asc"
  }'
```

**What to check**:

- `total_products`: 15+ results
- Products sorted by price (ascending)
- Top products under 5000 INR
- Fewer Sony/Bose, more Boat/Realme/JBL
- All three sources represented

### Scenario 3: Gaming Earbuds with High Confidence

**Description**: User looking for gaming earbuds

**Expected Results**: 10+ high-relevance products

```bash
curl -X POST http://localhost:3003/search \
  -H "Content-Type: application/json" \
  -d '{
    "intent": {
      "requestId": 3,
      "userId": 2,
      "normalized_category": {
        "primary_category": "Audio/Earbuds",
        "secondary_category": "True Wireless",
        "category_confidence": 0.98
      },
      "refined_keywords": [
        {"keyword": "gaming", "priority": 0.9, "type": "use_case"},
        {"keyword": "earbuds", "priority": 0.95, "type": "product_type"},
        {"keyword": "low latency", "priority": 0.8, "type": "feature"}
      ],
      "inferred_use_case": {
        "primary_use_case": "gaming",
        "secondary_use_cases": ["music", "calls"],
        "inferred_features": ["low_latency", "durable", "good_mic"],
        "missing_details": [],
        "inference_confidence": 0.92
      },
      "brand_priority_score": {
        "specified_brands": ["Apple", "Beats", "Sony"],
        "brand_confidence": 0.88,
        "alternative_brands": ["JBL", "Boat"]
      },
      "budget_clarity_score": {
        "min_budget": 10000,
        "max_budget": 25000,
        "budget_range": 15000,
        "price_sensitivity": "low",
        "price_clarity_score": 0.92
      },
      "overall_confidence": 0.92
    },
    "limit": 10,
    "sort_by": "rating"
  }'
```

**What to check**:

- `overall_confidence`: 0.92 (high confidence)
- Products sorted by rating (descending)
- Top products: AirPods Pro, Sony models, Beats
- All within budget (10K-25K)

## 📊 Monitoring & Debugging

### View Cache Statistics

```bash
curl http://localhost:3003/cache/stats

Response:
{
  "status": "connected",
  "total_keys": 2,
  "used_memory": "1.2K",
  "connected_clients": 1,
  "expired_keys": 0
}
```

### Clear User Cache

```bash
# Clear all cache for user 1
curl -X POST http://localhost:3003/cache/clear?user_id=1

# Clear entire cache
curl -X POST http://localhost:3003/cache/clear
```

### View Service Logs

```bash
# Docker logs
docker-compose logs -f product-aggregator

# Local Python (already in stdout)
# Watch the terminal where python main.py is running
```

### Monitor Kafka Events

**Access Kafka UI**: http://localhost:8080

1. Click "Topics" in left menu
2. Select `intent.processed` - See incoming events
3. Select `products.fetched` - See aggregator output

### Redis Monitoring

```bash
# Connect to Redis CLI
redis-cli -h localhost

# Check memory
INFO memory

# List all product cache keys
KEYS "products:*"

# Get specific cache entry
GET "products:1:1:relevance"

# Monitor in real-time
MONITOR
```

## 🔄 End-to-End Flow Testing

### With Kafka Connection

```bash
# 1. Terminal 1: Start product aggregator
docker-compose up -d

# 2. Terminal 2: Monitor Kafka topics
docker-compose exec kafka kafka-console-consumer \
  --bootstrap-server localhost:29092 \
  --topic products.fetched \
  --from-beginning

# 3. Terminal 3: Produce mock intent event
docker-compose exec kafka kafka-console-producer \
  --broker-list localhost:29092 \
  --topic intent.processed

# Paste this JSON and press Enter:
{
  "event_type": "intent.processed",
  "requestId": 100,
  "userId": 5,
  "timestamp": "2026-03-22T10:30:00Z",
  "data": {
    "requestId": 100,
    "userId": 5,
    ...
  }
}

# 4. Check Terminal 2: Should see products.fetched event produced
```

## 🚨 Troubleshooting

### Service Not Starting

**Problem**: "Connection refused" when accessing http://localhost:3003

```bash
# Check if service is running
docker-compose ps

# View logs
docker-compose logs product-aggregator

# Restart service
docker-compose restart product-aggregator
```

### Redis Connection Failed

**Problem**: Redis not connecting

```bash
# Check Redis is running
docker-compose ps redis

# Check Redis is healthy
redis-cli -h localhost ping
# Should respond: PONG

# Restart Redis
docker-compose restart redis
```

### Kafka Connection Failed

**Problem**: Kafka topic not found

```bash
# Check Kafka is running
docker-compose ps kafka

# List topics
docker-compose exec kafka kafka-topics \
  --list \
  --bootstrap-server localhost:29092

# Create topic if needed
docker-compose exec kafka kafka-topics \
  --create \
  --topic intent.processed \
  --bootstrap-server localhost:29092 \
  --partitions 1 \
  --replication-factor 1
```

### Adapter Timeout

**Problem**: Individual adapter requests timing out

```
This is expected behavior! The service falls back to mock data.
Check logs to see which sources failed.
Increase timeout in .env if needed: AMAZON_API_TIMEOUT=10
```

### Cache Not Working

**Problem**: Every search is slow (> 2 seconds)

```bash
# Check cache is enabled
docker-compose exec product-aggregator python -c "from config import get_settings; print(get_settings().cache_enabled)"

# Check cache connection
curl http://localhost:3003/cache/stats

# If status is "disabled" or "error", restart Redis:
docker-compose restart redis
```

## ✅ Verification Checklist

After setup, verify these items:

- [ ] `/health` returns `"status": "healthy"`
- [ ] `/search` with Scenario 1 returns 20+ products
- [ ] Search results are sorted by relevance score
- [ ] Running same search again returns `"cache_hit": true`
- [ ] Cache stats show > 0 total_keys
- [ ] Kafka UI shows topics exist
- [ ] Logs show "Search complete" messages
- [ ] Products have all required fields (name, price, rating, source)
- [ ] Multiple sources represented in results
- [ ] Search duration under 3s for cache miss

## 📈 Performance Tips

1. **Increase Cache TTL**: Set `REDIS_TTL=7200` for 2 hours
2. **Parallel Adapter Queries**: Already optimized with asyncio
3. **Limit Results**: Use `limit: 10` for faster aggregation
4. **Pre-warm Cache**: Run common searches to populate cache
5. **Monitor Adapter Latencies**: Check which adapters are slow

## 🎓 Architecture Overview

```
Request Flow:
┌─────────────┐
│POST /search │
└──────┬──────┘
       │
       ▼
  ┌─────────────┐
  │Check Cache  │ ──Yes──> [Return cached result]
  └──────┬──────┘
         │ No
         ▼
  ┌─────────────────────────────┐
  │ Parallel adapter queries:   │
  │ - Internal DB              │
  │ - Amazon API               │
  │ - Flipkart API             │
  └──────┬──────────────────────┘
         │
         ▼
  ┌──────────────────┐
  │Aggregate results │
  │Sort/Filter       │
  └──────┬───────────┘
         │
         ▼
  ┌──────────────────┐
  │Store in Cache    │
  │(Redis, 1hr TTL)  │
  └──────┬───────────┘
         │
         ▼
  ┌──────────────────────┐
  │Return response +     │
  │emit Kafka event      │
  └──────────────────────┘
```

## 🎯 Next Steps

1. **Integrate with Intent Parser**: Listen to `intent.processed` topic
2. **Connect to Product Matcher**: Consume `products.fetched` events
3. **Implement Real APIs**: Replace mock data with live Amazon/Flipkart
4. **Add Caching Strategy**: Optimize TTL for your use case
5. **Set Up Monitoring**: Add Prometheus metrics

## 📚 Additional Resources

- See `README.md` for complete documentation
- See `ARCHITECTURE.md` for detailed design patterns
- See `INTEGRATION.md` for downstream service patterns

---

**Ready to search!** 🎉  
Try Scenario 1 now: `curl -X POST http://localhost:3003/search ...`
