# AI Execution Module - Integration Checklist

## 📋 Setup Steps

### Step 1: Import Module in Main App

**File**: `src/app.module.ts`

```typescript
import { AiExecutionModule } from './modules/ai-execution/ai-execution.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    PrismaModule,
    AuthModule,
    UserModule,
    // ... other imports
    WalletModule, // Required dependency
    ShoppingModule, // Required dependency
    AiExecutionModule, // ← Add this
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

**Validation**: Should compile without errors

### Step 2: Verify Dependencies Available

Check that WalletModule and ShoppingModule are properly exported:

```typescript
// src/modules/wallet/wallet.module.ts
@Module({
  // ...
  exports: [WalletService], // ← Must export
})
export class WalletModule {}

// src/modules/shopping/shopping.module.ts
@Module({
  // ...
  exports: [ShoppingAssistantService], // ← Must export
})
export class ShoppingModule {}
```

### Step 3: Verify Prisma Models Exist

Check that these models exist in `prisma/schema.prisma`:

```prisma
model User {
  id                 Int      @id @default(autoincrement())
  email              String   @unique
  // ... other fields
  wallet             Wallet?
  orders             Order[]
  chatMessages       ChatMessage[]
  @@map("users")
}

model Product {
  id                 Int      @id @default(autoincrement())
  name               String
  price              Decimal  @db.Decimal(12, 2)
  category           String
  description        String?
  imageUrl           String?
  createdAt          DateTime @default(now())
  orders             OrderItem[]
  @@map("products")
}

model Wallet {
  id                 Int      @id @default(autoincrement())
  userId             Int      @unique
  balance            Decimal  @db.Decimal(12, 2)
  isAiAuthorized     Boolean  @default(false)
  aiSpendingLimit    Decimal  @db.Decimal(12, 2) @default(50000)
  maxPerOrder        Decimal  @db.Decimal(12, 2) @default(100000)
  dailyLimit         Decimal  @db.Decimal(12, 2) @default(500000)
  dailySpentToday    Decimal  @db.Decimal(12, 2) @default(0)
  isLocked           Boolean  @default(false)
  lockReason         String?
  user               User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions       WalletTransaction[]
  authorizations     WalletAuthorization[]
  spendingLimits     WalletSpendingLimit[]
  auditLogs          WalletAuditLog[]
  @@map("wallets")
}

model Order {
  id                 Int      @id @default(autoincrement())
  userId             Int
  status             String   @default("pending")
  total              Decimal  @db.Decimal(12, 2)
  metadata           Json?
  createdAt          DateTime @default(now())
  user               User     @relation(fields: [userId], references: [id])
  items              OrderItem[]
  @@map("orders")
}

model OrderItem {
  id                 Int      @id @default(autoincrement())
  orderId            Int
  productId          Int
  quantity           Int      @default(1)
  price              Decimal  @db.Decimal(12, 2)
  order              Order    @relation(fields: [orderId], references: [id])
  product            Product  @relation(fields: [productId], references: [id])
  @@map("order_items")
}
```

**Action Required**: If any model is missing, create it via Prisma migration

### Step 4: Verify JWT Guard Exists

Check that JWT authentication is properly set up:

```typescript
// src/common/guards/jwt.guard.ts
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      request['user'] = this.jwtService.verify(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
    return true;
  }

  private extractToken(request: any): string | undefined {
    const authHeader = request.headers.authorization;
    return authHeader?.split(' ')[1];
  }
}
```

### Step 5: Verify User Decorator Exists

```typescript
// src/common/decorators/user.decorator.ts
export const User = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
```

### Step 6: Verify Kafka Service Exists

```typescript
// src/kafka/kafka.service.ts
@Injectable()
export class KafkaService {
  async emit(topic: string, message: any): Promise<void> {
    // Implementation
  }
}
```

**If missing**: Create placeholder or remove Kafka calls temporarily

### Step 7: Verify Services Are Available

These services must be injectable:

```typescript
// Check these are in their respective modules' exports:
- WalletService       (from WalletModule)
- ShoppingAssistantService (from ShoppingModule)
- PrismaService       (from PrismaModule)
- KafkaService        (from KafkaModule)
```

### Step 8: Run Database Migrations

If using new Prisma models:

```bash
# Add to schema if needed
prisma migrate dev --name add_execution_support
```

### Step 9: Start Application

```bash
npm run start:dev

