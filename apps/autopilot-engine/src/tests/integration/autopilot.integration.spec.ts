/**
 * Autopilot Engine - Integration Tests
 * Complete workflow testing
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { RuleEngine } from '../../services/rule-engine.service';
import { DecisionEngine } from '../../services/decision-engine.service';
import { PrismaService } from '../../database/prisma.service';
import { AutopilotRuleRepository } from '../../database/repositories/autopilot-rule.repository';
import { AutopilotDecisionRepository } from '../../database/repositories/autopilot-decision.repository';
import { SafetyLayerService } from '../../safety/safety-layer.service';

describe('Autopilot Engine - Integration Tests', () => {
  let app: INestApplication;
  let ruleEngine: RuleEngine;
  let decisionEngine: DecisionEngine;
  let ruleRepository: AutopilotRuleRepository;
  let decisionRepository: AutopilotDecisionRepository;
  let safetyLayer: SafetyLayerService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    ruleEngine = moduleFixture.get<RuleEngine>(RuleEngine);
    decisionEngine = moduleFixture.get<DecisionEngine>(DecisionEngine);
    ruleRepository = moduleFixture.get<AutopilotRuleRepository>(AutopilotRuleRepository);
    decisionRepository = moduleFixture.get<AutopilotDecisionRepository>(
      AutopilotDecisionRepository
    );
    safetyLayer = moduleFixture.get<SafetyLayerService>(SafetyLayerService);
    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Complete Rule Creation Workflow', () => {
    it('should create rule via API and persist to database', async () => {
      const ruleData = {
        userId: 'test-user-123',
        name: 'Budget Phone Alert',
        conditions: [
          {
            field: 'price',
            operator: 'lte',
            value: 20000,
          },
          {
            field: 'category',
            operator: 'eq',
            value: 'smartphones',
          },
        ],
        action: {
          type: 'auto_buy',
          parameters: { quantity: 1 },
        },
        maxSpendPerMonth: 100000,
        maxOrderValue: 50000,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/autopilot/rules')
        .send(ruleData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.status).toBe('active');

      // Verify in database
      const rule = await ruleRepository.findById(response.body.data.id);
      expect(rule).toBeDefined();
      expect(rule!.userId).toBe('test-user-123');
      expect(rule!.status).toBe('active');
    });

    it('should retrieve user rules via API', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/autopilot/rules?userId=test-user-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Complete Decision Making Workflow', () => {
    it('should evaluate decision with all confidence factors', async () => {
      const evaluationData = {
        userId: 'test-user-123',
        ruleId: 'test-rule',
        product: {
          id: 'prod123',
          name: 'Samsung Galaxy A14',
          price: 18000,
          category: 'smartphones',
          brand: 'Samsung',
          rating: 4.3,
          stock: 5,
          imageUrl: 'http://example.com/phone.jpg',
        },
        userHistory: {
          userId: 'test-user-123',
          totalPurchases: 10,
          totalSpent: 450000,
          returnRate: 0.05,
          averageRating: 4.2,
          purchasesByCategory: { smartphones: 7 },
          lastPurchaseDate: new Date(),
        },
        minimumConfidenceThreshold: 0.65,
        rankingScore: 78,
        intentScore: 75,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/autopilot/evaluate')
        .send(evaluationData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.confidence).toBeDefined();
      expect(response.body.data.confidence.overall).toBeGreaterThan(0);
      expect(response.body.data.confidence.overall).toBeLessThanOrEqual(1);
      expect(response.body.data.reasoning).toBeDefined();
      expect(Array.isArray(response.body.data.reasoning.positiveFactors)).toBe(true);
    });

    it('should record decision in database with analytics', async () => {
      const decision = await decisionEngine.makeDecision({
        userId: 'test-user-123',
        product: {
          id: 'prod456',
          name: 'Test Phone',
          price: 25000,
          category: 'smartphones',
          brand: 'Test Brand',
          rating: 4.0,
          stock: 10,
          priceHistory: [],
          reviews: 0,
          availability: true,
        },
        userHistory: {
          totalPurchases: 5,
          totalSpentThisMonth: 100000,
          returnRate: 0.1,
          purchasesByCategory: {},
          purchaseCount: 5,
          averageOrderValue: 20000,
          preferredCategories: [],
          brandPreferences: {},
          pricePointPreference: 25000,
          nextMaxAllowedPurchase: 25000,
        },
        minimumConfidenceThreshold: 0.6,
      });

      // Record in database
      const dbDecision = await decisionRepository.createDecision({
        userId: decision.userId,
        productId: decision.productId,
        shouldProceed: decision.shouldProceed,
        confidence: decision.confidence.overall,
        confidenceFactors: decision.confidence.factors,
        reasoning: decision.reasoning,
        requiresApproval: decision.requiresApproval,
        riskLevel: decision.riskLevel,
      });

      expect(dbDecision).toBeDefined();
      expect(dbDecision.confidence).toBeDefined();

      // Verify retrieval
      const retrieved = await decisionRepository.findById(dbDecision.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.userId).toBe('test-user-123');
    });
  });

  describe('Safety Layer Integration', () => {
    it('should detect spending anomalies', async () => {
      const anomalyCheck = await safetyLayer.checkSpendingAnomaly(
        'test-user-123',
        100000, // Proposed amount
        200000 // Monthly limit
      );

      expect(anomalyCheck).toBeDefined();
      expect(anomalyCheck.isAnomaly).toBeDefined();
      expect(['low', 'medium', 'high', 'critical']).toContain(anomalyCheck.severity);
    });

    it('should determine if approval is required', async () => {
      const approvalCheck = await safetyLayer.shouldRequireApproval(
        'test-user-123',
        {
          confidence: 0.75,
          riskLevel: 'medium',
          amount: 50000,
          monthlyLimit: 100000,
        },
        {
          approvalRequired: false,
          autoApproveThreshold: 0.85,
          minConfidenceThreshold: 0.65,
        }
      );

      expect(approvalCheck).toBeDefined();
      expect(approvalCheck.requiresApproval).toBeDefined();
      expect(Array.isArray(approvalCheck.reasons)).toBe(true);
    });

    it('should record anomalies', async () => {
      await safetyLayer.recordAnomaly(
        'test-user-123',
        'unusual_spend',
        'high',
        'Spending spike detected'
      );

      // Verify recording
      const anomalies = await prisma.anomalyDetection.findMany({
        where: {
          userId: 'test-user-123',
          detectionType: 'unusual_spend',
        },
      });

      expect(anomalies.length).toBeGreaterThan(0);
    });
  });

  describe('Approval Workflow', () => {
    it('should create and process approval requests', async () => {
      // Create a decision requiring approval
      const decision = await decisionRepository.createDecision({
        userId: 'test-user-123',
        productId: 'prod789',
        shouldProceed: true,
        confidence: 0.72,
        confidenceFactors: {},
        reasoning: { summary: 'Medium confidence' },
        requiresApproval: true,
        riskLevel: 'medium',
      });

      // Create approval request
      const approval = await decisionRepository.createApprovalRequest({
        userId: 'test-user-123',
        decisionId: decision.id,
        reason: 'Medium confidence decision requires approval',
      });

      expect(approval).toBeDefined();
      expect(approval.status).toBe('pending');

      // Get pending approvals
      const pendingApprovals = await decisionRepository.getPendingApprovals('test-user-123');
      expect(pendingApprovals.length).toBeGreaterThan(0);

      // Approve decision
      const approved = await decisionRepository.approve(decision.id, 'User approved');
      expect(approved.status).toBe('approved');
    });
  });

  describe('End-to-End Purchase Flow', () => {
    it('should handle complete purchase workflow', async () => {
      // Step 1: Create rule
      const rule = await ruleRepository.create({
        userId: 'test-user-e2e',
        name: 'E2E Test Rule',
        conditions: [
          { field: 'price', operator: 'lte', value: 30000 },
          { field: 'category', operator: 'eq', value: 'electronics' },
        ],
        action: { type: 'auto_buy', parameters: { quantity: 1 } },
        maxSpendPerMonth: 200000,
        maxOrderValue: 100000,
        description: 'E2E test',
      });

      expect(rule.id).toBeDefined();

      // Step 2: Create matching product
      const product = {
        id: 'prod-e2e',
        name: 'Test Electronics',
        price: 25000,
        category: 'electronics',
        brand: 'Test',
        rating: 4.5,
        stock: 20,
        priceHistory: [] as { price: number; timestamp: Date; source: string }[],
        reviews: 0,
        availability: true,
      };

      // Step 3: Evaluate decision
      const decision = await decisionEngine.makeDecision({
        userId: 'test-user-e2e',
        ruleId: rule.id,
        product,
        userHistory: {
          totalPurchases: 5,
          totalSpentThisMonth: 100000,
          returnRate: 0.05,
          purchasesByCategory: { electronics: 3 },
          purchaseCount: 5,
          averageOrderValue: 20000,
          preferredCategories: ['electronics'],
          brandPreferences: {},
          pricePointPreference: 25000,
          nextMaxAllowedPurchase: 25000,
        },
        minimumConfidenceThreshold: 0.6,
      });

      expect(decision.shouldProceed).toBeDefined();
      expect(decision.confidence.overall).toBeGreaterThan(0);

      // Step 4: Record decision
      const dbDecision = await decisionRepository.createDecision({
        userId: 'test-user-e2e',
        ruleId: rule.id,
        productId: product.id,
        shouldProceed: decision.shouldProceed,
        confidence: decision.confidence.overall,
        confidenceFactors: decision.confidence.factors,
        reasoning: decision.reasoning,
        requiresApproval: decision.requiresApproval,
        riskLevel: decision.riskLevel,
      });

      // Step 5: Execute purchase (if approved)
      if (!decision.requiresApproval) {
        const executed = await decisionRepository.updateStatus(
          dbDecision.id,
          'executed',
          'order-123'
        );

        expect(executed.status).toBe('executed');
        expect(executed.orderId).toBe('order-123');

        // Step 6: Record rule execution
        await ruleRepository.recordExecution(rule.id, true);

        // Verify stats
        const stats = await ruleRepository.getStats(rule.id);
        expect(stats.triggerCount).toBeGreaterThan(0);
        expect(stats.successRate).toBeGreaterThan(0);
      }
    });
  });

  describe('API Health and Status', () => {
    it('should return health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/autopilot/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.service).toBe('autopilot-engine');
      expect(response.body.version).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid rule creation', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/autopilot/rules')
        .send({
          userId: 'test-user',
          name: '',
          conditions: [],
          // Missing required fields
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle not found errors', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/autopilot/rules/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});
