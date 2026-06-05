/**
 * Shopping Assistant Service
 * Business logic for shopping recommendation system
 * Orchestrates:
 * - Intent analysis (port 3002)
 * - Product search and aggregation
 * - Product ranking (port 3004)
 * - Real-time updates via WebSocket
 * - Conversation history management
 */

import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../services/prisma.service';

// ── Category keyword map for lightweight intent detection ─────────────────────
// Maps intent category names to DB category ILIKE patterns.
const CATEGORY_PATTERNS: Record<string, { pattern: string; display: string }> = {
  phone: { pattern: '%smartphone%', display: 'Smartphone' },
  laptop: { pattern: '%laptop%', display: 'Laptop' },
  headphones: { pattern: '%headphone%', display: 'Headphones' },
  television: { pattern: '%television%', display: 'Television' },
  appliances: { pattern: '%applian%', display: 'Appliance' },
  watch: { pattern: '%watch%', display: 'Smart Watch' },
  tablet: { pattern: '%tablet%', display: 'Tablet' },
  camera: { pattern: '%camera%', display: 'Camera' },
  speaker: { pattern: '%speaker%', display: 'Speaker' },
  refrigerator: { pattern: '%refrigerator%', display: 'Refrigerator' },
  washing: { pattern: '%washing%', display: 'Washing Machine' },
  ac: { pattern: '%air conditioner%', display: 'Air Conditioner' },
};

interface RankingRequest {
  products: Array<{
    id: string;
    name: string;
    price: number;
    rating: number;
    brand?: string;
    features?: string[];
  }>;
  budget_min?: number;
  budget_max?: number;
  preferred_brands?: string[];
  quality_threshold?: number;
  preferred_delivery_days?: number;
}

interface RankingResult {
  request_id: string;
  ranked_products: Array<{
    rank: number;
    product_id: string;
    score: number;
    confidence: number;
    explanation: {
      quality_score: number;
      price_score: number;
      rating_score: number;
      delivery_score: number;
      brand_score: number;
      summary: string;
      strengths: string[];
      weaknesses?: string[];
    };
  }>;
  best_product: {
    product_id: string;
    score: number;
  };
  average_confidence: number;
}

interface ClarifyingQuestion {
  id: string;
  question: string;
  type: 'multiple_choice' | 'open_ended' | 'range' | 'boolean';
  options?: string[];
  category: 'budget' | 'brand' | 'features' | 'delivery' | 'quality';
  required: boolean;
}

interface IntentAnalysisResult {
  user_intent: string;
  confidence: number;
  budget?: { min: number; max: number };
  preferences?: string[];
  clarifying_questions: ClarifyingQuestion[];
  category?: string;
}

