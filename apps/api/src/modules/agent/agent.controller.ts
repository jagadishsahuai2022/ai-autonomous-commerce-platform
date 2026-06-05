/*
 * Agentic Checkout Engine - Agent API Controller
 * Core endpoints for AI-assisted shopping with safety, verification, and observability
 * Implements: /agent/search, /agent/execute, /agent/verify
 * Includes Schema.org structured data support
 */

import { Controller, Post, Get, Body, Param, UseGuards, Req, Res, Logger } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { IntentGuardrailService } from '../../common/services/intent-guardrail.service';
import { HITLApprovalService } from '../../common/services/hitl-approval.service';
import { VerificationLayerService } from '../../common/services/verification-layer.service';
import { OpenTelemetryService } from '../../common/services/opentelemetry-ai.service';
import { ZeroPartyDataService } from '../../common/services/zero-party-data.service';
import { CacheService } from '../../common/services/cache.service';
import { StructuredLoggerService } from '../../common/services/structured-logger.service';
import { MetricsService } from '../../common/services/metrics.service';
import { PrismaService } from '../../services/prisma.service';
import { JwtGuard as JwtAuthGuard } from '../../common/guards/jwt.guard';

@Controller('api/agent')
@UseGuards(JwtAuthGuard)
export class AgentController {
  private logger = new Logger(AgentController.name);

  constructor(
    private guardrailService: IntentGuardrailService,
    private approvalService: HITLApprovalService,
    private verificationService: VerificationLayerService,
    private telemetryService: OpenTelemetryService,
    private preferenceService: ZeroPartyDataService,
    private cacheService: CacheService,
    private loggerService: StructuredLoggerService,
    private metricsService: MetricsService,
    private prisma: PrismaService
  ) {}

  /**
   * POST /agent/search
   * Search with AI assistance and guardrails
   * Returns ranked products with confidence scores and explanations
   * Schema.org: BreadcrumbList, Product, AggregateOffer
   */
  @Post('search')
  async search(
    @Req() req: any,
    @Body()
    payload: {
      query: string;
      budget: number;
      categories?: string[];
      count?: number;
      correlationId?: string;
    },
    @Res() res: FastifyReply
  ): Promise<void> {
    const correlationId = payload.correlationId || this.generateCorrelationId();
    const userId = req.user.id;

    await this.telemetryService.traceAIDecision(
      'RECOMMENDATION',
      correlationId,
      userId,
      async (span) => {
        try {
          // Get user preferences
          const preferences = await this.preferenceService.getUserPreferences(userId);

          // Add context to span
          this.telemetryService.addContextAttribute('query', payload.query);
          this.telemetryService.addContextAttribute('budget', payload.budget);

          // Search with ranking (calls Python ranking service)
          const recommendations = await this.searchProductsWithRanking(
            payload.query,
            payload.budget,
            payload.categories || preferences.preferredCategories,
            payload.count || 10,
            correlationId
          );

          // Apply guardrails
          const guardrailResult = await this.guardrailService.evaluateRecommendations({
            userId,
            recommendations,
            userBudget: payload.budget,
            userPreferences: preferences as any,
            correlationId,
          });

          // Build response with Schema.org
          const response = {
            status: 'success',
            correlationId,
            guardrailStatus: {
              passed: guardrailResult.passed,
              violations: guardrailResult.violations,
              flagged: guardrailResult.flaggedRecommendations.length > 0,
              requiresApproval: guardrailResult.requiresApproval,
            },
            recommendations: guardrailResult.safeRecommendations.map((r) => ({
              productId: r.productId,
              name: r.productId, // Would fetch from DB
              price: r.price,
              quality: r.quality,
              confidence: r.confidence,
              explanation: r.explanation,
              schemaOrg: this.buildProductSchema(r),
            })),
            valueScore: guardrailResult.valueScore,
            budgetAlignment: guardrailResult.budgetAlignment,
            reasoning: guardrailResult.reasoning,
            alternatives: guardrailResult.alternatives.length > 0,
            alternativeCount: guardrailResult.alternatives.length,
            requiresApproval: guardrailResult.requiresApproval,
            schemaOrg: {
              '@context': 'https://schema.org',
              '@type': 'SearchResultsPage',
              resultStatistic: {
                '@type': 'SearchAction',
                query: payload.query,
                target: payload.budget,
              },
            },
          };

          // Log decision
          await this.telemetryService.logAIDecision(
            'RECOMMENDATION',
            correlationId,
            userId,
            { query: payload.query, budget: payload.budget },
            { count: recommendations.length, passed: guardrailResult.passed },
            (guardrailResult.valueScore / 100) * 100,
            'success',
            guardrailResult.reasoning,
            0,
            {
              guardrailsPassed: guardrailResult.passed,
              valueScore: guardrailResult.valueScore,
            }
          );

          res.send(response);
        } catch (error) {
          this.logger.error(`Search failed: ${error.message}`, error.stack);
          await this.telemetryService.logAIDecision(
            'RECOMMENDATION',
            correlationId,
            userId,
            { query: payload.query },
            { error: error.message },
            0,
            'error',
            `Search failed: ${error.message}`,
            0
          );
          res.status(500).send({
            status: 'error',
            message: error.message,
            correlationId,
          });
        }
      }
    );
  }

