# Database Schema Documentation

**Autopilot Engine - PostgreSQL with Prisma ORM**

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Core Models](#core-models)
3. [Relationships](#relationships)
4. [Indexes & Performance](#indexes--performance)
5. [Migrations](#migrations)
6. [Queries Reference](#queries-reference)

---

## Overview

**Database**: PostgreSQL 13+  
**ORM**: Prisma 7.5.0+  
**Migration Tool**: Prisma Migrate  
**Connection Pooling**: PostgreSQL Native

### Database Statistics

- **Tables**: 9
- **Relationships**: 15+
- **Indexes**: 20+
- **Constraints**: Full referential integrity
- **Backup Strategy**: WAL-based continuous archiving

---

## Core Models

### 1. AutopilotRule

**Purpose**: Store user-defined purchase rules with conditions and actions

```prisma
model AutopilotRule {
  id                    String    @id @default(cuid())
  userId                String    @db.VarChar(255)
  name                  String    @db.VarChar(255)
  description           String?   @db.Text
  status                String    @default("active")
  conditions            Json      @default("[]")
  action                Json      @default("{}")
  maxSpendPerMonth      Decimal   @db.Decimal(15, 2)
  maxOrderValue         Decimal   @db.Decimal(15, 2)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@index([userId])
  @@index([status])
  @@index([createdAt])
}
```

**Fields**:

- `id`: Unique rule identifier (CUID format)
- `userId`: Owner of the rule
- `name`: Rule display name
- `description`: Optional rule details
- `status`: "active", "paused", "archived"
- `conditions`: JSON array of rule conditions
  ```json
  [
    { "field": "price", "operator": "lte", "value": 50000 },
    { "field": "category", "operator": "in", "value": ["phones", "laptops"] }
  ]
  ```
- `action`: JSON object specifying purchase action
  ```json
  {
    "type": "auto_buy",
    "parameters": { "quantity": 1, "maxRetries": 3 }
  }
  ```
- `maxSpendPerMonth`: Monthly spending limit in INR
- `maxOrderValue`: Individual order limit in INR
- `createdAt/updatedAt`: Timestamps

**Indexes**:

- Primary: `id`
- Secondary: `userId`, `status`, `createdAt`

---

### 2. AutopilotDecision

**Purpose**: Track all autonomous purchase decisions made by the system

```prisma
model AutopilotDecision {
  id                    String    @id @default(cuid())
  userId                String    @db.VarChar(255)
  ruleId                String?   @db.VarChar(255)
  productId             String    @db.VarChar(255)
  shouldProceed         Boolean
  confidence            Decimal   @db.Decimal(5, 2)
  confidenceFactors     Json      @default("{}")
  reasoning             Json      @default("{}")
  status                String    @default("pending")
  orderId               String?   @unique
  requiresApproval      Boolean   @default(false)
  riskLevel             String    @default("low")
  rejectionReason       String?   @db.Text
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  approvalRequest       ApprovalRequest?
  analytics             DecisionAnalytic?

  @@index([userId])
  @@index([status])
  @@index([ruleId])
  @@index([createdAt])
}
```

**Fields**:

- `id`: Unique decision identifier
- `userId`: User making the purchase
- `ruleId`: Associated rule (nullable)
- `productId`: Target product ID
- `shouldProceed`: Final decision (buy/skip)
- `confidence`: Confidence score (0-100)
- `confidenceFactors`: Breakdown of confidence calculation
  ```json
  {
    "ruleMatch": 0.95,
    "userHistory": 0.78,
    "productRelevance": 0.85,
    "overall": 0.86
  }
  ```
- `reasoning`: Explanation of decision
  ```json
  {
    "summary": "High confidence due to rule match and user preference",
    "positiveFactors": ["exact_category_match", "price_in_range"],
    "concerns": ["first_brand_purchase"]
  }
  ```
- `status`: pending, approved, rejected, executed, approval_expired
- `orderId`: Associated order (if executed)
- `requiresApproval`: Manual approval needed
- `riskLevel`: low, medium, high, critical
- `rejectionReason`: Why purchase was rejected

**Relationships**:

- Has one `ApprovalRequest`
- Has one `DecisionAnalytic`

---

### 3. ApprovalRequest

**Purpose**: Track approval workflow for decisions requiring user confirmation

```prisma
model ApprovalRequest {
  id                    String    @id @default(cuid())
  userId                String    @db.VarChar(255)
  decisionId            String    @unique
  decision              AutopilotDecision @relation(fields: [decisionId], references: [id], onDelete: Cascade)
  status                String    @default("pending")
  reason                String    @db.Text
  approvedAt            DateTime?
  rejectedAt            DateTime?
  approvedBy            String?
  rejectedBy            String?
  approverNotes         String?   @db.Text
  expiresAt             DateTime
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@index([userId])
  @@index([status])
  @@index([decisionId])
}
```

**Fields**:

- `id`: Approval request ID
- `userId`: User approving
- `decisionId`: Decision requiring approval
- `status`: pending, approved, rejected, expired
- `reason`: Why approval is needed
- `approvedAt/rejectedAt`: When action taken
- `approvedBy/rejectedBy`: User who took action
- `approverNotes`: Optional notes from approver
- `expiresAt`: Approval deadline (24 hours from creation)

**Lifecycle**:

1. Decision created with `requiresApproval: true`
2. ApprovalRequest created with `status: pending`
3. User reviews decision
4. Status changes to `approved` or `rejected`
5. If no action for 24 hours, status becomes `expired`

---

### 4. AnomalyDetection

**Purpose**: Log suspicious purchase patterns and behaviors

```prisma
model AnomalyDetection {
  id                    String    @id @default(cuid())
  userId                String    @db.VarChar(255)
  detectionType         String    @db.VarChar(100)
  severity              String    @db.VarChar(20)
  reason                String    @db.Text
  anomalyData           Json      @default("{}")
  actionTaken           String?   @db.VarChar(100)
  createdAt             DateTime  @default(now())

  @@index([userId])
  @@index([detectionType])
  @@index([severity])
  @@index([createdAt])
}
```

**Detection Types**:

- `unusual_spend`: Spending approaching/exceeding limit
- `fraud_signal`: Suspicious purchase patterns
- `rapid_purchases`: Multiple purchases in short time
- `pattern_spike`: Deviation from user's typical behavior
- `geographic_anomaly`: Purchase from unusual location

**Severity Levels**:

- `low`: < 30% likelihood of fraud
- `medium`: 30-60% likelihood
- `high`: 60-90% likelihood
- `critical`: Potential account compromise

**anomalyData** Example:

```json
{
  "currentSpent": 85000,
  "monthlyLimit": 100000,
  "percentage": 85,
  "flaggedItems": ["rapid_purchases", "high_value"],
  "riskScore": 72
}
```

---

### 5. DecisionAnalytic

**Purpose**: Store analytics and performance metrics for decisions

```prisma
model DecisionAnalytic {
  id                    String    @id @default(cuid())
  decisionId            String    @unique
  decision              AutopilotDecision @relation(fields: [decisionId], references: [id], onDelete: Cascade)
  userId                String    @db.VarChar(255)
  engineVersion         String    @db.VarChar(50)
  evaluationTime        Int       // in milliseconds
  confidenceBreakdown   Json      @default("{}")
  riskFactors           Json      @default("[]")
  approvedBy            String?   @db.VarChar(100)
  approvalMethod        String?   @db.VarChar(50)
  outcomeActual         String?   @db.VarChar(50)
  returnRatio           Decimal?  @db.Decimal(5, 2)
  createdAt             DateTime  @default(now())

  @@index([userId])
  @@index([createdAt])
}
```

**Fields**:

- `evaluationTime`: Decision engine response time
- `confidenceBreakdown`: Detailed confidence calculation
- `riskFactors`: Array of identified risks
- `approvalMethod`: manual, auto, rule_based
- `outcomeActual`: What actually happened (used for ML)
- `returnRatio`: If returned, what % was returned

---

### 6. RuleMetadata

**Purpose**: Extended configuration and categorization for rules

```prisma
model RuleMetadata {
  id                    String    @id @default(cuid())
  ruleId                String    @unique
  categories            Json      @default("[]")
  tags                  Json      @default("[]")
  timeWindow            Json      @default("{}")
  geographicRestrictions Json    @default("[]")
  localizationInfo      Json      @default("{}")
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@index([ruleId])
}
```

**Structure**:

```json
{
  "categories": ["smartphones", "electronics"],
  "tags": ["budget", "premium_brands"],
  "timeWindow": {
    "startTime": "09:00",
    "endTime": "21:00",
    "daysOfWeek": [1, 2, 3, 4, 5]
  },
  "geographicRestrictions": ["IN-KA", "IN-TG"],
  "localizationInfo": {
    "preferredCurrency": "INR",
    "emiEnabled": true,
    "codEnabled": true
  }
}
```

---

### 7. IndiaLocalizedFeature

**Purpose**: Store India-specific user preferences and settings

```prisma
model IndiaLocalizedFeature {
  id                    String    @id @default(cuid())
  userId                String    @unique @db.VarChar(255)
  preferredPincode      String    @db.VarChar(6)
  emiPreferred          Boolean   @default(true)
  codPreferred          Boolean   @default(true)
  maxCODAmount          Decimal   @db.Decimal(10, 0)
  preferredEMITenure    Int       @default(12)
  paymentMethods        Json      @default("[]")
  tierAssignment        String    @db.VarChar(10)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@index([userId])
  @@index([preferredPincode])
}
```

**Fields**:

- `preferredPincode`: User's default delivery pincode
- `emiPreferred`: Enable EMI for this user
- `codPreferred`: Enable COD for this user
- `maxCODAmount`: User's COD limit
- `preferredEMITenure`: Default EMI duration (months)
- `paymentMethods`: Array of enabled payment methods
- `tierAssignment`: "tier1" or "tier2" city assignment

---

### 8. RulePerformanceMetric

**Purpose**: Track historical performance and effectiveness of rules

```prisma
model RulePerformanceMetric {
  id                    String    @id @default(cuid())
  ruleId                String    @db.VarChar(255)
  period                String    @db.VarChar(50)
  triggerCount          Int       @default(0)
  successCount          Int       @default(0)
  rejectionCount        Int       @default(0)
  approvalRequiredCount Int       @default(0)
  totalSpent            Decimal   @db.Decimal(15, 2)
  averageConfidence     Decimal   @db.Decimal(5, 2)
  avgProductPrice       Decimal   @db.Decimal(10, 2)
  returnRate            Decimal?  @db.Decimal(5, 2)
  createdAt             DateTime  @default(now())

  @@unique([ruleId, period])
  @@index([ruleId])
  @@index([period])
}
```

**Periods**: "daily", "weekly", "monthly", "yearly"

**Calculations**:

- Success Rate = successCount / triggerCount
- Rejection Rate = rejectionCount / triggerCount
- Average Spent = totalSpent / successCount

---

### 9. AutopilotUserPreference

**Purpose**: Global user configuration and settings

```prisma
model AutopilotUserPreference {
  id                    String    @id @default(cuid())
  userId                String    @unique @db.VarChar(255)
  autopilotEnabled      Boolean   @default(true)
  approvalRequired      Boolean   @default(false)
  autoApproveThreshold  Decimal   @db.Decimal(3, 2) @default(0.85)
  minConfidenceThreshold Decimal  @db.Decimal(3, 2) @default(0.65)
  maxRiskLevel          String    @default("high")
  monthlySpendLimit     Decimal   @db.Decimal(15, 2)
  notificationPreference Json     @default("{}")
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@index([userId])
}
```

**Notification Preferences**:

```json
{
  "emailNotifications": true,
  "inAppNotifications": true,
  "smsNotifications": false,
  "slackNotifications": false,
  "notifyOn": ["high_risk", "approval_needed", "anomaly_detected"]
}
```

---

## Relationships

### Relationship Diagram

```
AutopilotRule (1) ──────────────────── (N) AutopilotDecision
                                           |
                                           ├─ (1) ApprovalRequest
                                           └─ (1) DecisionAnalytic

AutopilotDecision (1) ────┬──────────── (1) ApprovalRequest
                          └──────────── (1) DecisionAnalytic

User (1) ──┬──────────── (N) AutopilotRule
           ├──────────── (N) AutopilotDecision
           ├──────────── (N) AnomalyDetection
           ├──────────── (1) IndiaLocalizedFeature
           └──────────── (1) AutopilotUserPreference

AutopilotRule (1) ────────────────── (1) RuleMetadata
AutopilotRule (1) ────────────────── (N) RulePerformanceMetric
```

### Cascade Rules

- **AutopilotDecision** deletion cascades to:
  - ApprovalRequest (deleted on CASCADE)
  - DecisionAnalytic (deleted)

- **AutopilotRule** deletion cascades to:
  - RuleMetadata (deleted)
  - RulePerformanceMetric (deleted on CASCADE)

---

## Indexes & Performance

### Index Strategy

**Composite Indexes** (for common query patterns):

```sql
-- High-Priority Queries
CREATE INDEX idx_decision_user_status ON AutopilotDecision(userId, status);
CREATE INDEX idx_decision_created_user ON AutopilotDecision(createdAt DESC, userId);
CREATE INDEX idx_rule_user_status ON AutopilotRule(userId, status);
CREATE INDEX idx_approval_user_pending ON ApprovalRequest(userId, status);
CREATE INDEX idx_anomaly_user_severity ON AnomalyDetection(userId, severity DESC);
```

### Query Performance Targets

| Query                  | Target Latency | Index                     |
| ---------------------- | -------------- | ------------------------- |
| Find user rules        | < 50ms         | idx_rule_user_status      |
| Find decisions by user | < 100ms        | idx_decision_user_status  |
| Pending approvals      | < 50ms         | idx_approval_user_pending |
| Anomalies by severity  | < 100ms        | idx_anomaly_user_severity |
| Monthly spending       | < 200ms        | idx_decision_created_user |

### Optimization Guidelines

1. **Always filter by userId first** in WHERE clause
2. **Use pagination for large result sets** (limit 50)
3. **Avoid SELECT \*** - specify needed columns
4. **Use aggregation functions** for statistics
5. **Enable query plan caching** in application

---

## Migrations

### Running Migrations

```bash
# Create migration (after schema changes)
npx prisma migrate dev --name add_new_feature

# Apply pending migrations to production
npx prisma migrate deploy

# Check migration status
npx prisma migrate status

# Rollback (development only)
npx prisma migrate resolve --rolled-back migration_name
```

### Migration History

**v1.0 - Initial Schema**

- All 9 tables created
- Core relationships established
- Validation constraints added
- Indexes created

---

## Queries Reference

### Common Query Patterns

**Get user's active rules**

```typescript
const rules = await prisma.autopilotRule.findMany({
  where: {
    userId: 'user-123',
    status: 'active',
  },
  orderBy: { createdAt: 'desc' },
  take: 50,
});
```

**Get pending approvals**

```typescript
const approvals = await prisma.approvalRequest.findMany({
  where: {
    userId: 'user-123',
    status: 'pending',
  },
  include: { decision: true },
  orderBy: { expiresAt: 'asc' },
});
```

**Get anomalies for user (last 7 days)**

```typescript
const anomalies = await prisma.anomalyDetection.findMany({
  where: {
    userId: 'user-123',
    createdAt: {
      gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
  },
  orderBy: { createdAt: 'desc' },
});
```

**Get user's spending this month**

```typescript
const monthStart = new Date();
monthStart.setDate(1);

const decisions = await prisma.autopilotDecision.findMany({
  where: {
    userId: 'user-123',
    status: 'executed',
    createdAt: { gte: monthStart },
  },
});

const totalSpent = decisions.reduce(
  (sum, d) => sum + Number(d.confidence), // In practice, use order amount
  0
);
```

---

## Security Considerations

1. **Row-Level Security**: Implement through application logic (not DB-level)
2. **Data Encryption**: Use PgCrypto for sensitive fields
3. **Audit Trail**: All modifications logged via createdAt/updatedAt
4. **SQL Injection**: Prevented by Prisma parameterized queries
5. **Soft Deletes**: Implemented via status field (not hard deletes)

---

## Backup & Recovery

### Backup Strategy

```bash
# Automated daily backups
pg_dump -U postgres autopilot_db | gzip > /backups/autopilot_$(date +%Y%m%d).sql.gz

# Recovery
gunzip < /backups/autopilot_YYYYMMDD.sql.gz | psql -U postgres autopilot_db
```

### Point-in-Time Recovery (PITR)

- WAL-based archiving enabled
- 7-day retention window
- Automated archival to S3

---

## Monitoring & Maintenance

### Key Metrics to Monitor

- Slow query log (queries > 1000ms)
- Index usage statistics
- Table bloat percentage
- Connection pool utilization
- Replication lag (if replicated)

### Maintenance Tasks

```sql
-- Weekly: Reindex fragmented indexes
REINDEX INDEX idx_name;

-- Monthly: Analyze and vacuum
ANALYZE;
VACUUM (ANALYZE, VERBOSE);

-- Quarterly: Full database maintenance
VACUUM FULL;
CLUSTER;
```

---

**Last Updated**: April 2026  
**Prisma Version**: 7.5.0+  
**PostgreSQL Version**: 13+
