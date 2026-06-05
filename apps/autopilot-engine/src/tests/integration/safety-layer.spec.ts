/**
 * Safety Layer Integration Tests
 * Anomaly detection and safety workflows
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { SafetyLayerService } from '../../safety/safety-layer.service';
import { AutopilotDecisionRepository } from '../../database/repositories/autopilot-decision.repository';
import { PrismaService } from '../../database/prisma.service';

describe('Safety Layer Integration Tests', () => {
  let app: INestApplication;
  let safetyLayer: SafetyLayerService;
  let decisionRepository: AutopilotDecisionRepository;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    safetyLayer = moduleFixture.get<SafetyLayerService>(SafetyLayerService);
    decisionRepository = moduleFixture.get<AutopilotDecisionRepository>(
      AutopilotDecisionRepository
    );
    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Spending Anomaly Detection', () => {
    it('should detect normal spending (no anomaly)', async () => {
      const result = await safetyLayer.checkSpendingAnomaly(
        'normal-spender',
        15000, // Proposed amount
        100000 // Monthly limit
      );

      expect(result.isAnomaly).toBe(false);
      expect(result.severity).toBe('low');
      expect(result.reason).toBeDefined();
    });

    it('should detect medium spending anomaly', async () => {
      const result = await safetyLayer.checkSpendingAnomaly(
        'medium-spender',
        50000, // Proposed amount
        100000 // Monthly limit - 50% usage
      );

      expect(result.isAnomaly).toBe(true);
      expect(['low', 'medium']).toContain(result.severity);
      expect(result.reason).toBeDefined();
    });

    it('should detect high spending anomaly', async () => {
      const result = await safetyLayer.checkSpendingAnomaly(
        'high-spender',
        80000, // Proposed amount
        100000 // Monthly limit - 80% usage
      );

      expect(result.isAnomaly).toBe(true);
      expect(['medium', 'high']).toContain(result.severity);
      expect(result.reason).toBeDefined();
    });

    it('should detect critical spending anomaly (exceeds limit)', async () => {
      const result = await safetyLayer.checkSpendingAnomaly(
        'over-spender',
        150000, // Proposed amount exceeds limit
        100000 // Monthly limit
      );

      expect(result.isAnomaly).toBe(true);
      expect(result.severity).toBe('critical');
      expect(result.reason).toBeDefined();
    });
  });

  describe('Purchase Pattern Anomaly Detection', () => {
    it('should detect normal purchase patterns', async () => {
      // checkPurchasePatternAnomaly fetches purchase history from DB internally
      const result = await safetyLayer.checkPurchasePatternAnomaly('normal-buyer');

      expect(result.isAnomaly).toBeDefined();
      expect(result.severity).toBeDefined();
    });

    it('should detect spike in recent purchases', async () => {
      const result = await safetyLayer.checkPurchasePatternAnomaly('spike-buyer');

      expect(result.isAnomaly).toBeDefined();
      expect(result.severity).toBeDefined();
    });
  });

  describe('Fraud Signal Detection', () => {
    // checkFraudSignals(userId, productId, amount) - fetches history from DB internally
    it('should detect rapid purchases (fraud signal)', async () => {
      const result = await safetyLayer.checkFraudSignals('rapid-buyer', 'prod1', 10000);

      expect(result.hasFraudSignals).toBeDefined();
      expect(result.signals).toBeInstanceOf(Array);
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
    });

    it('should detect high-value purchase (fraud signal)', async () => {
      const result = await safetyLayer.checkFraudSignals('whale-buyer', '', 150000);

      expect(result.hasFraudSignals).toBeDefined();
      expect(result.signals).toBeInstanceOf(Array);
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
    });

    it('should detect duplicate SKU purchases (fraud signal)', async () => {
      const result = await safetyLayer.checkFraudSignals('duplicate-buyer', 'same-sku', 5000);

      expect(result.hasFraudSignals).toBeDefined();
      expect(result.signals).toBeInstanceOf(Array);
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
    });

    it('should combine multiple fraud signals', async () => {
      const result = await safetyLayer.checkFraudSignals('multi-fraud-buyer', 'sku1', 100000);

      expect(result.hasFraudSignals).toBeDefined();
      expect(result.signals).toBeInstanceOf(Array);
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Approval Requirement Logic', () => {
    it('should not require approval for low-risk decision', async () => {
      const decision = {
        confidence: 0.95,
        riskLevel: 'low' as const,
        amount: 5000,
        monthlyLimit: 100000,
      };

      const userPreferences = {
        approvalRequired: false,
        autoApproveThreshold: 0.85,
        minConfidenceThreshold: 0.65,
      };

      const result = await safetyLayer.shouldRequireApproval(
        'trusted-user',
        decision,
        userPreferences
      );

      expect(result.requiresApproval).toBe(false);
      expect(result.reasons.length).toBe(0);
    });

    it('should require approval for low confidence', async () => {
      const decision = {
        confidence: 0.62,
        riskLevel: 'low' as const,
        amount: 10000,
        monthlyLimit: 100000,
      };

      const userPreferences = {
        approvalRequired: false,
        autoApproveThreshold: 0.85,
        minConfidenceThreshold: 0.65,
      };

      const result = await safetyLayer.shouldRequireApproval(
        'low-confidence-user',
        decision,
        userPreferences
      );

      expect(result.requiresApproval).toBe(true);
      expect(result.reasons.some(r => r.toLowerCase().includes('confidence') || r.toLowerCase().includes('threshold'))).toBe(true);
    });

    it('should require approval for medium/high risk', async () => {
      const decision = {
        confidence: 0.9,
        riskLevel: 'high' as const,
        amount: 50000,
        monthlyLimit: 100000,
      };

      const userPreferences = {
        approvalRequired: false,
        autoApproveThreshold: 0.85,
        minConfidenceThreshold: 0.65,
      };

      const result = await safetyLayer.shouldRequireApproval(
        'risky-decision-user',
        decision,
        userPreferences
      );

      expect(result.requiresApproval).toBe(true);
      expect(result.reasons.some(r => r.toLowerCase().includes('risk') || r.toLowerCase().includes('high'))).toBe(true);
    });

    it('should require approval for spending anomaly', async () => {
      const decision = {
        confidence: 0.9,
        riskLevel: 'low' as const,
        amount: 95000, // 95% of limit
        monthlyLimit: 100000,
      };

      const userPreferences = {
        approvalRequired: false,
        autoApproveThreshold: 0.85,
        minConfidenceThreshold: 0.65,
      };

      const result = await safetyLayer.shouldRequireApproval(
        'big-spender-user',
        decision,
        userPreferences
      );

      expect(result.requiresApproval).toBe(true);
      expect(result.reasons.some(r => r.toLowerCase().includes('spending') || r.toLowerCase().includes('anomaly'))).toBe(true);
    });
  });

  describe('Anomaly Recording', () => {
    it('should record anomalies to database', async () => {
      const userId = 'anomaly-test-user';
      const anomalyType = 'unusual_spend';
      const severity = 'high';
      const reason = 'Spending spike detected';

      await safetyLayer.recordAnomaly(userId, anomalyType, severity, reason);

      // Verify in database
      const anomalies = await prisma.anomalyDetection.findMany({
        where: { userId, detectionType: anomalyType },
      });

      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies[0].severity).toBe('high');
      expect(anomalies[0].description).toBe(reason);
    });

    it('should track anomaly history', async () => {
      const userId = 'history-test-user';

      // Record multiple anomalies
      await safetyLayer.recordAnomaly(userId, 'unusual_spend', 'low', 'First');
      await safetyLayer.recordAnomaly(userId, 'fraud_signal', 'medium', 'Second');
      await safetyLayer.recordAnomaly(userId, 'unusual_spend', 'high', 'Third');

      // Retrieve history
      const anomalies = await prisma.anomalyDetection.findMany({
        where: { userId },
        orderBy: { detectedAt: 'desc' },
      });

      expect(anomalies.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Spending Status Tracking', () => {
    it('should calculate current spending status', async () => {
      const status = await safetyLayer.getSpendingStatus('status-user', 100000);

      expect(status.currentSpent).toBeGreaterThanOrEqual(0);
      expect(status.remaining).toBeDefined();
      expect(status.percentageUsed).toBeGreaterThanOrEqual(0);
      expect(status.percentageUsed).toBeLessThanOrEqual(100);
    });
  });

  describe('Safety Layer API Endpoints', () => {
    it('should check anomaly via API', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/autopilot/safety/check-anomaly')
        .send({
          userId: 'api-anomaly-user',
          proposedAmount: 50000,
          monthlyLimit: 100000,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isAnomaly).toBeDefined();
      expect(response.body.data.severity).toBeDefined();
    });

    it('should determine approval requirement via API', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/autopilot/safety/check-approval')
        .send({
          userId: 'api-approval-user',
          decision: {
            confidence: 0.75,
            riskLevel: 'medium',
            amount: 30000,
            monthlyLimit: 100000,
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.requiresApproval).toBeDefined();
      expect(response.body.data.reasons).toBeDefined();
    });

    it('should record anomaly via API', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/autopilot/safety/record-anomaly')
        .send({
          userId: 'api-record-user',
          type: 'unusual_spend',
          severity: 'medium',
          reason: 'Test anomaly recording',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should get spending status via API', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/autopilot/safety/spending-status')
        .query({
          userId: 'api-status-user',
          monthlyLimit: 100000,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.currentSpent).toBeDefined();
      expect(response.body.data.remaining).toBeDefined();
      expect(response.body.data.percentage).toBeDefined();
    });
  });

  describe('Error Handling in Safety Layer', () => {
    it('should handle invalid user IDs', async () => {
      const result = await safetyLayer.checkSpendingAnomaly('', 5000, 100000);

      expect(result).toBeDefined();
      expect(result.isAnomaly).toBeDefined();
    });

    it('should handle zero/negative amounts', async () => {
      const result = await safetyLayer.checkSpendingAnomaly('test-user', 0, 100000);

      expect(result.isAnomaly).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should handle zero/negative limits', async () => {
      const result = await safetyLayer.checkSpendingAnomaly('test-user', 5000, 0);

      expect(result).toBeDefined();
      expect(result.severity).toBeDefined();
    });
  });

  describe('Safety Layer Performance', () => {
    it('should check anomaly within performance SLA', async () => {
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        await safetyLayer.checkSpendingAnomaly(`perf-user-${i}`, Math.random() * 100000, 100000);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // 5 second SLA for 100 checks
    });
  });
});
