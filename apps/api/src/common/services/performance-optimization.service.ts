/**
 * Performance Optimization Service
 * Query optimization, caching strategies, pagination, query result batching
 */

import { Injectable, Logger } from '@nestjs/common';

export interface QueryOptimizationResult {
  originalQuery: string;
  optimizedQuery: string;
  selectFields: string[];
  joins: string[];
  indexHints: string[];
  estimatedPerformance: 'GOOD' | 'MODERATE' | 'POOR';
  recommendations: string[];
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

@Injectable()
export class PerformanceOptimizationService {
  private readonly logger = new Logger(PerformanceOptimizationService.name);
  private readonly queryCache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 300000; // 5 minutes

  /**
   * Optimize database query
   */
  optimizeQuery(
    entity: string,
    filters: Record<string, any> = {},
    requiredFields: string[] = []
  ): QueryOptimizationResult {
    const recommendations: string[] = [];
    const joins: string[] = [];
    const indexHints: string[] = [];

    // Determine which fields to select
    const selectFields = this.getOptimalSelectFields(entity, requiredFields);

    // Suggest joins based on entity
    if (entity === 'Order' && filters.userId) {
      joins.push('users');
      indexHints.push('INDEX idx_orders_userId');
    }

    if (entity === 'Product' && filters.categoryId) {
      indexHints.push('INDEX idx_products_categoryId');
      recommendations.push('Add full-text search index on product.name and product.description');
    }

    if (entity === 'Review' && filters.productId) {
      indexHints.push('INDEX idx_reviews_productId');
      recommendations.push('Paginate results to avoid loading all reviews');
    }

    // Build optimized query
    let optimizedQuery = `SELECT ${selectFields.join(', ')} FROM ${entity}`;

    Object.keys(filters).forEach((key) => {
      optimizedQuery += ` WHERE ${key} = ?`;
    });

    // Determine performance
    const estimatedPerformance = this.estimatePerformance(selectFields, joins, indexHints);

    return {
      originalQuery: `SELECT * FROM ${entity}`,
      optimizedQuery,
      selectFields,
      joins,
      indexHints,
      estimatedPerformance,
      recommendations,
    };
  }

  /**
   * Get optimal fields for entity
   */
  private getOptimalSelectFields(entity: string, required: string[]): string[] {
    const commonFields: Record<string, string[]> = {
      Order: ['id', 'userId', 'totalAmount', 'status', 'createdAt'],
      Product: ['id', 'name', 'price', 'rating', 'id', 'inventoryCount'],
      User: ['id', 'email', 'name', 'status', 'createdAt'],
      Review: ['id', 'productId', 'rating', 'text', 'createdAt'],
    };

    if (required.length > 0) {
      return required;
    }

    return commonFields[entity] || [];
  }

  /**
   * Estimate query performance
   */
  private estimatePerformance(
    selectFields: string[],
    joins: string[],
    indexHints: string[]
  ): 'GOOD' | 'MODERATE' | 'POOR' {
    let score = 100;

    // Penalty for selecting too many fields
    if (selectFields.length > 10) score -= 30;
    // Penalty for multiple joins
    if (joins.length > 2) score -= 20;
    // Bonus for using index hints
    if (indexHints.length > 0) score += 15;

    if (score >= 70) return 'GOOD';
    if (score >= 40) return 'MODERATE';
    return 'POOR';
  }

  /**
   * Create paginated response
   */
  createPaginatedResponse<T>(
    data: T[],
    page: number,
    limit: number,
    total: number
  ): { data: T[]; pagination: PaginationMetadata } {
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    return {
      data: data.slice(offset, offset + limit),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Batch process items
   */
  async batchProcess<T, R>(
    items: T[],
    processFn: (batch: T[]) => Promise<R[]>,
    batchSize: number = 100
  ): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      try {
        const batchResults = await processFn(batch);
        results.push(...batchResults);
      } catch (error) {
        this.logger.error(`Batch processing error at index ${i}: ${error}`);
        throw error;
      }
    }

    return results;
  }

  /**
   * Cache query result
   */
  cacheQueryResult(key: string, data: any): void {
    this.queryCache.set(key, {
      data,
      timestamp: Date.now(),
    });

    // Cleanup old cache entries
    if (this.queryCache.size > 1000) {
      const now = Date.now();
      let removed = 0;

      for (const [cacheKey, value] of this.queryCache.entries()) {
        if (now - value.timestamp > this.CACHE_TTL) {
          this.queryCache.delete(cacheKey);
          removed++;
        }
      }

      this.logger.debug(`Cleaned up ${removed} cache entries`);
    }
  }

