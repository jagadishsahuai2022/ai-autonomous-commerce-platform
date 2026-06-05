import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { InternalServerException } from '../common/exceptions/app.exception';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('PrismaService');
  private prismaClient: PrismaClient;
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    const adapter = new PrismaPg(this.pool);
    this.prismaClient = new PrismaClient({
      adapter,
      log: [
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    try {
      await this.prismaClient.$connect();
      this.logger.log('? Prisma client connected to PostgreSQL database');
    } catch (error) {
      this.logger.error('? Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.prismaClient.$disconnect();
    await this.pool.end();
    this.logger.log('?? Prisma client disconnected from database');
  }

  // Expose prisma model accessors
  get user() {
    return this.prismaClient.user;
  }
  get product() {
    return this.prismaClient.product;
  }
  get wallet() {
    return this.prismaClient.wallet;
  }
  get order() {
    return this.prismaClient.order;
  }
  get orderItem() {
    return this.prismaClient.orderItem;
  }
  get cart() {
    return this.prismaClient.cart;
  }
  get cartItem() {
    return this.prismaClient.cartItem;
  }
  get userPreferences() {
    return this.prismaClient.userPreferences;
  }
  get userMemory() {
    return this.prismaClient.userMemory;
  }
  get chatMessage() {
    return this.prismaClient.chatMessage;
  }
  get seller() {
    return this.prismaClient.seller;
  }
  get sellerProduct() {
    return this.prismaClient.sellerProduct;
  }
  get walletTransaction() {
    return this.prismaClient.walletTransaction;
  }
  get walletAuthorization() {
    return this.prismaClient.walletAuthorization;
  }
  get featureFlag() {
    return this.prismaClient.featureFlag;
  }
  get approvalRequest() {
    return this.prismaClient.approvalRequest;
  }
  get aiDecisionLog() {
    return this.prismaClient.aIDecisionLog;
  }
  get refreshToken() {
    return this.prismaClient.refreshToken;
  }
  get activityLog() {
    return this.prismaClient.activityLog;
  }
  get rankingPersonalization() {
    return this.prismaClient.rankingPersonalization;
  }
  get autoDecisionLog() {
    return this.prismaClient.autoDecisionLog;
  }
  get preferenceQuiz() {
    return this.prismaClient.preferenceQuiz;
  }
  get validationSession() {
    return this.prismaClient.validationSession;
  }
  get buyRequest() {
    return this.prismaClient.buyRequest;
  }
  get walletAuditLog() {
    return this.prismaClient.walletAuditLog;
  }
  get walletSpendingLimit() {
    return this.prismaClient.walletSpendingLimit;
  }
  get buyingPattern() {
    return this.prismaClient.buyingPattern;
  }
  get memoryInsight() {
    return this.prismaClient.memoryInsight;
  }
  get priceHistory() {
    return this.prismaClient.priceHistory;
  }
  get sellerAiAnalytics() {
    return this.prismaClient.sellerAiAnalytics;
  }
  get wishlistCollection() {
    return this.prismaClient.wishlistCollection;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get wishlistCollectionProduct(): any {
    return (this.prismaClient as any).wishlistCollectionProduct;
  }

  // Expose raw query methods with correct binding
  $queryRaw<T = unknown>(query: TemplateStringsArray | string, ...values: any[]): Promise<T> {
    return (this.prismaClient.$queryRaw as any)(query, ...values) as Promise<T>;
  }

  $executeRaw(query: TemplateStringsArray | string, ...values: any[]): Promise<number> {
    return (this.prismaClient.$executeRaw as any)(query, ...values) as Promise<number>;
  }

  $transaction<T>(
    fn: (client: PrismaClient) => Promise<T>,
    options?: { maxWait?: number; timeout?: number }
  ): Promise<T> {
    return this.prismaClient.$transaction(fn as any, options) as Promise<T>;
  }

  async findUserByEmail(email: string) {
    try {
      const user = await this.prismaClient.user.findUnique({
        where: { email },
      });
      if (!user) {
        this.logger.debug(`User not found: ${email}`);
        return null;
      }
      return user;
    } catch (error) {
      this.logger.error(`Error finding user by email: ${email}`, (error as any).message);
      throw new InternalServerException('Database error');
    }
  }

  async findUserById(id: number, _fields?: string[]) {
    try {
      return await this.prismaClient.user.findUnique({
        where: { id },
      });
    } catch (error) {
      this.logger.error(`Error finding user by ID: ${id}`, (error as any).message);
      throw new InternalServerException('Database error');
    }
  }

  async createUser(data: { email: string; name?: string; passwordHash?: string }) {
    try {
      return await this.prismaClient.user.create({
        data,
      });
    } catch (error) {
      this.logger.error(`Error creating user`, (error as any).message);
      throw new InternalServerException('Database error');
    }
  }

  async findAllProducts(skip = 0, take = 10, _fields?: string[]) {
    try {
      return await this.prismaClient.product.findMany({
        skip,
        take,
        include: { businessMetrics: { select: { inventoryCount: true } } },
      });
    } catch (error) {
      this.logger.error(`Error finding products`, (error as any).message);
      throw new InternalServerException('Database error');
    }
  }

  async findProductById(id: number, _fields?: string[]) {
    try {
      if (!id || id <= 0) return null;
      return await this.prismaClient.product.findUnique({
        where: { id },
        include: { businessMetrics: { select: { inventoryCount: true } } },
      });
    } catch (error) {
      this.logger.error(`Error finding product by id: ${id}`, (error as any).message);
      throw new InternalServerException('Database error');
    }
  }

  async findProductsByCategory(category: string, _fields?: string[]) {
    try {
      return await this.prismaClient.product.findMany({
        where: { category },
        include: { businessMetrics: { select: { inventoryCount: true } } },
      });
    } catch (error) {
      this.logger.error(`Error finding products by category: ${category}`, (error as any).message);
      throw new InternalServerException('Database error');
    }
  }

  getCategories(): any {
    return this.prismaClient.product
      .findMany({
        select: { category: true },
        distinct: ['category'],
      })
      .then((rows: { category: string }[]) => rows.map((r) => ({ name: r.category, count: 0 })));
  }

  async findProductsWithFilters(opts: {
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
    select?: string[];
    [key: string]: any;
  }): Promise<{ products: any[]; total: number }> {
    try {
      const {
        skip = 0,
        take = 20,
        search,
        category,
        brand,
        minPrice,
        maxPrice,
        minRating,
        minDiscount,
        freeDelivery,
        expressDelivery,
        codAvailable,
        sortBy,
      } = opts;
      const where: any = {};
      // Category — case-insensitive substring match. The seed stores
      // lowercase snake_case category names ("electronics", "home_kitchen")
      // but the UI lets users type free-form. Substring + insensitive mode
      // makes the filter actually work for any reasonable input.
      if (category) where.category = { contains: category, mode: 'insensitive' };
      // Brand: the Product model does NOT have a `brand` column (brand is
      // baked into the product name during seeding). Match against `name`
      // instead so users still get something useful when they type a brand.
      if (brand) {
        where.AND = (where.AND ?? []).concat([{ name: { contains: brand, mode: 'insensitive' } }]);
      }
      if (minPrice !== undefined || maxPrice !== undefined) {
        where.price = {};
        if (minPrice !== undefined) where.price.gte = minPrice;
        if (maxPrice !== undefined) where.price.lte = maxPrice;
      }
      // NOTE: minRating, codAvailable, freeDelivery, expressDelivery and
      // minDiscount reference columns that do not exist on the current
      // Product model (rating/reviewCount/codAvailable/delivery/discountPct
      // were never migrated). Treating them as no-ops here prevents the
      // Prisma validation error that previously made every filtered query
      // throw a 500 and silently fall back to the web proxy's mock catalog.
      void minRating;
      void minDiscount;
      void freeDelivery;
      void expressDelivery;
      void codAvailable;
      // Free-text search across name / description / category / genericName
      // (case-insensitive). `genericName` is the most reliable column for
      // human-readable product types ("Laptop", "Washing Machine") populated
      // by V0066. Each token must match at least one of these columns.
      if (search && search.length > 0) {
        const tokens = search.trim().split(/\s+/).filter(Boolean);
        if (tokens.length > 0) {
          const tokenAnd = tokens.map((t) => ({
            OR: [
              { name: { contains: t, mode: 'insensitive' } },
              { description: { contains: t, mode: 'insensitive' } },
              { category: { contains: t, mode: 'insensitive' } },
              { genericName: { contains: t, mode: 'insensitive' } },
            ],
          }));
          where.AND = (where.AND ?? []).concat(tokenAnd);
        }
      }
      // Map sortBy → Prisma orderBy. Only fields that EXIST on Product are
      // valid. `rating`/`discount`/`popularity` are mapped to safe proxies
      // (featured + price + createdAt) so the query never throws.
      let orderBy: any | undefined;
      switch ((sortBy || '').toLowerCase()) {
        case 'price-low':
        case 'price_asc':
        case 'price':
          orderBy = { price: 'asc' };
          break;
        case 'price-high':
        case 'price_desc':
          orderBy = { price: 'desc' };
          break;
        case 'rating':
          // No rating column → fallback to featured-first, then newest.
          orderBy = [{ featured: 'desc' }, { createdAt: 'desc' }];
          break;
        case 'newest':
        case 'latest':
          orderBy = { createdAt: 'desc' };
          break;
        case 'discount':
        case 'popularity':
          orderBy = [{ featured: 'desc' }, { createdAt: 'desc' }];
          break;
        default:
          orderBy = undefined;
      }

      const [products, total] = await Promise.all([
        this.prismaClient.product.findMany({
          where,
          skip,
          take,
          ...(orderBy ? { orderBy } : {}),
        }),
        this.prismaClient.product.count({ where }),
      ]);

      // Post-filters for fields not modelled as scalar columns are no-ops
      // here — see the comment above. Returning the page as-is.
      return { products, total };
    } catch (error) {
      this.logger.error(`Error finding products with filters`, (error as any).message);
      throw new InternalServerException('Database error');
    }
  }

  async countProducts(): Promise<number> {
    try {
      return await this.prismaClient.product.count();
    } catch (error) {
      this.logger.error('Error counting products', (error as any).message);
      throw new InternalServerException('Database error');
    }
  }
}
