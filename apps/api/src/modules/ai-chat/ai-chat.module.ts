/**
 * AI Chat Module
 * Encapsulates AI chat functionality
 */

import { Module } from '@nestjs/common';
import { AIChatService } from './ai-chat.service';
import { AIChatController } from './ai-chat.controller';
import { PrismaService } from '../../services/prisma.service';
import { RedisService } from '../../services/redis.service';
import { KafkaService } from '../../kafka/kafka.service';

@Module({
  controllers: [AIChatController],
  providers: [AIChatService, PrismaService, RedisService, KafkaService],
  exports: [AIChatService], // Export so other modules can use it
})
export class AIChatModule {}