  /**
   * Get cached query result
   */
  getCachedQueryResult(key: string): any | null {
    const cached = this.queryCache.get(key);

    if (!cached) {
      return null;
    }

    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.queryCache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Invalidate cache pattern
   */
  invalidateCachePattern(pattern: string): number {
    let removed = 0;
    const regex = new RegExp(pattern);

    for (const key of this.queryCache.keys()) {
      if (regex.test(key)) {
        this.queryCache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get pagination params
   */
  getPaginationParams(
    page?: number | string,
    limit?: number | string,
    maxLimit: number = 100
  ): { page: number; limit: number } {
    let parsedPage = parseInt(page as string) || 1;
    let parsedLimit = parseInt(limit as string) || 20;

    // Validate
    if (parsedPage < 1) parsedPage = 1;
    if (parsedLimit < 1) parsedLimit = 1;
    if (parsedLimit > maxLimit) parsedLimit = maxLimit;

    return { page: parsedPage, limit: parsedLimit };
  }

  /**
   * Build sort order
   */
  buildSortOrder(
    sortBy?: string,
    sortOrder?: string,
    allowedFields?: string[]
  ): { field: string; order: 'ASC' | 'DESC' } {
    let field = sortBy || 'id';
    let order: 'ASC' | 'DESC' = 'ASC';

    // Validate field if allowlist provided
    if (allowedFields && !allowedFields.includes(field)) {
      field = allowedFields[0];
    }

    // Validate order
    if (sortOrder?.toUpperCase() === 'DESC') {
      order = 'DESC';
    }

    return { field, order };
  }

  /**
   * Compress response data
   */
  compressData(
    data: any,
    threshold: number = 1024
  ): {
    compressed: boolean;
    size: number;
    compressedSize?: number;
  } {
    const json = JSON.stringify(data);
    const size = Buffer.byteLength(json);

    return {
      compressed: size > threshold,
      size,
      compressedSize: size > threshold ? Math.floor(size * 0.7) : undefined, // Estimate 70% compression
    };
  }

  /**
   * Create database index recommendations
   */
  getIndexRecommendations(entity: string): string[] {
    const recommendations: Record<string, string[]> = {
      Order: [
        'CREATE INDEX idx_orders_userId ON orders(user_id)',
        'CREATE INDEX idx_orders_status ON orders(status)',
        'CREATE INDEX idx_orders_createdAt ON orders(created_at DESC)',
        'CREATE COMPOSITE INDEX idx_orders_user_status ON orders(user_id, status)',
      ],
      Product: [
        'CREATE INDEX idx_products_categoryId ON products(category_id)',
        'CREATE FULLTEXT INDEX idx_products_search ON products(name, description)',
        'CREATE INDEX idx_products_price ON products(price)',
        'CREATE INDEX idx_products_rating ON products(rating DESC)',
      ],
      Review: [
        'CREATE INDEX idx_reviews_productId ON reviews(product_id)',
        'CREATE INDEX idx_reviews_userId ON reviews(user_id)',
        'CREATE INDEX idx_reviews_rating ON reviews(rating)',
      ],
      User: [
        'CREATE INDEX idx_users_email ON users(email)',
        'CREATE INDEX idx_users_status ON users(status)',
        'CREATE INDEX idx_users_createdAt ON users(created_at DESC)',
      ],
    };

    return recommendations[entity] || [];
  }

  /**
   * Estimate memory usage
   */
  estimateMemoryUsage(data: any): number {
    const json = JSON.stringify(data);
    const buffer = Buffer.from(json);
    return buffer.length; // In bytes
  }

  /**
   * Calculate query execution time estimate
   */
  estimateExecutionTime(
    rowCount: number,
    complexity: 'SIMPLE' | 'MODERATE' | 'COMPLEX' = 'MODERATE'
  ): number {
    const baseTime = {
      SIMPLE: 0.001,
      MODERATE: 0.005,
      COMPLEX: 0.02,
    };

    // Simple: 1ms per 1000 rows
    // Moderate: 5ms per 1000 rows
    // Complex: 20ms per 1000 rows
    return (rowCount / 1000) * baseTime[complexity] * 1000; // In ms
  }
}
