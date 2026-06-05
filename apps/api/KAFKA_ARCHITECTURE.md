# 🎯 Kafka Event-Driven Architecture Guide

## Overview

This document describes the complete event-driven architecture using Kafka to enable asynchronous communication between the NestJS backend, Python FastAPI AI service, and other microservices.

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        EVENT FLOW                               │
└─────────────────────────────────────────────────────────────────┘

User Actions (Frontend)
        ↓
  ┌─────────────────────────────────┐
  │   NestJS Backend (API)          │
  │  ┌─────────────────────────────┐│
  │  │ ProductService              ││
  │  │ CartService                 ││
  │  │ OrderService                ││
  │  └──────────┬──────────────────┘│
  │             │                    │
  │      ┌──────▼─────────┐         │
  │      │  KafkaService  │         │
  │      │  (Producer)    │         │
  │      └──────┬──────────┘         │
  └─────────────┼────────────────────┘
                │
        ┌───────▼──────────┐
        │   KAFKA TOPICS   │
        ├───────────────────┤
        │ product-events    │
        │ commerce-events   │
        │ user-behavior     │
        │ ml-events         │
        │ analytics         │
        └───────┬──────────┘
                │
    ┌───────────┼───────────┐
    │           │           │
    ▼           ▼           ▼
┌─────────────────────────────────────────┐
│     Python FastAPI AI Service          │
│   (KafkaEventConsumer)                 │
│  ┌────────────────────────────────┐    │
│  │ EventProcessors:              │    │
│  │ - UserBehaviorTracker         │    │
│  │ - OrderEventProcessor         │    │
│  │ - RecommendationEngine        │    │
│  └────────────────────────────────┘    │
│                                        │
│  ┌────────────────────────────────┐    │
│  │ Endpoints:                     │    │
│  │ GET  /api/recommendations/{id} │    │
│  │ GET  /api/user-profile/{id}    │    │
│  │ GET  /api/stats                │    │
│  │ GET  /api/kafka/status         │    │
│  └────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

---

## 🐳 Kafka Infrastructure

### Docker Compose Services

The `docker-compose.yml` includes:

- **Zookeeper** - Kafka coordination service
  - Port: 2181
  - Container: `ai-commerce-zookeeper`

- **Kafka** - Message broker
  - Ports: 9092 (host), 29092 (container)
  - Container: `ai-commerce-kafka`
  - Auto-topic creation enabled
  - 3 partitions per topic by default

- **PostgreSQL** - Data storage
- **Redis** - Caching
- **NestJS API** - Backend
- **FastAPI AI Service** - Event consumer

### Starting Services

```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f kafka
docker-compose logs -f api
docker-compose logs -f ai-service
```

---

## 📡 Domain Events

### Event Types

All events follow this naming convention: `<aggregate>.<action>`

#### Product Events

- `product.viewed` - User viewed a product
- `product.created` - Product created
- `product.updated` - Product updated

#### Cart Events

- `cart.item_added` - Item added to cart
- `cart.item_removed` - Item removed from cart
- `cart.abandoned` - Cart abandoned by user

#### Order Events

- `order.created` - Order created
- `order.confirmed` - Order confirmed
- `order.shipped` - Order shipped
- `order.completed` - Order completed
- `order.cancelled` - Order cancelled

#### User Events

- `user.registered` - User registered
- `user.updated` - User profile updated

#### Recommendation Events

- `recommendation.generated` - Recommendations generated

### Event Payload Structure

```typescript
{
  eventId: string (UUID),           // Unique event identifier
  eventType: string,                // Event type enum value
  timestamp: ISO8601,               // Event timestamp
  version: number,                  // SchemaVersion
  data: {
    userId?: number,                // User who triggered event
    productId?: number,             // Product involved
    orderId?: number,               // Order involved
    cartId?: number,                // Cart involved
    [...]                           // Event-specific fields
  },
  metadata?: {
    source: string,                 // Service that emitted event
    correlationId?: string,         // For event tracing
    causationId?: string,           // Event that caused this one
  }
}
```

---

## 🎯 NestJS Event Emission

### KafkaService

**Location**: `src/kafka/kafka.service.ts`

**Features**:

- Singleton producer
- Auto-connect on app startup
- Retry logic with exponential backoff (3 attempts)
- Gzip compression
- Error logging

**Methods**:

```typescript
// Emit single event
await kafkaService.emit(topic: string, message: object, partition?: number)

// Emit to multiple topics
await kafkaService.emitToMultiple(topics: string[], message: object)

// Health check
await kafkaService.healthCheck(): boolean

// Get producer status
kafkaService.getStatus(): { connected: boolean, brokers: string[] }
```

### Event Builder

**Location**: `src/common/events/domain.event.ts`

**Features**:

- Fluent API for building events
- Automatic UUID generation
- Validation
- Timestamp management

**Usage**:

