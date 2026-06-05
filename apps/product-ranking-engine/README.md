# Product Ranking Engine

Advanced weighted ranking system for e-commerce products with explainability and configurable scoring.

## Overview

The Product Ranking Engine scores and ranks products based on five weighted factors:

- **Budget Fit** (25%) - Price alignment with user budget
- **Quality Score** (25%) - Brand reputation, features, and build quality
- **Brand Preference** (20%) - Match with user preferred brands
- **Delivery Speed** (15%) - Shipping time alignment with user preference
- **Ratings** (15%) - Customer ratings and review confidence

Each product receives a final score (0-1) with detailed per-component explanations showing **why** that product was ranked at that position.

## Features

✅ **Weighted Scoring** - Configurable weights per deployment
✅ **Explainability** - Detailed breakdown of why each product was ranked
✅ **Kafka Integration** - Event-driven consumption/production
✅ **REST API** - Direct ranking endpoint plus batch processing
✅ **Configuration** - Environment-based settings with validation
✅ **Health Checks** - Readiness and liveness checks
✅ **Type Safety** - 100% Pydantic models with validation
✅ **Docker Ready** - Multi-stage build with slim image

## Architecture

```
Input: products.fetched (Kafka)
    ↓
[ProductRankingEngine]
    ├─ Budget Fit Scorer
    ├─ Quality Scorer
    ├─ Brand Preference Scorer
    ├─ Delivery Speed Scorer
    └─ Ratings Scorer
    ↓
Weighted Combination (Final Score)
    ↓
Output: products.ranked (Kafka)
REST API: POST /rank
```

## Scoring Algorithm

### Final Score Calculation

```
final_score = (
    budget_fit_score * 0.25 +
    quality_score * 0.25 +
    brand_preference_score * 0.20 +
    delivery_speed_score * 0.15 +
    ratings_score * 0.15
)
```

All component scores are normalized to [0, 1] range.

### Component Scoring

#### 1. Budget Fit Score (25%)

- **Below minimum budget**: Score decreases gradually (favors more affordable options)
- **Within budget**: Scores based on distance from maximum (closer to max = better value)
- **Above budget**: Penalized heavily; score = max(0, 1 - (excess_pct \* 0.8))

```
Formula:
if price > budget_max:
    score = 1.0 - (overflow_percentage * 0.8)
else:
    score = 0.7 + (remaining_budget_percentage * 0.3)
```

#### 2. Quality Score (25%)

Assessed via three sub-factors:

- **Brand Score** (40%): Reputation-based (Sony/Apple: 0.95, JBL: 0.75, etc.)
- **Feature Score** (35%): Normalized by feature count (5+ features = 1.0)
- **Build Quality** (25%): Derived from brand + price tier

```
quality_score = (brand * 0.4) + (features * 0.35) + (build * 0.25)
```

If below quality_threshold, product is marked with warning.

#### 3. Brand Preference Score (20%)

- **Exact match** (preferred_brands): 1.0
- **Alternative brand**: 0.8
- **Neutral brand**: 0.5

#### 4. Delivery Speed Score (15%)

- **Fast (≤2 days)**: 1.0
- **Moderate (3-7 days)**: 0.8 - linear interpolation
- **Slow (>7 days)**: max(0, 0.6 - (excess_days \* 0.05))

#### 5. Ratings Score (15%)

Combined rating and review confidence:

- Rating → normalized to [0,1]
- Confidence based on review count:
  - <10 reviews: 0.3 confidence
  - 10-100 reviews: 0.6 confidence
  - 100-1000 reviews: 0.85 confidence
  - 1000+ reviews: 0.99 confidence

```
ratings_score = (rating_normalized) * review_confidence
```

## API Endpoints

### Health Checks

#### GET `/health`

Service health status

```json
{
  "status": "healthy",
  "service": "product-ranking-engine",
  "version": "1.0.0"
}
```

#### GET `/health/ready`

Readiness check

```json
{
  "ready": true,
  "kafka_connected": true,
  "kafka_consuming": true
}
```

### Ranking

#### POST `/rank`

Rank products directly

```json
{
  "request_id": "req-123",
  "user_id": "user-456",
  "products": [
    {
      "id": "prod-1",
      "name": "Sony WH-1000XM4",
      "brand": "Sony",
      "price": 34999,
      "rating": 4.5,
      "review_count": 5234,
      "delivery_time": "2-3 days",
      "key_features": ["Noise-Canceling", "30-Hour Battery", "Touch Control"],
      "source": "internal",
      "discount_percent": 10,
      "original_price": 38999
    }
  ],
  "budget_min": 5000,
  "budget_max": 50000,
  "preferred_brands": ["Sony", "Bose"],
  "quality_threshold": 0.7,
  "preferred_delivery_days": 5
}
```

Response:

