/**
 * Wallet Module
 * Integrates wallet service, controller, and dependencies
 */

import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { PrismaService } from '../../services/prisma.service';
import { KafkaService } from '../../kafka/kafka.service';

@Module({
  providers: [WalletService, PrismaService, KafkaService],
  controllers: [WalletController],
  exports: [WalletService],
})
export class WalletModule {}
