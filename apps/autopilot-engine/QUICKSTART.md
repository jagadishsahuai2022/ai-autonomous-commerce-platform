# Autopilot Engine - Quick Start Guide

Get the Autopilot Engine running in 5 minutes!

## Prerequisites

```bash
# Check Node.js version (18+ required)
node --version

# Check npm version
npm --version
```

## Step 1: Install Dependencies

```bash
# Position yourself in the autopilot-engine directory
cd apps/autopilot-engine

# Install packages using pnpm (or npm)
npm install
```

## Step 2: Set Up Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your settings (optional - defaults work for local dev)
# nano .env
```

## Step 3: Start Infrastructure

```bash
# Start Kafka, PostgreSQL, and Redis with Docker Compose
docker-compose up -d

# Verify services are running
docker-compose ps

# Check logs (optional)
docker-compose logs -f kafka
```

**Wait for services to be healthy** (check docker-compose ps):

- ✅ postgres (healthy)
- ✅ redis (healthy)
- ✅ kafka (running)

## Step 4: Run Development Server

```bash
# Start the NestJS development server with hot-reload
npm run dev

# Output should show:
# 🚀 Autopilot Engine running on http://localhost:3002
# 📚 API available at http://localhost:3002/api/v1
```

## Step 5: Test It!

### Health Check

```bash
curl http://localhost:3002/api/v1/autopilot/health
```

Should return:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "autopilot-engine",
  "version": "1.0.0"
}
```

### Create Your First Rule

```bash
curl -X POST http://localhost:3002/api/v1/autopilot/rules \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "name": "Budget Phone Alert",
    "conditions": [
      {
        "field": "price",
        "operator": "lte",
        "value": 20000
      },
      {
        "field": "category",
        "operator": "eq",
        "value": "smartphones"
      }
    ],
    "action": {
      "type": "auto_buy",
      "parameters": { "quantity": 1 }
    },
    "maxSpendPerMonth": 100000,
    "maxOrderValue": 50000
  }'
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "rule_1705322640000_abc123",
    "userId": "user123",
    "name": "Budget Phone Alert",
    "status": "active",
    "createdAt": "2024-01-15T10:30:40.000Z",
    ...
  },
  "message": "Rule created successfully"
}
```

### Test Decision Making

```bash
curl -X POST http://localhost:3002/api/v1/autopilot/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "ruleId": "rule_1705322640000_abc123",
    "product": {
      "id": "prod789",
      "name": "Samsung Galaxy A14",
      "price": 18000,
      "category": "smartphones",
      "brand": "Samsung",
      "rating": 4.3,
      "stock": 5,
      "imageUrl": "http://example.com/phone.jpg"
    },
    "userHistory": {
      "userId": "user123",
      "totalPurchases": 8,
      "totalSpent": 160000,
      "returnRate": 0.05,
      "averageRating": 4.2,
      "purchasesByCategory": { "smartphones": 5 },
      "lastPurchaseDate": "2024-01-01T00:00:00Z"
    },
    "minimumConfidenceThreshold": 0.65,
    "rankingScore": 78,
    "intentScore": 75
  }'
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "decision_1705322700000_def456",
    "userId": "user123",
    "productId": "prod789",
    "timestamp": "2024-01-15T10:31:40.000Z",
    "shouldProceed": true,
    "confidence": {
      "overall": 0.78,
      "factors": {
        "priceConfidence": 0.85,
        "qualityConfidence": 0.72,
        "historyConfidence": 0.80,
        "marketConfidence": 0.60,
        "rankingConfidence": 0.78,
        "intentConfidence": 0.75
      },
      "breakdown": [...]
    },
    "reasoning": {
      "positiveFactors": [
        "High product quality (rating: 4.3/5)",
        "Price aligns with your purchase history",
        "Strong category affinity (5 previous smartphone purchases)"
      ],
      "negativeFactors": [],
      "summary": "Good match. May need user confirmation."
    },
    "requiresApproval": false,
    "riskLevel": "low"
  },
  "message": "Decision evaluated successfully"
}
```

## Step 6: Run Tests