```json
{
  "request_id": "req-123",
  "user_id": "user-456",
  "total_products": 1,
  "ranked_products": [
    {
      "rank": 1,
      "product": {...},
      "score": 0.845,
      "confidence": 0.92,
      "explanation": {
        "product_id": "prod-1",
        "final_score": 0.845,
        "summary": "Sony WH-1000XM4 - premium quality, preferred brand, great price",
        "budget_fit_score": {
          "distance_from_max": 15001,
          "distance_percentage": 0.30,
          "score": 0.90,
          "reason": "Price 34999 is 30.0% below max budget"
        },
        ...
      }
    }
  ],
  "best_product": {...},
  "average_confidence": 0.92
}
```

#### POST `/rank/batch`

Process multiple requests

```json
{
  "total_requests": 2,
  "results": [...]
}
```

### Configuration

#### GET `/config/weights`

Current scoring weights

```json
{
  "weights": {
    "budget_fit": 0.25,
    "quality_score": 0.25,
    "brand_preference": 0.2,
    "delivery_speed": 0.15,
    "ratings": 0.15
  },
  "total": 1.0
}
```

#### GET `/config`

Service configuration

```json
{
  "service": "product-ranking-engine",
  "version": "1.0.0",
  "environment": "development",
  "kafka_topic_in": "products.fetched",
  "kafka_topic_out": "products.ranked"
}
```

## Kafka Integration

### Consumer: `products.fetched`

Consumes aggregated product lists with ranking requests:

```json
{
  "event_type": "products.fetched",
  "request_id": "req-123",
  "user_id": "user-456",
  "products": [...],
  "budget_min": 5000,
  "budget_max": 50000,
  "preferred_brands": ["Sony"],
  "quality_threshold": 0.7,
  "preferred_delivery_days": 5
}
```

### Producer: `products.ranked`

Produces ranked product events:

```json
{
  "event_type": "products.ranked",
  "request_id": "req-123",
  "user_id": "user-456",
  "timestamp": "2024-01-15T10:30:00",
  "total_products_ranked": 1,
  "best_product_id": "prod-1",
  "best_product_score": 0.845,
  "average_confidence": 0.92
}
```

## Configuration

### Environment Variables

```bash
# API Configuration
API_HOST=0.0.0.0
API_PORT=3004
SERVICE_NAME=product-ranking-engine
SERVICE_VERSION=1.0.0
ENVIRONMENT=development
LOG_LEVEL=INFO

# Kafka Configuration
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
KAFKA_CONSUMER_GROUP=ranking-engine-group
KAFKA_TOPIC_PRODUCTS_FETCHED=products.fetched
KAFKA_TOPIC_PRODUCTS_RANKED=products.ranked

# Scoring Weights (must sum to 1.0)
WEIGHT_BUDGET_FIT=0.25
WEIGHT_QUALITY_SCORE=0.25
WEIGHT_BRAND_PREFERENCE=0.20
WEIGHT_DELIVERY_SPEED=0.15
WEIGHT_RATINGS=0.15

# Algorithm Parameters
MIN_CONFIDENCE_THRESHOLD=0.5
SCORE_PRECISION=3
USE_AI_EXPLANATION=false

# Redis Configuration (for future caching)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
```

### Copy Template

```bash
cp .env.example .env
# Edit .env with your configuration
```

## Installation

### Requirements

- Python 3.11+
- Kafka 3.0+ / Confluent Kafka 7.5+
- Redis 7+ (optional, for caching)

### Setup

```bash
# 1. Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env with your settings

# 4. Run locally
python main.py

# 5. Or run with Docker
docker-compose up ranking-engine
```

## Development

### Project Structure

```
product-ranking-engine/
├── main.py                 # FastAPI application
├── config.py              # Configuration management
├── models.py              # Pydantic models (500+ LOC)
├── requirements.txt       # Python dependencies
├── .env.example          # Environment template
├── Dockerfile            # Container definition
├── services/
│   ├── __init__.py
│   ├── ranking_service.py  # Scoring algorithm
│   └── kafka_service.py    # Kafka integration
├── tests/
│   ├── test_ranking.py
│   ├── test_kafka.py
│   └── test_models.py
└── README.md
```

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=services --cov-report=html

# Run specific test
pytest tests/test_ranking.py::test_ranking_algorithm
```

### Local Development with Docker

```bash
# Build image
docker build -t ranking-engine:latest .

# Run with full stack
docker-compose up

# Access service
curl http://localhost:3004/health
```

## Testing

### Test Scenarios

1. **Budget Fit** - Products within, above, below budget
2. **Quality** - Brands with known quality scores
3. **Brand Preference** - Matching, alternative, neutral brands
4. **Delivery** - Fast, moderate, slow delivery times
5. **Ratings** - Varying review counts and confidence levels
6. **Edge Cases** - Empty lists, single product, extreme values

### Example Test Request

```bash
curl -X POST http://localhost:3004/rank \
  -H "Content-Type: application/json" \
  -d @test_request.json