# Should see in logs:
# [Nest] 1234  - 01/15/2024, 10:00:00 AM   [NestFactory] Nest application successfully started +15ms
# [Nest] 1234  - 01/15/2024, 10:00:00 AM   [InstanceLoader] AiExecutionModule dependencies initialized +5ms
```

### Step 10: Test Endpoints

```bash
# Test suggestion mode
curl -X POST http://localhost:3000/execution/execute \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productIds": [1],
    "mode": "suggestion",
    "intent": { "category": "laptops" }
  }'

# Should return 201 with execution request
```

## 🔍 Verification Checklist

- [ ] AiExecutionModule imported in AppModule
- [ ] WalletModule exported WalletService
- [ ] ShoppingModule exported ShoppingAssistantService
- [ ] All Prisma models exist
- [ ] JWT Guard configured
- [ ] User Decorator available
- [ ] Kafka Service available (or mocked)
- [ ] Database migrations applied
- [ ] Application starts without errors
- [ ] Endpoints accessible via API

## 📝 File Locations

| File                               | Purpose                          |
| ---------------------------------- | -------------------------------- |
| `ai-execution-agent.service.ts`    | Core business logic (600+ LOC)   |
| `ai-execution-agent.controller.ts` | REST endpoints (150 LOC)         |
| `ai-execution.module.ts`           | NestJS module setup (15 LOC)     |
| `dto/execution.dto.ts`             | Request/Response types (150 LOC) |
| `AI_EXECUTION_GUIDE.md`            | Comprehensive documentation      |

## 🚀 Quick Start

### After Integration Steps Complete:

1. **Enable AI Spending for User**:

```bash
POST /wallet/authorize-ai
Authorization: Bearer TOKEN
{
  "aiSpendingLimit": 50000
}
```

2. **Test Autonomous Execution**:

```bash
POST /execution/execute
Authorization: Bearer TOKEN
{
  "productIds": [1, 2, 3],
  "mode": "autonomous",
  "intent": {
    "category": "electronics",
    "budget": { "max": 50000 }
  }
}
```

3. **Check Execution Stats**:

```bash
GET /execution/stats
Authorization: Bearer TOKEN
```

## 🐛 Troubleshooting

### Error: "Cannot find module 'WalletService'"

**Solution**: Verify WalletModule exports WalletService in module.ts

### Error: "JwtGuard not found"

**Solution**: Create `/src/common/guards/jwt.guard.ts` with guard implementation

### Error: "PrismaService undefined"

**Solution**: Verify PrismaModule is imported before AiExecutionModule

### Error: "Kafka service not available"

**Temporary Fix**: Comment out Kafka calls in service:

```typescript
// await this.kafka.emit(...)  // Comment out for now
```

**Permanent Fix**: Setup Kafka service or use message queue alternative

## 📊 API Documentation

After integration, Swagger docs available at:

```
http://localhost:3000/api/docs
```

Look for **"AI Execution Agent"** section with:

- POST `/execution/execute`
- POST `/execution/validate`
- POST `/execution/approve`
- GET `/execution/stats`

## ✅ Success Indicators

1. ✅ No compilation errors
2. ✅ Application starts cleanly
3. ✅ `/execution/stats` returns user statistics
4. ✅ Can create execution requests without errors
5. ✅ Wallet validation works correctly
6. ✅ Order creation succeeds with retry logic

## 📞 Next Steps

- [ ] Create ExecutionRequest Prisma model for persistence
- [ ] Add WebSocket notifications for execution status
- [ ] Write integration tests for all 3 modes
- [ ] Setup monitoring/alerting for failures
- [ ] Configure Kafka topic for execution events
- [ ] Add rate limiting middleware
- [ ] Document API in Swagger/OpenAPI

---

**Status**: Ready for Integration  
**Version**: 1.0.0
