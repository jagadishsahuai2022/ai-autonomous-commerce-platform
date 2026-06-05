/**
 * Shopping Chat Controller
 * Handles chat messages and streaming responses
 * Integrates with Intent Parser and Product Ranking services
 */

import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Res,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { RpcException } from '@nestjs/microservices';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  type?: 'text' | 'product_recommendation' | 'clarifying_question';
  metadata?: Record<string, any>;
}

interface ChatMessageRequest {
  userId: string;
  sessionId?: string;
  message: string;
  conversationHistory?: ChatMessage[];
}

interface ChatMessageResponse {
  id: string;
  message: string;
  timestamp: string;
  action: 'respond' | 'ask_question' | 'show_recommendations' | 'refine' | 'complete';
  products?: any[];
  questions?: any[];
}

@Controller('api/chat')
export class ShoppingChatController {
  constructor() // Inject services as needed
  // private intentService: IntentAnalysisService,
  // private productService: ProductService,
  // private rankingService: RankingService,
  {}

  /**
   * POST /api/chat/message
   * Handle user message and return streamed response
   *
   * Request Body:
   * {
   *   userId: string,
   *   sessionId?: string,
   *   message: string,
   *   conversationHistory?: ChatMessage[]
   * }
   *
   * Response: Server-Sent Events (SSE) stream
   * - Returns streamed message chunks
   * - Includes products, questions, or just text
   */
  @Post('message')
  async sendMessage(@Body() payload: ChatMessageRequest, @Res() response: FastifyReply): Promise<void> {
    try {
      // Validate payload
      if (!payload.userId || !payload.message) {
        throw new BadRequestException('userId and message are required');
      }

      // Set headers for streaming via raw Node.js response
      const raw = response.raw;
      raw.setHeader('Content-Type', 'text/event-stream');
      raw.setHeader('Cache-Control', 'no-cache');
      raw.setHeader('Connection', 'keep-alive');
      raw.setHeader('Access-Control-Allow-Origin', '*');

      // Start event stream
      const sendEvent = (data: any) => {
        raw.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Mock implementation - replace with actual service calls
      const chatResponse = await this.handleChatMessage(
        payload.userId,
        payload.message,
        payload.conversationHistory || []
      );

      // Stream the response in chunks
      for (const chunk of chatResponse.chunks) {
        // Simulate streaming delay
        await new Promise((resolve) => setTimeout(resolve, 50));

        sendEvent({
          type: 'message_chunk',
          data: chunk,
          timestamp: new Date().toISOString(),
        });
      }

      // Send metadata (products, questions) if present
      if (chatResponse.products && chatResponse.products.length > 0) {
        sendEvent({
          type: 'products',
          data: chatResponse.products,
        });
      }

      if (chatResponse.questions && chatResponse.questions.length > 0) {
        sendEvent({
          type: 'questions',
          data: chatResponse.questions,
        });
      }

      // Send completion marker
      sendEvent({
        type: 'complete',
        data: {
          id: chatResponse.id,
          message: chatResponse.message,
          action: chatResponse.action,
        },
      });

      response.raw.end();
    } catch (error) {
      response.raw.write(
        `data: ${JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })}\n\n`
      );
      response.raw.end();
    }
  }

  /**
   * Mock implementation of chat message handling
   * Replace with actual service calls to:
   * 1. Intent Parser Service
   * 2. Product Aggregator
   * 3. Ranking Engine
   */
  private async handleChatMessage(userId: string, message: string, history: ChatMessage[]) {
    // TODO: Implement actual logic
    // 1. Call Intent Parser Service: POST /analyze with { text: message }
    // 2. Based on intent, call Product Aggregator to search products
    // 3. Stream back chunked response
    // 4. Return products + clarifying questions

    return {
      id: `msg-${Date.now()}`,
      message: `Echo: ${message}`,
      action: 'respond' as const,
      chunks: [
        `I understand you're looking for `,
        `products with specific criteria. `,
        `Let me search the best options for you...`,
      ],
      products: [],
      questions: [],
    };
  }
}
