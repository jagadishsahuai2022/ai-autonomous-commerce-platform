/**
 * Kafka Producer Service
 * Publishes autopilot events to Kafka topics
 */

import { Injectable, Logger } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { AutopilotEvent } from '../types';

@Injectable()
export class KafkaProducerService {
  private readonly logger = new Logger(KafkaProducerService.name);
  private producer: Producer;
  private kafka: Kafka;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'autopilot-engine',
      brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
    });
    this.producer = this.kafka.producer({ retry: { retries: 0 } });
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      this.logger.log('Kafka Producer connected');
    } catch (error) {
      this.logger.error('Failed to connect Kafka Producer', error);
    }
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  /**
   * Publish autopilot event
   */
  async publishEvent(topic: string, event: AutopilotEvent): Promise<void> {
    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key: event.ruleId,
            value: JSON.stringify(event),
            headers: {
              'event-type': event.type,
              'correlation-id': event.correlationId || '',
              timestamp: Date.now().toString(),
            },
          },
        ],
      });

      this.logger.debug(`Event published to ${topic}: ${event.type}`);
    } catch (error) {
      this.logger.error(`Failed to publish event to ${topic}`, error);
      throw error;
    }
  }

  /**
   * Publish rule created event
   */
  async publishRuleCreated(ruleId: string, userId: string): Promise<void> {
    await this.publishEvent('autopilot.rules.created', {
      id: this.generateEventId(),
      type: 'RULE_CREATED',
      ruleId,
      userId,
      timestamp: new Date(),
      correlationId: ruleId,
    });
  }

  /**
   * Publish decision triggered event
   */
  async publishDecisionTriggered(
    decisionId: string,
    ruleId: string,
    userId: string,
    productId: string
  ): Promise<void> {
    await this.publishEvent('autopilot.triggered', {
      id: this.generateEventId(),
      type: 'RULE_TRIGGERED',
      ruleId,
      userId,
      productId,
      timestamp: new Date(),
      correlationId: decisionId,
    });
  }

  /**
   * Publish execution event
   */
  async publishExecuted(
    decisionId: string,
    ruleId: string,
    userId: string,
    productId: string,
    success: boolean,
    orderId?: string
  ): Promise<void> {
    await this.publishEvent('autopilot.executed', {
      id: this.generateEventId(),
      type: 'PURCHASE_EXECUTED',
      ruleId,
      userId,
      productId,
      metadata: { success, orderId },
      timestamp: new Date(),
      correlationId: decisionId,
    });
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