```bash
# Run all unit tests
npm run test

# Watch mode (re-run on changes)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Step 7: View UI (Optional)

### Kafka UI

Open browser: http://localhost:8080

Monitor Kafka topics in real-time:

- autopilot.rules.created
- autopilot.triggered
- autopilot.executed

### PostgreSQL

```bash
# Connect to database
psql postgresql://postgres:postgres@localhost:5432/delegate_cart

# View autopilot tables (once migration runs)
\dt
```

## Development Commands

```bash
# Build for production
npm run build

# Start production build
npm start (after build)

# Format code
npm run format

# Run linter
npm run lint

# Type check
npm run type-check

# View logs
npm run logs

# Clean build artifacts
npm run clean
```

## Troubleshooting

### Services not starting?

```bash
# Check if ports are in use
lsof -i :3002  # Node app
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :9092  # Kafka

# Force kill if needed
kill -9 <PID>

# Restart services
docker-compose restart
```

### Database connection error?

```bash
# Verify PostgreSQL is running
docker-compose logs postgres

# Check connectivity
psql postgresql://postgres:postgres@localhost:5432/delegate_cart -c "SELECT 1"
```

### Kafka connection error?

```bash
# Check Kafka logs
docker-compose logs kafka

# Verify brokers are available
docker exec -it autopilot-kafka kafka-broker-api-versions.sh --bootstrap-server localhost:9092
```

### Tests failing?

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Run specific test file
npm run test -- rule-engine.service.spec

# Run with verbose output
npm run test -- --verbose
```

## Next Steps

1. ✅ **Explore API**: Check out all endpoints at http://localhost:3002/api/v1
2. 📖 **Read Documentation**: See [README.md](README.md) for comprehensive docs
3. 🧪 **Write Tests**: Add more test cases in `src/**/*.spec.ts`
4. 🔗 **Integrate**: Connect with other services (API, ranking engine, etc.)
5. 🚀 **Deploy**: Follow [DEPLOYMENT_GUIDE.md](../../DEPLOYMENT_GUIDE_LOCAL.md)

## Architecture Deep Dive

```
User creates Rule
    ↓
Rule Engine evaluates conditions on product
    ↓
Decision Engine scores confidence
    ↓
Safety Layer checks limits
    ↓
Explainability Layer generates reasoning
    ↓
Kafka publishes events
    ↓
Order processing (via API service)
    ↓
Results reported to user dashboard
```

## Key Files to Explore

- `src/services/rule-engine.service.ts` - Rule evaluation logic
- `src/services/decision-engine.service.ts` - Confidence scoring
- `src/controllers/autopilot.controller.ts` - REST API endpoints
- `src/types/index.ts` - TypeScript type definitions
- `src/kafka/*.service.ts` - Event streaming
- `src/main.ts` - Application bootstrap

## API Quick Reference

| Endpoint                     | Method | Purpose             |
| ---------------------------- | ------ | ------------------- |
| `/autopilot/health`          | GET    | Health check        |
| `/autopilot/rules`           | POST   | Create rule         |
| `/autopilot/rules`           | GET    | Get user rules      |
| `/autopilot/rules/:id`       | GET    | Get specific rule   |
| `/autopilot/rules/:id`       | PUT    | Update rule         |
| `/autopilot/rules/:id`       | DELETE | Disable rule        |
| `/autopilot/rules/:id/stats` | GET    | Get rule statistics |
| `/autopilot/evaluate`        | POST   | Evaluate decision   |

## Environment Variables

Key variables for local development:

```env
NODE_ENV=development
PORT=3002
KAFKA_BROKERS=localhost:9092
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/delegate_cart
REDIS_HOST=localhost
REDIS_PORT=6379
MIN_CONFIDENCE_THRESHOLD=0.65
AUTO_PURCHASE_ENABLED=true
```

See `.env.example` for all options.

## Need Help?

- 📖 Full docs: [README.md](README.md)
- 🐛 Report bugs: GitHub Issues
- 💬 Ask questions: Discord community
- 📧 Email: dev@delegatecart.com

---

**Happy automating! 🚀**
