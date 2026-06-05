import { Module } from '@nestjs/common';
import { FeatureFlagController } from './feature-flag.controller';
import { FeatureFlagService } from './feature-flag.service';
import { PrismaService } from '../../services/prisma.service';
import { RedisService } from '../../services/redis.service';

@Module({
  controllers: [FeatureFlagController],
  providers: [FeatureFlagService, PrismaService, RedisService],
  exports: [FeatureFlagService],
})
export class FeatureFlagModule {}
