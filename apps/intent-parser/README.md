# AI Intent Processing Service

AI-powered intent parser service that converts raw BuyRequest data into structured, actionable insights using Large Language Models (LLM).

## 🎯 Overview

The Intent Parser Service analyzes customer buy requests and produces normalized intent data with:

- **Normalized Categories**: Standard product classification
- **Refined Keywords**: Extracted and prioritized search terms
- **Inferred Use Cases**: Predicted actual use patterns
- **Brand Priority Analysis**: Brand preference and alternatives
- **Budget Clarity Scores**: Budget constraint assessment

## 🚀 Features

✅ **LLM Integration**

- OpenAI GPT-4 / GPT-3.5
- Anthropic Claude 3
- Pluggable provider architecture

✅ **Kafka Integration**

- Consumes: `buy_request.created` events
- Produces: `intent.processed` events
- Event-driven architecture

✅ **REST API**

- `/intent/parse` - Parse single buy request
- `/health` - Service health check
- `/kafka/mock-buy-request` - Test without Kafka

✅ **Confidence Scores**

- Overall confidence (0-1)
- Component-level confidence (category, keywords, use case, brand, budget)
- Threshold-based filtering

✅ **Production-Ready**

- Async/await support
- Error handling and logging
- Docker & Docker Compose
- Health checks

## 📋 Installation

### Prerequisites

- Python 3.11+
- Kafka (or Docker)
- OpenAI / Anthropic API key

### Local Setup

```bash
cd apps/intent-parser

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env

# Edit .env with your API keys
# OPENAI_API_KEY=sk-...
# KAFKA_BOOTSTRAP_SERVERS=localhost:9092
```

### Docker Setup

```bash
cd apps/intent-parser

# Build and start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f intent-parser
```

## ⚙️ Configuration

### Environment Variables

```bash
# LLM Configuration
LLM_PROVIDER=openai                          # openai or anthropic
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview

# Kafka Configuration
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
KAFKA_CONSUMER_GROUP=intent-parser-service
KAFKA_TOPIC_BUY_REQUEST=buy_request.created
KAFKA_TOPIC_INTENT_PROCESSED=intent.processed

# API Configuration
HOST=0.0.0.0
PORT=3002
LOG_LEVEL=INFO
```

## 🔌 API Endpoints

### Health Check

```bash
GET /health

Response: 200 OK
{
  "status": "healthy",
  "version": "1.0.0",
  "llm_provider": "openai",
  "kafka_connected": true
}
```

### Parse Intent

```bash
POST /intent/parse
Content-Type: application/json

{
  "buyRequest": {
    "id": 1,
    "userId": 1,
    "productName": "Wireless Headphones",
    "description": "Premium noise-cancelling headphones",
    "budgetMin": 200,
    "budgetMax": 500,
    "qualityScore": 8,
    "preferredBrands": ["Sony", "Bose"],
    "deliveryDate": "2026-04-15",
    "autoExecute": true,
    "notifyChannels": ["email"]
  }
}

Response: 200 OK
{
  "requestId": 1,
  "userId": 1,
  "normalized_category": {
    "primary_category": "Audio Equipment > Headphones",
    "secondary_category": "Wireless Headphones",
    "category_confidence": 0.95
  },
  "refined_keywords": [
    {
      "keyword": "noise_cancelling",
      "priority": 0.95,
      "type": "feature"
    },
    {
      "keyword": "premium",
      "priority": 0.85,
      "type": "quality"
    }
  ],
  "inferred_use_case": {
    "primary_use_case": "professional_audio",
    "secondary_use_cases": ["travel", "casual_listening"],
    "inferred_features": ["active_noise_cancelling", "long_battery_life"],
    "missing_details": ["preferred_color", "connectivity_type"],
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
  "processing_timestamp": "2026-03-22T10:30:00Z",
  "llm_model_used": "gpt-4-turbo-preview"
}
```

### Mock Kafka Event (Testing)

