import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from '../../services/prisma.service';
import { LoggerService } from '../../common/logger.service';
import { CoreServicesModule } from '../../common/core-services.module';

@Module({
  imports: [CoreServicesModule],
  controllers: [AuthController],
  providers: [AuthService, PrismaService, LoggerService],
  exports: [AuthService, PrismaService, LoggerService],
})
export class AuthModule {}
