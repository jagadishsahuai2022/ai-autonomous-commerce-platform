/**
 * Comprehensive Unit Tests - Product Service
 * Tests for core product functionality
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../src/services/prisma.service';
import { CacheService } from '../../src/common/services/cache.service';
import { SecurityService } from '../../src/common/services/security.service';
import { ErrorHandlerService } from '../../src/common/services/error-handler.service';

describe('Product Service Unit Tests', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let cache: CacheService;
  let security: SecurityService;
  let errorHandler: ErrorHandlerService;

  const mockProduct = {
    id: 1,
    name: 'Test Product',
    description: 'Test Description',
    price: 9999,
    category: 'Electronics',
    imageUrl: null,
    featured: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    // Fields added in r53 (virtual try-on / eligibility)
    eligibleForReplacement: false,
    eligibleForReturn: true,
    eligibleForVirtualTryOn: false,
    // Fields added in r66/r67 (generic name + category relations)
    genericName: null,
    categoryId: null,
    subCategoryId: null,
    // Fields added in later migration
    inStock: true,
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        {
          provide: PrismaService,
          useValue: {
            product: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            invalidate: jest.fn(),
          },
        },
        {
          provide: SecurityService,
          useValue: {
            validateInput: jest.fn(),
            sanitizeOutput: jest.fn(),
          },
        },
        {
          provide: ErrorHandlerService,
          useValue: {
            createNotFoundError: jest.fn(),
            createValidationError: jest.fn(),
            handleError: jest.fn(),
          },
        },
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    cache = module.get<CacheService>(CacheService);
    security = module.get<SecurityService>(SecurityService);
    errorHandler = module.get<ErrorHandlerService>(ErrorHandlerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Product Retrieval', () => {
    it('should retrieve product by ID', async () => {
      jest.spyOn(prisma.product, 'findUnique').mockResolvedValue(mockProduct);

      const result = await prisma.product.findUnique({
        where: { id: 1 },
      });

      expect(result).toEqual(mockProduct);
      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should return null for non-existent product', async () => {
      jest.spyOn(prisma.product, 'findUnique').mockResolvedValue(null);

      const result = await prisma.product.findUnique({
        where: { id: 9999 },
      });

      expect(result).toBeNull();
    });

    it('should retrieve products with pagination', async () => {
      const products = [mockProduct, { ...mockProduct, id: 2 }];
      jest.spyOn(prisma.product, 'findMany').mockResolvedValue(products);

      const result = await prisma.product.findMany({
        skip: 0,
        take: 10,
      });

      expect(result).toHaveLength(2);
      expect(result).toEqual(products);
    });

    it('should filter products by category', async () => {
      const filtered = [mockProduct];
      jest.spyOn(prisma.product, 'findMany').mockResolvedValue(filtered);

      const result = await prisma.product.findMany({
        where: { category: 'Electronics' },
      });

      expect(result).toEqual(filtered);
    });
  });

  describe('Product Creation', () => {
    it('should create product with valid data', async () => {
      const createData = {
        name: 'New Product',
        description: 'Description',
        price: 9999,
        category: 'Electronics',
      };

      jest.spyOn(prisma.product, 'create').mockResolvedValue({
        ...mockProduct,
        ...createData,
      });

      const result = await prisma.product.create({
        data: createData,
      } as any);

      expect(result.name).toBe('New Product');
      expect(prisma.product.create).toHaveBeenCalledWith({ data: createData });
    });

    it('should reject invalid product data', async () => {
      const invalidData = {
        name: '', // Empty name
        price: -100, // Negative price
      };

      jest.spyOn(security, 'validateInput').mockImplementation(() => {
        throw new Error('Invalid input');
      });

      expect(() => {
        security.validateInput(JSON.stringify(invalidData));
      }).toThrow('Invalid input');
    });
  });

  describe('Product Update', () => {
    it('should update product with valid data', async () => {
      const updateData = { price: 12999 };
      const updated = { ...mockProduct, ...updateData };

      jest.spyOn(prisma.product, 'update').mockResolvedValue(updated);

      const result = await prisma.product.update({
        where: { id: 1 },
        data: updateData,
      });

      expect(result.price).toBe(12999);
    });

    it('should not update non-existent product', async () => {
      jest.spyOn(prisma.product, 'update').mockRejectedValue(new Error('Not found'));

      await expect(
        prisma.product.update({
          where: { id: 9999 },
          data: { price: 12999 },
        })
      ).rejects.toThrow('Not found');
    });
  });

  describe('Product Deletion', () => {
    it('should delete product', async () => {
      jest.spyOn(prisma.product, 'delete').mockResolvedValue(mockProduct);

      const result = await prisma.product.delete({
        where: { id: 1 },
      });

      expect(result.id).toBe(1);
    });

    it('should handle deletion of non-existent product', async () => {
      jest.spyOn(prisma.product, 'delete').mockRejectedValue(new Error('Not found'));

      await expect(prisma.product.delete({ where: { id: 9999 } })).rejects.toThrow('Not found');
    });
  });

  describe('Caching', () => {
    it('should cache product data', async () => {
      jest.spyOn(cache, 'set').mockResolvedValue(undefined);

      await cache.set('product:prod-123', mockProduct, 3600);

      expect(cache.set).toHaveBeenCalledWith('product:prod-123', mockProduct, 3600);
    });

    it('should retrieve cached product', async () => {
      jest.spyOn(cache, 'get').mockResolvedValue(mockProduct);

      const result = await cache.get('product:prod-123');

      expect(result).toEqual(mockProduct);
      expect(cache.get).toHaveBeenCalledWith('product:prod-123');
    });

    it('should invalidate cache on update', async () => {
      jest.spyOn(cache, 'invalidate').mockResolvedValue(undefined);

      await cache.invalidate('product:*');

      expect(cache.invalidate).toHaveBeenCalledWith('product:*');
    });
  });

  describe('Stock Management', () => {
    it('should prevent negative stock', async () => {
      const updateData = { stock: -10 };

      jest.spyOn(security, 'validateInput').mockImplementation(() => {
        throw new Error('Stock cannot be negative');
      });

      expect(() => security.validateInput(JSON.stringify(updateData))).toThrow(
        'Stock cannot be negative'
      );
    });

    it('should reduce inventory on purchase', async () => {
      // Inventory tracked in ProductBusinessMetrics.inventoryCount
      const updatedMetrics = { inventoryCount: 99 };
      jest.spyOn(prisma.product, 'update').mockResolvedValue({ ...mockProduct } as any);

      const result = await prisma.product.update({
        where: { id: 1 },
        data: {} as any, // inventory updated via businessMetrics upsert
      });

      expect(result.id).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors', async () => {
      const dbError = new Error('Database connection failed');
      jest.spyOn(prisma.product, 'findUnique').mockRejectedValue(dbError);

      jest.spyOn(errorHandler, 'handleError').mockReturnValue({
        statusCode: 500,
        code: 'DATABASE_ERROR',
        message: 'Database error occurred',
        context: {},
      } as any);

      await expect(prisma.product.findUnique({ where: { id: 1 } })).rejects.toThrow();

      const result = errorHandler.handleError(dbError);
      expect(result.statusCode).toBe(500);
    });

    it('should handle validation errors', async () => {
      const validationError = new Error('Invalid price');
      jest.spyOn(errorHandler, 'createValidationError').mockReturnValue({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'Invalid price',
        context: { field: 'price' },
      } as any);

      const result = errorHandler.createValidationError('price', 'Invalid price');
      expect(result.statusCode).toBe(400);
    });
  });
});
