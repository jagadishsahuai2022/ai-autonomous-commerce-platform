# Autopilot Engine - File Structure

```
apps/autopilot-engine/
├── src/
│   ├── controllers/
│   │   └── autopilot.controller.ts          # REST API Controller
│   │       ├── POST /rules                  # Create rule
│   │       ├── GET /rules                   # List user rules
│   │       ├── GET /rules/:id               # Get specific rule
│   │       ├── PUT /rules/:id               # Update rule
│   │       ├── DELETE /rules/:id            # Disable rule
│   │       ├── GET /rules/:id/stats         # Rule statistics
│   │       ├── POST /evaluate               # Evaluate decision
│   │       └── GET /health                  # Service health
│   │
│   ├── services/
│   │   ├── rule-engine.service.ts           # Rule evaluation (250+ lines)
│   │   │   ├── createRule()                 # Create and validate rules
│   │   │   ├── evaluateRule()               # Evaluate conditions
│   │   │   ├── evaluateCondition()          # Single condition eval
│   │   │   ├── getUserRules()               # Fetch user's rules
│   │   │   ├── updateRule()                 # Modify rule
│   │   │   ├── disableRule()                # Disable rule
│   │   │   ├── recordRuleExecution()        # Track execution
│   │   │   └── getRuleStats()               # Usage statistics
│   │   │
│   │   ├── rule-engine.service.spec.ts      # Rule Engine Tests (400+ lines)
│   │   │   ├── Test: createRule             # Rule creation validation
│   │   │   ├── Test: evaluateRule           # Condition matching
│   │   │   ├── Test: Operators              # All condition types
│   │   │   ├── Test: getUserRules           # Rule listing
│   │   │   └── Test: recordRuleExecution    # Stats tracking
│   │   │
│   │   ├── decision-engine.service.ts       # Decision making (300+ lines)
│   │   │   ├── makeDecision()               # Main decision logic
│   │   │   ├── calculateConfidenceScore()   # Scoring algorithm
│   │   │   ├── scorePriceRelevance()        # Price factor
│   │   │   ├── scoreProductQuality()        # Quality factor
│   │   │   ├── scoreUserHistory()           # History factor
│   │   │   ├── scoreMarketContext()         # Market factor
│   │   │   ├── generateReasoning()          # Explainability
│   │   │   └── recordDecisionOutcome()      # Feedback loop
│   │   │
│   │   ├── decision-engine.service.spec.ts  # Decision Tests (400+ lines)
│   │   │   ├── Test: makeDecision           # Decision making
│   │   │   ├── Test: Confidence Factors     # Scoring algo
│   │   │   ├── Test: Risk Levels            # Risk classification
│   │   │   └── Test: Reasoning              # Explainability
│   │   │
│   │   └── autopilot-engine.module.ts       # NestJS Module
│   │       └── Exports: RuleEngine, DecisionEngine
│   │
│   ├── kafka/
│   │   ├── kafka-producer.service.ts        # Event Publishing (100+ lines)
│   │   │   ├── publishEvent()               # Generic event publish
│   │   │   ├── publishRuleCreated()         # Rule creation event
│   │   │   ├── publishDecisionTriggered()   # Decision event
│   │   │   └── publishExecuted()            # Execution event
│   │   │
│   │   ├── kafka-consumer.service.ts        # Event Consumption (100+ lines)
│   │   │   ├── subscribeToTopics()          # Subscribe to channels
│   │   │   ├── handleMessage()              # Process events
│   │   │   └── isReady()                    # Health check
│   │   │
│   │   └── kafka.module.ts                  # NestJS Module
│   │       └── Exports: Producer, Consumer
│   │
│   ├── types/
│   │   └── index.ts                         # Type Definitions (260+ lines)
│   │       ├── AutopilotRule                # Rule interface
│   │       ├── RuleCondition                # Condition interface
│   │       ├── DecisionContext              # Decision input
│   │       ├── AutopilotDecision            # Decision output
│   │       ├── ConfidenceScore              # Scoring breakdown
│   │       ├── DecisionReasoning            # Explainability
│   │       ├── ProductData                  # Product info
│   │       ├── UserPurchaseHistory          # User behavior
│   │       ├── AnomalyDetection             # Safety layer
│   │       ├── ApprovalRequest              # Approval workflow
│   │       ├── AutopilotAnalytics           # Metrics
│   │       ├── IndiaLocalizationData        # India features
│   │       └── AutopilotEvent               # Kafka events
│   │
│   ├── app.module.ts                        # Root NestJS Module
│   │   ├── Imports: ConfigModule
│   │   ├── Imports: AutopilotEngineModule
│   │   ├── Imports: KafkaModule
│   │   └── Controllers: AutopilotController
│   │
│   └── main.ts                              # Application Bootstrap (40+ lines)
│       ├── NestFactory setup
│       ├── CORS configuration
│       ├── Global validation pipe
│       ├── API prefix setup
│       └── Server startup
│
├── tests/
│   └── integration/                         # E2E tests (to be created)
│       ├── rule-creation.e2e.spec.ts
│       ├── decision-making.e2e.spec.ts
│       └── kafka-events.e2e.spec.ts
│
├── dist/                                    # Compiled output (generated)
│   └── [Compiled JavaScript files]
│
├── node_modules/                            # Dependencies (generated)
│
├── .env                                     # Environment variables (local)
├── .env.example                             # Environment template
├── .gitignore                               # Git ignore rules
│
├── package.json                             # NPM Configuration
│   ├── Dependencies: @nestjs/*, kafkajs, redis, axios, class-validator
│   ├── DevDependencies: @types/node, typescript, ts-jest, jest
│   └── Scripts: dev, build, start, test, lint, format, type-check
│
├── tsconfig.json                            # TypeScript Configuration
│   ├── Target: ES2020
│   ├── Module: commonjs
│   ├── Paths: @/* → src/*
│   └── Strict: true
│
├── jest.config.js                           # Jest Configuration
│   ├── Coverage threshold: 70%
│   ├── Test environment: node
│   └── Test regex: *.spec.ts
│
├── Dockerfile                               # Docker Image
│   ├── Build stage: Compile TypeScript
│   ├── Production stage: Minimal runtime
│   └── Health check: API endpoint
│
├── docker-compose.yml                       # Local Environment
│   ├── Kafka (with Zookeeper)
│   ├── PostgreSQL
│   ├── Redis
│   └── Kafka UI (optional)
│
├── README.md                                # Full Documentation (500+ lines)
│   ├── Architecture overview
│   ├── Core components explanation
│   ├── API reference with examples
│   ├── Configuration guide
│   ├── Testing instructions
│   └── Troubleshooting guide
│
├── QUICKSTART.md                            # Quick Start Guide (300+ lines)
│   ├── Step-by-step setup
│   ├── Example API calls
│   ├── Testing instructions
│   └── Troubleshooting tips
│
└── FILE_STRUCTURE.md                        # This file
    └── Visual guide to project layout
```

