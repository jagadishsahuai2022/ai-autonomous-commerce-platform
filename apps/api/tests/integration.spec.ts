/// <reference types="jest" />
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/services/prisma.service';

/**
 * PRODUCTION-GRADE INTEGRATION TESTS
 * Test complete user journeys and system behavior
 */

describe('DelegateCart System Integration Tests', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let accessToken: string;
  let userId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  // ========== Authentication Tests ==========

  describe('Authentication & JWT', () => {
    it('should register a new user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `test-${Date.now()}@example.com`,
          password: 'TestPassword123!',
          name: 'Test User',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();

      userId = response.body.data.userId;
      accessToken = response.body.data.accessToken;
    });

    it('should login with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: `test-${Date.now()}@example.com`,
          password: 'TestPassword123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.accessToken).toBeDefined();
    });

    it('should refresh access token with refresh token', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: `test-${Date.now()}@example.com`,
          password: 'TestPassword123!',
        });

      const refreshToken = loginResponse.body.data.refreshToken;

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.data.accessToken).toBeDefined();
    });
  });

  // ========== Product Browsing Tests ==========

  describe('Product Browsing', () => {
    it('should get products by category', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products?category=Electronics&page=1&limit=20')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(20);
    });

    it('should search products', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products/search?query=laptop&limit=10')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });

    it('should get product details', async () => {
      // Get a product first
      const productsResponse = await request(app.getHttpServer())
        .get('/api/v1/products/search?query=electronics&limit=1')
        .set('Authorization', `Bearer ${accessToken}`);

      if (productsResponse.body.data.length > 0) {
        const productId = productsResponse.body.data[0].id;

        const response = await request(app.getHttpServer())
          .get(`/api/v1/products/${productId}`)
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.id).toBe(productId);
      }
    });
  });

  // ========== Shopping Cart Tests ==========

  describe('Shopping Cart', () => {
    it('should add item to cart', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/cart/add')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          productId: 1,
          quantity: 2,
        });

      expect([200, 201]).toContain(response.status);
    });

    it('should get cart', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.items).toBeDefined();
    });

    it('should update cart item quantity', async () => {
      const response = await request(app.getHttpServer())
        .put('/api/v1/cart/items/1')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ quantity: 3 });

      expect([200, 201]).toContain(response.status);
    });

    it('should remove item from cart', async () => {
      const response = await request(app.getHttpServer())
        .delete('/api/v1/cart/items/1')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
    });
  });

  // ========== Order Tests ==========

  describe('Orders & Checkout', () => {
    it('should checkout with idempotency', async () => {
      const idempotencyKey = `order-${Date.now()}`;

      const response = await request(app.getHttpServer())
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          shippingAddress: {
            street: '123 Main St',
            city: 'Bangalore',
            state: 'Karnataka',
            pincode: '560001',
          },
          paymentMethod: 'wallet',
        });

      expect([200, 201]).toContain(response.status);
      expect(response.body.data.orderId).toBeDefined();

      // Retry with same idempotency key should return same order
      const retryResponse = await request(app.getHttpServer())
        .post('/api/v1/orders/checkout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          shippingAddress: {
            street: '123 Main St',
            city: 'Bangalore',
            state: 'Karnataka',
            pincode: '560001',
          },
          paymentMethod: 'wallet',
        });

      expect(retryResponse.status).toBe(200);
      expect(retryResponse.body.data.orderId).toBe(response.body.data.orderId);
    });

    it('should get order history', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  // ========== Wallet Tests ==========

  describe('Wallet & Payments', () => {
    it('should get wallet balance', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/wallet/balance')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.balance).toBeDefined();
    });

    it('should add funds to wallet', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/wallet/topup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          amount: 5000,
          paymentMethod: 'upi',
        });

      expect([200, 201]).toContain(response.status);
    });

    it('should get transaction history', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/wallet/transactions')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  // ========== AI Features Tests ==========

  describe('AI Shopping', () => {
    it('should chat with AI assistant', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/chat/message')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          message: 'Show me best laptops under 100000',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.response).toBeDefined();
    });

    it('should create buy request', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/buy-requests')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          productName: 'Best Laptop',
          budgetMin: 50000,
          budgetMax: 100000,
          qualityScore: 8,
          deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

      expect([200, 201]).toContain(response.status);
      expect(response.body.data.id).toBeDefined();
    });

    it('should get AI recommendations', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/recommendations')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  // ========== Rate Limiting Tests ==========

  describe('Rate Limiting', () => {
    it('should respect rate limits', async () => {
      const promises = [];

      // Make 150 requests (exceeding typical 100/minute limit)
      for (let i = 0; i < 150; i++) {
        promises.push(
          request(app.getHttpServer())
            .get('/api/v1/products?limit=1')
            .set('Authorization', `Bearer ${accessToken}`)
        );
      }

      const responses = await Promise.all(promises);
      const rateLimited = responses.filter((r) => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  // ========== Error Handling Tests ==========

  describe('Error Handling', () => {
    it('should handle unauthorized access', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/orders');

      expect(response.status).toBe(401);
    });

    it('should validate input data', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/cart/add')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          productId: 'invalid',
          quantity: 'not-a-number',
        });

      expect(response.status).toBe(400);
    });

    it('should handle not found', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/orders/999999')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(404);
    });
  });

  // ========== Performance Tests ==========

  describe('Performance', () => {
    it('should respond to search within 2 seconds', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get('/api/v1/products/search?query=electronics&limit=20')
        .set('Authorization', `Bearer ${accessToken}`);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000);
    });

    it('should handle concurrent requests', async () => {
      const promises = Array(50)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .get('/api/v1/products?limit=10')
            .set('Authorization', `Bearer ${accessToken}`)
        );

      const responses = await Promise.all(promises);
      const successful = responses.filter((r) => r.status === 200);

      expect(successful.length).toBeGreaterThan(45); // At least 90% success rate
    });
  });
});
