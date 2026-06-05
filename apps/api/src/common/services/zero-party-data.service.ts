/*
 * Zero-party Data System
 * Allows users to explicitly share preferences through interactive quiz
 * Feeds preferences into ranking engine for personalization
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { MetricsService } from './metrics.service';
import { StructuredLoggerService } from './structured-logger.service';

export interface PreferenceQuiz {
  id: string;
  userId: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  answers: QuizAnswer[];
  completedAt?: Date;
  createdAt: Date;
}

export interface QuizAnswer {
  questionId: string;
  question: string;
  category: string;
  answer: string;
  value?: number;
}

export interface UserPreferences {
  userId: string;
  budgetSensitivity: 'high' | 'medium' | 'low'; // Price consciousness
  qualityPreference: 'high' | 'medium' | 'low'; // Quality vs price tradeoff
  preferredCategories: string[]; // What user cares about
  preferredBrands: string[];
  avoidedBrands: string[];
  maxPricePerItem: number;
  expectedValue: 'premium' | 'mid' | 'budget'; // Overall expectation
  shoppingStyle: 'quick' | 'research' | 'balanced';
  sustainabilityImportance: 'high' | 'medium' | 'low';
  brandLoyalty: 'high' | 'medium' | 'low';
  riskTolerance: 'high' | 'medium' | 'low'; // Willingness to try new products
  deliverySpeed: 'critical' | 'important' | 'flexible';
  autoDecisionEnabled: boolean;
  autoDecisionLimit: number;
  quizVersion: number;
  lastUpdatedAt: Date;
}

@Injectable()
export class ZeroPartyDataService {
  private logger = new Logger(ZeroPartyDataService.name);

  private quizQuestions = [
    {
      id: 'q1',
      category: 'budgetSensitivity',
      question: 'How important is price when making a purchase?',
      options: [
        { label: 'Very important - price is critical', value: 'high' },
        { label: 'Somewhat important - balance of price and quality', value: 'medium' },
        { label: 'Not very important - quality matters more', value: 'low' },
      ],
    },
    {
      id: 'q2',
      category: 'qualityPreference',
      question: 'Do you prefer premium products or value-for-money options?',
      options: [
        { label: 'Premium quality - worth the extra cost', value: 'high' },
        { label: 'Good balance - mid-range is perfect', value: 'medium' },
        { label: 'Value-focused - budget-friendly options preferred', value: 'low' },
      ],
    },
    {
      id: 'q3',
      category: 'preferredCategories',
      question: 'Which product categories interest you most? (Select all)',
      options: [
        { label: 'Electronics & Gadgets' },
        { label: 'Fashion & Apparel' },
        { label: 'Home & Kitchen' },
        { label: 'Groceries & Food' },
        { label: 'Sports & Fitness' },
        { label: 'Books & Entertainment' },
      ],
    },
    {
      id: 'q4',
      category: 'maxPricePerItem',
      question: "What's your typical max price for a single item?",
      options: [
        { label: '₹0 - ₹5,000', value: 5000 },
        { label: '₹5,000 - ₹15,000', value: 15000 },
        { label: '₹15,000 - ₹50,000', value: 50000 },
        { label: '₹50,000+', value: 100000 },
      ],
    },
    {
      id: 'q5',
      category: 'expectedValue',
      question: 'When shopping online, what value are you seeking?',
      options: [
        { label: 'Best-in-class products - no compromise on quality', value: 'premium' },
        { label: 'Solid reliable products at reasonable prices', value: 'mid' },
        { label: 'Maximum savings - lowest price wins', value: 'budget' },
      ],
    },
    {
      id: 'q6',
      category: 'shoppingStyle',
      question: 'How do you typically approach shopping?',
      options: [
        { label: 'Quick decisions - I know what I want', value: 'quick' },
        { label: 'Careful research - I compare thoroughly', value: 'research' },
        { label: 'Balanced - some research, then decide', value: 'balanced' },
      ],
    },
    {
      id: 'q7',
      category: 'sustainabilityImportance',
      question: 'How important are eco-friendly/sustainable products?',
      options: [
        { label: 'Very important - sustainability is key', value: 'high' },
        { label: 'Somewhat important - consider where feasible', value: 'medium' },
        { label: 'Not important - price/quality takes priority', value: 'low' },
      ],
    },
    {
      id: 'q8',
      category: 'deliverySpeed',
      question: 'How important is fast delivery?',
      options: [
        { label: 'Critical - I need it ASAP', value: 'critical' },
        { label: 'Important - within 2-3 days ideally', value: 'important' },
        { label: 'Flexible - standard delivery is fine', value: 'flexible' },
      ],
    },
    {
      id: 'q9',
      category: 'autoDecisionEnabled',
      question: 'Would you like AI to auto-purchase recommendations up to a certain amount?',
      options: [
        { label: 'Yes, auto-purchase recommendations (faster shopping)', value: true },
        { label: 'No, always ask me first (more control)', value: false },
      ],
    },
    {
      id: 'q10',
      category: 'riskTolerance',
      question: 'How willing are you to try lesser-known brands?',
      options: [
        { label: 'Very open - new brands are exciting', value: 'high' },
        { label: "Somewhat - if they're good value", value: 'medium' },
        { label: 'Prefer known brands - predictable quality', value: 'low' },
      ],
    },
  ];

  constructor(
    private prisma: PrismaService,
    private metrics: MetricsService,
    private logger$: StructuredLoggerService
  ) {}

  /**
   * Initialize preference quiz for user
   */
  async startQuiz(userId: string): Promise<PreferenceQuiz> {
    try {
      const quiz = await this.prisma.preferenceQuiz.create({
        data: {
          userId: parseInt(userId, 10),
          status: 'in_progress',
          answers: JSON.stringify([]),
        },
      });

      this.logger$.logBusinessEvent('preference_quiz_started', {
        userId,
        quizId: quiz.id,
      });

      return {
        id: quiz.id,
        userId,
        status: 'in_progress',
        answers: [],
        createdAt: quiz.createdAt,
      };
    } catch (error) {
      this.logger.error(`Failed to start quiz: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get quiz questions
   */
  getQuizQuestions(): any[] {
    return this.quizQuestions;
  }

  /**
   * Submit quiz answer
   */
  async submitAnswer(
    quizId: string,
    userId: string,
    questionId: string,
    answer: string | string[]
  ): Promise<PreferenceQuiz> {
    try {
      const quiz = await this.prisma.preferenceQuiz.findUnique({
        where: { id: quizId },
      });

      if (!quiz || quiz.userId !== parseInt(userId, 10)) {
        throw new Error('Quiz not found');
      }

      const answers = JSON.parse(quiz.answers as string) || [];
      const question = this.quizQuestions.find((q) => q.id === questionId);

      if (!question) {
        throw new Error('Question not found');
      }

      // Add or update answer
      const existingIndex = answers.findIndex((a: any) => a.questionId === questionId);
      const quizAnswer = {
        questionId,
        question: question.question,
        category: question.category,
        answer,
      };

      if (existingIndex >= 0) {
        answers[existingIndex] = quizAnswer;
      } else {
        answers.push(quizAnswer);
      }

      // Update quiz
      const updated = await this.prisma.preferenceQuiz.update({
        where: { id: quizId },
        data: {
          answers: JSON.stringify(answers),
        },
      });

      return {
        id: updated.id,
        userId: String(updated.userId),
        status: updated.status as 'in_progress' | 'completed' | 'abandoned',
        answers,
        createdAt: updated.createdAt,
      };
    } catch (error) {
      this.logger.error(`Failed to submit answer: ${error.message}`);
      throw error;
    }
  }

  /**
   * Complete quiz and store preferences
   */
  async completeQuiz(quizId: string, userId: string): Promise<UserPreferences> {
    try {
      const quiz = await this.prisma.preferenceQuiz.findUnique({
        where: { id: quizId },
      });

      if (!quiz || quiz.userId !== parseInt(userId, 10)) {
        throw new Error('Quiz not found');
      }

      const answers: QuizAnswer[] = JSON.parse(quiz.answers as string);
      const preferences = this.parseQuizAnswersToPreferences(userId, answers);

      // Update or create preferences
      const stored = await this.prisma.userPreferences.upsert({
        where: { userId: parseInt(userId, 10) },
        update: {
          budgetSensitivity: preferences.budgetSensitivity,
          qualityPreference: preferences.qualityPreference,
          preferredCategories: preferences.preferredCategories,
          preferredBrands: preferences.preferredBrands,
          maxPricePerItem: preferences.maxPricePerItem,
          expectedValue: preferences.expectedValue,
          shoppingStyle: preferences.shoppingStyle,
          sustainabilityImportance: preferences.sustainabilityImportance,
          deliverySpeed: preferences.deliverySpeed,
        } as any,
        create: {
          userId: parseInt(userId, 10),
          budgetSensitivity: preferences.budgetSensitivity,
          qualityPreference: preferences.qualityPreference,
          preferredCategories: preferences.preferredCategories,
          preferredBrands: preferences.preferredBrands,
          maxPricePerItem: preferences.maxPricePerItem,
          expectedValue: preferences.expectedValue,
          shoppingStyle: preferences.shoppingStyle,
          sustainabilityImportance: preferences.sustainabilityImportance,
          deliverySpeed: preferences.deliverySpeed,
        } as any,
      });

      // Mark quiz as completed
      await this.prisma.preferenceQuiz.update({
        where: { id: quizId },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });

      this.logger$.logBusinessEvent('preference_quiz_completed', {
        userId,
        quizId,
        preferences: {
          budgetSensitivity: preferences.budgetSensitivity,
          qualityPreference: preferences.qualityPreference,
          autoDecisionEnabled: preferences.autoDecisionEnabled,
        },
      });

      this.metrics.recordCounterMetric('preference_quizzes_completed', 1);

      return this.mapStoredPreferences(stored);
    } catch (error) {
      this.logger.error(`Failed to complete quiz: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user preferences (or default if not set)
   */
  async getUserPreferences(userId: string): Promise<UserPreferences> {
    try {
      const stored = await this.prisma.userPreferences.findUnique({
        where: { userId: parseInt(userId, 10) },
      });

      if (!stored) {
        // Return default preferences
        return this.getDefaultPreferences(userId);
      }

      return this.mapStoredPreferences(stored);
    } catch (error) {
      this.logger.error(`Failed to get preferences: ${error.message}`);
      return this.getDefaultPreferences(userId);
    }
  }

  /**
   * Update specific preferences
   */
  async updatePreferences(
    userId: string,
    updates: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    try {
      const stored = await this.prisma.userPreferences.upsert({
        where: { userId: parseInt(userId, 10) },
        update: {
          preferredCategories: updates.preferredCategories,
          preferredBrands: updates.preferredBrands,
          avoidedBrands: updates.avoidedBrands,
          budgetSensitivity: updates.budgetSensitivity,
          qualityPreference: updates.qualityPreference,
          maxPricePerItem: updates.maxPricePerItem,
          expectedValue: updates.expectedValue,
          shoppingStyle: updates.shoppingStyle,
          sustainabilityImportance: updates.sustainabilityImportance,
          deliverySpeed: updates.deliverySpeed,
        } as any,
        create: {
          userId: parseInt(userId, 10),
          budgetSensitivity: updates.budgetSensitivity || 'medium',
          qualityPreference: updates.qualityPreference || 'medium',
          preferredCategories: updates.preferredCategories || [],
          preferredBrands: updates.preferredBrands || [],
          avoidedBrands: updates.avoidedBrands || [],
          maxPricePerItem: updates.maxPricePerItem || 50000,
          expectedValue: updates.expectedValue || 'mid',
          shoppingStyle: updates.shoppingStyle || 'balanced',
          sustainabilityImportance: updates.sustainabilityImportance || 'low',
          deliverySpeed: updates.deliverySpeed || 'important',
        } as any,
      });

      return this.mapStoredPreferences(stored);
    } catch (error) {
      this.logger.error(`Failed to update preferences: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse quiz answers into structured preferences
   */
  private parseQuizAnswersToPreferences(userId: string, answers: QuizAnswer[]): UserPreferences {
    const answerMap = new Map(answers.map((a) => [a.category, a.answer]));

    return {
      userId,
      budgetSensitivity: (answerMap.get('budgetSensitivity') as any) || 'medium',
      qualityPreference: (answerMap.get('qualityPreference') as any) || 'medium',
      preferredCategories: Array.isArray(answerMap.get('preferredCategories'))
        ? (answerMap.get('preferredCategories') as unknown as string[])
        : [],
      preferredBrands: [],
      avoidedBrands: [],
      maxPricePerItem: (answerMap.get('maxPricePerItem') as unknown as number) || 50000,
      expectedValue: (answerMap.get('expectedValue') as any) || 'mid',
      shoppingStyle: (answerMap.get('shoppingStyle') as any) || 'balanced',
      sustainabilityImportance: (answerMap.get('sustainabilityImportance') as any) || 'low',
      brandLoyalty: 'medium',
      riskTolerance: (answerMap.get('riskTolerance') as any) || 'medium',
      deliverySpeed: (answerMap.get('deliverySpeed') as any) || 'important',
      autoDecisionEnabled: (answerMap.get('autoDecisionEnabled') as unknown as boolean) || false,
      autoDecisionLimit: (answerMap.get('autoDecisionEnabled') as unknown as boolean) ? 25000 : 0,
      quizVersion: 1,
      lastUpdatedAt: new Date(),
    };
  }

  /**
   * Map stored preferences to object
   */
  private mapStoredPreferences(stored: any): UserPreferences {
    return {
      userId: String(stored.userId),
      budgetSensitivity: stored.budgetSensitivity as any,
      qualityPreference: stored.qualityPreference as any,
      preferredCategories: (stored as any).preferredCategories || [],
      preferredBrands: (stored as any).preferredBrands || [],
      avoidedBrands: (stored as any).avoidedBrands || [],
      maxPricePerItem: (stored as any).maxPricePerItem || 50000,
      expectedValue: (stored as any).expectedValue as any || 'mid',
      shoppingStyle: (stored as any).shoppingStyle as any || 'balanced',
      sustainabilityImportance: (stored as any).sustainabilityImportance as any || 'low',
      brandLoyalty: (stored as any).brandLoyalty || 'medium',
      riskTolerance: (stored as any).riskTolerance || 'medium',
      deliverySpeed: (stored as any).deliverySpeed as any || 'important',
      autoDecisionEnabled: (stored as any).autoDecisionEnabled || false,
      autoDecisionLimit: (stored as any).autoDecisionLimit || 0,
      quizVersion: (stored as any).quizVersion || 1,
      lastUpdatedAt: stored.updatedAt,
    };
  }

  /**
   * Get default preferences for new user
   */
  private getDefaultPreferences(userId: string): UserPreferences {
    return {
      userId,
      budgetSensitivity: 'medium',
      qualityPreference: 'medium',
      preferredCategories: [],
      preferredBrands: [],
      avoidedBrands: [],
      maxPricePerItem: 50000,
      expectedValue: 'mid',
      shoppingStyle: 'balanced',
      sustainabilityImportance: 'low',
      brandLoyalty: 'medium',
      riskTolerance: 'medium',
      deliverySpeed: 'important',
      autoDecisionEnabled: false,
      autoDecisionLimit: 0,
      quizVersion: 1,
      lastUpdatedAt: new Date(),
    };
  }
}
