/**
 * AI Chat Controller - NestJS
 * REST API for AI-powered shopping assistant
 */

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Logger,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AIChatService } from './ai-chat.service';
import { LoggerService } from '../../common/logger.service';

@Controller('ai/chat')
export class AIChatController {
  private readonly logger = new Logger('AIChatController');
  private readonly appLogger = new LoggerService();

  constructor(private chatService: AIChatService) {}

  /**
   * POST /ai/chat
   * Send message to AI and get response
   */
  @Post()
  async chat(
    @Body()
    body: {
      userId: number;
      message: string;
    }
  ) {
    try {
      if (!body.userId || !body.message) {
        throw new BadRequestException('userId and message are required');
      }

      if (body.message.trim().length < 2) {
        throw new BadRequestException('Message must be at least 2 characters');
      }

      if (body.message.length > 1000) {
        throw new BadRequestException('Message must not exceed 1000 characters');
      }

      const response = await this.chatService.chat({
        userId: body.userId,
        message: body.message.trim(),
      });

      return response;
    } catch (error) {
      this.logger.error('Error in chat endpoint:', (error as any).message);

      if (error instanceof BadRequestException) {
        throw error;
      }

      return {
        success: false,
        error: 'Failed to process your message. Please try again.',
      };
    }
  }

  /**
   * GET /ai/chat/history/:userId
   * Get chat history for user
   */
  @Get('history/:userId')
  async getChatHistory(@Param('userId') userId: string, @Query('limit') limit: string = '50') {
    try {
      const userIdNum = parseInt(userId, 10);
      if (isNaN(userIdNum)) {
        throw new BadRequestException('Invalid userId');
      }

      const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
      const history = await this.chatService.getChatHistory(userIdNum, limitNum);

      this.appLogger.debug('Chat history retrieved', {
        userId: userIdNum,
        count: history.length,
      });

      return {
        success: true,
        data: history,
        count: history.length,
      };
    } catch (error) {
      this.logger.error('Error fetching history:', (error as any).message);
      return {
        success: false,
        error: 'Failed to fetch chat history',
      };
    }
  }

  /**
   * DELETE /ai/chat/history/:userId
   * Clear chat history for user
   */
  @Delete('history/:userId')
  async clearChatHistory(@Param('userId') userId: string) {
    try {
      const userIdNum = parseInt(userId, 10);
      if (isNaN(userIdNum)) {
        throw new BadRequestException('Invalid userId');
      }

      const success = await this.chatService.clearChatHistory(userIdNum);

      this.appLogger.log('Chat history cleared', {
        userId: userIdNum,
        success,
      });

      return {
        success,
        message: success ? 'Chat history cleared' : 'Failed to clear history',
      };
    } catch (error) {
      this.logger.error('Error clearing history:', (error as any).message);
      return {
        success: false,
        error: 'Failed to clear chat history',
      };
    }
  }

  /**
   * GET /ai/chat/suggestions/:userId
   * Get suggested questions for user
   */
  @Get('suggestions/:userId')
  async getSuggestedQuestions(@Param('userId') userId: string) {
    try {
      const userIdNum = parseInt(userId, 10);
      if (isNaN(userIdNum)) {
        throw new BadRequestException('Invalid userId');
      }

      const suggestions = await this.chatService.getSuggestedQuestions(userIdNum);

      return {
        success: true,
        data: suggestions,
      };
    } catch (error) {
      this.logger.error('Error getting suggestions:', (error as any).message);
      return {
        success: false,
        error: 'Failed to get suggestions',
      };
    }
  }

  /**
   * GET /ai/chat/health
   * Check AI service health
   */
  @Get('health')
  async getHealth() {
    try {
      const isHealthy = await this.chatService.getAIServiceHealth();

      return {
        success: isHealthy,
        status: isHealthy ? 'healthy' : 'unhealthy',
        service: 'AI Chat Service',
      };
    } catch (error) {
      this.logger.error('Health check error:', (error as any).message);
      return {
        success: false,
        status: 'unhealthy',
        error: 'AI service is unavailable',
      };
    }
  }
}
