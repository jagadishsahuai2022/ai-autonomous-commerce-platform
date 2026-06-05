/**
 * Shopping Assistant Module
 * Orchestrates chat, intent analysis, and product ranking
 * Integrates multiple microservices:
 * - Intent Parser Service (port 3002)
 * - Product Aggregator
 * - Ranking Engine (port 3004)
 * - WebSocket Gateway for real-time updates
 */

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ShoppingChatController } from './chat.controller';
import { IntentAnalysisController } from './intent.controller';
import { ShoppingAssistantService } from './shopping-assistant.service';
import { PrismaService } from '../services/prisma.service';

@Module({
  imports: [HttpModule],
  controllers: [ShoppingChatController, IntentAnalysisController],
  providers: [ShoppingAssistantService, PrismaService],
  exports: [ShoppingAssistantService],
})
export class ShoppingAssistantModule {}
