import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { PrismaService } from '../../services/prisma.service';
import { RedisService } from '../../services/redis.service';
import { LoggerService } from '../../common/logger.service';
import { KafkaService } from '../../kafka/kafka.service';

@Module({
  controllers: [ProductController],
  providers: [ProductService, PrismaService, RedisService, LoggerService, KafkaService],
  exports: [ProductService, PrismaService, RedisService, LoggerService, KafkaService],
})
export class ProductModule {}
