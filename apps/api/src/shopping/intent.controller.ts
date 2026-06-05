/**
 * Intent Analysis Controller
 * Handles user intent parsing and clarifying questions
 * Integrates with Intent Parser microservice
 */

import {
  Controller,
  Post,
  Body,
  Param,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

interface IntentAnalysisRequest {
  userId: string;
  text: string;
  context?: Record<string, any>;
}

interface IntentAnalysisResponse {
  userId: string;
  intent: {
    user_intent: string;
    confidence: number;
    budget?: { min: number; max: number };
    preferences?: string[];
    clarifying_questions: string[];
  };
  questions: Array<{
    id: string;
    question: string;
    type: 'multiple_choice' | 'open_ended' | 'range' | 'boolean';
    options?: string[];
    category?: 'budget' | 'brand' | 'features' | 'delivery' | 'quality';
    required?: boolean;
  }>;
}

interface AnswerQuestionRequest {
  questionId: string;
  answer: string | number | boolean;
}

interface AnswerQuestionResponse {
  questionId: string;
  success: boolean;
  updatedIntent?: Record<string, any>;
  nextQuestion?: {
    id: string;
    question: string;
    type: string;
  };
}

const logger = new Logger('IntentAnalysisController');

@Controller('api/intent')
export class IntentAnalysisController {
  constructor() {
    // Inject Intent Parser Service
    // private intentParserService: IntentParserService,
  }

  /**
   * POST /api/intent/analyze
   * Analyze user text to extract shopping intent
   * Returns intent details + clarifying questions
   *
   * Request Body:
   * {
   *   userId: string,
   *   text: string,
   *   context?: { budget_range?: string, prefer_brands?: string[] }
   * }
   *
   * Response:
   * {
   *   intent: { user_intent, confidence, budget, preferences, questions },
   *   questions: [{ id, question, type, options?, category?, required? }]
   * }
   */
  @Post('analyze')
  async analyzeIntent(@Body() payload: IntentAnalysisRequest): Promise<IntentAnalysisResponse> {
    try {
      // Validate payload
      if (!payload.userId || !payload.text) {
        throw new BadRequestException('userId and text are required');
      }

      logger.log(`Analyzing intent for user ${payload.userId}: "${payload.text}"`);

      // TODO: Replace with actual Intent Parser Service call
      // const intendResult = await this.intentParserService.analyze({
      //   query: payload.text,
      //   context: payload.context
      // });

      // Mock implementation
      const analysis = await this.mockAnalyzeIntent(payload.text, payload.context);

      return {
        userId: payload.userId,
        intent: analysis.intent,
        questions: analysis.questions as any,
      };
    } catch (error) {
      logger.error('Intent analysis failed:', error);
      throw new InternalServerErrorException('Failed to analyze intent');
    }
  }

  /**
   * POST /api/intent/answer-question
   * Process user's answer to clarifying question
   * May trigger follow-up questions or finalize intent
   *
   * Request Body:
   * {
   *   questionId: string,
   *   answer: string | number | boolean
   * }
   *
   * Response:
   * {
   *   success: boolean,
   *   updatedIntent?: { budget, preferences, ... },
   *   nextQuestion?: { id, question, type }
   * }
   */
  @Post('answer-question')
  async answerQuestion(@Body() payload: AnswerQuestionRequest): Promise<AnswerQuestionResponse> {
    try {
      // Validate payload
      if (!payload.questionId || payload.answer === undefined || payload.answer === null) {
        throw new BadRequestException('questionId and answer are required');
      }

      logger.log(`Answer received for question ${payload.questionId}: ${payload.answer}`);

      // TODO: Replace with actual Intent Parser Service call
      // const updateResult = await this.intentParserService.answerQuestion({
      //   questionId: payload.questionId,
      //   answer: payload.answer
      // });

      // Mock implementation
      const result = await this.mockAnswerQuestion(payload.questionId, payload.answer);

      return {
        questionId: payload.questionId,
        success: true,
        updatedIntent: result.updatedIntent,
        nextQuestion: result.nextQuestion,
      };
    } catch (error) {
      logger.error('Question answer processing failed:', error);
      throw new InternalServerErrorException('Failed to process answer');
    }
  }

  // =========================================================================
  // Mock implementations - replace with actual microservice calls
  // =========================================================================

  private async mockAnalyzeIntent(text: string, context?: Record<string, any>) {
    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 200));

    const textLower = text.toLowerCase();
    let category = 'electronics';
    let budget = { min: 5000, max: 50000 };
    const preferredBrands = [];

    // Simple keyword matching
    if (textLower.includes('phone') || textLower.includes('smartphone')) {
      category = 'phones';
      budget = { min: 10000, max: 100000 };
      if (textLower.includes('iphone')) preferredBrands.push('Apple');
      if (textLower.includes('samsung')) preferredBrands.push('Samsung');
    } else if (textLower.includes('laptop')) {
      category = 'laptops';
      budget = { min: 30000, max: 200000 };
    } else if (textLower.includes('cheap')) {
      budget = { min: 100, max: 10000 };
    } else if (textLower.includes('premium') || textLower.includes('luxury')) {
      budget = { min: 50000, max: 500000 };
    }

    return {
      intent: {
        user_intent: text,
        confidence: 0.82,
        budget,
        preferences: preferredBrands,
        clarifying_questions: [
          'budget',
          'brand_preference',
          'features_required',
          'delivery_urgency',
        ],
      },
      questions: [
        {
          id: 'q1-budget',
          question: 'What is your budget range?',
          type: 'range' as const,
          category: 'budget',
          required: true,
        },
        {
          id: 'q2-brand',
          question: 'Do you have any preferred brands?',
          type: 'multiple_choice' as const,
          options: ['Apple', 'Samsung', 'Sony', 'LG', 'No preference'],
          category: 'brand',
          required: false,
        },
        {
          id: 'q3-delivery',
          question: 'How soon do you need this?',
          type: 'multiple_choice' as const,
          options: ['Same day', '1-2 days', '3-7 days', 'No hurry'],
          category: 'delivery',
          required: false,
        },
      ],
    };
  }

  private async mockAnswerQuestion(questionId: string, answer: string | number | boolean) {
    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 100));

    const answerText = String(answer);
    let updatedIntent = {};
    let nextQuestion = null;

    // Map answers to intent updates
    if (questionId === 'q1-budget' && typeof answer === 'number') {
      updatedIntent = { budget_max: answer };
    } else if (questionId === 'q2-brand') {
      updatedIntent = { preferred_brand: answerText };
    } else if (questionId === 'q3-delivery') {
      updatedIntent = { delivery_preference: answerText };
    }

    // Optionally provide next question
    if (questionId === 'q1-budget') {
      nextQuestion = {
        id: 'q2-brand',
        question: 'Do you have any preferred brands?',
        type: 'multiple_choice',
      };
    }

    return {
      updatedIntent,
      nextQuestion,
    };
  }
}