```typescript
const event = new EventBuilder()
  .withEventType(EventType.PRODUCT_VIEWED)
  .withUserId(123)
  .withProductId(456)
  .withData({ customField: 'value' })
  .build();

await kafkaService.emit('product-events', event);
```

### Service Integration

#### ProductService

```typescript
// Emits: product.viewed
// Topics: product-events, user-behavior, analytics
async findOne(id: number, userId?: number)
```

#### CartService

```typescript
// Emits: cart.item_added
// Topics: commerce-events
async addItem(userId: number, item: any)

// Emits: cart.abandoned
// Topics: commerce-events
async clearCart(userId: number, reason: string)
```

#### OrderService

```typescript
// Emits: order.created
// Topics: commerce-events, analytics
async createOrder(orderData: any)

// Emits: order.confirmed, order.shipped, order.completed, order.cancelled
// Topics: commerce-events, analytics
async updateOrderStatus(orderId: number, newStatus: string)
```

### Kafka Topics

| Topic             | Producers                 | Consumers             | Purpose                |
| ----------------- | ------------------------- | --------------------- | ---------------------- |
| `product-events`  | ProductService            | AI Service, Analytics | Product-related events |
| `commerce-events` | CartService, OrderService | AI Service, Analytics | Commerce transactions  |
| `user-behavior`   | ProductService            | AI Service            | User interactions      |
| `ml-events`       | AI Service                | Optional analytics    | ML events              |
| `analytics`       | All services              | Analytics             | All analytical data    |
| `recommendations` | AI Service                | Optional consumers    | Recommendation updates |

---

## 🧠 Python Kafka Consumer

### KafkaEventConsumer

**Location**: `app/consumers/kafka_consumer.py`

**Features**:

- Consumer group: `ai-service-consumer`
- Auto-commit enabled
- Error handling with retries
- Background thread operation
- Event handler registration

**Methods**:

```python
# Initialize consumer
consumer = KafkaEventConsumer(brokers="kafka:29092", group_id="ai-service-consumer")

# Register event handler
consumer.register_handler(EventType.PRODUCT_VIEWED, async_handler_func)

# Start consumption
consumer.start()

# Stop consumption
consumer.stop()

# Get status
status = consumer.get_status()
```

### Event Processing

#### UserBehaviorTracker

```python
# Track product views
tracker.track_product_view(user_id, product_id, event)

# Track cart add
tracker.track_cart_item_added(user_id, product_id, event)

# Track abandoned carts
tracker.track_cart_abandoned(user_id, event)

# Get user profile
profile = tracker.get_user_profile(user_id)
```

#### OrderEventProcessor

```python
# Process order creation
processor.process_order_created(event)

# Update order status
processor.process_order_status_change(event, "shipped")

# Get order info
order_info = processor.get_order_info(order_id)
```

#### RecommendationEngine

```python
# Generate recommendations
recommendations = engine.generate_recommendations(user_id)

# Get insights
insights = engine.get_insights(user_id)
```

### Event Handlers

```python
# Registered handlers in main.py:
# - handle_product_viewed()
# - handle_cart_item_added()
# - handle_cart_abandoned()
# - handle_order_created()
# - handle_order_confirmed()
# - handle_order_shipped()
# - handle_order_completed()
```

---

## 🔄 Event Flow Examples

### Example 1: Product View Event Flow

```
1. User views product (GET /products/123?userId=456)
   ↓
2. ProductController.findOne() called
   ↓
3. ProductService.findOne() executes (cache/DB lookup)
   ↓
4. emit ProductViewedEvent() called (non-blocking)
   KafkaService.emitToMultiple([
     'product-events',
     'user-behavior',
     'analytics'
   ], event)
   ↓
5. Event published to Kafka (retries if needed)
   ↓
6. Python consumer receives event
   ↓
7. EventHandler routes to UserBehaviorTracker
   ↓
8. Product view recorded:
   - user_events[456].append(product_view)
   - user_products[456].append(123)
   ↓
9. AI Service API can now:
   - GET /api/recommendations/456
   - GET /api/user-profile/456
```

### Example 2: Order Creation Event Flow

```
1. User clicks "Place Order"
   ↓
2. NestJS API: POST /orders with order data
   ↓
3. OrderController.createOrder() called
   ↓
4. OrderService.createOrder() executes
   ↓
5. emit OrderCreatedEvent() called
   KafkaService.emitToMultiple([
     'commerce-events',
     'analytics'
   ], event)
   ↓
6. Event published to Kafka
   ↓
7. Python consumer receives event
   ↓
8. OrderEventProcessor.process_order_created()
   - Store order info
   - Record event history
   ↓
9. Order status updates trigger:
   - emit OrderConfirmedEvent()
   - emit OrderShippedEvent()
   - emit OrderCompletedEvent()
```

---

## 🏗️ Clean Architecture Principles

### Separation of Concerns

**NestJS**:

- Controllers: HTTP requests → DTOs
- Services: Business logic
- KafkaService: Event emission (decoupled)

**Python**:

- Consumer: Kafka event consumption (decoupled)
- Processors: Business logic (ML, analytics)
- Endpoints: API responses

### Non-Blocking Event Emission

Events are emitted asynchronously and don't block main business logic:

```typescript
// In ProductService
async findOne(id: number, userId?: number) {
  const product = await db.findProduct(id);

  // Non-blocking - don't await
  this.emitProductViewedEvent(userId, id)
    .catch(error => logger.warn('Event emission failed'));

  return product;  // Return immediately
}
```

### Error Resilience

- Kafka emission failures don't break business logic
- Consumer has retry logic with exponential backoff
- Invalid events are logged, not thrown
- Services continue with degraded functionality

---

## 🔍 Monitoring & Debugging

### Health Checks

```bash
# NestJS Kafka status
curl http://localhost:3001/kafka/status

# Python Kafka status
curl http://localhost:8000/api/kafka/status

# Full AI service stats
curl http://localhost:8000/api/stats
```

### Logs

```bash
# View NestJS logs
docker-compose logs -f api

# View Python logs
docker-compose logs -f ai-service

# View Kafka logs
docker-compose logs -f kafka
```

### Test Event Emission

```bash
# Send test event to Python service
curl -X POST http://localhost:8000/api/events/test \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "test-123",
    "eventType": "product.viewed",
    "timestamp": "2024-01-15T10:00:00Z",
    "version": 1,
    "data": {
      "userId": 1,
      "productId": 123
    }
  }'
```

---

## 📈 Performance Considerations

### Throughput

- **Topics**: 3 partitions per topic (configurable)
- **Batching**: 10 max records per poll
- **Compression**: Gzip enabled
- **Partitioning**: By `userId` for local processing

### Scalability

To scale:

1. Add more Kafka partitions
2. Add more consumer instances
3. Load balance Kafka brokers
4. Use consumer groups

### Retention

- **Log retention**: 7 days (168 hours)
- **Segment size**: 1GB per segment
- **Cleanup policy**: Delete (production: Compact)

---

## 🧪 Testing Kafka Events

### Manual Testing

```bash
# 1. Verify Kafka is running
docker-compose ps

# 2. Produce event via NestJS
curl http://localhost:3001/products/1?userId=1

# 3. Check Python stats
curl http://localhost:8000/api/stats

# 4. Get recommendations
curl http://localhost:8000/api/recommendations/1

# 5. Test via Python endpoint
curl -X POST http://localhost:8000/api/events/test -d '...'
```

### Automated Testing

```python
# In Python tests
from app.models.event import EventType, DomainEvent
from app.consumers.kafka_consumer import KafkaEventConsumer

# Create consumer
consumer = KafkaEventConsumer()
consumer.connect()

# Test handler
test_called = []
def test_handler(event):
    test_called.append(event)

consumer.register_handler(EventType.PRODUCT_VIEWED, test_handler)

# Verify handler works
assert len(test_called) > 0
```

---

## 🚀 Production Deployment

### Pre-Deployment Checklist

- [ ] Kafka cluster configured (3+ brokers)
- [ ] Topics created with proper replication
- [ ] Consumer groups configured
- [ ] Monitoring/alerting set up
- [ ] Backup strategy in place
- [ ] Security (SSL/TLS) configured
- [ ] Authentication (SASL) configured

### Performance Tuning

```yaml
# Kafka Configuration
num.partitions: 6 # More partitions for parallelism
replication.factor: 3 # For fault tolerance
min.insync.replicas: 2 # Wait for 2 replicas
log.retention.hours: 168 # 1 week retention
log.segment.bytes: 1073741824 # 1 GB segments
```

### Monitoring Metrics

- Message throughput (messages/sec)
- Consumer lag (offset behind latest)
- Broker CPU/Memory/Disk
- Topic replication status
- Producer fail rate

---

## 🔗 Integration Points

### Future Enhancements

1. **WebSocket Integration**: Push recommendations to connected clients
2. **Real-time Analytics**: Dashboard consuming events
3. **ML Model Training**: Collect data from events
4. **Fraud Detection**: Real-time anomaly detection
5. **Inventory Management**: Stock updates via events
6. **Notification Service**: Send alerts based on events
7. **Data Lake**: Archive events for analysis

### Extension Points

- Add new event types in `EventType` enum
- Add new topics in `KAFKA_TOPICS`
- Register new handlers in `init_event_handlers()`
- Implement new processors in `app/services/`

---

## Summary

This event-driven architecture enables:

- ✅ Decoupled microservices
- ✅ Scalable event processing
- ✅ Real-time analytics
- ✅ Asynchronous operations
- ✅ Non-blocking business logic
- ✅ Enterprise-grade reliability

The system is production-ready and follows best practices for distributed systems.
