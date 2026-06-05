/**
 * Seller AI Copilot Controller
 * REST endpoints for seller AI features
 */

import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { User } from '../../common/decorators/user.decorator';
import { SellerService } from './seller.service';
import { ListingGeneratorService } from './listing-generator.service';
import { PriceSuggestionService, DemandPredictionService } from './pricing-demand.service';
import {
  CreateSellerDto,
  UpdateSellerDto,
  SellerProfileDto,
  GenerateListingDto,
  GeneratedListingResponseDto,
  GetPriceSuggestionsDto,
  PriceSuggestionResponseDto,
  GetDemandPredictionDto,
  DemandPredictionResponseDto,
  DemandInsightDto,
  DashboardMetricsDto,
  SellerProductDto,
  ProductPerformanceDto,
} from './dto/seller.dto';

@ApiTags('Seller AI Copilot')
@Controller('sellers')
@UseGuards(JwtGuard)
@ApiBearerAuth('access-token')
export class SellerCopilotController {
  constructor(
    private readonly sellerService: SellerService,
    private readonly listingGenerator: ListingGeneratorService,
    private readonly priceSuggestion: PriceSuggestionService,
    private readonly demandPrediction: DemandPredictionService
  ) {}

  // ==================== SELLER PROFILE ENDPOINTS ====================

