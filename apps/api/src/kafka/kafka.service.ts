import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { LoggerService } from '../common/logger.service';

/**
 * KafkaService - Singleton producer for event emission
 * Manages Kafka producer lifecycle and message publishing
 */
@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('KafkaService');
  private readonly appLogger = new LoggerService();
  private kafka: Kafka;
  private producer: Producer;
  private isConnected = false;

  constructor() {
    // Initialize Kafka client
    this.kafka = new Kafka({
      clientId: 'delegatecart-api',
      brokers: (process.env.KAFKA_BROKERS || 'kafka:29092').split(','),
      connectionTimeout: 10000,
      requestTimeout: 30000,
      logLevel: process.env.NODE_ENV === 'production' ? 1 : 4, // 0=NOTHING, 1=ERROR, 2=WARN, 3=INFO, 4=DEBUG
    });

    // Create producer
    // KafkaJS 2.x: maxInFlightRequests === 1 internally enables idempotent mode,
    // which then requires retries > 0. Remove maxInFlightRequests to avoid this.
    // Saga pattern at the application layer owns retry/idempotency — transport-level
    // retries set to 5 to handle transient connection errors without message duplication
    // risk (each message uses a unique key for deduplication at the consumer side).
    this.producer = this.kafka.producer({
      idempotent: false,
      retry: { retries: 5, initialRetryTime: 100 },
    });
  }

  /**
   * Connect to Kafka on module initialization
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.producer.connect();
      this.isConnected = true;
      this.logger.log('✅ Kafka producer connected');
      this.appLogger.log('Kafka producer initialized', {
        brokers: process.env.KAFKA_BROKERS || 'kafka:29092',
        clientId: 'delegatecart-api',
      });
    } catch (error) {
      this.logger.warn(
        '⚠️ Failed to connect Kafka producer - continuing without Kafka',
        (error as any).message
      );
      this.appLogger.warn('Kafka connection failed - running in API-only mode', {
        brokers: process.env.KAFKA_BROKERS || 'kafka:29092',
        error: (error as any).message,
      });
      // Don't throw - allow application to continue without Kafka
      // Event publishing will fail gracefully when attempted
    }
  }

  /**
   * Disconnect from Kafka on module destruction
   */
  async onModuleDestroy(): Promise<void> {
    if (this.isConnected) {
      try {
        await this.producer.disconnect();
        this.isConnected = false;
        this.logger.log('✅ Kafka producer disconnected');
      } catch (error) {
        this.logger.error('Error disconnecting Kafka producer', (error as any).stack);
      }
    }
  }

  /**
   * Emit event to Kafka topic with retry logic
   * @param topic - Kafka topic name
   * @param message - Message payload (will be serialized to JSON)
   * @param partition - Optional partition number
   */
  async emit(topic: string, message: Record<string, any>, partition?: number): Promise<void> {
    if (!this.isConnected) {
      const error = new Error('Kafka producer not connected');
      this.logger.error('Cannot emit event - producer not connected', error.stack);
      throw error;
    }

    const kafkaMessage = {
      key: message.eventId || message.userId?.toString() || null,
      value: Buffer.from(JSON.stringify(message)),
      headers: {
        'event-type': message.eventType,
        timestamp: new Date().toISOString(),
      },
    };

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Log event emission
        this.appLogger.debug('Publishing event to Kafka', {
          topic,
          eventType: message.eventType,
          eventId: message.eventId,
          attempt,
        });

        // Send message to Kafka
        await this.producer.send({
          topic,
          messages: [kafkaMessage],
          timeout: 30000,
          compression: 1,
        });

        // Success logging
        this.appLogger.log('Event published to Kafka', {
          topic,
          eventType: message.eventType,
          eventId: message.eventId,
          size: Buffer.byteLength(kafkaMessage.value),
        });

        return; // Success - exit
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Kafka emit attempt ${attempt}/${maxRetries} failed`,
          (error as any).message
        );

        // Wait before retry (exponential backoff: 100ms, 200ms, 400ms)
        if (attempt < maxRetries) {
          await this.sleep(100 * Math.pow(2, attempt - 1));
        }
      }
    }

    // All retries failed
    this.logger.error(
      `Failed to emit event to topic '${topic}' after ${maxRetries} attempts`,
      lastError?.stack || 'Unknown error'
    );

    this.appLogger.error('Event emission failed after retries', undefined, {
      topic,
      eventType: message.eventType,
      eventId: message.eventId,
      retries: maxRetries,
      error: lastError?.message,
    });

    // In production, we might want to throw, but for now we log and continue
    // This prevents event emission from blocking business logic
  }

  /**
   * Emit to multiple topics in parallel
   */
  async emitToMultiple(topics: string[], message: Record<string, any>): Promise<void> {
    const promises = topics.map((topic) =>
      this.emit(topic, message).catch((error) => {
        this.logger.error(`Failed to emit to topic ${topic}`, error.stack);
      })
    );

    await Promise.all(promises);
  }

  /**
   * Health check for Kafka connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      // Try to admin operations to verify connection
      const admin = this.kafka.admin();
      await admin.connect();
      await admin.disconnect();
      return true;
    } catch (error) {
      this.logger.error('Kafka health check failed', (error as any).stack);
      return false;
    }
  }

  /**
   * Get producer status
   */
  getStatus(): { connected: boolean; brokers: string[] } {
    return {
      connected: this.isConnected,
      brokers: (process.env.KAFKA_BROKERS || 'kafka:29092').split(','),
    };
  }

  /**
   * Helper: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
