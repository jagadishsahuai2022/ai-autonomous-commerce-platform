/**
 * ACP Kafka Event Producer
 * Part 7: Event-driven integration with Kafka
 * Produces events for agent decisions and checkout process
 */

import { Injectable, Logger } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import {
  AgentRequestCreatedEvent,
  AgentResponseGeneratedEvent,
  AgentCheckoutInitiatedEvent,
  AgentCheckoutCompletedEvent,
  AgentRequest,
  AgentResponse,
  CheckoutRequest,
} from '../schemas/acp.types';

@Injectable()
export class ACPKafkaProducerService {
  private readonly logger = new Logger(ACPKafkaProducerService.name);
  private producer: Producer;
  private kafka: Kafka;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'acp-agent',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    });

    // retry.retries: 0 — ACP Saga handles idempotency at the application level.
    // NestJS v11.1.0+ introduced retryAttempts: 3 as a Kafka transport default;
    // leaving retries enabled would cause double-publishing of AgentCheckout events.
    this.producer = this.kafka.producer({
      retry: { retries: 0 },
    });
  }

  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      this.logger.log('Connected to Kafka');
    } catch (error) {
      this.logger.error(`Kafka connection failed: ${error}`);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.producer.disconnect();
      this.logger.log('Disconnected from Kafka');
    } catch (error) {
      this.logger.error(`Kafka disconnection failed: ${error}`);
    }
  }

  /**
   * Produce: Agent Request Created
   */
  async publishAgentRequestCreated(request: AgentRequest): Promise<void> {
    try {
      const event: AgentRequestCreatedEvent = {
        requestId: request.requestId,
        correlationId: request.correlationId,
        userId: request.userContext.userId,
        intentType: this.extractIntentType(request.intent),
        timestamp: request.timestamp,
        constraints: request.constraints,
      };

      await this.producer.send({
        topic: 'agent.request.created',
        messages: [
          {
            key: request.correlationId,
            value: JSON.stringify(event),
            headers: {
              'correlation-id': request.correlationId,
              'request-id': request.requestId,
              'user-id': request.userContext.userId,
            },
          },
        ],
      });

      this.logger.debug(`Published: agent.request.created for ${request.requestId}`);
    } catch (error) {
      this.logger.error(`Failed to publish agent.request.created: ${error}`);
      // Don't throw - event publishing failure shouldn't block execution
    }
  }

  /**
   * Produce: Agent Response Generated
   */
  async publishAgentResponseGenerated(response: AgentResponse): Promise<void> {
    try {
      const event: AgentResponseGeneratedEvent = {
        responseId: response.responseId,
        requestId: response.requestId,
        correlationId: response.correlationId,
        userId: 'unknown', // Would come from context
        optionsCount: response.options.length,
        selectedOptionId: response.selectedOption?.productId,
        confidenceScore: response.confidenceScore,
        processingTimeMs: response.processingTimeMs,
        timestamp: response.timestamp,
      };

      await this.producer.send({
        topic: 'agent.response.generated',
        messages: [
          {
            key: response.correlationId,
            value: JSON.stringify(event),
            headers: {
              'correlation-id': response.correlationId,
              'response-id': response.responseId,
              'request-id': response.requestId,
            },
          },
        ],
      });

      this.logger.debug(`Published: agent.response.generated for ${response.responseId}`);
    } catch (error) {
      this.logger.error(`Failed to publish agent.response.generated: ${error}`);
    }
  }

  /**
   * Produce: Agent Checkout Initiated
   */
  async publishAgentCheckoutInitiated(request: CheckoutRequest, orderId: string): Promise<void> {
    try {
      const event: AgentCheckoutInitiatedEvent = {
        checkoutId: this.generateCheckoutId(),
        correlationId: request.correlationId,
        userId: request.userContext.userId,
        orderId,
        productIds: request.intent.products.map((p) => p.productId),
        totalAmount: request.intent.products.reduce((sum) => sum + 1000, 0), // Mock calculation
        currency: request.userContext.currency,
        timestamp: new Date(),
      };

      await this.producer.send({
        topic: 'agent.checkout.initiated',
        messages: [
          {
            key: request.correlationId,
            value: JSON.stringify(event),
            headers: {
              'correlation-id': request.correlationId,
              'order-id': orderId,
              'user-id': request.userContext.userId,
            },
          },
        ],
      });

      this.logger.debug(`Published: agent.checkout.initiated for ${event.checkoutId}`);
    } catch (error) {
      this.logger.error(`Failed to publish agent.checkout.initiated: ${error}`);
    }
  }

  /**
   * Produce: Agent Checkout Completed
   */
  async publishAgentCheckoutCompleted(
    correlationId: string,
    userId: string,
    orderId: string,
    status: 'success' | 'failed',
    totalAmount: number,
    currency: string,
    failureReason?: string
  ): Promise<void> {
    try {
      const event: AgentCheckoutCompletedEvent = {
        checkoutId: this.generateCheckoutId(),
        correlationId,
        userId,
        orderId,
        status,
        totalAmount,
        currency,
        failureReason,
        timestamp: new Date(),
      };

      await this.producer.send({
        topic: 'agent.checkout.completed',
        messages: [
          {
            key: correlationId,
            value: JSON.stringify(event),
            headers: {
              'correlation-id': correlationId,
              'order-id': orderId,
              'user-id': userId,
              status,
            },
          },
        ],
      });

      this.logger.debug(`Published: agent.checkout.completed for ${orderId}`);
    } catch (error) {
      this.logger.error(`Failed to publish agent.checkout.completed: ${error}`);
    }
  }

  /**
   * Publish custom ACP event
   */
  async publishCustomEvent(topic: string, event: any, correlationId: string): Promise<void> {
    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key: correlationId,
            value: JSON.stringify(event),
            headers: {
              'correlation-id': correlationId,
              timestamp: new Date().toISOString(),
            },
          },
        ],
      });

      this.logger.debug(`Published custom event to ${topic}`);
    } catch (error) {
      this.logger.error(`Failed to publish custom event: ${error}`);
    }
  }

  /**
   * Runtime health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const admin = this.kafka.admin();
      await admin.connect();
      const cluster = await admin.describeCluster();
      await admin.disconnect();
      return cluster.brokers.length > 0;
    } catch (error) {
      this.logger.error(`Health check failed: ${error}`);
      return false;
    }
  }

  private extractIntentType(intent: any): string {
    if (intent.query) return 'search';
    if (intent.productId) return 'product';
    if (intent.products) return 'checkout';
    return 'unknown';
  }

  private generateCheckoutId(): string {
    return `checkout_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
