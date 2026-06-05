import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { RedisService } from '../../services/redis.service';
import { LoggerService } from '../../common/logger.service';
import { NotFoundException, InternalServerException } from '../../common/exceptions/app.exception';
import { ProductResponseDto, ProductListResponseDto, CategoryResponseDto } from './dto/product.dto';
import { KafkaService } from '../../kafka/kafka.service';
import { EventType, KAFKA_TOPICS, EventBuilder } from '../../common/events/domain.event';
import * as crypto from 'crypto';

// Short TTL for product list so changes to TOTAL_PRODUCTS propagate quickly.
// Individual product pages keep a longer 1-hour TTL.
const PRODUCT_LIST_CACHE_TTL = 120; // 2 minutes
const FILTER_CACHE_TTL = 300; // 5 minutes for filtered results
const CATEGORIES_CACHE_TTL = 600; // 10 minutes for category list
const PRODUCT_CACHE_TTL = 3600; // 1 hour
const PRODUCTS_LIST_CACHE_KEY = `products:list:v${process.env.TOTAL_PRODUCTS_VERSION ?? '1'}`;
const PRODUCT_CACHE_KEY_PREFIX = 'product:';
const CATEGORIES_CACHE_KEY = 'products:categories:v1';

const PRODUCT_FIELDS = [
  'id',
  'name',
  'description',
  'price',
  'originalPrice',
  'discountPct',
  'category',
  'brand',
  'image',
  'imageUrl',
  'rating',
  'reviewCount',
  'stock',
  'inStock',
  'delivery',
  'codAvailable',
  'hasEMI',
  'createdAt',
];

/**
 * Normalise product image field — the DB stores the URL in `imageUrl` (Prisma field name)
 * but the legacy DTO and frontend code rely on `image`. This helper ensures BOTH fields
 * are always populated so consumers don't have to distinguish.
 */
function mapProductImage(p: any): any {
  const url = p.image || p.imageUrl || undefined;
  return { ...p, image: url, imageUrl: url };
}