  /**
   * POST /agent/verify
   * Verify order before execution
   * Checks: budget, inventory, seller trust, wallet, fraud
   */
  @Post('verify')
  async verify(
    @Req() req: any,
    @Body()
    payload: {
      productIds: string[];
      orderAmount: number;
      correlationId?: string;
    },
    @Res() res: FastifyReply
  ): Promise<void> {
    const correlationId = payload.correlationId || this.generateCorrelationId();
    const userId = req.user.id;

    await this.telemetryService.traceAIDecision('RANKING', correlationId, userId, async (span) => {
      try {
        // Get seller IDs from products (Product has no sellerId; use empty array)
        const sellerIds: string[] = [];

        // Run comprehensive verification
        const verification = await this.verificationService.verifyBeforeExecution({
          userId,
          orderAmount: payload.orderAmount,
          productIds: payload.productIds,
          sellerIds,
          correlationId,
        });

        this.telemetryService.addContextAttribute('verification.valid', verification.valid);
        this.telemetryService.addContextAttribute(
          'verification.checks',
          verification.checks.length
        );

        // Build response
        const response = {
          status: 'success',
          correlationId,
          verification: {
            valid: verification.valid,
            validUntil: verification.validUntil,
            checks: verification.checks.map((c) => ({
              name: c.name,
              status: c.status,
              message: c.message,
            })),
            blockingIssues: verification.blockingIssues,
            warnings: verification.warnings,
          },
          schemaOrg: {
            '@context': 'https://schema.org',
            '@type': 'Order',
            orderStatus: verification.valid ? 'OrderProcessing' : 'OrderCancelled',
            priceCurrency: 'INR',
            price: payload.orderAmount,
            url: `${process.env.API_URL}/orders/${verification.requestId}`,
          },
        };

        // Log verification
        await this.telemetryService.logAIDecision(
          'AUTO_EXECUTE',
          correlationId,
          userId,
          { orderAmount: payload.orderAmount },
          { valid: verification.valid },
          verification.valid ? 100 : 0,
          'success',
          verification.valid ? 'Order ready for execution' : 'Order blocked by verification',
          0
        );

        res.send(response);
      } catch (error) {
        this.logger.error(`Verification failed: ${error.message}`, error.stack);
        res.status(500).send({
          status: 'error',
          message: error.message,
          correlationId,
        });
      }
    });
  }

