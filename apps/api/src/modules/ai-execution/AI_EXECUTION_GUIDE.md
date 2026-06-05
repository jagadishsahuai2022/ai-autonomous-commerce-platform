# AI Execution Agent - Implementation Guide

## Overview

The AI Execution Agent is the autonomous purchasing layer that ties together the Shopping Assistant (product ranking) and Wallet System (financial controls). It provides three execution modes for different levels of automation.

**Architecture**:

```
User Intent
    ↓
Shopping Assistant (analyzeIntent + rankProducts)
    ↓
AI Execution Agent (selectProduct + validateWallet)
    ↓
Wallet System (debitWallet + audit)
    ↓
Order Service (createOrder)
    ↓
Event Emission (Kafka events)
    ↓
User Notification (WebSocket)
```

## 3 Execution Modes

### 1. **Suggestion Mode** - Recommendation Only

No automatic purchase. AI recommends a product and waits for user action.

**Flow**:

1. User provides shopping intent
2. Shopping Assistant ranks products
3. AI selects best match
4. Return suggestion to user UI
5. User manually purchases or dismisses

**Use Case**: "Show me the best laptop under 50k"

**API Example**:

```bash
POST /execution/execute
{
  "productIds": [1, 2, 3],
  "mode": "suggestion",
  "intent": {
    "category": "laptops",
    "budget": { "min": 10000, "max": 50000 }
  }
}

Response (201):
{
  "id": "exec-1234567890-abc123",
  "mode": "suggestion",
  "status": "completed",
  "selectedProduct": {
    "id": 1,
    "name": "Dell XPS 13",
    "price": 45000
  },
  "message": "Product Dell XPS 13 recommended..."
}
```

### 2. **Approval Mode** - Request Permission First

AI recommends product and creates time-limited approval request. Wallet authorization required.

**Flow**:

1. User provides shopping intent
2. Shopping Assistant ranks products
3. AI selects best match
4. Create wallet authorization (1-hour limit)
5. Send approval request to user UI
6. User approves/rejects within 1 hour
7. If approved → auto-purchase with retry logic
8. If rejected → cancel authorization

**Use Case**: "Buy me a phone, but ask first"

**API Example**:

```bash
POST /execution/execute
{
  "productIds": [1, 2, 3],
  "mode": "approval",
  "intent": {
    "category": "phones",
    "budget": { "min": 20000, "max": 80000 }
  }
}

Response (201):
{
  "id": "exec-1234567890-abc123",
  "mode": "approval",
  "status": "pending",
  "expiresAt": "2024-01-15T14:30:00Z",
  "selectedProduct": {
    "id": 2,
    "name": "iPhone 15",
    "price": 75000
  },
  "message": "Approval needed for iPhone 15 for ₹75,000..."
}
```

**Approve Decision**:

```bash
POST /execution/approve
{
  "executionRequestId": "exec-1234567890-abc123",
  "approved": true
}

Response (200):
{
  "executionRequestId": "exec-1234567890-abc123",
  "approved": true,
  "message": "Order #12345 placed successfully",
  "orderId": 12345
}
```

**Reject Decision**:

```bash
POST /execution/approve
{
  "executionRequestId": "exec-1234567890-abc123",
  "approved": false,
  "rejectionReason": "Too expensive, show me cheaper options"
}

Response (200):
{
  "executionRequestId": "exec-1234567890-abc123",
  "approved": false,
  "message": "Request rejected: Too expensive..."
}
```

### 3. **Autonomous Mode** - Auto-Purchase

No approval needed. AI validates wallet and purchase automatically if conditions met.

**Flow**:

1. User provides shopping intent
2. Shopping Assistant ranks products
3. AI selects best match
4. Validate wallet (balance, limits, AI authorization)
5. Create order and debit wallet (with retry logic)
6. Emit event for notification
7. Return confirmation

**Important**: User must have `isAiAuthorized: true` in wallet profile.

**Use Case**: "Make all my regular purchases automatically"

**API Example**:

```bash
POST /execution/execute
{
  "productIds": [1, 2],
  "mode": "autonomous",
  "intent": {
    "category": "groceries",
    "budget": { "max": 5000 }
  },
  "metadata": {
    "userQuery": "Restock my regular grocery items"
  }
}

Response (201):
{
  "id": "exec-1234567890-abc123",
  "mode": "autonomous",
  "status": "completed",
  "selectedProduct": {
    "id": 1,
    "name": "Rice Pack (10kg)",
    "price": 450
  },
  "orderId": 12345,
  "message": "Order #12345 placed successfully..."
}
```

## Retry Logic

Exponential backoff strategy for handling transient failures:

**Configuration**:

