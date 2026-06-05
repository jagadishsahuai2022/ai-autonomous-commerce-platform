# Intent Parser - Quick Start Guide

## ⚡ 5-Minute Setup

### Step 1: Start Kafka & Services

```bash
cd apps/intent-parser

# Start everything with Docker Compose
docker-compose up -d

# Verify services are running
docker-compose ps
```

Expected output:

```
CONTAINER ID   IMAGE                                    PORTS
...            confluentinc/cp-kafka:7.5.0             0.0.0.0:9092->9092/tcp
...            confluentinc/cp-zookeeper:7.5.0         0.0.0.0:2181->2181/tcp
...            provectuslabs/kafka-ui:latest           0.0.0.0:8080->8080/tcp
```

### Step 2: Create .env File

```bash
cp .env.example .env

# Edit .env with your API key
# OPENAI_API_KEY=sk-your-key-here
```

### Step 3: Start Intent Parser

```bash
# Option A: Build and run from Docker
docker-compose up intent-parser

# Option B: Run locally with Python
python -m pip install -r requirements.txt
python main.py
```

### Step 4: Verify It's Running

```bash
curl http://localhost:3002/health

# Expected response:
# {
#   "status": "healthy",
#   "version": "1.0.0",
#   "llm_provider": "openai",
#   "kafka_connected": true
# }
```

✅ **Setup Complete!**

---

## 🧪 Test Scenarios

### Scenario 1: Parse a Wireless Headphone Request

```bash
curl -X POST http://localhost:3002/intent/parse \
  -H "Content-Type: application/json" \
  -d '{
    "buyRequest": {
      "id": 1,
      "userId": 1,
      "productName": "Wireless Headphones",
      "description": "Premium noise-cancelling headphones for travel",
      "budgetMin": 200,
      "budgetMax": 500,
      "qualityScore": 8,
      "preferredBrands": ["Sony", "Bose", "Apple"],
      "deliveryDate": "2026-04-15",
      "autoExecute": true,
      "notifyChannels": ["email"]
    }
  }' | jq .
```

**Expected Output:**

- Category: Audio Equipment > Headphones (confidence: ~0.95)
- Keywords: noise_cancelling, premium, wireless, travel, professional_use
- Use Case: professional_audio or travel_audio
- Brand Priority: Sony/Bose top, AirPods, Sennheiser as alternatives
- Overall Confidence: ~0.90

---

### Scenario 2: Parse a Gaming Laptop Request

```bash
curl -X POST http://localhost:3002/intent/parse \
  -H "Content-Type: application/json" \
  -d '{
    "buyRequest": {
      "id": 2,
      "userId": 1,
      "productName": "Gaming Laptop",
      "description": "High-performance laptop for gaming and video editing",
      "budgetMin": 1500,
      "budgetMax": 2500,
      "qualityScore": 9,
      "preferredBrands": ["ASUS", "Razer", "MSI"],
      "deliveryDate": "2026-04-01",
      "autoExecute": false,
      "notifyChannels": ["email", "whatsapp"]
    }
  }' | jq .
```

**Expected Output:**

- Category: Electronics > Computers > Gaming Laptops (confidence: ~0.93)
- Keywords: high_performance, gaming, video_editing, RTX, high_refresh_rate
- Use Case: gaming_and_content_creation
- Features: GPU (RTX 4080+), High refresh rate display, SSD storage
- Price Sensitivity: medium (budget range = 1000, 67% of min)

---

### Scenario 3: Parse a Budget Camping Gear (Unclear Intent)

```bash
curl -X POST http://localhost:3002/intent/parse \
  -H "Content-Type: application/json" \
  -d '{
    "buyRequest": {
      "id": 3,
      "userId": 1,
      "productName": "Camping Stuff",
      "description": null,
      "budgetMin": 50,
      "budgetMax": 200,
      "qualityScore": 5,
      "preferredBrands": null,
      "deliveryDate": "2026-05-01",
      "autoExecute": true,
      "notifyChannels": null
    }
  }' | jq .
```

**Expected Output:**

- Category: Sports & Outdoors > Camping (lower confidence: ~0.65)
- Missing Details: ["specific_item_type", "camping_style", "group_size"]
- Use Case Confidence: ~0.60 (unclear)
- Overall Confidence: ~0.60 (below threshold?)

---

## 📊 Monitoring & Debugging

### View Recent Processed Intents on Kafka

```bash
# Inside Docker container
docker-compose exec kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic intent.processed \
  --from-beginning \
  --max-messages 5 | jq .

# Or outside Docker (if Kafka exposed)
kafka-console-consumer --bootstrap-server localhost:9092 \
  --topic intent.processed --from-beginning --max-messages 5
```

### Check Logs

```bash
# See all service logs
docker-compose logs -f

# Only Intent Parser logs
docker-compose logs -f intent-parser

# Only Kafka logs
docker-compose logs -f kafka
```

### Access Kafka UI

Open: http://localhost:8080

- View topics
- Monitor consumer groups
- Browse messages
- Check broker status

---

## 🎯 Integration Patterns

### Pattern 1: Synchronous API Call

User creates buy request → Frontend calls `/intent/parse` → Show results immediately