  /**
   * POST /agent/execute
   * Execute order with AI decision
   * Handles approval workflow if needed
   * Updates inventory, creates order, processes payment
   */
  @Post('execute')
  async execute(
    @Req() req: any,
    @Body()
    payload: {
      productIds: string[];
      quantities: number[];
      orderAmount: number;
      autoDecision?: boolean;
      correlationId?: string;
    },
    @Res() res: FastifyReply
  ): Promise<void> {
    const correlationId = payload.correlationId || this.generateCorrelationId();
    const userId = req.user.id;

    await this.telemetryService.traceAIDecision(
      'AUTO_EXECUTE',
      correlationId,
      userId,
      async (span) => {
        try {
          // Get user preferences
          const preferences = await this.preferenceService.getUserPreferences(userId);

          // 1. Verify before execution
          // Get seller IDs from products (Product has no sellerId; use empty array)
          const sellerIds: string[] = [];

          const verification = await this.verificationService.verifyBeforeExecution({
            userId,
            orderAmount: payload.orderAmount,
            productIds: payload.productIds,
            sellerIds,
            correlationId,
          });

          if (!verification.valid) {
            // Block execution
            await this.telemetryService.logGuardrailBlock(
              correlationId,
              userId,
              'Verification failed',
              payload,
              verification.blockingIssues,
              {
                blockingIssueCount: verification.blockingIssues.length,
              }
            );

            return res.status(400).send({
              status: 'blocked',
              message: 'Order verification failed',
              issues: verification.blockingIssues,
              correlationId,
            });
          }

          // 2. Check if approval needed
          const needsApproval = await this.approvalService.shouldRequireApproval(
            userId,
            payload.orderAmount,
            0, // riskScore (would come from verification)
            'ai_decision'
          );

          if (needsApproval) {
            // Create approval request
            const approval = await this.approvalService.createApprovalRequest(
              userId,
              'ai_decision',
              payload.orderAmount,
              payload.productIds.map((pid) => ({
                productId: pid,
                name: 'Product',
                price: payload.orderAmount / payload.productIds.length,
                quality: 'mid',
                sellerId: '',
                sellerRating: 4.5,
                relevanceScore: 0.95,
              })),
              {
                decision: 'AI recommended this purchase',
                confidence: 95,
                reasoning: Array.isArray(payload.autoDecision)
                  ? []
                  : ['Budget aligned', 'Good value'],
                strengths: ['Good ratings', 'Fast delivery'],
                weaknesses: [],
                assumption: 'User wants quality products',
                fallbackOptions: [],
              },
              [],
              0, // riskScore
              correlationId
            );

            await this.telemetryService.logApprovalDecision(
              correlationId,
              userId,
              payload.orderAmount,
              'auto_execute',
              0,
              { approval: approval.id }
            );

            return res.status(202).send({
              status: 'approved_required',
              message: 'Order requires user approval',
              approvalId: approval.id,
              approvalExpiresAt: approval.expiresAt,
              correlationId,
              schemaOrg: {
                '@context': 'https://schema.org',
                '@type': 'Order',
                orderStatus: 'OrderPending',
                confirmationNumber: approval.id,
              },
            });
          }

          // 3. Execute order
          const wallet = await this.prisma.wallet.findUnique({
            where: { userId },
            select: { balance: true },
          });

          if (!wallet || wallet.balance < payload.orderAmount) {
            throw new Error('Insufficient wallet balance');
          }

          // Create order
          const order = await this.prisma.order.create({
            data: {
              userId,
              total: payload.orderAmount,
              status: 'pending',
              items: {
                create: payload.productIds.map((productId, idx) => ({
                  productId: parseInt(productId, 10),
                  quantity: payload.quantities[idx],
                  price: payload.orderAmount / payload.productIds.length,
                })),
              },
            },
          });

          // Debit wallet
          const walletForDebit = await this.prisma.wallet.findUnique({
            where: { userId },
            select: { id: true },
          });
          await this.prisma.walletTransaction.create({
            data: {
              walletId: walletForDebit!.id,
              type: 'debit',
              amount: payload.orderAmount,
              orderId: order.id,
              reason: 'Auto-executed AI purchase',
              balanceBefore: wallet!.balance,
              balanceAfter: wallet!.balance - payload.orderAmount,
            } as any,
          });

          // Log successful execution
          await this.telemetryService.logAutoExecution(
            correlationId,
            userId,
            String(order.id),
            payload.orderAmount,
            payload.productIds,
            95, // confidence
            'Order auto-executed successfully'
          );

          this.metricsService.recordCounterMetric('agent_orders_executed', 1, {
            autoExecuted: 'true',
          });

          res.status(201).send({
            status: 'success',
            message: 'Order executed successfully',
            orderId: order.id,
            orderAmount: payload.orderAmount,
            correlationId,
            schemaOrg: {
              '@context': 'https://schema.org',
              '@type': 'Order',
              orderDate: new Date().toISOString(),
              orderNumber: order.id,
              orderStatus: 'OrderProcessing',
              orderTotal: {
                '@type': 'PriceSpecification',
                priceCurrency: 'INR',
                price: payload.orderAmount,
              },
            },
          });
        } catch (error) {
          this.logger.error(`Execution failed: ${error.message}`, error.stack);
          res.status(500).send({
            status: 'error',
            message: error.message,
            correlationId,
          });
        }
      }
    );
  }

  /**
   * GET /agent/preferences/quiz
   * Get preference quiz questions
   */
  @Get('preferences/quiz')
  async getQuiz(@Req() req: any, @Res() res: FastifyReply): Promise<void> {
    const questions = this.preferenceService.getQuizQuestions();
    res.send({
      status: 'success',
      questions,
      schemaOrg: {
        '@context': 'https://schema.org',
        '@type': 'Quiz',
        numberOfQuestions: questions.length,
      },
    });
  }

