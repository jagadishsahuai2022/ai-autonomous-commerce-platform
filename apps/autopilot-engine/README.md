# Autopilot Engine - AI-Driven Autonomous Shopping

![Autopilot Engine](https://img.shields.io/badge/status-production-brightgreen)
![Node.js](https://img.shields.io/badge/node.js-18.x-green)
![NestJS](https://img.shields.io/badge/nestjs-10.x-red)
![Kafka](https://img.shields.io/badge/kafka-event--driven-blue)

## Overview

The **Autopilot Engine** is a sophisticated autonomous shopping system that enables users to set intelligent rules and let the platform automatically make purchase decisions on their behalf. It combines rule engines, ML-powered decision making, and safety mechanisms to create a seamless "set and forget" shopping experience.

### Key Capabilities

✨ **Intelligent Rule Engine**: Define complex purchase conditions (price, category, brand, ratings, stock, time-based)
🧠 **ML-Powered Decisions**: Confidence scoring with multi-factor analysis
🛡️ **Safety Layer**: Spend limits, anomaly detection, and approval workflows
📊 **Complete Transparency**: Explainable AI with decision reasoning
🚀 **Event-Driven**: Kafka-based architecture for real-time triggers
🇮🇳 **India-First**: Built-in EMI, COD, and regional payment support

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│         Frontend (Next.js)                               │
│  Autopilot Dashboard • Rule Builder • Decision Logs      │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   ┌─────────┐  ┌─────────┐  ┌─────────┐
   │ REST    │  │ WebSocket│ │ Kafka   │
   │ API     │  │ Events   │  │ Events  │
   └────┬────┘  └────┬────┘  └────┬────┘
        │            │            │
        └────────────┼────────────┘
                     │
        ┌────────────▼────────────┐
        │  Autopilot Engine       │
        │  ┌────────────────────┐ │
        │  │ Rule Engine        │ │  Processes rules & conditions
        │  ├────────────────────┤ │
        │  │ Decision Engine    │ │  Scores and decides
        │  ├────────────────────┤ │
        │  │ Safety Layer       │ │  Limits & anomaly detection
        │  ├────────────────────┤ │
        │  │ Explainability     │ │  Reasoning & transparency
        │  └────────────────────┘ │
        └────────────┬────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   ┌─────────┐  ┌─────────┐  ┌─────────┐
   │ Config  │  │ Redis   │  │ Kafka   │
   │Service  │  │ Cache   │  │ Topics  │
   └─────────┘  └─────────┘  └─────────┘
```

## Core Components

### 1. Rule Engine (`src/services/rule-engine.service.ts`)

Manages user-defined autopilot rules with condition evaluation.

**Supported Condition Types**:

- **Price-based**: `price <= 15000`, `price > 5000`
- **Category-based**: `category == "smartphones"`
- **Brand-based**: `brand in ["Samsung", "Apple"]`
- **Quality-based**: `rating >= 4.5`
- **Availability**: `stock > 5`
- **Time-based**: `hour between 9-17` (business hours)
- **Composite**: Multiple conditions with AND logic

**Methods**:

```typescript
createRule(rule: AutopilotRule): Promise<AutopilotRule>
evaluateRule(rule: AutopilotRule, product: ProductData): boolean
getUserRules(userId: string): Promise<AutopilotRule[]>
updateRule(ruleId: string, updates: Partial<AutopilotRule>): Promise<AutopilotRule>
recordRuleExecution(ruleId: string, success: boolean): Promise<void>
```

### 2. Decision Engine (`src/services/decision-engine.service.ts`)

Evaluates purchase decisions with comprehensive confidence scoring.

**Confidence Factors** (weighted):

- Price Relevance (20%): Compares to user's purchase history
- Product Quality (20%): Rating, brand, stock availability
- Purchase History (25%): Repeat buyer status, category affinity
- Market Context (10%): Trending, competitor pricing
- Ranking Score (15%): ML ranking engine output
- Intent Score (10%): NLP intent parser output

**Decision Output**:

```typescript
{
  shouldProceed: boolean;           // Auto-buy recommended
  confidence: {
    overall: 0-1;                   // Overall confidence score
    factors: { /* individual factors */ };
    breakdown: [ /* detailed breakdown */ ];
  };
  reasoning: {
    positiveFactors: string[];      // Why to buy
    negativeFactors: string[];      // Why not to buy
    summary: string;                // Human-readable summary
  };
  requiresApproval: boolean;        // Need user confirmation
  riskLevel: 'low' | 'medium' | 'high';
}
```

### 3. Kafka Integration

**Topics**:

- `autopilot.rules.created`: New rule creation events
- `autopilot.triggered`: Decision trigger events
- `autopilot.executed`: Purchase execution results
- `price.updates`: Real-time price change events
- `ranking.scores`: Product ranking updates
- `intent.parsed`: User intent signals

### 4. Safety Layer

**Features**:

- 💰 **Spend Limits**: Monthly and per-order limits
- 🚨 **Anomaly Detection**: Unusual purchase patterns
- ✅ **Approval Workflow**: High-risk decisions require user confirmation
- 🔍 **Audit Trail**: Complete decision history

## API Reference

### Rule Management

#### Create Rule

```bash
POST /api/v1/autopilot/rules
Content-Type: application/json

{
  "userId": "user123",
  "name": "Budget Phone Alert",
  "conditions": [
    {
      "field": "price",
      "operator": "lte",
      "value": 15000
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
  "maxSpendPerMonth": 50000,
  "maxOrderValue": 25000
}
```

#### Get User Rules

```bash
GET /api/v1/autopilot/rules?userId=user123

Response:
{
  "success": true,
  "data": [ /* array of rules */ ],
  "count": 5
}
```

#### Evaluate Decision

```bash
POST /api/v1/autopilot/evaluate
Content-Type: application/json

{
  "userId": "user123",
  "ruleId": "rule456",
  "product": {
    "id": "prod789",
    "name": "Samsung Galaxy S21",
    "price": 45000,
    "category": "smartphones",
    "brand": "Samsung",
    "rating": 4.7,
    "stock": 8
  },
  "userHistory": {
    "totalPurchases": 15,
    "totalSpent": 680000,
    "returnRate": 0.05
  },
  "minimumConfidenceThreshold": 0.65
}
```

### Response Format

```json
{
  "success": true,
  "data": {
    "id": "decision_xxx",
    "shouldProceed": true,
    "confidence": {
      "overall": 0.84,
      "factors": {
        /* ... */
      }
    },
    "reasoning": {
      /* ... */
    },
    "riskLevel": "low"
  },
  "message": "Decision evaluated successfully"
}
```

## Getting Started

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 13+
- Kafka 3.0+
- Redis 6+

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Start services
docker-compose up -d

# Run migrations (if any)
npm run migrate

# Start development server
npm run dev
```

### Development

```bash
# Build
npm run build

# Test
npm run test

# Test with coverage
npm run test:coverage

# Lint
npm run lint

# Format
npm run format

# Type check
npm run type-check
```

### Production

```bash
# Build optimized bundle
npm run build

# Start production server
npm start

# Or with PM2
pm2 start npm --name "autopilot-engine" -- start
```

## Configuration

See `.env.example` for all available configuration options:

```env
# Core
NODE_ENV=production
PORT=3002
LOG_LEVEL=info

# Kafka
KAFKA_BROKERS=kafka1:9092,kafka2:9092

# Decision Making
MIN_CONFIDENCE_THRESHOLD=0.65
AUTO_PURCHASE_ENABLED=true

# Safety
MAX_MONTHLY_SPEND=500000
MAX_ORDER_VALUE=100000
```

## Testing

### Run All Tests

```bash
npm run test
```

### Run Specific Test Suite

```bash
npm run test -- rule-engine
npm run test -- decision-engine
```

### Coverage Report

```bash
npm run test:coverage
```

### Test Coverage Goals

- Unit Tests: **Rule Engine, Decision Engine, Kafka Services**
- Integration Tests: API endpoints, Kafka events
- E2E Tests: Complete decision workflow
- Performance: Load testing with K6

## Monitoring & Observability

### Health Check

```bash
GET http://localhost:3002/api/v1/autopilot/health
```

### Logs

```bash
# Real-time logs
npm run logs

# Log levels: error, warn, info, debug, verbose, silly
```

### Metrics

- Rule creation/execution rates
- Decision confidence distribution
- Success/failure ratios
- API response times

## Integration with Delegate Cart

### Upstream Services

- **API Service** (NestJS): Core commerce backend
- **Ranking Engine** (Python): Product scoring
- **Intent Parser** (Python): User intent analysis
- **Product Aggregator** (Python): Product catalog

### Event Flow

1. User creates autopilot rule via API
2. System listens to Kafka topics (price updates, intent parsed)
3. On trigger event, evaluates rule conditions
4. Runs decision engine with confidence scoring
5. If approved, publishes execution event
6. API service processes purchase
7. Results reported back to user

## India-Specific Features

### Payment Methods

- 💳 Credit/Debit Card
- 🏦 Net Banking
- 📱 UPI & Digital Wallets
- 💵 Cash on Delivery (COD)
- 0️⃣ EMI (Equated Monthly Installments)

### Localization

- Regional pricing
- Pincode-based delivery ETAs
- Local brand preferences
- Festival-specific promotions
- Regional language support

## Explainability & Transparency

Every decision includes:

1. **Confidence Score**: 0-1 scale with individual factor breakdown
2. **Positive Factors**: Why the system recommends buying
3. **Negative Factors**: Concerns or risks identified
4. **Summary**: Human-readable explanation
5. **Risk Assessment**: Low/Medium/High risk classification
6. **Audit Trail**: Complete decision history

Example:

```
Decision: Recommend Purchase
Confidence: 84% (High confidence)

Positive Factors:
- High product quality (rating: 4.7/5)
- Price aligns with your purchase history
- Strong category affinity (20 previous smartphone purchases)
- Limited stock - action recommended

Negative Factors: None

Summary: Excellent match. Safe to proceed automatically.
Risk Level: Low
```

## Performance Optimization

- 🚀 Redis caching for repetitive evaluations
- ⚡ Kafka async event processing
- 🔄 Connection pooling for database
- 📦 Compressed API responses
- 🎯 Efficient rule indexing

## Security

- 🔐 JWT/OAuth2 authentication
- 🔒 Rate limiting on APIs
- 🛡️ CORS configuration
- 📊 Audit logging
- 🚨 Anomaly detection
- ⚠️ Spend limit enforcement

## Troubleshooting

### Common Issues

**Issue**: Rules not triggering

- Check Kafka connectivity
- Verify rule conditions
- Review event timestamps

**Issue**: Low confidence scores

- Check user purchase history
- Verify product data
- Review ranking service output

**Issue**: Performance degradation

- Monitor Redis cache hit rate
- Check database connection pool
- Review Kafka consumer lag

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT - See LICENSE file

## Support

- 📧 Email: support@delegatecart.com
- 💬 Discord: [Community Server]
- 📝 Issues: GitHub Issues
- 📚 Documentation: [Wiki](wiki)

---

**Built with ❤️ for Indian E-commerce**
