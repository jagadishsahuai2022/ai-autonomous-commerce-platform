/**
 * AI Execution Agent Module
 * Orchestrates product selection, wallet validation, and autonomous order placement
 */

import { Module } from '@nestjs/common';
import { AiExecutionAgentService } from './ai-execution-agent.service';
import { AiExecutionAgentController } from './ai-execution-agent.controller';
import { WalletModule } from '../wallet/wallet.module';
import { ShoppingAssistantModule } from '../../shopping/shopping-assistant.module';

@Module({
  imports: [WalletModule, ShoppingAssistantModule],
  controllers: [AiExecutionAgentController],
  providers: [AiExecutionAgentService],
  exports: [AiExecutionAgentService],
})
export class AiExecutionModule {}