```

## Performance

### Current Architecture

- **Avg Response Time**: ~50ms per 100 products
- **Throughput**: ~2000 requests/min on modern hardware
- **Memory Usage**: ~150MB baseline + 1MB per 100 products in flight

### Optimization Opportunities

- Redis caching for brand quality scores
- Batch scoring for high-volume requests
- Vectorized NumPy operations
- Connection pooling for Kafka

## Examples

### Complete Ranking Request

```json
{
  "request_id": "req-shopping-001",
  "user_id": "user-12345",
  "products": [
    {
      "id": "prod-sony-wh1000xm4",
      "name": "Sony WH-1000XM4 Wireless Headphones",
      "brand": "Sony",
      "price": 34999,
      "original_price": 38999,
      "discount_percent": 10,
      "rating": 4.6,
      "review_count": 5234,
      "delivery_time": "2-3 days",
      "key_features": ["Active Noise Canceling", "30-Hour Battery", "Multipoint Connection"],
      "source": "internal"
    },
    {
      "id": "prod-bose-qc45",
      "name": "Bose QuietComfort 45",
      "brand": "Bose",
      "price": 38999,
      "original_price": null,
      "discount_percent": 0,
      "rating": 4.5,
      "review_count": 3112,
      "delivery_time": "3-5 days",
      "key_features": ["Noise Canceling", "24-Hour Battery", "Bluetooth 5.3"],
      "source": "amazon"
    }
  ],
  "budget_min": 20000,
  "budget_max": 50000,
  "preferred_brands": ["Sony", "Bose", "Sennheiser"],
  "quality_threshold": 0.7,
  "preferred_delivery_days": 5
}
```

### Complete Ranking Response

```json
{
  "request_id": "req-shopping-001",
  "user_id": "user-12345",
  "total_products": 2,
  "ranked_products": [
    {
      "rank": 1,
      "product": {...Sony product...},
      "score": 0.857,
      "confidence": 0.94,
      "explanation": {
        "product_id": "prod-sony-wh1000xm4",
        "product_name": "Sony WH-1000XM4 Wireless Headphones",
        "final_score": 0.857,
        "rank": 1,
        "confidence": 0.94,
        "summary": "Sony WH-1000XM4 - premium quality, preferred brand, great price",
        "key_strengths": [
          "Price 34999 is 30.0% below max budget",
          "Quality score: 0.92 with 3 key features",
          "Sony is in your preferred brands"
        ],
        "key_weaknesses": [],
        "budget_fit_score": {
          "distance_from_max": 15001,
          "distance_percentage": 0.30,
          "score": 0.90,
          "reason": "Price 34999 is 30.0% below max budget"
        },
        "quality_score": {
          "brand_score": 0.95,
          "feature_count": 3,
          "feature_score": 0.6,
          "build_quality": 0.90,
          "score": 0.92,
          "reason": "Quality 0.92 with 3 key features"
        },
        "brand_preference_score": {
          "is_preferred": true,
          "preference_level": "brand_match",
          "score": 1.0,
          "reason": "Sony is in your preferred brands"
        },
        "delivery_speed_score": {
          "delivery_days": 3,
          "urgency_fit": "moderate",
          "score": 0.80,
          "reason": "Moderate delivery: 3 days (preferred: 5)"
        },
        "ratings_score": {
          "rating": 4.6,
          "review_count": 5234,
          "confidence": 0.99,
          "score": 0.91,
          "reason": "Rating: 4.6/5 with 5234 reviews (very many reviews)"
        },
        "weights": {
          "budget_fit": 0.25,
          "quality": 0.25,
          "brand": 0.20,
          "delivery": 0.15,
          "ratings": 0.15
        }
      }
    }
  ],
  "best_product": {...rank 1 product...},
  "average_confidence": 0.94
}
```

## Troubleshooting

### Kafka Connection Issues

```
ERROR: KAFKA_BROKER_NOT_AVAILABLE
Solution: Check KAFKA_BOOTSTRAP_SERVERS setting and broker availability
```

### Weight Validation Error

```
ERROR: Weights must sum to 1.0
Solution: Update .env weights - ensure they total exactly 1.0
```

### Product Score Below Threshold

```
Product quality_score < quality_threshold
Solution: Adjust quality_threshold or product features in source
```

## Roadmap

- [ ] AI-powered explanations (GPT integration)
- [ ] A/B testing framework for weight optimization
- [ ] Redis caching layer
- [ ] GraphQL API
- [ ] Real-time analytics dashboard
- [ ] Distributed scoring (multi-instance)

## License

Proprietary - Part of DelegateCart e-commerce platform

## Support

For issues, documentation, or feature requests, contact the platform team.