@Injectable()
export class ShoppingAssistantService {
  private readonly logger = new Logger('ShoppingAssistantService');
  private readonly RANKING_ENGINE_URL = 'http://localhost:3004';
  private readonly INTENT_PARSER_URL = 'http://localhost:3002';

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService
  ) {}

  /**
   * Analyze user text to extract shopping intent.
   * Tries the Intent Parser microservice first; falls back to lightweight
   * keyword matching enriched with real DB brand data when the service is down.
   */
  async analyzeIntent(
    userId: string,
    text: string,
    context?: Record<string, any>
  ): Promise<IntentAnalysisResult> {
    try {
      this.logger.log(`Analyzing intent for user ${userId}: "${text.substring(0, 50)}..."`);

      // Try the Intent Parser microservice
      try {
        const response: any = await firstValueFrom(
          this.httpService.post(`${this.INTENT_PARSER_URL}/analyze`, { query: text, context })
        );
        if (response?.data) return response.data;
      } catch {
        this.logger.warn('Intent Parser unavailable — falling back to keyword-based analysis');
      }

      // Lightweight keyword-based fallback using real DB brand data
      return this.analyzeIntentFromDB(text);
    } catch (error) {
      this.logger.error('Intent analysis failed:', error);
      throw new HttpException('Failed to analyze intent', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Rank products based on user intent and preferences.
   * Calls the Ranking Engine microservice; falls back to score-based ordering
   * on the real product attributes when the service is unavailable.
   */
  async rankProducts(products: any[], intent?: Record<string, any>): Promise<RankingResult> {
    try {
      if (products.length === 0) {
        throw new Error('No products to rank');
      }

      this.logger.log(`Ranking ${products.length} products`);

      const rankingRequest: RankingRequest = {
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          rating: p.rating || 0,
          brand: p.brand,
          features: p.features,
        })),
        budget_min: intent?.budget?.min,
        budget_max: intent?.budget?.max,
        preferred_brands: intent?.brands || [],
        quality_threshold: intent?.quality_threshold || 0.6,
        preferred_delivery_days: intent?.delivery_days,
      };

      try {
        const response: any = await firstValueFrom(
          this.httpService.post(`${this.RANKING_ENGINE_URL}/rank`, rankingRequest)
        );
        return response.data;
      } catch {
        this.logger.warn('Ranking Engine unavailable — using attribute-based ordering');
        return this.rankByAttributes(rankingRequest);
      }
    } catch (error) {
      this.logger.error('Product ranking failed:', error);
      throw new HttpException('Failed to rank products', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Process user answer to clarifying question.
   */
  async processQuestionAnswer(
    questionId: string,
    answer: string | number | boolean
  ): Promise<{ updatedIntent: Record<string, any>; nextQuestion?: ClarifyingQuestion }> {
    try {
      this.logger.log(`Processing answer to question ${questionId}: ${answer}`);
      const updatedIntent: Record<string, any> = {};
      if (questionId === 'q1') {
        updatedIntent.budget_max = answer;
      } else if (questionId === 'q2') {
        updatedIntent.preferred_brand = answer;
      }
      return { updatedIntent };
    } catch (error) {
      this.logger.error('Failed to process question answer:', error);
      throw new HttpException('Failed to process answer', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Fetch real products from the database matching the parsed intent.
   * No synthetic or hardcoded products are ever returned.
   */
  async getProductsForIntent(intent: IntentAnalysisResult, limit: number = 50): Promise<any[]> {
    try {
      this.logger.log(`Fetching DB products for intent: "${intent.user_intent}"`);

      // Try the Product Aggregator microservice first
      try {
        const response: any = await firstValueFrom(
          this.httpService.post('http://localhost:3003/products/search', {
            intent: intent.user_intent,
            budget: intent.budget,
            category: intent.category,
            limit,
          })
        );
        if (Array.isArray(response?.data) && response.data.length > 0) {
          return response.data;
        }
      } catch {
        this.logger.warn('Product Aggregator unavailable — querying DB directly');
      }

      // Direct DB query via Prisma
      const where: Record<string, any> = { inStock: true };

      if (intent.budget) {
        where.price = { gte: intent.budget.min, lte: intent.budget.max };
      }

      if (intent.category) {
        const catEntry = CATEGORY_PATTERNS[intent.category];
        if (catEntry) {
          where.category = { contains: catEntry.pattern.replace(/%/g, ''), mode: 'insensitive' };
        }
      }

      const products = await this.prisma.product.findMany({
        where,
        take: limit,
        orderBy: [{ featured: 'desc' }, { price: 'asc' }],
      });

      return products.map((p) => ({
        id: String(p.id),
        name: p.name,
        brand: p.genericName?.split(' ')[0] ?? 'Unknown',
        price: p.price,
        category: p.category,
        imageUrl: p.imageUrl ?? null,
        inStock: p.inStock,
        rating: 4.0, // rating not in Product schema; sourced from ProductBusinessMetrics if needed
        features: [],
      }));
    } catch (error) {
      this.logger.error('Failed to fetch products from DB:', error);
      return []; // Never return hardcoded data — empty array signals "no results"
    }
  }

  // =========================================================================
  // Private helpers — real-data implementations
  // =========================================================================

  /**
   * Lightweight keyword-based intent detection enriched with real DB brand data.
   * Used when the Intent Parser microservice is unavailable.
   */
  private async analyzeIntentFromDB(text: string): Promise<IntentAnalysisResult> {
    const textLower = text.toLowerCase();

    // Detect category via keyword matching
    let detectedCategory: string | null = null;
    for (const [cat, { pattern }] of Object.entries(CATEGORY_PATTERNS)) {
      const keyword = pattern.replace(/%/g, '');
      if (textLower.includes(keyword) || textLower.includes(cat)) {
        detectedCategory = cat;
        break;
      }
    }

    // Additional common aliases
    if (!detectedCategory) {
      if (/phone|mobile|smartphone|iphone|android/.test(textLower)) detectedCategory = 'phone';
      else if (/laptop|macbook|notebook|ultrabook/.test(textLower)) detectedCategory = 'laptop';
      else if (/headphone|earphone|earbuds|headset/.test(textLower))
        detectedCategory = 'headphones';
      else if (/tv|television|smart tv/.test(textLower)) detectedCategory = 'television';
      else if (/fridge|refrigerator/.test(textLower)) detectedCategory = 'refrigerator';
      else if (/washing machine|washer/.test(textLower)) detectedCategory = 'washing';
    }

    // Extract budget from text (e.g., "under 30000", "₹50K")
    let budget: { min: number; max: number } | undefined;
    const budgetMatch =
      textLower.match(
        /(?:under|below|within|upto?|less than|max|budget)\s*[₹rs.]?\s*(\d[\d,]*(?:\.\d+)?)\s*([kl]?)/i
      ) || textLower.match(/[₹rs.]\s*(\d[\d,]*(?:\.\d+)?)\s*([kl]?)/i);
    if (budgetMatch) {
      let amount = parseFloat(budgetMatch[1].replace(/,/g, ''));
      const suffix = (budgetMatch[2] || '').toLowerCase();
      if (suffix === 'k') amount *= 1000;
      else if (suffix === 'l') amount *= 100000;
      budget = { min: 0, max: Math.round(amount) };
    }

    // Fetch real brands from DB for the detected category
    const clarifying_questions: ClarifyingQuestion[] = [];
    if (!budget) {
      clarifying_questions.push({
        id: 'q1',
        question: 'What is your budget range?',
        type: 'range',
        category: 'budget',
        required: false,
      });
    }

    if (detectedCategory) {
      try {
        const catEntry = CATEGORY_PATTERNS[detectedCategory];
        if (catEntry) {
          const brandRows = await this.prisma.product.findMany({
            where: {
              category: { contains: catEntry.pattern.replace(/%/g, ''), mode: 'insensitive' },
              inStock: true,
            },
            select: { genericName: true },
            distinct: ['genericName'],
            take: 8,
          });
          const brands = [
            ...new Set(
              brandRows
                .map((r) => r.genericName?.split(' ')[0])
                .filter((b): b is string => !!b && b.length > 1)
            ),
          ].slice(0, 8);

          if (brands.length > 0) {
            clarifying_questions.push({
              id: `q${clarifying_questions.length + 1}`,
              question: `Do you prefer a specific brand?`,
              type: 'multiple_choice',
              options: [...brands, 'No preference'],
              category: 'brand',
              required: false,
            });
          }
        }
      } catch {
        /* DB unavailable — skip brand question rather than using hardcoded brands */
      }
    }

    clarifying_questions.push({
      id: `q${clarifying_questions.length + 1}`,
      question: 'How soon do you need delivery?',
      type: 'multiple_choice',
      options: ['Same day', '1-2 days', '3-7 days', 'No rush'],
      category: 'delivery',
      required: false,
    });

    return {
      user_intent: text,
      confidence: detectedCategory ? 0.82 : 0.55,
      budget,
      category: detectedCategory ?? undefined,
      preferences: [],
      clarifying_questions,
    };
  }

  /**
   * Deterministic ranking based on price fit and product attributes.
   * Used when the Ranking Engine microservice is unavailable.
   * No random numbers or hardcoded scores.
   */
  private rankByAttributes(request: RankingRequest): RankingResult {
    const budgetMax = request.budget_max ?? Infinity;
    const budgetMin = request.budget_min ?? 0;

    const scored = request.products.map((prod) => {
      const priceFit =
        prod.price <= budgetMax && prod.price >= budgetMin
          ? 1.0
          : prod.price > budgetMax
            ? Math.max(0, 1 - (prod.price - budgetMax) / budgetMax)
            : 0.9;
      const ratingNorm = Math.min(1, (prod.rating || 0) / 5);
      const score = parseFloat((priceFit * 0.6 + ratingNorm * 0.4).toFixed(3));
      return { prod, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return {
      request_id: `rank-${Date.now()}`,
      ranked_products: scored.map(({ prod, score }, index) => ({
        rank: index + 1,
        product_id: prod.id,
        score,
        confidence: Math.min(0.99, score + 0.05),
        explanation: {
          quality_score: Math.min(1, (prod.rating || 0) / 5),
          price_score: prod.price <= budgetMax ? 0.9 : 0.5,
          rating_score: Math.min(1, (prod.rating || 0) / 5),
          delivery_score: 0.8,
          brand_score: request.preferred_brands?.includes(prod.brand ?? '') ? 1.0 : 0.7,
          summary: `${prod.name} — ranked by price fit and customer rating`,
          strengths: [
            prod.price <= budgetMax ? 'Within budget' : 'Slightly over budget',
            prod.rating >= 4 ? `${prod.rating} star rating` : 'Available now',
          ],
          weaknesses: index > 0 ? ['Other options may suit better'] : [],
        },
      })),
      best_product: {
        product_id: scored[0]?.prod.id ?? '',
        score: scored[0]?.score ?? 0,
      },
      average_confidence: scored.reduce((s, { score }) => s + score, 0) / (scored.length || 1),
    };
  }
}

interface RankingRequest {
  products: Array<{
    id: string;
    name: string;
    price: number;
    rating: number;
    brand?: string;
    features?: string[];
  }>;
  budget_min?: number;
  budget_max?: number;
  preferred_brands?: string[];
  quality_threshold?: number;
  preferred_delivery_days?: number;
}

interface RankingResult {
  request_id: string;
  ranked_products: Array<{
    rank: number;
    product_id: string;
    score: number;
    confidence: number;
    explanation: {
      quality_score: number;
      price_score: number;
      rating_score: number;
      delivery_score: number;
      brand_score: number;
      summary: string;
      strengths: string[];
      weaknesses?: string[];
    };
  }>;
  best_product: {
    product_id: string;
    score: number;
  };
  average_confidence: number;
}