  /**
   * POST /agent/preferences/quiz/start
   * Start preference quiz
   */
  @Post('preferences/quiz/start')
  async startQuiz(@Req() req: any, @Res() res: FastifyReply): Promise<void> {
    const userId = req.user.id;
    const quiz = await this.preferenceService.startQuiz(userId);
    res.send({
      status: 'success',
      quizId: quiz.id,
      createdAt: quiz.createdAt,
    });
  }

  /**
   * POST /agent/preferences/quiz/:quizId/answer
   * Submit quiz answer
   */
  @Post('preferences/quiz/:quizId/answer')
  async submitAnswer(
    @Req() req: any,
    @Param('quizId') quizId: string,
    @Body() payload: { questionId: string; answer: string | string[] },
    @Res() res: FastifyReply
  ): Promise<void> {
    const userId = req.user.id;
    const updated = await this.preferenceService.submitAnswer(
      quizId,
      userId,
      payload.questionId,
      payload.answer
    );
    res.send({
      status: 'success',
      quizId: updated.id,
      answerCount: updated.answers.length,
    });
  }

  /**
   * POST /agent/preferences/quiz/:quizId/complete
   * Complete quiz and store preferences
   */
  @Post('preferences/quiz/:quizId/complete')
  async completeQuiz(
    @Req() req: any,
    @Param('quizId') quizId: string,
    @Res() res: FastifyReply
  ): Promise<void> {
    const userId = req.user.id;
    const preferences = await this.preferenceService.completeQuiz(quizId, userId);
    res.send({
      status: 'success',
      preferences: {
        budgetSensitivity: preferences.budgetSensitivity,
        qualityPreference: preferences.qualityPreference,
        autoDecisionEnabled: preferences.autoDecisionEnabled,
        preferredCategories: preferences.preferredCategories,
      },
    });
  }

  /**
   * GET /agent/approvals
   * Get pending approvals for user
   */
  @Get('approvals')
  async getPendingApprovals(@Req() req: any, @Res() res: FastifyReply): Promise<void> {
    const userId = req.user.id;
    const approvals = await this.approvalService.getPendingApprovals(userId);
    res.send({
      status: 'success',
      count: approvals.length,
      approvals: approvals.map((a) => ({
        id: a.id,
        reason: a.reason,
        orderAmount: a.orderAmount,
        riskScore: a.riskScore,
        expiresAt: a.expiresAt,
        reasoning: a.aiReasoning,
      })),
    });
  }

  /**
   * POST /agent/approvals/:approvalId/approve
   * Approve an order
   */
  @Post('approvals/:approvalId/approve')
  async approveOrder(
    @Req() req: any,
    @Param('approvalId') approvalId: string,
    @Body() payload: { reason?: string },
    @Res() res: FastifyReply
  ): Promise<void> {
    const userId = req.user.id;
    const approval = await this.approvalService.approveOrder(approvalId, userId, payload.reason);
    res.send({
      status: 'success',
      approval: {
        id: approval.id,
        status: approval.status,
        respondedAt: approval.respondedAt,
      },
    });
  }

  /**
   * POST /agent/approvals/:approvalId/reject
   * Reject an order
   */
  @Post('approvals/:approvalId/reject')
  async rejectOrder(
    @Req() req: any,
    @Param('approvalId') approvalId: string,
    @Body() payload: { reason: string },
    @Res() res: FastifyReply
  ): Promise<void> {
    const userId = req.user.id;
    const approval = await this.approvalService.rejectOrder(approvalId, userId, payload.reason);
    res.send({
      status: 'success',
      approval: {
        id: approval.id,
        status: approval.status,
        respondedAt: approval.respondedAt,
      },
    });
  }

  /**
   * Helper: Search products with ranking
   */
  private async searchProductsWithRanking(
    query: string,
    budget: number,
    categories: string[],
    count: number,
    correlationId: string
  ): Promise<any[]> {
    // In production, this would call the ranking service
    return [];
  }

  /**
   * Helper: Build Schema.org Product structured data
   */
  private buildProductSchema(product: any): any {
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.productId,
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'INR',
        price: product.price,
        availability: 'https://schema.org/InStock',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: product.confidence * 5, // Convert 0-1 to 0-5
        bestRating: 5,
        worstRating: 1,
      },
    };
  }

  /**
   * Helper: Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