```python
import requests

def parse_user_intent(buy_request):
    response = requests.post(
        "http://localhost:3002/intent/parse",
        json={"buyRequest": buy_request}
    )
    return response.json()

# Usage
intent = parse_user_intent({
    "id": 1,
    "userId": 1,
    "productName": "Laptop",
    "budgetMin": 1000,
    "budgetMax": 2000,
    "qualityScore": 8,
    "preferredBrands": ["Dell", "Lenovo"],
    "deliveryDate": "2026-04-01",
    "autoExecute": False,
    "notifyChannels": ["email"]
})

print(f"Category: {intent['normalized_category']['primary_category']}")
print(f"Confidence: {intent['overall_confidence']:.2%}")
```

### Pattern 2: Asynchronous Event Processing

BuyRequest created in DB → Event published → Intent Parser consumes → Intent saved

```
1. buy_request API creates record in DB
2. Event producer: emit "buy_request.created" to Kafka
3. Intent Parser consumes event
4. LLM processes request
5. Event producer: emit "intent.processed" to Kafka
6. Other services consume "intent.processed" event
   - Product matcher
   - Recommendation engine
   - Analytics pipeline
```

### Pattern 3: Testing Without Kafka

```bash
# Use mock endpoint (no Kafka required)
curl -X POST http://localhost:3002/kafka/mock-buy-request \
  -H "Content-Type: application/json" \
  -d '{ "buyRequest": { ... } }'

# Internally processes like Kafka event but returns immediately
```

---

## 🔍 Response Interpretation

### What do the confidence scores mean?

| Score     | Meaning   | Action                      |
| --------- | --------- | --------------------------- |
| 0.90-1.00 | Excellent | Use for automated matching  |
| 0.75-0.90 | Good      | Use with minor verification |
| 0.60-0.75 | Moderate  | Request user clarification  |
| 0.40-0.60 | Low       | Ask follow-up questions     |
| 0.00-0.40 | Very Low  | Manual review needed        |

### What if a keyword has low priority?

Keywords are sorted by priority (0.0-1.0). Keywords with priority < 0.3 are typically:

- Inferred but uncertain features
- Optional preferences
- Could be assumptions

### What does "missing_details" mean?

The LLM inferred gaps in the requirement that would improve matching:

```json
"missing_details": [
  "preferred_color",
  "connectivity_type",
  "warranty_preference"
]
```

Recommendation: Show UI hints to user to fill these in for better results.

---

## ⚠️ Common Issues

### Issue: "OPENAI_API_KEY not found"

**Solution:**

```bash
# Check .env file exists
ls -la apps/intent-parser/.env

# Verify OPENAI_API_KEY is set
cat apps/intent-parser/.env | grep OPENAI_API_KEY

# If missing, add it
echo "OPENAI_API_KEY=sk-..." >> .env
```

### Issue: "Kafka connection failed"

**Solution:**

```bash
# Verify Kafka is running
docker-compose ps

# If not running:
docker-compose up -d kafka zookeeper

# Wait 10 seconds for Kafka to start, then:
python main.py
```

### Issue: "JSON decode error" from LLM

**Solution:**

```bash
# The LLM response wasn't valid JSON
# Try adjusting in .env:

LLM_TEMPERATURE=0.2          # Lower = more deterministic
LLM_MAX_TOKENS=1000          # Increase if response cut off
```

### Issue: "Rate limit exceeded" from OpenAI

**Solution:**

```bash
# Wait 60 seconds, then try again
# Or:
# - Upgrade API plan
# - Use fewer concurrent requests
# - Switch to Anthropic: LLM_PROVIDER=anthropic
```

---

## 📈 Performance Tuning

### Reduce Latency

```bash
# Use faster model
OPENAI_MODEL=gpt-3.5-turbo          # Faster, cheaper
OPENAI_MODEL=gpt-4-turbo-preview    # Slower, more accurate

# Lower token limit (shorter response)
LLM_MAX_TOKENS=300  # Instead of 500

# Increase temperature for faster responses (less thinking)
LLM_TEMPERATURE=0.5  # Instead of 0.3
```

### Increase Throughput

```bash
# Use connection pooling
# Ensure Kafka brokers > 1
# Increase consumer parallelism

docker-compose up -d --scale intent-parser=3  # Multiple replicas
```

### Reduce Costs

```bash
# Use cheaper model
OPENAI_MODEL=gpt-3.5-turbo

# Or use Anthropic with volume discount
LLM_PROVIDER=anthropic
```

---

## 🚀 Next Steps

1. **Integrate with Product Matcher**
   - Consume `intent.processed` events
   - Match products based on refined keywords & category
   - Produce `products.matched` events

2. **Add Caching**
   - Cache LLM responses for duplicate intents
   - Redis for fast retrieval

3. **Implement Auto-Categorization**
   - Train ML model on LLM outputs
   - Use ML for faster categorization
   - Keep LLM as fallback

4. **Add Analytics**
   - Track confidence trends
   - Identify unclear product descriptions
   - Monitor category distribution

5. **Multi-Language Support**
   - Extend prompts for translations
   - Normalize categories across languages

---

## 📞 Support

**Service URL:** http://localhost:3002 (local dev)  
**Health Check:** http://localhost:3002/health  
**API Docs:** http://localhost:3002/docs (Swagger)  
**Alternative Docs:** http://localhost:3002/redoc (ReDoc)

**Kafka UI:** http://localhost:8080

---

**Ready to process intents? Start with Scenario 1 above!** 🚀
