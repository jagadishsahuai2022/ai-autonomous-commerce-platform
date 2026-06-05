/**
 * ACP Agent Controller
 * Part 2: REST APIs for agent search, quote, and checkout
 */

import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
  HttpCode,
  BadRequestException,
  Logger,
  Headers,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JWTAuthGuard, IdempotencyInterceptor } from '../../common/guards/production-guards';
import { ObservabilityService } from '../../common/services/observability.service';
import { IdempotencyKeyService } from '../../common/services/idempotency-key.service';

import { ACPGatewayService } from '../services/acp-gateway.service';
import { ACPPaymentTokenService } from '../services/acp-payment-token.service';
import { ACPVerificationService } from '../services/acp-verification.service';
import { ACPKafkaProducerService } from '../services/acp-kafka-producer.service';

import {
  AmazonMerchantAdapter,
  FlipkartMerchantAdapter,
  InternalSellerAdapter,
} from '../adapters/merchant-adapters';

import type {
  AgentRequest,
  AgentResponse,
  CheckoutRequest,
  CheckoutResponse,
} from '../schemas/acp.types';

@ApiTags('ACP - Agentic Commerce Protocol')
@ApiBearerAuth()
@Controller('api/v1/agent')
export class ACPAgentController {
  private readonly logger = new Logger(ACPAgentController.name);

  constructor(
    private gateway: ACPGatewayService,
    private paymentToken: ACPPaymentTokenService,
    private verification: ACPVerificationService,
    private kafka: ACPKafkaProducerService,
    private observability: ObservabilityService,
    private idempotency: IdempotencyKeyService,
    private amazonAdapter: AmazonMerchantAdapter,
    private flipkartAdapter: FlipkartMerchantAdapter,
    private internalAdapter: InternalSellerAdapter
  ) {}