```typescript
{
  maxRetries: 3,
  initialDelayMs: 1000,      // 1 second
  maxDelayMs: 10000,         // 10 seconds
  backoffMultiplier: 2       // Double each time
}
```

**Retry Schedule**:

- Attempt 1: Immediate
- Attempt 2: After 1 second
- Attempt 3: After 2 seconds
- Attempt 4: After 4 seconds
- Max attempts reached → Failure

**Retryable Errors** (will retry):

- Network timeouts
- Temporary service unavailability (5xx)
- Database connection issues
- Kafka message failures

**Non-Retryable Errors** (fail immediately):

- Invalid product ID (404)
- Insufficient wallet balance (400)
- User not authorized (401)
- Invalid request format (400)

**Retry Event Emission**:
Each retry attempt emits Kafka event for monitoring:

```json
{
  "type": "execution.retry",
  "userId": 123,
  "requestId": "exec-1234567890-abc123",
  "attempt": 2,
  "error": "Network timeout",
  "nextRetryIn": 2000
}
```

## Failure Handling

### Failure Scenarios

**1. Insufficient Wallet Balance**

```
User: ₹10,000 balance
Product: ₹50,000
Result: FAILED - Cannot execute

Wallet Validation Response:
{
  "isValid": false,
  "errors": [
    "Insufficient balance. Available: ₹10,000, Required: ₹50,000"
  ]
}
```

**Recovery**: User adds money to wallet via `POST /wallet/add`

**2. Exceeds Daily Limit**

```
User: Daily limit ₹100,000, already spent ₹90,000
Product: ₹50,000
Result: FAILED - Would exceed daily limit

Wallet Validation Response:
{
  "isValid": false,
  "errors": [
    "Would exceed daily limit. Remaining: ₹10,000, Amount: ₹50,000"
  ]
}
```

**Recovery**: Wait until next day (auto-resets at midnight) or increase daily limit via `PUT /wallet/limits`

**3. AI Spending Not Authorized**

```
User: isAiAuthorized = false
Result: FAILED - AI spending disabled

Wallet Validation Response:
{
  "isValid": false,
  "errors": ["AI spending not authorized on this wallet"]
}
```

**Recovery**: User enables via `POST /wallet/authorize-ai`

**4. Product Temporarily Unavailable** (Transient)

```
Product was in stock but is now out of stock during execution
Result: First attempt fails
Action: Service retries with exponential backoff

After 3 failed retries:
{
  "status": "failed",
  "error": "Product unavailable after 3 retries",
  "lastError": "Inventory insufficient"
}
```

**Recovery**: User can retry with different product or wait for restock

**5. Wallet Locked (Suspicious Activity)**

```
Wallet locked due to suspicious transaction pattern
Result: FAILED - Cannot execute

Wallet Validation Response:
{
  "isValid": false,
  "errors": ["Wallet is locked: Suspicious activity detected"]
}
```

**Recovery**: User contacts support or verifies account via email link

### Recovery Strategies

| Scenario            | Auto-Retry  | User Action                          |
| ------------------- | ----------- | ------------------------------------ |
| Network timeout     | ✅ Yes (3x) | None needed                          |
| Insufficient funds  | ❌ No       | Add money to wallet                  |
| Exceeds daily limit | ❌ No       | Wait or increase limit               |
| Product unavailable | ✅ Yes (3x) | Try different product                |
| Wallet locked       | ❌ No       | Contact support                      |
| AI not authorized   | ❌ No       | Enable via POST /wallet/authorize-ai |

## Validation Before Execution

All executions go through 4-layer validation:

```typescript
await validationService.validateExecution(userId, productId, {
  amount: product.price,
  isAiAuthorized: true,
});

// Checks:
// 1. User has AI spending enabled (isAiAuthorized)
// 2. Wallet not locked
// 3. Sufficient balance
// 4. Within per-order limit
// 5. Within daily limit (if configured)
// 6. Within AI spending limit (if configured)
```

**Validation Response**:

```json
{
  "isValid": true,
  "canExecute": true,
  "walletStatus": {
    "balance": 500000,
    "maxPerOrder": 100000,
    "dailyLimit": 500000,
    "dailySpentToday": 150000,
    "isAiAuthorized": true,
    "aiSpendingLimit": 50000
  },
  "errors": [],
  "warnings": ["Low wallet balance after transaction"],
  "recommendation": "All checks passed. Ready to execute."
}
```

## API Integration

### 1. Add Module to Main App

In `src/app.module.ts`:

```typescript
import { AiExecutionModule } from './modules/ai-execution/ai-execution.module';

@Module({
  imports: [
    // ... other modules
    WalletModule,
    ShoppingModule,
    AiExecutionModule, // Add this
  ],
})
export class AppModule {}
```

