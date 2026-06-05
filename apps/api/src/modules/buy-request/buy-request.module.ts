/**
 * Buy Request Module
 * Encapsulates buy request functionality
 */

import { Module } from '@nestjs/common';
import { BuyRequestController } from './buy-request.controller';
import { BuyRequestService } from './buy-request.service';
import { PrismaService } from '../../services/prisma.service';
import { RedisService } from '../../services/redis.service';
import { KafkaService } from '../../kafka/kafka.service';
import { LoggerService } from '../../common/logger.service';

@Module({
  controllers: [BuyRequestController],
  providers: [BuyRequestService, PrismaService, RedisService, KafkaService, LoggerService],
  exports: [BuyRequestService],
})
export class BuyRequestModule {}