@Injectable()
export class ProductService {
  private readonly logger = new Logger('ProductService');
  private readonly appLogger = new LoggerService();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly kafkaService: KafkaService // Inject Kafka service
  ) {}

  /**
   * Find all products with pagination and caching
   * Does NOT emit events (list view is not tracked as individual product views)
   */
  async findAll(skip = 0, take = 10): Promise<ProductListResponseDto> {
    try {
      // Generate cache key with pagination
      const cacheKey = `${PRODUCTS_LIST_CACHE_KEY}:${skip}:${take}`;

      // Check cache first
      const cached = await this.redis.get<ProductListResponseDto>(cacheKey);
      if (cached) {
        this.appLogger.debug('Cache hit for products list', { skip, take });
        return cached;
      }

      // Fetch all product fields including rich display data
      const products = await this.prisma.findAllProducts(skip, take, [
        'id',
        'name',
        'description',
        'price',
        'originalPrice',
        'category',
        'brand',
        'image',
        'rating',
        'reviewCount',
        'stock',
        'inStock',
        'delivery',
        'codAvailable',
        'hasEMI',
        'createdAt',
      ]);

      const response: ProductListResponseDto = {
        products: (products as any[]).map(mapProductImage) as ProductResponseDto[],
        total: await this.prisma.countProducts(),
        skip,
        take,
      };

      // Cache result with short TTL so catalog size changes propagate quickly
      await this.redis.set(cacheKey, response, { ttl: PRODUCT_LIST_CACHE_TTL });

      this.appLogger.log('Products fetched successfully', { skip, take, count: products.length });

      return response;
    } catch (error) {
      this.logger.error('Error fetching products', (error as any).stack);
      throw new InternalServerException('Failed to fetch products');
    }
  }

  /**
   * Find product by ID with caching
   * Emits "product.viewed" event for analytics and recommendations
   */
  async findOne(id: number, userId?: number): Promise<ProductResponseDto> {
    try {
      // Validate ID
      if (id <= 0) {
        throw new NotFoundException('Product');
      }

      const cacheKey = `${PRODUCT_CACHE_KEY_PREFIX}${id}`;

      // Check cache
      const cached = await this.redis.get<ProductResponseDto>(cacheKey);
      if (cached) {
        this.appLogger.debug('Cache hit for product', { productId: id });

        // Emit product view event (non-blocking)
        if (userId) {
          this.emitProductViewedEvent(userId, id).catch((error) => {
            this.logger.warn('Failed to emit product viewed event', error.message);
          });
        }

        return cached;
      }

      // Query the Prisma model directly for single-product fetches so the
      // endpoint remains stable even if helper wrappers are refactored.
      const product = await this.prisma.product.findUnique({ where: { id } });

      if (!product) {
        throw new NotFoundException('Product');
      }

      // Cache result
      await this.redis.set(cacheKey, product, { ttl: PRODUCT_CACHE_TTL });

      // Emit product view event (non-blocking, don't await)
      if (userId) {
        this.emitProductViewedEvent(userId, id).catch((error) => {
          this.logger.warn('Failed to emit product viewed event', error.message);
        });
      }

      return mapProductImage(product) as unknown as ProductResponseDto;
    } catch (error) {
      this.logger.error('Error fetching product', (error as any).stack, { productId: id });

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerException('Failed to fetch product');
    }
  }

  /**
   * Find products by category with caching
   */
  async findByCategory(category: string): Promise<ProductResponseDto[]> {
    try {
      if (!category || category.trim().length === 0) {
        throw new Error('Category is required');
      }

      const cacheKey = `products:category:${category}`;

      // Check cache
      const cached = await this.redis.get<ProductResponseDto[]>(cacheKey);
      if (cached) {
        this.appLogger.debug('Cache hit for category products', { category });
        return cached;
      }

      // Query with optimization
      const products = await this.prisma.findProductsByCategory(category, [
        'id',
        'name',
        'price',
        'category',
      ]);

      if (!products || products.length === 0) {
        this.appLogger.log('No products found for category', { category });
      }

      // Cache result
      await this.redis.set(cacheKey, products as unknown as ProductResponseDto[], {
        ttl: PRODUCT_CACHE_TTL,
      });

      return (products as any[]).map(mapProductImage) as unknown as ProductResponseDto[];
    } catch (error) {
      this.logger.error('Error fetching products by category', (error as any).message, {
        category,
      });
      throw new InternalServerException('Failed to fetch products by category');
    }
  }

  /**
   * Get distinct categories with product counts — cached for 10 minutes.
   */
  async getCategories(): Promise<CategoryResponseDto[]> {
    try {
      const cached = await this.redis.get<CategoryResponseDto[]>(CATEGORIES_CACHE_KEY);
      if (cached) return cached;

      const categories = this.prisma.getCategories();
      await this.redis.set(CATEGORIES_CACHE_KEY, categories, { ttl: CATEGORIES_CACHE_TTL });
      return categories;
    } catch (error) {
      this.logger.error('Error fetching categories', (error as any).message);
      // Fallback: return from prisma without caching
      return this.prisma.getCategories();
    }
  }

  /**
   * Find products with server-side filters applied.
   * Results are cached per unique filter combination.
   */
  async findWithFilters(opts: {
    skip?: number;
    take?: number;
    search?: string;
    category?: string;
    brand?: string;
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    minDiscount?: number;
    freeDelivery?: boolean;
    expressDelivery?: boolean;
    codAvailable?: boolean;
    sortBy?: string;
  }): Promise<ProductListResponseDto> {
    try {
      const { skip = 0, take = 20 } = opts;

      // Build stable cache key from filter opts (exclude pagination for total count)
      const filterHash = crypto
        .createHash('sha1')
        .update(JSON.stringify({ ...opts, skip: 0, take: 0 }))
        .digest('hex')
        .slice(0, 12);
      const cacheKey = `products:filtered:${filterHash}:${skip}:${take}`;

      const cached = await this.redis.get<ProductListResponseDto>(cacheKey);
      if (cached) {
        this.appLogger.debug('Cache hit for filtered products', { filterHash, skip, take });
        return cached;
      }

      const { products, total } = await this.prisma.findProductsWithFilters({
        ...opts,
        select: PRODUCT_FIELDS,
      });

      const response: ProductListResponseDto = {
        products: products as unknown as ProductResponseDto[],
        total,
        skip,
        take,
      };

      await this.redis.set(cacheKey, response, { ttl: FILTER_CACHE_TTL });
      this.appLogger.log('Filtered products fetched', {
        filterHash,
        total,
        returned: products.length,
      });
      return response;
    } catch (error) {
      this.logger.error('Error fetching filtered products', (error as any).stack);
      throw new InternalServerException('Failed to fetch filtered products');
    }
  }

  /**
   * Invalidate product cache
   */
  async invalidateCache(id?: number): Promise<void> {
    try {
      if (id) {
        const cacheKey = `${PRODUCT_CACHE_KEY_PREFIX}${id}`;
        await this.redis.delete(cacheKey);
        this.appLogger.log('Product cache invalidated', { productId: id });
      } else {
        // Invalidate all products cache (can improve this with Redis SCAN in production)
        await this.redis.flush();
        this.appLogger.log('All product cache invalidated');
      }
    } catch (error) {
      this.logger.error('Error invalidating cache', (error as any).message);
    }
  }

  /**
   * Find featured products with caching
   */
  async findFeatured(limit: number = 12): Promise<ProductResponseDto[]> {
    try {
      const validLimit = Math.min(Math.max(1, limit), 100);
      const cacheKey = `products:featured:${validLimit}`;

      // Check cache
      const cached = await this.redis.get<ProductResponseDto[]>(cacheKey);
      if (cached) {
        this.appLogger.debug('Cache hit for featured products', { limit: validLimit });
        return cached;
      }

      // Query featured products (first N products marked as featured in the generator)
      const products = await this.prisma.findAllProducts(0, validLimit, [
        'id',
        'name',
        'price',
        'description',
        'category',
        'brand',
        'image',
        'rating',
        'reviewCount',
        'inStock',
        'delivery',
        'codAvailable',
        'hasEMI',
        'originalPrice',
        'createdAt',
      ]);

      if (!products || products.length === 0) {
        this.appLogger.log('No featured products found');
      }

      // Cache result
      await this.redis.set(cacheKey, products as unknown as ProductResponseDto[], {
        ttl: PRODUCT_CACHE_TTL,
      });

      return (products as any[]).map(mapProductImage) as unknown as ProductResponseDto[];
    } catch (error) {
      this.logger.error('Error fetching featured products', (error as any).message, { limit });
      throw new InternalServerException('Failed to fetch featured products');
    }
  }

  /**
   * Emit product viewed event
   * Non-blocking event emission for analytics and recommendations
   */
  private async emitProductViewedEvent(userId: number, productId: number): Promise<void> {
    try {
      const event = new EventBuilder()
        .withEventType(EventType.PRODUCT_VIEWED)
        .withUserId(userId)
        .withProductId(productId)
        .build();

      // Emit to multiple topics for different consumers
      await this.kafkaService.emitToMultiple(
        [KAFKA_TOPICS.PRODUCT_EVENTS, KAFKA_TOPICS.USER_BEHAVIOR, KAFKA_TOPICS.ANALYTICS],
        event
      );

      this.appLogger.debug('Product viewed event emitted', {
        userId,
        productId,
        eventId: event.eventId,
      });
    } catch (error) {
      // Don't throw - event emission should not block product retrieval
      this.logger.error('Failed to emit product viewed event', (error as any).message);
    }
  }
}
