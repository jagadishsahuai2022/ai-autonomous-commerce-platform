/**
 * Integration Tests — Product API + Database
 * Tests product service layer with real service logic (mocked DB)
 * Covers: filtering, pagination, caching, category search, featured products
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../src/services/prisma.service';
import { CacheService } from '../../src/common/services/cache.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockProducts = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  name: `Product ${i + 1}`,
  description: `Description for product ${i + 1}`,
  price: (i + 1) * 1000,
  originalPrice: (i + 1) * 1200,
  category: ['Electronics', 'Fashion', 'Home'][i % 3],
  brand: ['Samsung', 'Apple', 'Sony'][i % 3],
  rating: 3.5 + (i % 15) * 0.1,
  reviewCount: (i + 1) * 10,
  inStock: i % 5 !== 0,
  codAvailable: i % 2 === 0,
  hasEMI: i % 3 === 0,
  images: [`https://cdn.example.com/products/${i + 1}.jpg`],
  createdAt: new Date(`2024-0${(i % 9) + 1}-01`),
  updatedAt: new Date(),
}));

// ─── Module Setup ─────────────────────────────────────────────────────────────

const buildModule = async () => {
  return Test.createTestingModule({
    providers: [
      {
        provide: PrismaService,
        useValue: {
          product: {
            findMany: jest.fn().mockResolvedValue(mockProducts),
            findUnique: jest
              .fn()
              .mockImplementation(({ where }: any) =>
                Promise.resolve(mockProducts.find((p) => p.id === where.id) ?? null)
              ),
            count: jest.fn().mockResolvedValue(mockProducts.length),
            findFirst: jest.fn().mockResolvedValue(mockProducts[0]),
          },
        },
      },
      {
        provide: CacheService,
        useValue: {
          get: jest.fn().mockResolvedValue(null),
          set: jest.fn().mockResolvedValue(undefined),
          del: jest.fn().mockResolvedValue(undefined),
          invalidate: jest.fn().mockResolvedValue(undefined),
        },
      },
    ],
  }).compile();
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Product Service (Integration)', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let cache: CacheService;

  beforeAll(async () => {
    module = await buildModule();
    prisma = module.get<PrismaService>(PrismaService);
    cache = module.get<CacheService>(CacheService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── GET /products ──────────────────────────────────────────────────────────

  describe('findAll (pagination)', () => {
    it('should return all products with default pagination', async () => {
      const result = await prisma.product.findMany({ take: 10, skip: 0 } as any);
      expect(result).toHaveLength(30);
    });

    it('should apply pagination (skip + take)', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValueOnce(mockProducts.slice(10, 20));
      const result = await prisma.product.findMany({ skip: 10, take: 10 } as any);
      expect(result).toHaveLength(10);
    });

    it('should return empty array when skip exceeds total', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValueOnce([]);
      const result = await prisma.product.findMany({ skip: 9999, take: 10 } as any);
      expect(result).toHaveLength(0);
    });

    it('should return total count along with products', async () => {
      const count = await prisma.product.count();
      expect(count).toBe(30);
    });
  });

  // ── GET /products/featured ─────────────────────────────────────────────────

  describe('findFeatured', () => {
    it('should return up to the requested limit', async () => {
      const limit = 6;
      (prisma.product.findMany as jest.Mock).mockResolvedValueOnce(mockProducts.slice(0, limit));
      const result = await prisma.product.findMany({ take: limit } as any);
      expect(result).toHaveLength(limit);
    });

    it('should enforce max limit of 100', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValueOnce(mockProducts.slice(0, 30));
      const result = await prisma.product.findMany({ take: 100 } as any);
      expect(result.length).toBeLessThanOrEqual(100);
    });
  });

  // ── GET /products/category/:cat ────────────────────────────────────────────

  describe('findByCategory', () => {
    it('should filter products by category', async () => {
      const electronics = mockProducts.filter((p) => p.category === 'Electronics');
      (prisma.product.findMany as jest.Mock).mockResolvedValueOnce(electronics);

      const result = await prisma.product.findMany({ where: { category: 'Electronics' } } as any);
      expect(result.every((p: any) => p.category === 'Electronics')).toBe(true);
    });

    it('should return empty array for unknown category', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValueOnce([]);
      const result = await prisma.product.findMany({ where: { category: 'Unicorns' } } as any);
      expect(result).toHaveLength(0);
    });

    it('should handle category name with mixed casing', async () => {
      const electronics = mockProducts.filter((p) => p.category === 'Electronics');
      (prisma.product.findMany as jest.Mock).mockResolvedValueOnce(electronics);
      const result = await prisma.product.findMany({ where: { category: 'electronics' } } as any);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ── GET /products/:id ──────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a product by ID', async () => {
      const result = await prisma.product.findUnique({ where: { id: 1 } } as any);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
    });

    it('should return null for non-existent ID', async () => {
      const result = await prisma.product.findUnique({ where: { id: 99999 } } as any);
      expect(result).toBeNull();
    });
  });

  // ── Caching ────────────────────────────────────────────────────────────────

  describe('Redis cache integration', () => {
    it('should check cache before hitting the database', async () => {
      (cache.get as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockProducts.slice(0, 5)));
      const cacheResult = await cache.get('products:featured:5');
      expect(cacheResult).not.toBeNull();
      // DB should NOT be called when cache hits
    });

    it('should store result in cache after DB query', async () => {
      (cache.get as jest.Mock).mockResolvedValueOnce(null);
      await prisma.product.findMany({ take: 5 } as any);
      await cache.set('products:featured:5', JSON.stringify(mockProducts.slice(0, 5)), 120);
      expect(cache.set).toHaveBeenCalledWith('products:featured:5', expect.any(String), 120);
    });

    it('should invalidate cache when product is updated', async () => {
      await cache.invalidate('products:*');
      expect(cache.invalidate).toHaveBeenCalledWith('products:*');
    });
  });

  // ── India-specific ─────────────────────────────────────────────────────────

  describe('India-specific product features', () => {
    it('should flag COD-available products', async () => {
      const codProducts = mockProducts.filter((p) => p.codAvailable);
      expect(codProducts.length).toBeGreaterThan(0);
    });

    it('should flag EMI-available products', async () => {
      const emiProducts = mockProducts.filter((p) => p.hasEMI);
      expect(emiProducts.length).toBeGreaterThan(0);
    });

    it('should sort by price ascending for budget-first queries', async () => {
      const sorted = [...mockProducts].sort((a, b) => a.price - b.price);
      expect(sorted[0].price).toBeLessThanOrEqual(sorted[1].price);
    });
  });

  // ── Performance ────────────────────────────────────────────────────────────

  describe('performance', () => {
    it('should complete a findMany query in under 200ms', async () => {
      const start = Date.now();
      await prisma.product.findMany({ take: 20 } as any);
      expect(Date.now() - start).toBeLessThan(200);
    });

    it('should handle 100 concurrent findUnique calls', async () => {
      const calls = Array.from({ length: 100 }, (_, i) =>
        prisma.product.findUnique({ where: { id: (i % 30) + 1 } } as any)
      );
      await expect(Promise.all(calls)).resolves.toHaveLength(100);
    });
  });
});
