# Quick Start Guide - Product Ranking Engine

Set up and run the Product Ranking Engine in 5 minutes.

## 1. Prerequisites

- Python 3.11+
- Docker & Docker Compose (optional but recommended)
- Git

## 2. Local Setup (Without Docker)

### Step 1: Clone & Navigate

```bash
cd apps/product-ranking-engine
```

### Step 2: Create Virtual Environment

```bash
python -m venv venv
source venv/bin/activate
# Or on Windows: venv\Scripts\activate
```

### Step 3: Install Dependencies

```bash
pip install -r requirements.txt
```

### Step 4: Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

- Set `KAFKA_BOOTSTRAP_SERVERS` to your Kafka broker (e.g., `localhost:9092`)
- Adjust weights if needed (must sum to 1.0)

### Step 5: Run Service

```bash
python main.py
```

Server starts on `http://localhost:3004`

## 3. Docker Setup (Recommended)

### Step 1: Navigate to Root

```bash
cd ../..  # Go to delegatecart root
```

### Step 2: Start Full Stack

```bash
docker-compose up ranking-engine kafka zookeeper
```

Wait for all services to be healthy (~30 seconds):

- Zookeeper: ✓ Ready
- Kafka: ✓ Ready
- Ranking Engine: ✓ Healthy

### Step 3: Verify Health

```bash
curl http://localhost:3004/health
```

Response:

```json
{
  "status": "healthy",
  "service": "product-ranking-engine",
  "version": "1.0.0"
}
```

## 4. Test the API

### Test 1: Health Check

```bash
curl http://localhost:3004/health
```

### Test 2: Get Configuration

```bash
curl http://localhost:3004/config/weights
```

Output shows current scoring weights.

### Test 3: Simple Ranking Request

Save as `test_request.json`:

```json
{
  "request_id": "test-001",
  "user_id": "user-100",
  "products": [
    {
      "id": "prod-1",
      "name": "Sony WH-1000XM4",
      "brand": "Sony",
      "price": 34999,
      "original_price": 38999,
      "discount_percent": 10,
      "rating": 4.6,
      "review_count": 5000,
      "delivery_time": "2 days",
      "key_features": ["Noise-Canceling", "30-Hour Battery", "Touch Control"],
      "source": "internal"
    },
    {
      "id": "prod-2",
      "name": "Bose QuietComfort 45",
      "brand": "Bose",
      "price": 38999,
      "rating": 4.5,
      "review_count": 3000,
      "delivery_time": "5 days",
      "key_features": ["Noise Cancel", "24-Hour Battery"],
      "source": "amazon"
    }
  ],
  "budget_min": 10000,
  "budget_max": 50000,
  "preferred_brands": ["Sony", "Bose"],
  "quality_threshold": 0.6,
  "preferred_delivery_days": 5
}
```

Run:

```bash
curl -X POST http://localhost:3004/rank \
  -H "Content-Type: application/json" \
  -d @test_request.json | jq
```

### Test 4: Check Scores

The response shows:

- Ranked products (highest score first)
- Final score for each product
- Complete explanation including:
  - Why each product was scored
  - Strengths and weaknesses
  - Component scoring breakdown

## 5. Understanding the Response

Key fields in response:

```json
{
  "request_id": "test-001",
  "total_products": 2,
  "ranked_products": [
    {
      "rank": 1,                    // Position in ranking
      "score": 0.857,               // Final weighted score (0-1)
      "confidence": 0.94,           // Confidence in this ranking
      "explanation": {
        "summary": "...",           // Human-readable summary
        "key_strengths": [...],     // Top factors supporting this rank
        "key_weaknesses": [...],    // Areas where product could improve
        "budget_fit_score": {...},  // Component scores
        "quality_score": {...},
        "ratings_score": {...}
      }
    }
  ],
  "best_product": {...},            // Top-ranked product
  "average_confidence": 0.94        // Overall confidence in ranking
}
```

## 6. Simulate Kafka Flow

### Terminal 1: Produce Test Event

```bash
docker-compose exec kafka kafka-console-producer \
  --broker-list kafka:9092 \
  --topic products.fetched
```

Paste:

```json
{
  "event_type": "products.fetched",
  "request_id": "event-001",
  "user_id": "user-100",
  "products": [
    {
      "id": "prod-1",
      "name": "Sony Headphones",
      "brand": "Sony",
      "price": 30000,
      "rating": 4.6,
      "review_count": 5000,
      "delivery_time": "2 days",
      "key_features": ["Noise-Cancel"],
      "source": "internal"
    }
  ],
  "budget_min": 10000,
  "budget_max": 50000,
  "preferred_brands": ["Sony"],
  "quality_threshold": 0.6,
  "preferred_delivery_days": 5
}
```

Press Ctrl+D to send

### Terminal 2: Consume Ranked Event

```bash
docker-compose exec kafka kafka-console-consumer \
  --bootstrap-server kafka:9092 \
  --topic products.ranked \
  --from-beginning
```

You'll see the ranked event produced by the engine!

## 7. Running Tests

### Run All Tests

```bash
pytest
```

### Run Specific Test

```bash
pytest tests/test_ranking.py -v
```

### With Coverage

```bash
pytest --cov=services --cov-report=html
```

## 8. Logs

### View Application Logs

**Docker:**

```bash
docker-compose logs -f ranking-engine
```

**Local:**

```bash
tail -f ranking_engine.log
```

## 9. Stop Services

**Docker:**

```bash
docker-compose down
```

**Local:**

- Press `Ctrl+C` to stop

## 10. Troubleshooting

### Issue: `Connection refused` when accessing API

**Solution:**

1. Verify service is running: `curl http://localhost:3004/health`
2. Check logs: `docker-compose logs ranking-engine`
3. Ensure port 3004 is not in use

### Issue: Kafka messages not consumed

**Solution:**

1. Check Kafka is running: `docker-compose logs kafka`
2. Verify topic exists: `docker-compose exec kafka kafka-topics --list --bootstrap-server kafka:9092`
3. Check consumer group: `docker-compose logs ranking-engine`

### Issue: Weight validation error

**Solution:**

1. Check .env: weights must sum to exactly 1.0
2. Fix example:
   ```
   WEIGHT_BUDGET_FIT=0.25
   WEIGHT_QUALITY_SCORE=0.25
   WEIGHT_BRAND_PREFERENCE=0.20
   WEIGHT_DELIVERY_SPEED=0.15
   WEIGHT_RATINGS=0.15
   # Total = 1.0 ✓
   ```

## 11. API Documentation

Interactive API docs available at:

- **Swagger UI**: http://localhost:3004/docs
- **ReDoc**: http://localhost:3004/redoc

## 12. Next Steps

1. **Integrate with Account Service**: Subscribe to ranking requests
2. **Monitor Performance**: Track response times and confidence scores
3. **Tune Weights**: Adjust weights based on business preferences
4. **Add Caching**: Implement Redis for brand quality scores
5. **Scale Out**: Deploy multiple instances with load balancing

## 13. Key Endpoints Reference

| Method | Endpoint          | Purpose                |
| ------ | ----------------- | ---------------------- |
| GET    | `/health`         | Health check           |
| GET    | `/config`         | View configuration     |
| GET    | `/config/weights` | View scoring weights   |
| POST   | `/rank`           | Rank products directly |
| POST   | `/rank/batch`     | Batch ranking          |

## 14. Support

For issues:

1. Check logs: `docker-compose logs -f ranking-engine`
2. Verify configuration: `curl http://localhost:3004/config`
3. Review README.md for detailed documentation

Happy ranking! 📊
