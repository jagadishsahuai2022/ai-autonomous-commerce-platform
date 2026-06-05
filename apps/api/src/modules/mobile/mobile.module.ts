import { Module } from '@nestjs/common';
import { MobileController } from './mobile.controller';
import { CartModule } from '../cart/cart.module';
import { PrismaService } from '../../services/prisma.service';
import { RedisService } from '../../services/redis.service';
import { LoggerService } from '../../common/logger.service';

@Module({
  imports: [CartModule],
  controllers: [MobileController],
  providers: [PrismaService, RedisService, LoggerService],
})
export class MobileModule {}
