/**
 * Kafka Consumer Service
 * Consumes events from Kafka topics
 */

import { Injectable, Logger } from '@nestjs/common';
import { Consumer, Kafka } from 'kafkajs';

@Injectable()
export class KafkaConsumerService {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private consumer: Consumer;
  private kafka: Kafka;
  private isConnected = false;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'autopilot-engine-consumer',
      brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
    });
    this.consumer = this.kafka.consumer({
      groupId: 'autopilot-engine-group',
      sessionTimeout: 30000,
      rebalanceTimeout: 60000,
    });
  }

  async onModuleInit() {
    try {
      await this.consumer.connect();
      this.isConnected = true;
      this.logger.log('Kafka Consumer connected');
      await this.subscribeToTopics();
    } catch (error) {
      this.logger.error('Failed to connect Kafka Consumer', error);
    }
  }

  async onModuleDestroy() {
    if (this.isConnected) {
      await this.consumer.disconnect();
    }
  }

  /**
   * Subscribe to relevant topics
   */
  private async subscribeToTopics() {
    try {
      await this.consumer.subscribe({
        topics: [
          'price.updates',
          'ranking.scores',
          'intent.parsed',
          'purchase.completed',
          'user.profile.updated',
        ],
        fromBeginning: false,
      });

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            await this.handleMessage(topic, partition, message);
          } catch (error) {
            this.logger.error(`Error processing message from ${topic}`, error);
          }
        },
      });

      this.logger.log('Subscribed to Kafka topics');
    } catch (error) {
      this.logger.error('Failed to subscribe to topics', error);
    }
  }

  /**
   * Handle incoming Kafka message
   */
  private async handleMessage(topic: string, partition: number, message: any): Promise<void> {
    try {
      const value = JSON.parse(message.value.toString());
      const eventType = message.headers?.['event-type']?.toString() || 'unknown';

      this.logger.debug(`Received message from ${topic}: ${eventType}`);

      switch (topic) {
        case 'price.updates':
          this.logger.debug(`Price update: Product ${value.productId} = ₹${value.newPrice}`);
          break;

        case 'ranking.scores':
          this.logger.debug(`Ranking score: Product ${value.productId} = ${value.score}`);
          break;

        case 'intent.parsed':
          this.logger.debug(`Intent parsed: User ${value.userId} - ${value.intent}`);
          break;

        case 'purchase.completed':
          this.logger.debug(`Purchase completed: Order ${value.orderId}`);
          break;

        case 'user.profile.updated':
          this.logger.debug(`User profile updated: ${value.userId}`);
          break;

        default:
          this.logger.warn(`Unknown topic: ${topic}`);
      }
    } catch (error) {
      this.logger.error(`Failed to parse message from ${topic}`, error);
    }
  }

  /**
   * Check consumer connectivity
   */
  isReady(): boolean {
    return this.isConnected;
  }
}
