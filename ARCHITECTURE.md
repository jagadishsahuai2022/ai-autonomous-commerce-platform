# ARCHITECTURE.md - System Architecture & Design Decisions

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CDN / Frontend                             │
├─────────────────────────────────────────────────────────────────┤
│  Next.js Application (Port 3000)                                 │
│  ├── App Router  ├── Tailwind CSS  ├── React 18  ├── TypeScript   │
└─────────────────────────────────────────────────────────────────┘
         │                          │                      │
         ├──────────API Call────────┼──────────────────────┤
         │                          │                      │
┌────────▼─────────────┬───────────▼──────────┬───────────▼────────┐
│   NestJS API         │  FastAPI AI Service  │   Static Assets    │
│   (Port 3001)        │   (Port 8000)        │   (S3/CDN)        │
├──────────────────────┼──────────────────────┼───────────────────┤
│ ├─ Auth Module       │ ├─ Recommender      │                    │
│ ├─ Product Module    │ ├─ Event Consumers  │                    │
│ ├─ Cart Module       │ └─ ML Models        │                    │
│ ├─ Order Module      │                      │                    │
│ └─ Feature Flags     │                      │                    │
└──────────┬───────────┴──────────┬───────────┴────────────────────┘
           │                      │
           │                      │
      ┌────▼──────────────────────▼────┐
      │    Message Bus (Apache Kafka)   │
      ├─────────────────────────────────┤
      │ Events:                         │
      │ • user-activity                 │
      │ • product-updates               │
      │ • order-events                  │
      └────┬──────────────────┬─────────┘
           │                  │
      ┌────▼───┐      ┌──────▼──────┐
      │PostgreSQL      │    Redis    │
      │(Persistence)   │   (Cache)   │
      └────────┘       └─────────────┘
```

## 📊 Component Breakdown

### Frontend Layer (Next.js)

**Technology**: Next.js 14 with App Router  
**Styling**: Tailwind CSS  
**Type Safety**: TypeScript

**Responsibilities**:

- Server-side rendering
- Client-side hydration
- API integration
- User interface

**Key Features**:

- Automatic code splitting
- Image optimization
- Font optimization
- Built-in CSS support

### API Layer (NestJS)

**Technology**: NestJS with Express  
**Architecture**: Modular monolith  
**Type Safety**: TypeScript

**Modules**:

```
AuthModule        - User authentication & authorization
ProductModule     - Product catalog management
CartModule        - Shopping cart operations
OrderModule       - Order processing & history
FeatureFlagModule - Feature management
```

**Cross-Cutting Concerns**:

- Global validation pipes
- CORS configuration
- Error handling
- Logging

### AI Service (FastAPI)

**Technology**: FastAPI with Uvicorn  
**Language**: Python 3.11+  
**Performance**: Async/await

**Components**:

- Recommendation Engine
- Event Consumers
- ML Model Integration Points
- Feedback Processing

### Data Layer

**PostgreSQL**: Primary database

- Relational data modeling
- ACID transactions
- Connection pooling

**Redis**: Caching layer

- Session storage
- Cache invalidation
- Real-time features

**Apache Kafka**: Event streaming

- Asynchronous messaging
- Event sourcing
- System decoupling

## 🔄 Data Flow Patterns

### User Browsing Flow

```
1. User visits /products
   │
2. Next.js fetches from API /products
   │
3. API queries PostgreSQL
   │
4. Results cached in Redis (5 minutes TTL)
   │
5. Response sent to frontend
   │
6. Frontend renders with Tailwind styles
```

### Recommendation Flow

```
1. User arrives at homepage
   │
2. Frontend: GET /recommend/1 to AI Service
   │
3. AI Service queries RedisCache for user profile
   │
4. If miss, consume from Kafka (user_activity topic)
   │
5. Generate recommendations using ML model
   │
6. Cache result in Redis (1 hour TTL)
   │
7. Return to frontend
   │
8. Frontend displays recommendations
```

### Order Processing

```
1. User places order
   │
2. Frontend: POST /orders to API
   │
3. API validates inventory
   │
4. API creates order in PostgreSQL
   │
5. API publishes "order-createdEvent to Kafka
   │
6. AI Service consumes event (updates user model)
   │
7. Send confirmation email (async)
   │
