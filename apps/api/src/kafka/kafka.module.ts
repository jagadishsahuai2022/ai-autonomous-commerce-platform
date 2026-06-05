import { Module } from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { LoggerService } from '../common/logger.service';

/**
 * KafkaModule - Global module for event-driven architecture
 * Provides Kafka producer as a singleton service
 */
@Module({
  providers: [KafkaService, LoggerService],
  exports: [KafkaService],
})
export class KafkaModule {}