### 2. Wire Dependencies

The module automatically imports dependencies:

- `WalletModule` - For wallet validation and debiting
- `ShoppingModule` - For ranking products

### 3. Configure Retry Strategy (Optional)

In `ai-execution-agent.service.ts`:

```typescript
private readonly retryConfig: RetryConfig = {
  maxRetries: 3,           // Change this
  initialDelayMs: 1000,    // Change this
  maxDelayMs: 10000,       // Change this
  backoffMultiplier: 2,    // Change this
};
```

## Usage Examples

### Example 1: Autonomous Smart Grocery Reordering

**Scenario**: User set up recurring purchase of groceries

**Frontend Setup**:

```javascript
// Using shopping assistant chat
const response = await assistantChat({
  message: 'Buy me rice, oil, and dal automatically every week',
  autoExecute: true,
});

// Chat shows: "Will auto-order these items weekly"
```

**Backend Flow**:

```bash
# Shopping assistant analyzes intent
POST /chat -> Shopping Intent Analysis:
{
  "intent": "recurring_purchase",
  "category": "groceries",
  "items": ["rice", "oil", "dal"],
  "budget": { "max": 5000 }
}

# Ranking engine returns top products
POST /ranking -> Returns RankedProduct[]

# Execution agent auto-purchases
POST /execution/execute:
{
  "productIds": [1, 2, 3],
  "mode": "autonomous",
  "intent": { "category": "groceries", "budget": { "max": 5000 } }
}

Response:
{
  "status": "completed",
  "orderId": 12345,
  "total": 4500,
  "items": ["Rice", "Oil", "Dal"]
}
```

### Example 2: Approval-Based High-Value Purchase

**Scenario**: User configured AI for purchases under ₹50k, needs approval for higher

**Frontend Setup**:

```javascript
const response = await assistantChat({
  message: 'Find me a good headphone around 30k',
});

// Shows: "Found Sony headphone for ₹28,500. Approve?"
// User clicks "Approve"
```

**Backend Flow**:

```bash
# Intent analysis reaches execution
POST /execution/execute:
{
  "productIds": [501, 502, 503],
  "mode": "approval",
  "intent": { "category": "headphones", "budget": { "max": 30000 } }
}

Response (pending):
{
  "id": "exec-abc123",
  "status": "pending",
  "expiresAt": "2024-01-15T14:30:00Z",
  "selectedProduct": {
    "name": "Sony WH-1000XM5",
    "price": 28500
  }
}

# User approves via UI
POST /execution/approve:
{
  "executionRequestId": "exec-abc123",
  "approved": true
}

Response:
{
  "status": "completed",
  "orderId": 12346,
  "message": "Order placed successfully!"
}
```

### Example 3: Suggestion Mode with Manual Review

**Scenario**: User wants AI recommendations but manually reviews

**Frontend Setup**:

```javascript
const response = await assistantChat({
  message: "What's a great camera for photography?",
});

// Shows: "Recommend Canon EOS R6 for ₹ 385,000"
// User manually purchases via product page
```

**Backend Flow**:

```bash
POST /execution/execute:
{
  "productIds": [701, 702, 703],
  "mode": "suggestion",
  "intent": {
    "type": "photography",
    "budget": { "max": 400000 }
  }
}

Response:
{
  "id": "exec-def456",
  "mode": "suggestion",
  "status": "completed",
  "selectedProduct": {
    "name": "Canon EOS R6",
    "price": 385000,
    "rank": 1,
    "score": 92
  },
  "message": "Canon EOS R6 is the best option for your needs..."
}

# User manually clicks "Buy Now" on product page
# Regular checkout flow
```

## Monitoring & Analytics

### Kafka Events Emitted

The execution agent emits events throughout the lifecycle:

```json
{
  "type": "execution.suggestion",
  "userId": 123,
  "productId": 1,
  "price": 25000
}

{
  "type": "execution.approval_requested",
  "userId": 123,
  "expiresAt": "2024-01-15T14:30:00Z"
}

{
  "type": "execution.approval_rejected",
  "userId": 123,
  "reason": "Too expensive"
}

{
  "type": "execution.autonomous_completed",
  "userId": 123,
  "orderId": 12345,
  "amount": 25000
}

{
  "type": "execution.autonomous_failed",
  "userId": 123,
  "error": "Insufficient balance",
  "retries": 2
}

{
  "type": "execution.retry",
  "userId": 123,
  "attempt": 2,
  "error": "Network timeout"
}
```

### Get Execution Statistics

