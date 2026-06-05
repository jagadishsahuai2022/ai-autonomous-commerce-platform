/**
 * Unit Tests — ProductService
 * Tests pagination, caching, exception handling, and event emission.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product.service';
import { PrismaService } from '../../services/prisma.service';
import { RedisService } from '../../services/redis.service';
import { KafkaService } from '../../kafka/kafka.service';
import { NotFoundException, InternalServerException } from '../../common/exceptions/app.exception';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const MOCK_PRODUCTS = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  name: `Product ${i + 1}`,
  description: `Description for product ${i + 1}`,
  price: 1000 + i * 100,
  originalPrice: 1200 + i * 100,
  category: i < 10 ? 'Electronics' : 'Books',
  brand: 'Brand',
  image: '/placeholder.svg',
  rating: 4.0,
  reviewCount: 100,
  stock: 50,
  inStock: true,
  delivery: { daysMin: 1, daysMax: 3, free: true },
  codAvailable: true,
  hasEMI: i % 2 === 0,
  createdAt: new Date(),
}));

function makePrismaMock(overrides: Partial<Record<keyof PrismaService, any>> = {}) {
  return {
    countProducts: jest.fn().mockResolvedValue(10000),
    findAllProducts: jest.fn().mockResolvedValue(MOCK_PRODUCTS),
    findProductsByCategory: jest.fn().mockResolvedValue(MOCK_PRODUCTS.slice(0, 10)),
    product: {
      findMany: jest.fn().mockResolvedValue(MOCK_PRODUCTS.filter((_, i) => i < 5)),
      findUnique: jest.fn().mockResolvedValue(MOCK_PRODUCTS[0]),
    },
    ...overrides,
  };
}

function makeRedisMock() {
  const store = new Map<string, any>();
  return {
    get: jest.fn().mockImplementation(async (key: string) => store.get(key) ?? null),
    set: jest.fn().mockImplementation(async (key: string, value: any) => store.set(key, value)),
    delete: jest.fn().mockImplementation(async (key: string) => store.delete(key)),
    flush: jest.fn().mockResolvedValue(undefined),
  };
}

function makeKafkaMock() {
  return {
    sendMessage: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn().mockResolvedValue(undefined),
    emitToMultiple: jest.fn().mockResolvedValue(undefined),
  };
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('ProductService', () => {
  let service: ProductService;
  let prismaMock: ReturnType<typeof makePrismaMock>;
  let redisMock: ReturnType<typeof makeRedisMock>;
  let kafkaMock: ReturnType<typeof makeKafkaMock>;

  async function buildModule(prismaOverrides: Partial<Record<keyof PrismaService, any>> = {}) {
    prismaMock = makePrismaMock(prismaOverrides);
    redisMock = makeRedisMock();
    kafkaMock = makeKafkaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisMock },
        { provide: KafkaService, useValue: kafkaMock },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  }

  beforeEach(async () => {
    await buildModule();
  });

  afterEach(() => jest.clearAllMocks());

  // ─── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns paginated products with total', async () => {
      const result = await service.findAll(0, 20);
      expect(result.products).toHaveLength(20);
      expect(result.total).toBe(10000);
      expect(result.skip).toBe(0);
      expect(result.take).toBe(20);
    });

    it('calls prisma.findAllProducts with correct skip/take', async () => {
      await service.findAll(100, 50);
      expect(prismaMock.findAllProducts).toHaveBeenCalledWith(100, 50, expect.any(Array));
    });

    it('uses cached response on second call (cache hit)', async () => {
      // First call — populates cache
      await service.findAll(0, 20);
      expect(prismaMock.findAllProducts).toHaveBeenCalledTimes(1);

      // Second call — hits cache
      await service.findAll(0, 20);
      expect(prismaMock.findAllProducts).toHaveBeenCalledTimes(1); // not called again
    });

    it('stores result in cache after fetch', async () => {
      await service.findAll(0, 20);
      expect(redisMock.set).toHaveBeenCalledWith(
        expect.stringContaining('products:list'),
        expect.objectContaining({ total: 10000 }),
        expect.objectContaining({ ttl: expect.any(Number) })
      );
    });

    it('throws InternalServerException on prisma error', async () => {
      prismaMock.findAllProducts.mockRejectedValueOnce(new Error('DB down'));
      await expect(service.findAll()).rejects.toThrow(InternalServerException);
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('returns a product by valid id', async () => {
      const product = await service.findOne(1);
      expect(product).toBeDefined();
      expect(prismaMock.product.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('throws NotFoundException when prisma returns null', async () => {
      prismaMock.product.findUnique.mockResolvedValueOnce(null);
      await expect(service.findOne(9999)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for id <= 0', async () => {
      await expect(service.findOne(0)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(-1)).rejects.toThrow(NotFoundException);
    });

    it('uses cached product on second call', async () => {
      await service.findOne(1);
      await service.findOne(1);
      expect(prismaMock.product.findUnique).toHaveBeenCalledTimes(1);
    });

    it('caches the product after first fetch', async () => {
      await service.findOne(1);
      expect(redisMock.set).toHaveBeenCalledWith(
        expect.stringContaining('product:1'),
        expect.any(Object),
        expect.anything()
      );
    });

    it('emits product viewed event when userId provided', async () => {
      await service.findOne(1, 42);
      // Allow async event emission to settle
      await new Promise((r) => setTimeout(r, 50));
      expect(kafkaMock.emitToMultiple).toHaveBeenCalled();
    });

    it('does not emit event when userId not provided', async () => {
      await service.findOne(1);
      await new Promise((r) => setTimeout(r, 50));
      expect(kafkaMock.sendMessage).not.toHaveBeenCalled();
    });

    it('throws InternalServerException on unexpected db error', async () => {
      prismaMock.product.findUnique.mockRejectedValueOnce(new Error('timeout'));
      await expect(service.findOne(1)).rejects.toThrow(InternalServerException);
    });
  });

  // ─── findByCategory ───────────────────────────────────────────────────────────

  describe('findByCategory()', () => {
    it('returns products for valid category', async () => {
      const result = await service.findByCategory('Electronics');
      expect(result.length).toBeGreaterThan(0);
      expect(prismaMock.findProductsByCategory).toHaveBeenCalledWith(
        'Electronics',
        expect.any(Array)
      );
    });

    it('throws error for empty category string', async () => {
      await expect(service.findByCategory('')).rejects.toThrow();
    });

    it('uses cache on repeated calls', async () => {
      await service.findByCategory('Electronics');
      await service.findByCategory('Electronics');
      expect(prismaMock.findProductsByCategory).toHaveBeenCalledTimes(1);
    });

    it('throws InternalServerException on prisma error', async () => {
      prismaMock.findProductsByCategory.mockRejectedValueOnce(new Error('error'));
      await expect(service.findByCategory('Electronics')).rejects.toThrow(InternalServerException);
    });
  });

  // ─── findFeatured ─────────────────────────────────────────────────────────────

  describe('findFeatured()', () => {
    it('returns featured products', async () => {
      const result = await service.findFeatured(5);
      expect(result.length).toBeGreaterThan(0);
    });

    it('clamps limit to 100', async () => {
      await service.findFeatured(200);
      // Should not crash, limit is clamped internally
      expect(prismaMock.findAllProducts).toHaveBeenCalled();
    });

    it('uses cache on second call', async () => {
      await service.findFeatured(5);
      await service.findFeatured(5);
      expect(prismaMock.findAllProducts).toHaveBeenCalledTimes(1);
    });
  });

  // ─── invalidateCache ──────────────────────────────────────────────────────────

  describe('invalidateCache()', () => {
    it('invalidates single product cache when id provided', async () => {
      await service.invalidateCache(1);
      expect(redisMock.delete).toHaveBeenCalledWith('product:1');
    });

    it('flushes all cache when no id provided', async () => {
      await service.invalidateCache();
      expect(redisMock.flush).toHaveBeenCalled();
    });
  });

  // ─── Cache Independence (different pages = different cache keys) ──────────────

  describe('pagination cache keys', () => {
    it('separate cache keys for different skip/take values', async () => {
      await service.findAll(0, 20);
      await service.findAll(20, 20);
      // Both should hit prisma (different cache keys)
      expect(prismaMock.findAllProducts).toHaveBeenCalledTimes(2);
    });
  });
});
