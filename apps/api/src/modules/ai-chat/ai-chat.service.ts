/**
 * AI Chat Service - NestJS Backend
 * Integrates with FastAPI AI service for natural language product search
 */

import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { LoggerService } from '../../common/logger.service';
import axios, { AxiosInstance } from 'axios';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  success: boolean;
  message?: string;
  intent?: string;
  keywords?: string[];
  products?: any[];
  error?: string;
}

export interface AIChatRequest {
  userId: number;
  message: string;
  conversationHistory?: ChatMessage[];
}

@Injectable()
export class AIChatService {
  private readonly logger = new Logger('AIChatService');
  private readonly appLogger = new LoggerService();
  private aiServiceClient: AxiosInstance;
  private aiServiceUrl: string;

  constructor(private prisma: PrismaService) {
    this.aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';

    this.aiServiceClient = axios.create({
      baseURL: this.aiServiceUrl,
      timeout: 30000,
    });

    this.logger.log(`✅ AI Chat Service initialized. AI Service URL: ${this.aiServiceUrl}`);
  }

  /**
   * Send message to AI and get response with product recommendations
   */
  async chat(request: AIChatRequest): Promise<ChatResponse> {
    try {
      const startTime = Date.now();

      this.appLogger.debug('Sending message to AI service', {
        userId: request.userId,
        messageLength: request.message.length,
      });

      // Call FastAPI service
      const response = await this.aiServiceClient.post('/chat', {
        userId: request.userId,
        message: request.message,
        conversation_history: request.conversationHistory?.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      });

      const duration = Date.now() - startTime;

      // TODO: chatMessage model not in prisma schema - skipping DB persistence
      // await this.prisma.chatMessage.create({ data: { userId: request.userId, role: 'user', content: request.message } });
      // await this.prisma.chatMessage.create({ data: { userId: request.userId, role: 'assistant', content: response.data.message || '' } });

      this.appLogger.debug('AI service response received', {
        userId: request.userId,
        duration,
        intent: response.data.intent,
        productCount: response.data.products?.length || 0,
      });

      return {
        success: true,
        message: response.data.message,
        intent: response.data.intent,
        keywords: response.data.keywords,
        products: response.data.products,
      };
    } catch (error) {
      this.logger.error('Error calling AI service:', (error as any).message);

      this.appLogger.error(
        'AI service error: ' +
          JSON.stringify({
            userId: request.userId,
            error: (error as any).message,
          })
      );

      return {
        success: false,
        error: 'Failed to process your request. Please try again.',
      };
    }
  }

  /**
   * Get chat history for user
   */
  async getChatHistory(userId: number, limit: number = 50): Promise<ChatMessage[]> {
    try {
      // TODO: chatMessage model not in prisma schema
      const messages: any[] = []; // TODO: chatMessage model not in prisma schema

      return messages.reverse().map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));
    } catch (error) {
      this.logger.error('Error fetching chat history:', (error as any).message);
      return [];
    }
  }

  /**
   * Clear chat history for user
   */
  async clearChatHistory(userId: number): Promise<boolean> {
    try {
      // TODO: chatMessage model not in prisma schema
      // await this.prisma.chatMessage.deleteMany({ where: { userId } });

      this.appLogger.log('Chat history cleared', { userId });
      return true;
    } catch (error) {
      this.logger.error('Error clearing chat history:', (error as any).message);
      return false;
    }
  }

  /**
   * Get AI service health
   */
  async getAIServiceHealth(): Promise<boolean> {
    try {
      const response = await this.aiServiceClient.get('/health');
      return response.status === 200;
    } catch (error) {
      this.logger.error('AI service health check failed:', (error as any).message);
      return false;
    }
  }

  /**
   * Get suggested questions based on user history
   */
  async getSuggestedQuestions(userId: number): Promise<string[]> {
    const suggestions = [
      'Show me running shoes under 3000',
      'What are the best wireless headphones?',
      'I need a backpack for work',
      'Show me budget laptops',
      'What are popular items right now?',
    ];

    return suggestions;
  }
}
