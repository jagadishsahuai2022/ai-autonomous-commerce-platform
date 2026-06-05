import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { CartModule } from '../cart/cart.module';
import { KafkaService } from '../../kafka/kafka.service';
import { LoggerService } from '../../common/logger.service';
import { PrismaService } from '../../services/prisma.service';
import { RedisService } from '../../services/redis.service';

@Module({
  imports: [CartModule],
  controllers: [OrderController],
  providers: [OrderService, KafkaService, LoggerService, PrismaService, RedisService],
  exports: [OrderService, KafkaService, LoggerService, PrismaService, RedisService],
})
export class OrderModule {}
