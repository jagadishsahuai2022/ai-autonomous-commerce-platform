/**
 * Approval Workflow Integration Tests
 * Complete approval request lifecycle
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { AutopilotDecisionRepository } from '../../database/repositories/autopilot-decision.repository';
import { NotificationService } from '../../services/notification.service';

describe('Approval Workflow Integration Tests', () => {
  let app: INestApplication;
  let decisionRepository: AutopilotDecisionRepository;
  let notificationService: NotificationService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    decisionRepository = moduleFixture.get<AutopilotDecisionRepository>(
      AutopilotDecisionRepository
    );
    notificationService = moduleFixture.get<NotificationService>(NotificationService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Approval Request Creation', () => {
    it('should create approval request for high-value decision', async () => {
      // Create initial decision
      const decision = await decisionRepository.createDecision({
        userId: 'approval-test-user',
        productId: 'high-value-product',
        shouldProceed: true,
        confidence: 0.68,
        confidenceFactors: {
          ruleMatch: 0.8,
          userHistory: 0.6,
          productRelevance: 0.65,
        },
        reasoning: { summary: 'Confidence below threshold' },
        requiresApproval: true,
        riskLevel: 'medium',
      });

      // Create approval request
      const approval = await decisionRepository.createApprovalRequest({
        userId: 'approval-test-user',
        decisionId: decision.id,
        reason: 'Confidence score 68% below auto-approval threshold of 75%',
      });

      expect(approval).toBeDefined();
      expect(approval.status).toBe('pending');
      expect(approval.decisionId).toBe(decision.id);
      expect(approval.userId).toBe('approval-test-user');
    });

    it('should fetch pending approvals for user', async () => {
      const pending = await decisionRepository.getPendingApprovals('approval-test-user');

      expect(Array.isArray(pending)).toBe(true);
      expect(pending.length).toBeGreaterThan(0);
      expect(pending[0].status).toBe('pending');
    });
  });

  describe('Approval Workflow States', () => {
    it('should transition decision through approval states', async () => {
      // Create decision
      const decision = await decisionRepository.createDecision({
        userId: 'state-test-user',
        productId: 'state-test-product',
        shouldProceed: true,
        confidence: 0.65,
        confidenceFactors: {},
        reasoning: { summary: 'Needs approval' },
        requiresApproval: true,
        riskLevel: 'low',
      });

      expect(decision.status).toBe('pending_approval');

      // Create approval request
      const approval = await decisionRepository.createApprovalRequest({
        userId: 'state-test-user',
        decisionId: decision.id,
        reason: 'Auto-approval disabled for this user',
      });

      expect(approval.status).toBe('pending');

      // Approve
      const approved = await decisionRepository.approve(decision.id, 'User approved');
      expect(approved.status).toBe('approved');

      // Execute
      const executed = await decisionRepository.updateStatus(
        decision.id,
        'executed',
        'order-test-123'
      );
      expect(executed.status).toBe('executed');
    });

    it('should handle rejection workflow', async () => {
      // Create decision
      const decision = await decisionRepository.createDecision({
        userId: 'reject-test-user',
        productId: 'reject-test-product',
        shouldProceed: true,
        confidence: 0.62,
        confidenceFactors: {},
        reasoning: { summary: 'Needs approval' },
        requiresApproval: true,
        riskLevel: 'medium',
      });

      // Create approval request
      await decisionRepository.createApprovalRequest({
        userId: 'reject-test-user',
        decisionId: decision.id,
        reason: 'Manual approval required',
      });

      // Reject
      const rejected = await decisionRepository.reject(decision.id, 'User rejected: Out of budget');

      expect(rejected.status).toBe('rejected');
      // rejectionReason is stored in approvalRequest.responseReason
    });
  });

  describe('Approval API Endpoints', () => {
    it('should list pending approvals via API', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/autopilot/approvals/pending')
        .query({ userId: 'approval-test-user' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should approve decision via API', async () => {
      // First, get a pending approval
      const pending = await decisionRepository.getPendingApprovals('approval-test-user');

      if (pending.length > 0) {
        const response = await request(app.getHttpServer())
          .post(`/api/v1/autopilot/approvals/${pending[0].decisionId}/approve`)
          .send({ notes: 'Approved via API test' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('approved');
      }
    });

    it('should reject decision via API', async () => {
      // Create a new decision for rejection
      const decision = await decisionRepository.createDecision({
        userId: 'api-reject-user',
        productId: 'api-reject-product',
        shouldProceed: true,
        confidence: 0.65,
        confidenceFactors: {},
        reasoning: { summary: 'Needs approval' },
        requiresApproval: true,
        riskLevel: 'low',
      });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/autopilot/approvals/${decision.id}/reject`)
        .send({ reason: 'Rejected via API - exceeds monthly budget' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('rejected');
    });
  });

  describe('Approval Notifications', () => {
    it('should send notification when approval is required', async () => {
      const notificationSpy = jest.spyOn(notificationService, 'sendApprovalNotification');

      const decision = await decisionRepository.createDecision({
        userId: 'notification-test-user',
        productId: 'notification-test-product',
        shouldProceed: true,
        confidence: 0.65,
        confidenceFactors: {},
        reasoning: { summary: 'Needs approval' },
        requiresApproval: true,
        riskLevel: 'medium',
      });

      // Notifications would be sent via event/hook
      expect(notificationSpy).toHaveBeenCalled();
    });
  });

  describe('Approval Timeout Handling', () => {
    it('should track approval timeout', async () => {
      const decision = await decisionRepository.createDecision({
        userId: 'timeout-test-user',
        productId: 'timeout-product',
        shouldProceed: true,
        confidence: 0.65,
        confidenceFactors: {},
        reasoning: { summary: 'Needs approval' },
        requiresApproval: true,
        riskLevel: 'low',
      });

      // Record timeout after 24 hours (would be handled by background job)
      const expired = await decisionRepository.updateStatus(decision.id, 'approval_expired', undefined);

      expect(expired.status).toBe('approval_expired');
    });
  });

  describe('Approval Analytics', () => {
    it('should generate approval statistics', async () => {
      const stats = await decisionRepository.getStatistics('notification-test-user');

      expect(stats).toBeDefined();
      expect(stats.totalDecisions).toBeGreaterThanOrEqual(0);
      expect(stats.pendingCount).toBeGreaterThanOrEqual(0);
      expect(stats.approvalRate).toBeGreaterThanOrEqual(0);
    });

    it('should track approval metrics', async () => {
      const decision = await decisionRepository.createDecision({
        userId: 'metrics-test-user',
        productId: 'metrics-product',
        shouldProceed: true,
        confidence: 0.72,
        confidenceFactors: {
          ruleMatch: 0.85,
          userHistory: 0.68,
        },
        reasoning: { summary: 'Metrics test' },
        requiresApproval: true,
        riskLevel: 'low',
      });

      // Record analytics
      await decisionRepository.recordAnalytics(decision.id, {
        confidenceBreakdown: {
          ruleMatch: 0.85,
          userHistory: 0.68,
        },
        riskFactors: ['confidence_border'],
        approvedBy: 'user_manual',
      });

      // Verify recording
      const analyticsRecord = await decisionRepository.findById(decision.id);
      expect(analyticsRecord).toBeDefined();
    });
  });

  describe('Approval Workflow Validation', () => {
    it('should validate approval request data', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/autopilot/approvals/invalid-id/approve')
        .send({}) // Empty body
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should prevent duplicate approvals', async () => {
      // Create and approve
      const decision = await decisionRepository.createDecision({
        userId: 'duplicate-test-user',
        productId: 'duplicate-product',
        shouldProceed: true,
        confidence: 0.65,
        confidenceFactors: {},
        reasoning: { summary: 'Duplicate test' },
        requiresApproval: true,
        riskLevel: 'low',
      });

      await decisionRepository.approve(decision.id, 'First approval');

      // Try to approve again
      const response = await request(app.getHttpServer())
        .post(`/api/v1/autopilot/approvals/${decision.id}/approve`)
        .send({ notes: 'Second approval attempt' })
        .expect(409); // Conflict

      expect(response.body.success).toBe(false);
    });
  });

  describe('Bulk Approval Operations', () => {
    it('should handle bulk approval requests', async () => {
      // Create multiple decisions
      const decisionIds = [];

      for (let i = 0; i < 3; i++) {
        const decision = await decisionRepository.createDecision({
          userId: 'bulk-test-user',
          productId: `bulk-product-${i}`,
          shouldProceed: true,
          confidence: 0.65,
          confidenceFactors: {},
          reasoning: { summary: `Bulk test ${i}` },
          requiresApproval: true,
          riskLevel: 'low',
        });
        decisionIds.push(decision.id);
      }

      // Bulk approve
      const response = await request(app.getHttpServer())
        .post('/api/v1/autopilot/approvals/bulk')
        .send({
          decisionIds,
          action: 'approve',
          batchNotes: 'Bulk approval',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.approvedCount).toBe(3);
    });
  });
});