8. Update analytics (async)
```

## 🏛️ Design Patterns Used

### 1. **Repository Pattern**

Each module has service layer for data access

```typescript
// Example in ProductService
class ProductService {
  findAll() { ... }  // Abstracted data access
  findOne(id) { ... }
}
```

### 2. **Dependency Injection**

NestJS built-in IoC container

```typescript
@Injectable()
export class ProductService {
  constructor(
    private ordersService: OrdersService // Auto-injected
  ) {}
}
```

### 3. **Strategy Pattern**

Switchable recommendation algorithms

```python
# FastAPI service
class RecommendationEngine:
  def get_recommendations(self, user_id):
    # Can switch between:
    # - Collaborative filtering
    # - Content-based filtering
    # - Hybrid approach
```

### 4. **Event-Driven Architecture**

Decoupled services via Kafka

- Services don't call each other directly
- Events published to message bus
- Subscribers consume events independently

### 5. **Cache-Aside Pattern**

```
Request → Check Cache → Miss/Hit
  │
  └─→ Hit: Return cached data
  └─→ Miss: Query DB → Cache → Return
```

## 🔐 Security Architecture

### Authentication Flow

```
1. User login (credentials)
   │
2. API validates against PostgreSQL
   │
3. Generate JWT token
   │
4. Store in Redis with user session
   │
5. Frontend receives token (HttpOnly cookie)
   │
6. Subsequent requests include token
   │
7. Middleware validates token
```

### Data Protection

- **Passwords**: Hashed with bcrypt
- **Sensitive Data**: Encrypted at rest
- **API Communication**: HTTPS only
- **CORS**: Restricted origins

## 📈 Scalability Design

### Horizontal Scaling

**Stateless Design**:

- Each API instance independent
- Session stored in Redis (shared)
- No local file storage
- Database-driven configuration

**Load Balancing**:

```
Client Requests
      │
      ▼
┌─────────────────┐
│  Load Balancer  │
│   (Nginx/HAProxy)
└────┬────┬────┬──┘
     │    │    │
  ┌──▼┐┌──▼┐┌──▼┐
  │API││API││API│ (Horizontal Scaling)
  └──┬┘└──┬┘└──┬┘
     │    │    │
     └────┴────┤
              ▼
          PostgreSQL + Read Replicas
```

### Caching Strategy

```
Tier 1: Browser Cache (1 hour)
  │
Tier 2: Redis (In-memory, 24 hour)
  │
Tier 3: Database (Persistent)
```

### Database Optimization

- **Indexes**: On frequently queried columns
- **Partitioning**: By date for large tables
- **Connection Pool**: Reuse connections
- **Query Optimization**: EXPLAIN ANALYZE

## 🔄 Deployment Architecture

### Development Environment

```bash
npm run dev → All apps run locally with hot-reload
```

### Production Environment

```
Docker Container Orchestration
    ├─ Docker Swarm or Kubernetes
    ├─ Auto-scaling based on metrics
    ├─ Zero-downtime deployments
    └─ Self-healing
```

## 🧪 Testing Architecture

### Unit Tests (Future)

```
Each module has its own test suite
- Services tested in isolation
- Mocked dependencies
```

### Integration Tests (Future)

```
Multiple modules interact
- Real database (test instance)
- Test data fixtures
```

### Start-to-End Tests (Future)

```
Full system testing
- All services running
- User workflows simulated
```

## 📊 Performance Characteristics

### Expected Performance

| Metric         | Target | Strategy                |
| -------------- | ------ | ----------------------- |
| API Response   | <200ms | Caching + Indexing      |
| Recommendation | <500ms | Pre-computation + Cache |
| Page Load      | <2s    | Code splitting + CDN    |
| Uptime         | 99.9%  | Redundancy + Monitoring |

### Performance Monitoring

```
Application Performance Monitoring (APM)
  ├─ Request latency tracking
  ├─ Database query profiling
  ├─ Error rate monitoring
  ├─ Resource utilization
  └─ Custom metrics
```

## 🔄 Evolution Roadmap

### Phase 2 Enhancements

- [ ] GraphQL API layer
- [ ] Real-time WebSocket updates
- [ ] Advanced ML model integration
- [ ] Distributed tracing (Jaeger)
- [ ] Service mesh (Istio)

### Phase 3 Optimizations

- [ ] Edge computing (Workers)
- [ ] Machine learning optimization
- [ ] Advanced caching strategies
- [ ] Multi-region deployment
- [ ] Disaster recovery plan

## 📚 References

- [12 Factor App](https://12factor.net/)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [The Twelve-Factor App methodology](https://en.wikipedia.org/wiki/Microservices)
- [Event-Driven Architecture](https://www.confluent.io/blog/event-driven-architecture/</div>

---

**Document Version**: 1.0  
**Last Updated**: April 2026
