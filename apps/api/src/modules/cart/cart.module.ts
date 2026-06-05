import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { KafkaService } from '../../kafka/kafka.service';
import { LoggerService } from '../../common/logger.service';
import { PrismaService } from '../../services/prisma.service';
import { RedisService } from '../../services/redis.service';

@Module({
  controllers: [CartController],
  providers: [CartService, KafkaService, LoggerService, PrismaService, RedisService],
  exports: [CartService, KafkaService, LoggerService, PrismaService, RedisService],
})
export class CartModule {}