## Code Statistics

| Component                         | Lines      | Purpose                    |
| --------------------------------- | ---------- | -------------------------- |
| `rule-engine.service.ts`          | 250+       | Core rule evaluation logic |
| `rule-engine.service.spec.ts`     | 400+       | Comprehensive unit tests   |
| `decision-engine.service.ts`      | 300+       | Decision making algorithm  |
| `decision-engine.service.spec.ts` | 400+       | Decision engine tests      |
| `autopilot.controller.ts`         | 200+       | REST API endpoints         |
| `kafka-producer.service.ts`       | 100+       | Event publishing           |
| `kafka-consumer.service.ts`       | 100+       | Event consumption          |
| `types/index.ts`                  | 260+       | TypeScript definitions     |
| `main.ts`                         | 40+        | Application bootstrap      |
| **Total**                         | **1,900+** | **Production-grade code**  |

## Key Interfaces Defined

### Rule System

- `AutopilotRule` - User-defined purchase rule
- `RuleCondition` - Condition with field, operator, value
- `AutopilotAction` - Action on rule match

### Decision Making

- `DecisionContext` - Input for decision engine
- `AutopilotDecision` - Decision output with reasoning
- `ConfidenceScore` - Multi-factor confidence breakdown
- `DecisionReasoning` - Explainability layer

### Data Models

- `ProductData` - Product information
- `UserPurchaseHistory` - User behavior data
- `MarketContext` - Market conditions
- `PricePoint` - Historical pricing

### Safety & Analytics

- `AnomalyDetection` - Anomaly detection config
- `ApprovalRequest` - Approval workflow
- `AutopilotAnalytics` - Usage metrics
- `RulePerformanceMetric` - Rule statistics

### Events & Integration

- `AutopilotEvent` - Kafka event structure
- `IndiaLocalizationData` - India-specific features
- `EMIOption` - Installment options
- `DeliveryETA` - Regional delivery estimates

## Service Dependencies

```
┌─────────────────────────────────────┐
│      NestJS Framework               │
├─────────────────────────────────────┤
│                                     │
│  ┌──────────────────────────────┐  │
│  │  AutopilotEngineModule       │  │
│  │  ├─ RuleEngine               │  │
│  │  └─ DecisionEngine           │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  KafkaModule                 │  │
│  │  ├─ KafkaProducerService     │  │
│  │  └─ KafkaConsumerService     │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  AutopilotController         │  │
│  │  (REST API Endpoints)        │  │
│  └──────────────────────────────┘  │
│                                     │
├─────────────────────────────────────┤
│  External Services                  │
│  ├─ Kafka (Event Streaming)         │
│  ├─ PostgreSQL (Data Persistence)   │
│  ├─ Redis (Caching)                 │
│  ├─ Ranking Engine (ML Scores)      │
│  └─ Intent Parser (User Intent)     │
└─────────────────────────────────────┘
```

## Test Coverage

- ✅ Unit Tests: Rule & Decision engines (800+ lines)
- ⏳ Integration Tests: API endpoints (planned)
- ⏳ E2E Tests: Complete workflows (planned)
- ⏳ Performance Tests: Load testing (planned)

**Current Coverage Goal**: 70%+

## Development Workflow

1. **Write Code** → Feature files in `src/`
2. **Write Tests** → `*.spec.ts` files alongside
3. **Run Tests** → `npm run test`
4. **Format** → `npm run format`
5. **Type Check** → `npm run type-check`
6. **Build** → `npm run build`
7. **Deploy** → Docker image ready

## Adding New Features

To add a new service/feature:

1. Create service in `src/services/my-feature.service.ts`
2. Create tests in `src/services/my-feature.service.spec.ts`
3. Add module exports if needed
4. Add controller endpoints in `autopilot.controller.ts`
5. Add types to `src/types/index.ts` if needed
6. Update documentation

## Hot Paths (Performance Critical)

- `RuleEngine.evaluateRule()` - Called on every product
- `DecisionEngine.calculateConfidenceScore()` - ML scoring
- `KafkaProducerService.publishEvent()` - Event publishing
- `AutopilotController` endpoints - API response time

Optimize these paths for production performance.

---

Generated from project structure analysis.
