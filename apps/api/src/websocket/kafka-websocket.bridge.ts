/**
 * Kafka-WebSocket Bridge
 * Listens to Kafka events and emits via WebSocket in real-time
 *
 * This bridges the event-driven backend with real-time frontend updates
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { WebSocketService } from './websocket.service';
import { DomainEvent, KAFKA_TOPICS, EventType } from '../common/events/domain.event';

@Injectable()
export class KafkaConsumerBridge implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('KafkaConsumerBridge');
  private kafka: Kafka;
  private consumer: Consumer;
  private isRunning = false;

  constructor(private readonly websocketService: WebSocketService) {}

  /**
   * Initialize Kafka consumer bridge on module init
   */
  async onModuleInit() {
    try {
      this.kafka = new Kafka({
        clientId: 'delegatecart-websocket-consumer',
        brokers: (process.env.KAFKA_BROKERS || 'kafka:29092').split(','),
        connectionTimeout: 10000,
        requestTimeout: 30000,
      });

      this.consumer = this.kafka.consumer({
        groupId: 'websocket-consumer-group',
        allowAutoTopicCreation: false,
        sessionTimeout: 30000,
        heartbeatInterval: 10000,
      });

      // Subscribe to relevant topics
      await this.consumer.subscribe({
        topics: [
          KAFKA_TOPICS.PRODUCT_EVENTS,
          KAFKA_TOPICS.COMMERCE_EVENTS,
          KAFKA_TOPICS.ML_EVENTS,
          KAFKA_TOPICS.RECOMMENDATIONS,
          KAFKA_TOPICS.USER_BEHAVIOR,
        ],
        fromBeginning: false,
      });

      // Start consuming
      await this.consumer.run({
        eachMessage: this.handleMessage.bind(this),
      });

      this.isRunning = true;
      this.logger.log('✅ Kafka-WebSocket bridge started');
    } catch (error) {
      this.logger.error(`Failed to initialize bridge: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle individual Kafka message
   */
  private async handleMessage(payload: EachMessagePayload) {
    try {
      const { topic, partition, message } = payload;

      if (!message.value) {
        this.logger.warn('Received empty message');
        return;
      }

      // Parse message
      const eventData = JSON.parse(message.value.toString());
      const event: DomainEvent = {
        eventId: eventData.eventId,
        eventType: eventData.eventType,
        timestamp: eventData.timestamp,
        version: eventData.version,
        data: eventData.data,
        metadata: eventData.metadata,
      };

      this.logger.debug(
        `📨 Kafka message received: type=${event.eventType}, userId=${event.data.userId}`
      );

      // Route to WebSocket
      this.websocketService.routeEvent(event);
    } catch (error) {
      this.logger.error(`Error processing message: ${error.message}`);
    }
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy() {
    if (this.isRunning && this.consumer) {
      try {
        await this.consumer.disconnect();
        this.isRunning = false;
        this.logger.log('✅ Kafka-WebSocket bridge stopped');
      } catch (error) {
        this.logger.error(`Error stopping bridge: ${error.message}`);
      }
    }
  }
}
