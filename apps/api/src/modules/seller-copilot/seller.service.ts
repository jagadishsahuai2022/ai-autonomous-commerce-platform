/**
 * Seller Service
 * Core business logic for seller management
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { LoggerService } from '../../common/logger.service';
import { KafkaService } from '../../kafka/kafka.service';
import {
  NotFoundException,
  ValidationException,
  UnauthorizedException,
  InternalServerException,
} from '../../common/exceptions/app.exception';
import {
  CreateSellerDto,
  UpdateSellerDto,
  SellerProfileDto,
  SellerProductDto,
  DashboardMetricsDto,
  ProductPerformanceDto,
} from './dto/seller.dto';

@Injectable()
export class SellerService {
  private readonly logger = new Logger('SellerService');
  private readonly appLogger = new LoggerService();

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaService
  ) {}

  /**
   * Create seller profile for user
   */
  async createSellerProfile(userId: number, createDto: CreateSellerDto): Promise<SellerProfileDto> {
    try {
      // Check if user already is a seller
      const existingSeller = await this.prisma.seller.findUnique({
        where: { userId },
      });

      if (existingSeller) {
        throw new ValidationException('User is already a seller');
      }

      // Create seller profile
      const seller = await this.prisma.seller.create({
        data: {
          userId,
          storeName: createDto.storeName,
          storeDescription: createDto.storeDescription,
          storeImageUrl: createDto.storeImageUrl,
          category: createDto.category,
          autoGenListings: createDto.autoGenListings ?? false,
          usePricingSuggestions: createDto.usePricingSuggestions ?? true,
          useDemandPrediction: createDto.useDemandPrediction ?? true,
        },
        include: {
          user: true,
        },
      });

      // Create analytics record
      await this.prisma.sellerAiAnalytics.create({
        data: {
          sellerId: seller.id,
        },
      });

      this.appLogger.log('Seller profile created', { userId, sellerId: seller.id });

      // Emit event
      await this.kafka.emit('seller-events', {
        type: 'seller.created',
        userId,
        sellerId: seller.id,
        storeName: seller.storeName,
        timestamp: new Date(),
      });

      return this.mapSellerToDto(seller);
    } catch (error) {
      this.logger.error('Failed to create seller profile', (error as any).message);
      throw error;
    }
  }

  /**
   * Get seller profile
   */
  async getSellerProfile(userId: number): Promise<SellerProfileDto> {
    try {
      const seller = await this.prisma.seller.findUnique({
        where: { userId },
        include: {
          products: {
            where: { status: 'active' },
          },
        },
      });

      if (!seller) {
        throw new NotFoundException('Seller profile not found');
      }

      return this.mapSellerToDto(seller, {
        activeListings: seller.products.length,
        totalViews: seller.products.reduce((sum, p) => sum + p.views, 0),
        conversionRate:
          seller.products.length > 0
            ? seller.products.reduce((sum, p) => sum + p.conversionRate, 0) / seller.products.length
            : 0,
      });
    } catch (error) {
      this.logger.error('Failed to get seller profile', (error as any).message);
      throw error;
    }
  }

  /**
   * Update seller profile
   */
  async updateSellerProfile(userId: number, updateDto: UpdateSellerDto): Promise<SellerProfileDto> {
    try {
      const seller = await this.prisma.seller.update({
        where: { userId },
        data: {
          storeName: updateDto.storeName,
          storeDescription: updateDto.storeDescription,
          storeImageUrl: updateDto.storeImageUrl,
          category: updateDto.category,
          autoGenListings: updateDto.autoGenListings,
          usePricingSuggestions: updateDto.usePricingSuggestions,
          useDemandPrediction: updateDto.useDemandPrediction,
          vendorTier: updateDto.vendorTier,
        },
      });

      this.appLogger.log('Seller profile updated', { userId, sellerId: seller.id });

      return this.mapSellerToDto(seller);
    } catch (error) {
      if ((error as any).code === 'P2025') {
        throw new NotFoundException('Seller profile not found');
      }
      this.logger.error('Failed to update seller profile', (error as any).message);
      throw error;
    }
  }

  /**
   * Create product listing
   */
  async createProduct(userId: number, productDto: SellerProductDto): Promise<SellerProductDto> {
    try {
      // Get seller
      const seller = await this.prisma.seller.findUnique({
        where: { userId },
      });

      if (!seller) {
        throw new NotFoundException('Seller profile not found');
      }

      // Create product
      const product = await this.prisma.sellerProduct.create({
        data: {
          sellerId: seller.id,
          title: productDto.title,
          description: productDto.description,
          category: productDto.category,
          subCategory: productDto.subCategory,
          basePrice: productDto.basePrice,
          currentPrice: productDto.currentPrice,
          costPrice: productDto.costPrice,
          quantity: productDto.quantity,
          images: productDto.images ?? [],
          sku: productDto.sku,
          status: 'active',
          publishedAt: new Date(),
        },
      });

      this.appLogger.log('Product created', {
        userId,
        productId: product.id,
        title: product.title,
      });

      // Emit event
      await this.kafka.emit('seller-events', {
        type: 'product.created',
        userId,
        sellerId: seller.id,
        productId: product.id,
        title: product.title,
        price: product.currentPrice,
        timestamp: new Date(),
      });

      return {
        id: product.id,
        title: product.title,
        description: product.description || undefined,
        category: product.category,
        subCategory: product.subCategory || undefined,
        basePrice: product.basePrice,
        currentPrice: product.currentPrice,
        quantity: product.quantity,
      };
    } catch (error) {
      this.logger.error('Failed to create product', (error as any).message);
      throw error;
    }
  }

  /**
   * Get seller's products
   */
  async getSellerProducts(
    userId: number,
    status?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ products: SellerProductDto[]; total: number; page: number; limit: number }> {
    try {
      const seller = await this.prisma.seller.findUnique({
        where: { userId },
      });

      if (!seller) {
        throw new NotFoundException('Seller profile not found');
      }

      const where = status ? { sellerId: seller.id, status } : { sellerId: seller.id };

      const [products, total] = await Promise.all([
        this.prisma.sellerProduct.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.sellerProduct.count({ where }),
      ]);

      return {
        products: products.map((p) => this.mapProductToDto(p)),
        total,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error('Failed to get seller products', (error as any).message);
      throw error;
    }
  }

  /**
   * Get product performance metrics
   */
  async getProductPerformance(userId: number, productId: number): Promise<ProductPerformanceDto> {
    try {
      const seller = await this.prisma.seller.findUnique({
        where: { userId },
      });

      if (!seller) {
        throw new NotFoundException('Seller profile not found');
      }

      const product = await this.prisma.sellerProduct.findFirst({
        where: {
          id: productId,
          sellerId: seller.id,
        },
      });

      if (!product) {
        throw new NotFoundException('Product not found');
      }

      // Get price history
      const priceHistory = await this.prisma.priceHistory.findFirst({
        where: { productId },
        orderBy: { createdAt: 'desc' },
      });

      return {
        productId: product.id,
        name: product.title,
        views: product.views,
        clicks: product.clicks,
        conversions: product.conversions,
        conversionRate: product.conversionRate,
        revenue: product.conversions * product.currentPrice,
        demandScore: product.demandScore,
        listingScore: product.listingScore,
        priceOptimizationOpportunity: priceHistory
          ? {
              currentPrice: product.currentPrice,
              recommendedPrice: priceHistory.newPrice,
              estimatedRevenueGain:
                (priceHistory.newPrice - product.currentPrice) * product.conversions * 0.1,
            }
          : undefined,
      };
    } catch (error) {
      this.logger.error('Failed to get product performance', (error as any).message);
      throw error;
    }
  }

  /**
   * Update product
   */
  async updateProduct(
    userId: number,
    productId: number,
    updateData: Partial<SellerProductDto>
  ): Promise<SellerProductDto> {
    try {
      const seller = await this.prisma.seller.findUnique({
        where: { userId },
      });

      if (!seller) {
        throw new NotFoundException('Seller profile not found');
      }

      const product = await this.prisma.sellerProduct.findFirst({
        where: {
          id: productId,
          sellerId: seller.id,
        },
      });

      if (!product) {
        throw new NotFoundException('Product not found');
      }

      const updated = await this.prisma.sellerProduct.update({
        where: { id: productId },
        data: {
          title: updateData.title ?? product.title,
          description: updateData.description ?? product.description,
          basePrice: updateData.basePrice ?? product.basePrice,
          currentPrice: updateData.currentPrice ?? product.currentPrice,
          quantity: updateData.quantity ?? product.quantity,
          status: updateData.status ?? product.status,
        },
      });

      return this.mapProductToDto(updated);
    } catch (error) {
      this.logger.error('Failed to update product', (error as any).message);
      throw error;
    }
  }

  /**
   * Get dashboard metrics for seller
   */
  async getDashboardMetrics(userId: number): Promise<DashboardMetricsDto> {
    try {
      const seller = await this.prisma.seller.findUnique({
        where: { userId },
        include: {
          products: true,
          aiAnalytics: true,
        },
      });

      if (!seller) {
        throw new NotFoundException('Seller profile not found');
      }

      const activeProducts = seller.products.filter((p) => p.status === 'active');
      const totalViews = activeProducts.reduce((sum, p) => sum + p.views, 0);
      const totalClicks = activeProducts.reduce((sum, p) => sum + p.clicks, 0);
      const totalConversions = activeProducts.reduce((sum, p) => sum + p.conversions, 0);
      const overallConversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

      // Get top performers
      const topProducts = activeProducts
        .sort((a, b) => b.conversions - a.conversions)
        .slice(0, 5)
        .map((p) => ({
          id: p.id,
          name: p.title,
          sales: p.conversions,
          revenue: p.conversions * p.currentPrice,
        }));

      const categoryPerformance = this.aggregateByCategory(activeProducts);

      return {
        overview: {
          activeListings: activeProducts.length,
          totalSales: seller.totalSales,
          totalRevenue: seller.totalSold * (seller.totalSales / Math.max(seller.totalSold, 1)),
          averageRating: seller.averageRating,
          storageUsage: 0,
        },
        performanceMetrics: {
          totalViews,
          totalClicks,
          totalConversions,
          overallConversionRate,
          weekOverWeekGrowth: this.calculateGrowth(seller),
        },
        aiInsights: {
          generatedListingsCount: seller.aiAnalytics?.generatedListingsCount ?? 0,
          avgGeneratedListingScore: seller.aiAnalytics?.pricingAccuracy ?? 0,
          priceSuggestionsAccepted: seller.aiAnalytics?.suggestionsAccepted ?? 0,
          revenueLiftFromAi: seller.aiAnalytics?.revenueLift ?? 0,
          demandForecastAccuracy: seller.aiAnalytics?.forecastAccuracy ?? 0,
        },
        topPerformers: {
          bestSellingProducts: topProducts,
          bestPerformingCategories: categoryPerformance,
        },
        recommendations: this.generateRecommendations(seller, activeProducts),
        trends: {
          demandTrend: 'stable',
          priceTrend: 'stable',
          inventoryHealth: this.calculateInventoryHealth(activeProducts),
          customerSatisfaction: seller.averageRating,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get dashboard metrics', (error as any).message);
      throw error;
    }
  }

  // ==================== HELPER METHODS ====================

  private mapSellerToDto(seller: any, stats?: any): SellerProfileDto {
    return {
      id: seller.id,
      userId: seller.userId,
      storeName: seller.storeName,
      storeDescription: seller.storeDescription,
      storeImageUrl: seller.storeImageUrl,
      totalSales: seller.totalSales,
      totalSold: seller.totalSold,
      averageRating: seller.averageRating,
      ratingCount: seller.ratingCount,
      category: seller.category,
      vendorTier: seller.vendorTier,
      isActive: seller.isActive,
      isVerified: seller.isVerified,
      createdAt: seller.createdAt,
      updatedAt: seller.updatedAt,
      stats,
    };
  }

  private mapProductToDto(product: any): SellerProductDto {
    return {
      id: product.id,
      title: product.title,
      description: product.description,
      category: product.category,
      subCategory: product.subCategory,
      basePrice: product.basePrice,
      currentPrice: product.currentPrice,
      costPrice: product.costPrice,
      quantity: product.quantity,
      images: product.images,
      sku: product.sku,
      status: product.status,
      views: product.views,
      clicks: product.clicks,
      conversions: product.conversions,
      conversionRate: product.conversionRate,
      demandScore: product.demandScore,
      listingScore: product.listingScore,
      autoGeneratedText: product.autoGeneratedText,
      publishedAt: product.publishedAt,
    };
  }

  private aggregateByCategory(products: any[]): Array<{
    category: string;
    conversionRate: number;
    revenue: number;
  }> {
    const categoryMap = new Map();

    products.forEach((p) => {
      if (!categoryMap.has(p.category)) {
        categoryMap.set(p.category, {
          category: p.category,
          clicks: 0,
          conversions: 0,
          revenue: 0,
        });
      }

      const cat = categoryMap.get(p.category);
      cat.clicks += p.clicks;
      cat.conversions += p.conversions;
      cat.revenue += p.conversions * p.currentPrice;
    });

    return Array.from(categoryMap.values())
      .map((cat) => ({
        category: cat.category,
        conversionRate: cat.clicks > 0 ? (cat.conversions / cat.clicks) * 100 : 0,
        revenue: cat.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  private calculateGrowth(seller: any): number {
    // Mock calculation - in production would compare week-over-week
    return Math.random() * 20 - 10; // -10% to +10%
  }

  private calculateInventoryHealth(products: any[]): string {
    const totalInventory = products.reduce((sum, p) => sum + p.quantity, 0);
    const totalDemand = products.reduce((sum, p) => sum + p.clicks, 0);

    if (totalDemand === 0) return 'Unknown';
    const ratio = totalInventory / totalDemand;

    if (ratio > 10) return 'Overstocked';
    if (ratio < 1) return 'Understocked';
    return 'Healthy';
  }

  private generateRecommendations(seller: any, products: any[]): any[] {
    const recommendations = [];

    // Low-performing products
    const lowPerformers = products.filter((p) => p.conversionRate < 0.5);
    if (lowPerformers.length > 0) {
      recommendations.push({
        type: 'listing',
        priority: 'high',
        message: `${lowPerformers.length} products have low conversion rates`,
        action: 'Use AI to regenerate listings for these products',
        estimatedImpact: 'Could improve conversion by 30-50%',
      });
    }

    // Inventory issues
    const understocked = products.filter((p) => p.quantity < 5 && p.clicks > 10);
    if (understocked.length > 0) {
      recommendations.push({
        type: 'inventory',
        priority: 'high',
        message: `${understocked.length} products are running low on inventory`,
        action: 'Restock high-demand items',
        estimatedImpact: 'Prevent lost sales',
      });
    }

    // Pricing opportunities
    const pricingOpportunity = products.filter((p) => p.demandScore > 70 && p.conversionRate > 5);
    if (pricingOpportunity.length > 0) {
      recommendations.push({
        type: 'pricing',
        priority: 'medium',
        message: `${pricingOpportunity.length} high-demand products could support price increases`,
        action: 'Apply AI price suggestions',
        estimatedImpact: '5-15% revenue increase',
      });
    }

    return recommendations.slice(0, 5);
  }
}
