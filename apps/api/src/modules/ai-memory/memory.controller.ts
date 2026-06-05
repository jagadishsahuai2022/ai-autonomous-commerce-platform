/**
 * AI Memory System REST Controller
 * Exposes memory endpoints: preferences, patterns, insights, recommendations
 */

import { Controller, Get, Post, Put, Body, Query, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { User } from '../../common/decorators/user.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { MemoryService } from './memory.service';
import { RankingService } from './ranking.service';
import { AutoDecisionService } from './auto-decision.service';
import {
  CreatePreferencesDto,
  PreferencesDto,
  MemorySummaryDto,
  RecommendationsResponseDto,
  AutoDecisionDto,
  MakeAutoDecisionDto,
} from './dto/memory.dto';

@ApiTags('AI Memory System')
@Controller('api/memory')
@UseGuards(JwtGuard)
export class MemoryController {
  constructor(
    private memoryService: MemoryService,
    private rankingService: RankingService,
    private autoDecisionService: AutoDecisionService
  ) {}

  // ==================== Preferences Endpoints ====================

  @Get('preferences')
  @ApiOperation({ summary: 'Get user preferences' })
  @ApiResponse({ status: 200, type: PreferencesDto })
  async getPreferences(@User() user: any): Promise<PreferencesDto> {
    return this.memoryService.getUserPreferences(user.id);
  }

  @Post('preferences')
  @ApiOperation({ summary: 'Update user preferences' })
  @ApiResponse({ status: 200, type: PreferencesDto })
  async updatePreferences(
    @User() user: any,
    @Body() dto: CreatePreferencesDto
  ): Promise<PreferencesDto> {
    return this.memoryService.updatePreferences(user.id, dto);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update preferences (PUT)' })
  @ApiResponse({ status: 200, type: PreferencesDto })
  async replacePreferences(
    @User() user: any,
    @Body() dto: CreatePreferencesDto
  ): Promise<PreferencesDto> {
    return this.memoryService.updatePreferences(user.id, dto);
  }

  @Post('preferences/add-category')
  @ApiOperation({ summary: 'Add preferred category' })
  async addPreferredCategory(
    @User() user: any,
    @Body('category') category: string
  ): Promise<PreferencesDto> {
    const prefs = await this.memoryService.getUserPreferences(user.id);
    const updated = prefs.preferredCategories || [];
    if (!updated.includes(category)) {
      updated.push(category);
    }
    return this.memoryService.updatePreferences(user.id, {
      preferredCategories: updated,
    });
  }

  @Post('preferences/remove-category')
  @ApiOperation({ summary: 'Remove preferred category' })
  async removePreferredCategory(
    @User() user: any,
    @Body('category') category: string
  ): Promise<PreferencesDto> {
    const prefs = await this.memoryService.getUserPreferences(user.id);
    const updated = prefs.preferredCategories?.filter((c) => c !== category) || [];
    return this.memoryService.updatePreferences(user.id, {
      preferredCategories: updated,
    });
  }

  // ==================== Patterns & Insights ====================

  @Get('patterns')
  @ApiOperation({ summary: 'Get buying patterns analysis' })
  async getBuyingPatterns(@User() user: any) {
    return this.memoryService.analyzeBuyingPatterns(user.id);
  }

  @Get('insights')
  @ApiOperation({ summary: 'Get memory-based insights' })
  async getInsights(@User() user: any) {
    return this.memoryService.getMemoryInsights(user.id);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get comprehensive memory summary' })
  @ApiResponse({ status: 200, type: MemorySummaryDto })
  async getMemorySummary(@User() user: any): Promise<MemorySummaryDto> {
    return this.memoryService.getMemorySummary(user.id);
  }

  // ==================== Ranking Personalization ====================

  @Get('ranking/weights')
  @ApiOperation({ summary: 'Get personalized ranking weights' })
  async getRankingWeights(@User() user: any) {
    return this.rankingService.personalizeRankingWeights(user.id);
  }

  @Get('ranking/payload')
  @ApiOperation({ summary: 'Get ranking payload for ranking engine' })
  async getRankingPayload(@User() user: any) {
    return this.rankingService.getRankingPayload(user.id);
  }

  @Post('ranking/personalize')
  @ApiOperation({ summary: 'Apply personalization to products' })
  async personalizeProducts(@User() user: any, @Body('products') products: any[]) {
    return this.rankingService.scoreProductsWithMemory(user.id, products);
  }

  // ==================== Recommendations ====================

  @Get('recommendations')
  @ApiOperation({ summary: 'Get personalized recommendations' })
  @ApiResponse({ status: 200, type: RecommendationsResponseDto })
  async getRecommendations(
    @User() user: any,
    @Query('limit') limit: string = '10'
  ): Promise<RecommendationsResponseDto> {
    const recommendations = await this.autoDecisionService.generateRecommendations(
      user.id,
      parseInt(limit) || 10
    );

    const insight = await this.memoryService.getMemoryInsights(user.id);

    return {
      recommendations: recommendations.map((r) => ({
        productId: r.id.toString(),
        productName: r.name,
        category: r.category,
        discrepancyReason: `Matches your preference for ${r.category}`,
        relevanceScore: r.personalizedScore || 0,
        matchedPreferences: insight.recommendedCategories,
        estimatedScore: r.personalizedScore || 0,
      })),
      explanation:
        insight.topInsights[0] || 'Personalized recommendations based on your preferences',
      personalizationLevel: insight.personalizationLevel,
      generateTime: new Date(),
    };
  }

  @Post('recommendations/deals')
  @ApiOperation({ summary: 'Get personalized deal alerts' })
  async getDealAlerts(@User() user: any, @Query('limit') limit: string = '5') {
    return this.autoDecisionService.getDealAlerts(user.id, parseInt(limit) || 5);
  }

  // ==================== Auto-Decisions ====================

  @Get('auto-decisions/enabled')
  @ApiOperation({ summary: 'Check if auto-decisions are enabled' })
  async checkAutoDecisionsEnabled(@User() user: any) {
    return this.autoDecisionService.isAutoDecisionEnabled(user.id);
  }

  @Post('auto-decisions/cart-add')
  @ApiOperation({ summary: 'Auto-add product to cart' })
  async autoAddToCart(
    @User() user: any,
    @Body('productId') productId: string
  ): Promise<{ success: boolean }> {
    const success = await this.autoDecisionService.autoAddToCart(user.id, productId);
    return { success };
  }

  @Post('auto-decisions/evaluate')
  @ApiOperation({ summary: 'Evaluate if auto-purchase is recommended' })
  async evaluateAutoPurchase(
    @User() user: any,
    @Body() body: { productId: string; price: number }
  ) {
    return this.autoDecisionService.evaluateAutoPurchase(user.id, body.productId, body.price);
  }

  @Get('auto-decisions/suggestions')
  @ApiOperation({ summary: 'Get smart product suggestions' })
  async getSmartSuggestions(@User() user: any, @Query('browsedProducts') browsedProducts?: string) {
    const browsedIds = browsedProducts?.split(',') || [];
    return this.autoDecisionService.getSmartSuggestions(user.id, browsedIds);
  }

  @Get('auto-decisions/history')
  @ApiOperation({ summary: 'Get auto-decision history' })
  async getAutoDecisionHistory(
    @User() user: any,
    @Query('limit') limit: string = '10'
  ): Promise<AutoDecisionDto[]> {
    return this.memoryService.getRecentAutoDecisions(user.id, parseInt(limit) || 10) as any;
  }

  @Post('auto-decisions/:id/feedback')
  @ApiOperation({ summary: 'Provide feedback on auto-decision' })
  async recordAutoDecisionFeedback(
    @User() user: any,
    @Param('id') decisionId: string,
    @Body() body: { accepted: boolean; satisfied?: boolean }
  ): Promise<{ success: boolean }> {
    await this.autoDecisionService.recordFeedback(user.id, parseInt(decisionId), body);
    return { success: true };
  }

  // ==================== Admin/Debug ====================

  @Post('debug/reset')
  @ApiOperation({ summary: '[DEBUG] Reset user memory' })
  async resetMemory(@User() user: any): Promise<{ success: boolean }> {
    // In production, this should require admin privileges
    await this.memoryService.initializeUserMemory(user.id);
    return { success: true };
  }

  @Get('debug/quality-score')
  @ApiOperation({ summary: '[DEBUG] Get memory quality score' })
  async getMemoryQualityScore(@User() user: any) {
    const memory = await this.memoryService.getUserMemory(user.id);
    const insights = await this.memoryService.getMemoryInsights(user.id);

    return {
      overallAccuracy: memory.accuracy,
      predictionAccuracy: insights.predictionAccuracy,
      autoDecisionConfidence: insights.autoDecisionConfidence,
      memoryAge: memory.memoryAge,
      updateCount: memory.updateCount,
      successRate: memory.autoDecisionSuccessRate,
    };
  }
}