```bash
GET /execution/stats

Response:
{
  "totalRequests": 50,
  "successfulPurchases": 45,
  "failedAttempts": 5,
  "suggestionsProvided": 20,
  "totalSpent": 1250000,
  "averageOrderValue": 27777,
  "successRate": 90,
  "averageRetries": 0.8
}
```

## Security Considerations

### 1. Rate Limiting

- Limit to 100 execution requests per hour per user
- Implement in middleware

### 2. AI Spending Limits

- Separate from per-order limit
- Default: ₹50,000 per order (AI)
- Configurable by user

### 3. Wallet Locking

- Lock wallet after 3 failed attempts
- Requires user verification to unlock

### 4. Audit Trail

- Every execution tracked in WalletAuditLog
- Who (userId), What (action), When (timestamp), Result (success/failure)

### 5. JWT Validation

- All endpoints require valid JWT token
- Cannot execute for other users

### 6. Approval Expiry

- Approval requests expire in 1 hour
- Cannot approve expired requests

## Testing

### Test Scenario 1: Autonomous Purchase with Retries

```bash
# Setup: Create test user with ₹100,000 balance
# Product: Available (after 2 failed attempts)

# Execute
POST /execution/execute:
{
  "productIds": [TEST_PRODUCT_ID],
  "mode": "autonomous"
}

Expected:
- First attempt fails (simulated timeout)
- Wait 1 second
- Second attempt fails (simulated timeout)
- Wait 2 seconds
- Third attempt succeeds
- Order created, wallet debited
- Status: "completed"
```

### Test Scenario 2: Insufficient Balance

```bash
# Setup: User with ₹10,000 balance
# Product: ₹50,000

# Execute
POST /execution/execute:
{
  "productIds": [EXPENSIVE_PRODUCT],
  "mode": "autonomous"
}

Expected:
- Validation fails
- Error: "Insufficient balance"
- No retry attempted
- Status: "failed"
- Wallet unchanged
```

### Test Scenario 3: Approval Timeout

```bash
# Setup: User with AI disabled
# Execute in approval mode
# Wait 61 minutes

# Try to approve
POST /execution/approve:
{
  "executionRequestId": "exec-abc123",
  "approved": true
}

Expected:
- Error: "Approval request has expired"
- Authorization cancelled
- Status: "failed"
```

## Troubleshooting

### Issue: "AI spending not authorized"

**Solution**: Enable AI spending on wallet:

```bash
POST /wallet/authorize-ai
{
  "aiSpendingLimit": 50000
}
```

### Issue: "Exceeds daily limit"

**Options**:

1. Wait until next day (limit resets at midnight)
2. Increase daily limit: `PUT /wallet/limits`

### Issue: "Approval request not found"

**Causes**:

- Wrong requestId
- Request expired (> 1 hour)
- Not the request owner

**Solution**: Execute fresh request with `POST /execution/execute`

### Issue: Wallet locked

**Cause**: Suspicious activity detected

**Solution**: Contact support or verify via email

## Production Deployment

### 1. Use Redis for Request Storage

Replace in-memory Map with Redis:

```typescript
// Current (memory leak risk)
private executionRequests = new Map<string, ExecutionRequest>();

// Production (use Redis)
private executionRequests = this.redis.createNamespace('execution-requests');
```

### 2. Configure Max Retries

Adjust based on infrastructure:

- High latency env: maxRetries = 5
- Low latency env: maxRetries = 2

### 3. Add Distributed Locking

For concurrent execution attempts:

```typescript
// Prevent double execution
const lock = await redis.acquire(`execution:${userId}:${productId}`);
try {
  // Execute order
} finally {
  await lock.release();
}
```

### 4. Setup Monitoring Alerts

Track:

- Execution failure rate > 10%
- Average retry count > 1.5
- Wallet lock rate > 5%

### 5. Database Schema for ExecutionRequest

For production persistence:

```sql
CREATE TABLE execution_requests (
  id VARCHAR(255) PRIMARY KEY,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  mode ENUM('suggestion', 'approval', 'autonomous'),
  status ENUM('pending', 'approved', 'executing', 'completed', 'failed'),
  order_id INT,
  error TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMP,
  expires_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  INDEX (user_id, created_at),
  INDEX (status, expires_at)
);
```

## Next Steps

1. ✅ Service created with retry logic
2. ✅ Controller with all 4 endpoints
3. ✅ Module configuration
4. **TODO**: Create ExecutionRequest Prisma model
5. **TODO**: Add WebSocket notifications
6. **TODO**: Write integration tests
7. **TODO**: Configure in main app.module.ts
8. **TODO**: Add monitoring dashboard

---

**Author**: AI Development Team  
**Last Updated**: January 2024  
**Version**: 1.0.0