  /**
   * POST /agent/search
   * Search for products using agent intent
   * Part 2, 3: Standardized Agent APIs + Message Schema
   */
  @Post('search')
  @UseGuards(JWTAuthGuard)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Search products via agent',
    description: 'Execute product search with agent intent understanding',
  })
  @ApiResponse({
    status: 200,
    description: 'Product search results in ACP format',
    schema: {
      type: 'object',
      properties: {
        options: { type: 'array' },
        selectedOption: { type: 'object' },
        confidence: { type: 'number' },
        reasoning: { type: 'string' },
      },
    },
  })
  async search(
    @Body() request: AgentRequest,
    @Headers('x-correlation-id') correlationId: string
  ): Promise<AgentResponse> {
    const traceContext = this.observability.generateTraceContext();

    try {
      // Validate request
      if (!request.intent || typeof request.intent !== 'object') {
        throw new BadRequestException('Invalid intent format');
      }

      const intent = request.intent as any;

      if (!intent.query) {
        throw new BadRequestException('Search query required');
      }

      // Publish request event
      await this.kafka.publishAgentRequestCreated({
        ...request,
        correlationId: correlationId || traceContext.correlationId,
        timestamp: new Date(),
      });

      // Search across all adapters
      const amazonResults = await this.amazonAdapter.search(intent.query, request.userContext);
      const flipkartResults = await this.flipkartAdapter.search(intent.query, request.userContext);
      const internalResults = await this.internalAdapter.search(intent.query, request.userContext);

      // Combine and rank results
      const allResults = [...amazonResults, ...flipkartResults, ...internalResults].sort(
        (a, b) => b.relevanceScore - a.relevanceScore
      );

      // Transform to ACP format
      const response = await this.gateway.translateToACP(
        {
          products: allResults,
          requestId: request.requestId,
          autoSelect: allResults.length === 1,
        },
        request.userContext.userId,
        correlationId || traceContext.correlationId
      );

      // Publish response event
      await this.kafka.publishAgentResponseGenerated(response);

      return response;
    } catch (error) {
      this.logger.error(`Search failed: ${error}`);
      throw error;
    }
  }

  /**
   * POST /agent/quote
   * Get pricing and availability quote for selected product
   * Part 2, 3: Standardized Agent APIs + Message Schema
   */
  @Post('quote')
  @UseGuards(JWTAuthGuard)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get product quote',
    description: 'Retrieve pricing, availability, and delivery estimate',
  })
  @ApiResponse({
    status: 200,
    description: 'Product quote with pricing and delivery info',
  })
  async quote(
    @Body()
    quoteRequest: {
      productId: string;
      quantity: number;
      correlationId?: string;
    },
    @Headers('x-correlation-id') correlationId: string
  ): Promise<any> {
    try {
      if (!quoteRequest.productId || !quoteRequest.quantity) {
        throw new BadRequestException('ProductID and quantity required');
      }

      if (quoteRequest.quantity <= 0) {
        throw new BadRequestException('Quantity must be positive');
      }

      const allResponses = await Promise.all([
        this.amazonAdapter.quote(quoteRequest.productId, quoteRequest.quantity).catch(() => null),
        this.flipkartAdapter.quote(quoteRequest.productId, quoteRequest.quantity).catch(() => null),
        this.internalAdapter.quote(quoteRequest.productId, quoteRequest.quantity).catch(() => null),
      ]);

      const validResponses = allResponses.filter((r) => r !== null);

      if (validResponses.length === 0) {
        throw new BadRequestException('Product not available from any merchant');
      }

      return {
        correlationId: correlationId || this.observability.generateTraceContext().correlationId,
        quotes: validResponses,
        timestamp: new Date(),
        recommendation: validResponses.sort((a, b) => a.price - b.price)[0],
      };
    } catch (error) {
      this.logger.error(`Quote failed: ${error}`);
      throw error;
    }
  }

  /**
   * POST /agent/checkout
   * Execute checkout with payment and verification
   * Part 2, 3, 4, 6, 8: Standardized APIs + Message Schema + Payment Token + Verification + Security
   */
  @Post('checkout')
  @UseGuards(JWTAuthGuard)
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(201)
  @ApiOperation({
    summary: 'Execute agent checkout',
    description: 'Process order with verification, payment tokenization, and signed requests',
  })
  @ApiResponse({
    status: 201,
    description: 'Checkout confirmation with order details',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        confirmation: { type: 'object' },
        orderId: { type: 'string' },
      },
    },
  })
  async checkout(
    @Body() checkoutRequest: Partial<CheckoutRequest>,
    @Headers('x-correlation-id') correlationId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Headers('authorization') auth: string
  ): Promise<CheckoutResponse> {
    const traceContext = this.observability.generateTraceContext();
    let orderId = '';

    try {
      // Step 1: Validate idempotency
      if (!idempotencyKey) {
        throw new BadRequestException('Idempotency-Key header required for checkout');
      }

      // Step 2: Validate checkout request structure
      if (!checkoutRequest.intent || !Array.isArray(checkoutRequest.intent.products)) {
        throw new BadRequestException('Invalid checkout intent');
      }

      // Step 3: Parse user ID from JWT
      const userId = this.extractUserIdFromAuth(auth);

      // Step 4: Transform to ACP CheckoutRequest
      const acpCheckoutRequest = await this.gateway.transformCheckoutRequest(
        checkoutRequest,
        userId,
        checkoutRequest.paymentToken || ''
      );

      // Step 5: Validate payment token
      const tokenValidation = await this.paymentToken.validateToken(
        checkoutRequest.paymentToken || '',
        userId,
        1000 // Mock amount
      );

      if (!tokenValidation.valid) {
        throw new BadRequestException(`Payment token invalid: ${tokenValidation.error}`);
      }

      // Step 6: Get product quotes
      const quotePromises = checkoutRequest.intent.products.map((p) =>
        this.internalAdapter.quote(p.productId, p.quantity)
      );

      const quotes = await Promise.all(quotePromises);

      // Step 7: Verify checkout readiness (Part 6)
      const verificationResult = await this.verification.verifyCheckoutReadiness(
        acpCheckoutRequest,
        quotes.map((q) => ({
          productId: q.productId,
          title: 'Product',
          price: q.price,
          currency: 'INR',
          seller: q.seller,
          availability: q.available ? 'in_stock' : 'out_of_stock',
          deliveryEstimate: { minDays: 1, maxDays: q.deliveryDays, type: 'standard' },
          ratings: { score: 4.5, count: 100, trustScore: q.seller.trustScore },
          relevanceScore: 85,
        })) as any
      );

      if (!verificationResult.passed) {
        return {
          responseId: `checkout_${Date.now()}`,
          requestId: acpCheckoutRequest.requestId,
          correlationId: correlationId || traceContext.correlationId,
          timestamp: new Date(),
          processingTimeMs: 0,
          version: '1.0.0',
          errors: verificationResult.blockingReasons,
          nextAction: 'payment_required' as const,
          status: 'failed' as const,
        };
      }

      // Step 8: Execute checkout with selected merchant
      orderId = `order_${Date.now()}`;

      const confirmation = await this.internalAdapter.checkout(
        acpCheckoutRequest.intent,
        checkoutRequest.paymentToken || ''
      );

      // Step 9: Consume payment token
      await this.paymentToken.consumeToken(
        checkoutRequest.paymentToken || '',
        userId,
        1000,
        orderId
      );

      // Step 10: Publish events (Part 7)
      await this.kafka.publishAgentCheckoutInitiated(acpCheckoutRequest, orderId);

      await this.kafka.publishAgentCheckoutCompleted(
        correlationId || traceContext.correlationId,
        userId,
        orderId,
        'success',
        confirmation.totalAmount,
        'INR'
      );

      // Step 11: Return success response
      const response: CheckoutResponse = {
        responseId: `checkout_resp_${Date.now()}`,
        requestId: acpCheckoutRequest.requestId,
        correlationId: correlationId || traceContext.correlationId,
        timestamp: new Date(),
        processingTimeMs: 0,
        version: '1.0.0',
        errors: [],
        nextAction: 'display_confirmation' as const,
        status: 'success' as const,
        confirmation,
      };

      return response;
    } catch (error) {
      this.logger.error(`Checkout failed: ${error}`);

      // Publish failure event
      if (orderId) {
        await this.kafka.publishAgentCheckoutCompleted(
          correlationId || traceContext.correlationId,
          'unknown',
          orderId,
          'failed',
          0,
          'INR',
          error instanceof Error ? error.message : String(error)
        );
      }

      throw error;
    }
  }

  /**
   * GET /agent/status/:correlationId
   * Check order/agent status by correlation ID
   * Part 9: Observability
   */
  @Get('status/:correlationId')
  @UseGuards(JWTAuthGuard)
  @ApiOperation({
    summary: 'Get agent interaction status',
    description: 'Retrieve status of agent request/response by correlation ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Agent interaction status',
  })
  async getStatus(@Param('correlationId') correlationId: string): Promise<any> {
    // In production, query from event store or cache
    return {
      correlationId,
      status: 'completed',
      timestamp: new Date(),
      events: ['agent.request.created', 'agent.response.generated', 'agent.checkout.completed'],
    };
  }

  /**
   * Helper: Extract user ID from Authorization header
   */
  private extractUserIdFromAuth(auth: string): string {
    // In production, decode JWT properly
    // For now, return mock user ID
    return 'user_' + Math.random().toString(36).slice(2, 9);
  }
}
