# 🚀 WebSocket Real-Time System - Complete Guide

## 📚 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Getting Started](#getting-started)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [Testing & Verification](#testing--verification)
6. [Security](#security)
7. [Performance Optimization](#performance-optimization)
8. [Troubleshooting](#troubleshooting)

---

## 🏗️ Architecture Overview

### Real-Time Data Flow

```
┌─────────────┐       ┌──────────┐        ┌──────────────┐
│   NestJS    │───────│  Kafka   │────────│ Python AI    │
│   Backend   │       │ Broker   │        │  Service     │
└─────────────┘       └──────────┘        └──────────────┘
      ▲                                           │
      │                                           ▼
      │                                    ┌──────────────┐
      │                                    │  Event       │
      │                                    │  Processing  │
      │                                    └──────────────┘
      │                                           │
      │                                           ▼
      │            WebSocket Events        ┌──────────────┐
      └────────────────────────────────────│  Kafka Store │
                                           └──────────────┘
           ▼
    ┌───────────────────────────────────┐
    │      WebSocket Gateway            │
    │   (Socket.IO on port 3002)        │
    └───────────────────────────────────┘
           │      │      │      │
           ▼      ▼      ▼      ▼
      [Room: user_1] [Room: user_2] [...user_N]
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
    ┌─────────────────┐  ┌──────────────────┐
    │   Next.js       │  │  React Hooks     │
    │   Frontend      │  │  & Components    │
    └─────────────────┘  └──────────────────┘
         │
         ▼
    ┌──────────────────────────────────┐
    │  Zustand Store (Real-time State) │
    │  - Recommendations               │
    │  - Cart Updates                  │
    │  - Order Status                  │
    │  - Notifications                 │
    └──────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────┐
    │    UI Components                 │
    │  - Real-time Recommendations     │
    │  - Live Cart                     │
    │  - Order Tracker                 │
    │  - Notifications                 │
    └──────────────────────────────────┘
```

### Key Components

| Component               | Purpose                                      | Technology       |
| ----------------------- | -------------------------------------------- | ---------------- |
| **KafkaConsumerBridge** | Listens to Kafka events, routes to WebSocket | NestJS Service   |
| **WebSocketGateway**    | Manages client connections, room management  | Socket.IO        |
| **WebSocketService**    | Transforms events to WebSocket format        | NestJS Service   |
| **realtimeClient**      | Frontend WebSocket connection manager        | socket.io-client |
| **useRealtimeStore**    | Global state for real-time data              | Zustand          |
| **useWebSocket**        | React hook for WebSocket integration         | React Hooks      |

---

## 🚀 Getting Started

### Prerequisites

- Docker & Docker Compose running
- Node.js 18+
- Python 3.9+

### Installation

#### 1. Backend Dependencies

```bash
cd apps/api

# Install NestJS WebSocket packages
npm install --save @nestjs/websockets socket.io

# JWT for authentication
npm install --save @nestjs/jwt

# Already installed:
# - kafkajs (Kafka producer/consumer)
# - @nestjs/common (core NestJS)
```

#### 2. Frontend Dependencies

```bash
cd apps/web

# Install Socket.IO client & state management
npm install socket.io-client zustand

# Already installed:
# - next-auth (session management)
# - next/navigation (routing)
```

#### 3. Python AI Service Dependencies

```bash
cd apps/ai-service

# Update requirements.txt
pip install aiokafka pydantic

# Or add to requirements.txt:
# aiokafka==0.8.0
# pydantic==2.0.0  (If not already installed)
```

### Configuration

#### NestJS WebSocket (.env)

```env
# WebSocket Configuration
WEBSOCKET_PORT=3002
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# JWT
JWT_SECRET=your-secret-key-here
JWT_TOKEN_ENABLED=true

# Kafka (existing)
KAFKA_BROKERS=kafka:29092

# Redis (if you want to persist connections)
REDIS_URL=redis://redis:6379
```

#### Next.js Frontend (.env.local)

```env
# WebSocket Server
NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:3002

# API Server
NEXT_PUBLIC_API_URL=http://localhost:3001

# NextAuth Settings (existing)
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000
```

---

## 🔌 Backend Implementation

### 1. WebSocket Gateway Structure

```
src/websocket/
├── websocket.gateway.ts      # Socket.IO gateway, connection handling
├── websocket.service.ts      # Event routing, emission logic
├── websocket.module.ts       # Module definition
├── kafka-websocket.bridge.ts # Kafka consumer bridge
└── guards/
    └── jwt-websocket.guard.ts # JWT authentication (optional)
```

### 2. Key Features Implemented

#### Connection Management

```typescript
// Users join room: user_<userId>
socket.join(`user_${userId}`); // Automatically on connect

// Prevents unauthorized access
// Validates userId before allowing connection
```

#### Event Emission

```typescript
// Emit to specific user
gateway.emitRecommendationUpdate(userId, data);

// Emit to all users
gateway.broadcastEvent('event-name', data);

// Room-based emission (secure)
server.to(`user_${userId}`).emit('event', data);
```

#### Kafka Bridge

```typescript
// Automatically consumes Kafka events
// Routes them to WebSocket gateway
// Transforms event format for frontend
```

### 3. Event Types Supported

| Event Type               | Trigger                          | Use Case                      |
| ------------------------ | -------------------------------- | ----------------------------- |
| `recommendation:updated` | AI generates new recommendations | Real-time product suggestions |
| `cart:updated`           | Item added/removed from cart     | Live cart synchronization     |
| `order:status_changed`   | Order status transitions         | Real-time order tracking      |
| `notification:created`   | System/marketing notification    | User alerts & messages        |
| `user:online/offline`    | Connection/disconnection         | User status tracking          |

---

## 🎨 Frontend Implementation

### 1. Integration Steps

#### Step 1: Add WebSocket Module to Route

```typescript
// pages/dashboard.tsx
import { WebSocketModule } from '@/lib/websocket/websocket.module';

export default function DashboardPage() {
  return <WebSocketModule>{/* Your components */}</WebSocketModule>;
}
```

#### Step 2: Use WebSocket Hook

```typescript
'use client';

import { useWebSocket } from '@/lib/hooks/useWebSocket';

export default function RecommendationsPage() {
  const {
    isConnected,
    recommendations,
    socket,
  } = useWebSocket({
    autoConnect: true,
    onConnect: () => console.log('Connected!'),
    onError: (error) => console.error('Error:', error),
  });

  return (
    <div>
      <p>Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</p>
      <RealtimeRecommendations />
    </div>
  );
}
```

#### Step 3: Add Components

```typescript
import RealtimeRecommendations from '@/components/RealtimeRecommendations';
import RealtimeOrderList from '@/components/RealtimeOrderStatus';
import NotificationContainer from '@/components/NotificationToast';

export default function Dashboard() {
  return (
    <div className="p-6 space-y-6">
      <RealtimeRecommendations />
      <RealtimeOrderList />
      <NotificationContainer />
    </div>
  );
}
```

### 2. State Management with Zustand

```typescript
import useRealtimeStore from '@/lib/store/realtime.store';

// In any component:
const { recommendations, cartItems, orders, notifications, isConnected } = useRealtimeStore();

// Update methods
store.setRecommendations(newRecommendations);
store.updateCart(cartItems);
store.addNotification({
  type: 'success',
  title: 'Success!',
  message: 'Action completed',
});
```

### 3. Custom Event Listeners

```typescript
import { useRealtimeEvent } from '@/lib/hooks/useWebSocket';

export function MyComponent() {
  useRealtimeEvent('custom:event', (data) => {
    console.log('Received:', data);
  });

  return <div>Listening for events...</div>;
}
```

---

## 🧪 Testing & Verification

### Test 1: Basic Connection

```bash
# Terminal 1: Start NestJS API
cd apps/api
npm run start

# Terminal 2: Check WebSocket is running
curl http://localhost:3002

# Expected: Connection refused (expected - WebSocket not HTTP)
# But the server is running
```

### Test 2: Frontend Connection

```typescript
// In browser console (Next.js running on localhost:3000)
import { realtimeClient } from '@/lib/realtime.ts';

// Connect
await realtimeClient.connect(1, 'your-jwt-token');

// Listen for events
realtimeClient.on('connected', (data) => {
  console.log('✅ Connected!', data);
});

// Check state
realtimeClient.getState();

// Ping server
const latency = await realtimeClient.ping();
console.log('Latency:', latency, 'ms');
```

### Test 3: Emit Event from Backend

```bash
# Using the test endpoint in api/src/modules/product/product.controller.ts
curl -X POST http://localhost:3001/events/test \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "eventType": "recommendation.generated",
    "data": {
      "recommendations": [
        {
          "id": "test-1",
          "productId": 1,
          "productName": "Test Product",
          "price": 99.99,
          "image": "https://...",
          "score": 0.95
        }
      ]
    }
  }'

# Frontend should receive event in real-time
# Check browser console and Zustand store
```

### Test 4: Full End-to-End Flow

**Step 1: Start Services**

```bash
docker-compose up -d
```

**Step 2: Start Frontend**

```bash
cd apps/web
npm run dev  # http://localhost:3000
```

**Step 3: Open Dashboard**

- Navigate to dashboard/recommendations
- Open browser DevTools console

**Step 4: Trigger Events**

```bash
# Product view event (generates recommendations)
curl "http://localhost:3001/products/1?userId=1"

# Wait 2-3 seconds
# Frontend should show real-time notification & recommendations
```

**Step 5: Verify UI Updates**

- ✅ Recommendations appear in real-time
- ✅ Toast notification shows
- ✅ Zustand store updated
- ✅ No page refresh needed

### Test 5: Multiple Users

```typescript
// User 1
const client1 = new RealtimeClient();
await client1.connect(1, 'token1');

// User 2
const client2 = new RealtimeClient();
await client2.connect(2, 'token2');

// User 1 receives events for user 1 only
// User 2 receives events for user 2 only
// Events isolated by room
```

### Test 6: Reconnection

```typescript
// Disconnect network
const client = realtimeClient;
client.disconnect();

// Should auto-reconnect within 5 seconds
// UI should show loading state
// Then re-connect automatically

// Network back
// Client reconnects and resumes
```

---

## 🔒 Security

### 1. JWT Authentication

```typescript
// Extract token from session
const token = session?.user?.token;

// Send in connection auth
await realtimeClient.connect(userId, token);

// Backend validates token
// Reject unauthorized connections
```

### 2. Room Isolation

```typescript
// Users can only access their own room
socket.join(`user_${userId}`); // Automatic

// Validation prevents cross-user access
const isValidChannel = (channel, userId) => {
  // Only allow: user_<userId>, broadcast, user_<userId>_*
  return channel === `user_${userId}` || channel === 'broadcast';
};

// Emit only to user's room
server.to(`user_${userId}`).emit(event, data);
```

### 3. Rate Limiting (Optional)

```typescript
// In websocket.gateway.ts (to implement)
private userMessageCount = new Map();

@SubscribeMessage('event')
async handleEvent(socket: Socket, data: any) {
  const userId = this.userSockets.get(socket.id);

  // Check rate limit
  const count = this.userMessageCount.get(userId) || 0;
  if (count > 100) {
    // Too many messages per minute
    socket.emit('error', 'Rate limit exceeded');
    return;
  }

  this.userMessageCount.set(userId, count + 1);
  // Reset after 60s
}
```

---

## ⚡ Performance Optimization

### 1. Message Compression

```typescript
// Already enabled in socket.io config
compression_type: 'gzip',  // NestJS
transports: ['websocket']  // Avoids polling
```

### 2. Selective Subscriptions

```typescript
// Only subscribe to events you need
socket.on('recommendation:updated', handler);

// Unsubscribe when not needed
socket.off('recommendation:updated', handler);
```

### 3. Batch Updates

```typescript
// Group multiple updates
const batch = [...updates];
store.updateBatch(batch); // Single re-render

// Instead of:
updates.forEach((u) => store.update(u)); // Multiple re-renders
```

### 4. Memory Management

```typescript
// Components cleanup subscriptions
useEffect(() => {
  const unsub = socket.on('event', handler);
  return unsub; // Cleanup
}, []);
```

---

## 🐛 Troubleshooting

### Issue: "Connection refused on port 3002"

**Solution**:

- Ensure WebSocket gateway is running: `curl http://localhost:3001/health`
- Check CORS_ORIGINS environment variable
- Port 3002 should not be blocked by firewall

### Issue: Events not reaching frontend

**Solution**:

- Verify Kafka consumer bridge is running: check `docker-compose logs api | grep Kafka`
- Check event is being emitted: `docker-compose logs api | grep "Event published"`
- Verify frontend is connected: `realtimeClient.isConnected()` in console

### Issue: "Invalid token" errors

**Solution**:

- Ensure JWT_SECRET matches across services
- Token should be included in connection auth
- Check token expiration: `JWT_EXPIRES_IN=24h`

### Issue: High latency / slow updates

**Solution**:

- Use `transports: ['websocket']` (not polling)
- Enable compression
- Check network: `realtimeClient.ping()`
- Verify Kafka broker performance

### Issue: Memory leaks

**Solution**:

- Always cleanup event listeners: `useEffect(() => { return unsub; }, [])`
- Remove old notifications: `clearNotifications()`
- Limit notifications array size

---

## 📊 Monitoring

### Backend Health Check

```bash
# Check WebSocket gateway status
curl http://localhost:3001/websocket/stats

# Response:
# {
#   "totalConnections": 42,
#   "totalUsers": 38,
#   "users": [
#     { "userId": 1, "socketCount": 2, "socketIds": [...] },
#     ...
#   ],
#   "timestamp": "2024-01-15T10:00:00Z"
# }
```

### Frontend Performance

```typescript
// Check connection state
realtimeClient.getState();

// Check message latency
const latency = await realtimeClient.ping();

// Check Zustand store
useRealtimeStore.getState();
```

### Logs

```bash
# API logs (Kafka consumer bridge)
docker-compose logs api | grep KafkaConsumerBridge

# Frontend logs
// Browser Console -> check for connection messages

# Python AI service
docker compose logs ai-service | grep consumer
```

---

## ✅ Checklist for Production

- [ ] JWT authentication enabled
- [ ] CORS properly configured
- [ ] Rate limiting implemented
- [ ] Error handling in all components
- [ ] Monitoring/logging setup
- [ ] Memory leak tests passed
- [ ] Load testing (100+ concurrent users)
- [ ] Graceful degradation when offline
- [ ] Rate limiting on events
- [ ] Token refresh logic
- [ ] Event versioning for backwards compatibility
- [ ] Database backups for event history

---

## 📚 API Reference

### WebSocket Events

#### Client → Server

```
subscribe        - Join a channel
unsubscribe      - Leave a channel
ping             - Connection keep-alive
```

#### Server → Client

```
connected               - Connection established
disconnect              - Connection lost
recommendation:updated  - New recommendations
cart:updated           - Cart changes
order:status_changed   - Order status update
notification:created   - New notification
user:online            - User came online
user:offline           - User went offline
error                  - Error occurred
```

### REST Endpoints

```
POST   /events/test          - Emit test event
GET    /websocket/stats      - Connection statistics
GET    /health               - Service health
```

---

## 🎓 Examples

### Example 1: Live Product Recommendations

**Backend Event**:

```json
{
  "eventType": "recommendation.generated",
  "userId": 1,
  "data": {
    "recommendations": [{ "id": 1, "name": "Product", "score": 0.95 }]
  }
}
```

**Frontend Receives**:

```typescript
socket.on('recommendation:updated', (data) => {
  // Zustand store updates automatically
  // Component re-renders
  // Toast notification shows
});
```

**Result**: User sees recommendations in real-time!

### Example 2: Order Tracking

**Backend Event**:

```json
{
  "eventType": "order.shipped",
  "userId": 1,
  "data": {
    "orderId": 123,
    "status": "shipped",
    "trackingNumber": "TRACK123"
  }
}
```

**Frontend Display**:

- Order status updates to "Shipped"
- Timeline shows shipping step
- Notification: "Your order is on its way!"

---

## 🚀 Next Steps

1. **Deploy**: Docker/Kubernetes configuration
2. **Scale**: Redis adapter for multi-server
3. **Monitor**: Prometheus/Grafana dashboards
4. **Optimize**: Custom compression, message filtering
5. **Extend**: Video streaming, file transfers

Happy real-timing! 🎉