```bash
POST /kafka/mock-buy-request
Content-Type: application/json

{
  "buyRequest": { ... }
}

Response: 200 OK
{
  "status": "success",
  "message": "Buy request event queued for processing",
  "requestId": 1
}
```

## 📊 Response Model

### ProcessedIntentResponse

```typescript
{
  // Identifiers
  requestId: number;
  userId: number;

  // Normalized category
  normalized_category: {
    primary_category: string;
    secondary_category: string | null;
    category_confidence: 0.0-1.0;
  };

  // Keywords
  refined_keywords: [
    {
      keyword: string;
      priority: 0.0-1.0;
      type: "feature" | "brand" | "quality" | "price" | "use_case";
    }
  ];

  // Intent inference
  inferred_use_case: {
    primary_use_case: string;
    secondary_use_cases: string[];
    inferred_features: string[];
    missing_details: string[];
    inference_confidence: 0.0-1.0;
  };

  // Brand analysis
  brand_priority_score: {
    specified_brands: string[];
    brand_confidence: 0.0-1.0;
    alternative_brands: string[];
  };

  // Budget analysis
  budget_clarity_score: {
    min_budget: number;
    max_budget: number;
    budget_range: number;
    price_sensitivity: "low" | "medium" | "high";
    price_clarity_score: 0.0-1.0;
  };

  // Metadata
  overall_confidence: 0.0-1.0;
  processing_timestamp: ISO 8601 datetime;
  llm_model_used: string;
  raw_llm_response: string (optional);
}
```

## 🎮 Usage Examples

### Using cURL

```bash
# Start the service
python main.py

# In another terminal, parse a buy request
curl -X POST http://localhost:3002/intent/parse \
  -H "Content-Type: application/json" \
  -d '{
    "buyRequest": {
      "id": 1,
      "userId": 1,
      "productName": "Gaming Laptop",
      "description": "High-performance for gaming and development",
      "budgetMin": 1500,
      "budgetMax": 2500,
      "qualityScore": 9,
      "preferredBrands": ["ASUS", "Razer"],
      "deliveryDate": "2026-04-01",
      "autoExecute": false,
      "notifyChannels": ["email", "whatsapp"]
    }
  }'
```

### Using Python

```python
import requests
import json

url = "http://localhost:3002/intent/parse"

buy_request = {
  "buyRequest": {
    "id": 1,
    "userId": 1,
    "productName": "Mechanical Keyboard",
    "budgetMin": 100,
    "budgetMax": 300,
    "qualityScore": 8,
    "preferredBrands": ["Corsair", "SteelSeries"],
    "deliveryDate": "2026-03-30",
    "autoExecute": True,
    "notifyChannels": ["email"]
  }
}

response = requests.post(url, json=buy_request)
intent = response.json()

print(f"Primary Category: {intent['normalized_category']['primary_category']}")
print(f"Overall Confidence: {intent['overall_confidence']:.2%}")
print(f"Use Case: {intent['inferred_use_case']['primary_use_case']}")
```

## 📊 Kafka Integration

### Consuming Buy Requests

The service automatically consumes from `buy_request.created` topic:

```json
{
  "event_type": "buy_request.created",
  "buyRequest": {
    /* BuyRequest object */
  },
  "metadata": {
    "timestamp": "2026-03-22T10:30:00Z",
    "source": "api"
  }
}
```

### Producing Intent Events

After processing, the service produces to `intent.processed`:

```json
{
  "event_type": "intent.processed",
  "requestId": 1,
  "userId": 1,
  "processedIntent": {
    /* ProcessedIntentResponse */
  },
  "metadata": {
    "llmModel": "gpt-4-turbo-preview",
    "source": "intent-parser-service"
  }
}
```

## 🧠 LLM Prompt Architecture

### System Prompt

Sets role and guidelines for the LLM (in `prompts.py`)

### Main Intent Parsing Prompt

Orchestrates extraction of:

1. Normalized categories
2. Refined keywords
3. Inferred use cases
4. Brand priority
5. Budget analysis

### Specialized Prompts (Optional)

- Category normalization
- Use case inference
- Brand analysis
- Budget clarity

## 🔐 Security

- API key validation for LLM providers
- Kafka security protocol configurable
- Request validation with Pydantic
- Error handling without exposing internals
- CORS middleware for API access

## 🚦 Running Services

### Start Kafka + Service with Docker Compose

```bash
# Start all services
docker-compose up -d

# View Kafka UI at http://localhost:8080
# Access intent parser at http://localhost:3002

# Stop services
docker-compose down
```

### Run Service Locally (with external Kafka)

```bash
# Ensure Kafka is running
# Update KAFKA_BOOTSTRAP_SERVERS in .env

python main.py
```

## 📈 Performance Considerations

- **LLM Inference**: 1-3 second typical latency
- **Kafka Throughput**: Hundreds of events per second
- **Concurrent Processing**: Async/await support
- **Memory**: ~200MB base + LLM provider client memory

## 🧪 Testing

### Health Check

```bash
curl http://localhost:3002/health
```

### Test with Mock Event

```bash
curl -X POST http://localhost:3002/kafka/mock-buy-request \
  -H "Content-Type: application/json" \
  -d '{ "buyRequest": { ... } }'
```

### Monitor Kafka Topics

```bash
# Using kafkacat inside Docker
docker-compose exec kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic intent.processed \
  --from-beginning
```

## 📝 Logging

Check logs in real-time:

```bash
# Docker
docker-compose logs -f intent-parser

# Local
# Logs output to console, configure in logging setup
```

## 🛠️ Troubleshooting

### Issue: LLM API errors

- Check API keys are set correctly in `.env`
- Verify API key has sufficient quota
- Check network connectivity to API endpoints

### Issue: Kafka connection failed

- Ensure Kafka is running: `docker-compose ps`
- Check KAFKA_BOOTSTRAP_SERVERS setting
- Verify firewall rules for port 9092

### Issue: Invalid JSON from LLM

- Try adjusting LLM_TEMPERATURE (lower = more deterministic)
- Check prompt templates in `prompts.py`
- Ensure LLM_MAX_TOKENS is sufficient

## 📦 Project Structure

```
apps/intent-parser/
├── main.py                      # FastAPI app & endpoints
├── config.py                    # Configuration management
├── models.py                    # Pydantic request/response models
├── prompts.py                   # LLM prompt templates
├── services/
│   ├── llm_service.py          # LLM provider abstraction
│   ├── kafka_service.py        # Kafka producer/consumer
│   └── intent_service.py       # Intent parsing business logic
├── requirements.txt            # Python dependencies
├── Dockerfile                  # Container image
├── docker-compose.yml          # Local dev environment
├── .env.example               # Environment template
└── README.md                  # This file
```

## 🚀 Deployment

### Docker Image Build

```bash
docker build -t intent-parser:latest .
```

### Kubernetes (Example)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: intent-parser
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: intent-parser
          image: intent-parser:latest
          ports:
            - containerPort: 3002
          env:
            - name: LLM_PROVIDER
              value: openai
            - name: OPENAI_API_KEY
              valueFrom:
                secretKeyRef:
                  name: intent-parser-secrets
                  key: openai-api-key
            - name: KAFKA_BOOTSTRAP_SERVERS
              value: kafka:9092
```

## 📄 License

MIT

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Add tests
4. Submit pull request

## 📞 Support

For issues or questions:

1. Check logs: `docker-compose logs intent-parser`
2. Review error responses
3. Check Kafka topics: `docker-compose exec kafka kafka-topics --list --bootstrap-server localhost:9092`
4. Test with `/kafka/mock-buy-request` endpoint

---

**Version**: 1.0.0  
**Last Updated**: March 22, 2026  
**Status**: ✅ Production Ready