  /**
   * Create seller profile
   */
  @Post('profile')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create seller profile',
    description: 'Convert user account to seller account',
  })
  @ApiResponse({
    status: 201,
    description: 'Seller profile created successfully',
    type: SellerProfileDto,
  })
  async createSellerProfile(
    @User() user: any,
    @Body() createDto: CreateSellerDto
  ): Promise<SellerProfileDto> {
    if (!user?.id) throw new BadRequestException('User not found');
    return this.sellerService.createSellerProfile(user.id, createDto);
  }

  /**
   * Get seller profile
   */
  @Get('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get seller profile',
    description: 'Retrieve current seller profile information',
  })
  @ApiResponse({
    status: 200,
    description: 'Seller profile retrieved',
    type: SellerProfileDto,
  })
  async getSellerProfile(@User() user: any): Promise<SellerProfileDto> {
    if (!user?.id) throw new BadRequestException('User not found');
    return this.sellerService.getSellerProfile(user.id);
  }

  /**
   * Update seller profile
   */
  @Put('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update seller profile',
    description: 'Update seller store information and AI settings',
  })
  @ApiResponse({
    status: 200,
    description: 'Seller profile updated',
    type: SellerProfileDto,
  })
  async updateSellerProfile(
    @User() user: any,
    @Body() updateDto: UpdateSellerDto
  ): Promise<SellerProfileDto> {
    if (!user?.id) throw new BadRequestException('User not found');
    return this.sellerService.updateSellerProfile(user.id, updateDto);
  }

  // ==================== AUTO LISTING GENERATOR ====================

  /**
   * Generate product listing
   * AI auto-generates professional description, bullet points, and pricing
   *
   * @example
   * {
   *   "title": "Samsung 55\" 4K TV",
   *   "basePrice": 45000,
   *   "category": "electronics",
   *   "quantity": 5,
   *   "images": ["url1", "url2"]
   * }
   */
  @Post('listings/generate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Generate listing with AI',
    description:
      'Auto-generate professional product listing with AI-optimized description and pricing',
  })
  @ApiResponse({
    status: 201,
    description: 'Listing generated successfully',
    type: GeneratedListingResponseDto,
  })
  async generateListing(
    @User() user: any,
    @Body() generateDto: GenerateListingDto
  ): Promise<GeneratedListingResponseDto> {
    if (!user?.id) throw new BadRequestException('User not found');
    return this.listingGenerator.generateListing(user.id, generateDto);
  }

  /**
   * Create product from generated listing
   */
  @Post('products')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create product listing',
    description: 'Create new product for sale',
  })
  @ApiResponse({
    status: 201,
    description: 'Product created',
    type: SellerProductDto,
  })
  async createProduct(
    @User() user: any,
    @Body() productDto: SellerProductDto
  ): Promise<SellerProductDto> {
    if (!user?.id) throw new BadRequestException('User not found');
    return this.sellerService.createProduct(user.id, productDto);
  }

  /**
   * Get seller's products
   */
  @Get('products')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get seller products',
    description: 'List all products for current seller',
  })
  async getSellerProducts(
    @User() user: any,
    @Query('status') status?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20
  ): Promise<any> {
    if (!user?.id) throw new BadRequestException('User not found');
    return this.sellerService.getSellerProducts(user.id, status, page, limit);
  }

  /**
   * Get product performance
   */
  @Get('products/:productId/performance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get product performance metrics',
    description: 'Get detailed performance analytics for specific product',
  })
  @ApiResponse({
    status: 200,
    description: 'Performance metrics retrieved',
    type: ProductPerformanceDto,
  })
  async getProductPerformance(
    @User() user: any,
    @Param('productId', ParseIntPipe) productId: number
  ): Promise<ProductPerformanceDto> {
    if (!user?.id) throw new BadRequestException('User not found');
    return this.sellerService.getProductPerformance(user.id, productId);
  }

  /**
   * Update product
   */
  @Put('products/:productId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update product',
    description: 'Update product information',
  })
  @ApiResponse({
    status: 200,
    description: 'Product updated',
    type: SellerProductDto,
  })
  async updateProduct(
    @User() user: any,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() updateData: Partial<SellerProductDto>
  ): Promise<SellerProductDto> {
    if (!user?.id) throw new BadRequestException('User not found');
    return this.sellerService.updateProduct(user.id, productId, updateData);
  }

  // ==================== PRICE SUGGESTIONS ====================

  /**
   * Get price suggestions
   *
   * @example
   * {
   *   "basePrice": 45000,
   *   "costPrice": 30000,
   *   "demandLevel": "high",
   *   "competitorPrices": [44000, 46000, 45500]
   * }
   */
  @Post('pricing/suggestions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get AI price suggestions',
    description:
      'Get intelligent price recommendations based on demand, competition, margins, and seasonality',
  })
  @ApiResponse({
    status: 200,
    description: 'Price suggestions generated',
    type: PriceSuggestionResponseDto,
  })
  async getPriceSuggestions(
    @User() user: any,
    @Body() priceDto: GetPriceSuggestionsDto
  ): Promise<PriceSuggestionResponseDto> {
    if (!user?.id) throw new BadRequestException('User not found');
    return this.priceSuggestion.getSuggestedPrice(user.id, priceDto);
  }

  /**
   * Apply price suggestion to product
   */
  @Post('pricing/suggestions/apply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Apply price suggestion',
    description: 'Apply suggested price to product and track change',
  })
  async applyPriceSuggestion(
    @User() user: any,
    @Body() body: { productId: number; suggestedPrice: number }
  ): Promise<any> {
    if (!user?.id) throw new BadRequestException('User not found');
    return this.priceSuggestion.applyPriceSuggestion(user.id, body.productId, body.suggestedPrice);
  }

  // ==================== DEMAND PREDICTION ====================

  /**
   * Get demand prediction
   *
   * @example
   * {
   *   "scope": "category",
   *   "scopeId": "electronics",
   *   "forecastDays": 7,
   *   "includeHistorical": true
   * }
   */
  @Post('demand/prediction')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get demand forecast',
    description:
      'Predict product/category demand for next 7/14/30 days using historical patterns and trends',
  })
  @ApiResponse({
    status: 200,
    description: 'Demand prediction generated',
    type: DemandPredictionResponseDto,
  })
  async getDemandPrediction(
    @User() user: any,
    @Body() predictionDto: GetDemandPredictionDto
  ): Promise<DemandPredictionResponseDto> {
    if (!user?.id) throw new BadRequestException('User not found');
    return this.demandPrediction.getDemandPrediction(user.id, predictionDto);
  }

  /**
   * Get demand insights
   */
  @Get('demand/insights')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get demand insights',
    description: 'Get AI-generated insights and recommendations based on demand analysis',
  })
  @ApiResponse({
    status: 200,
    description: 'Demand insights retrieved',
    type: DemandInsightDto,
  })
  async getDemandInsights(@User() user: any): Promise<DemandInsightDto> {
    if (!user?.id) throw new BadRequestException('User not found');
    return this.demandPrediction.getDemandInsights(user.id);
  }

  // ==================== DASHBOARD ====================

  /**
   * Get seller dashboard
   * Complete metrics, insights, and recommendations
   */
  @Get('dashboard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get seller dashboard',
    description: 'Get comprehensive dashboard with all metrics, AI insights, and recommendations',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard metrics retrieved',
    type: DashboardMetricsDto,
  })
  async getDashboardMetrics(@User() user: any): Promise<DashboardMetricsDto> {
    if (!user?.id) throw new BadRequestException('User not found');
    return this.sellerService.getDashboardMetrics(user.id);
  }
}
