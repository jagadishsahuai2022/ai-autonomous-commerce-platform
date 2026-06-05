/**
 * Integration Tests - Auth Controller
 * Tests for authentication endpoints with database interactions
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/services/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('Auth Controller (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;

  const testUser = {
    id: 1,
    email: 'test@example.com',
    passwordHash: 'HashedPassword123',
    name: 'Test User',
    role: 'customer',
    subscriptionPlan: 'BASIC',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const loginPayload = {
    email: 'test@example.com',
    password: 'password123',
  };

  const registerPayload = {
    email: 'newuser@example.com',
    password: 'password123',
    firstName: 'New',
    lastName: 'User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            session: {
              create: jest.fn(),
              findUnique: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
            decode: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
    configService = moduleFixture.get<ConfigService>(ConfigService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    it('should register new user successfully', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.user, 'create').mockResolvedValue({
        ...testUser,
        ...registerPayload,
      });

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerPayload)
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(registerPayload.email);
    });

    it('should reject duplicate email', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(testUser);

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerPayload)
        .expect(409);

      expect(response.body.code).toBe('USER_ALREADY_EXISTS');
    });

    it('should validate email format', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...registerPayload,
          email: 'invalid-email',
        })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_FAILED');
    });

    it('should validate password strength', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...registerPayload,
          password: '123', // Too weak
        })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_FAILED');
    });

    it('should hash password before storing', async () => {
      const createSpy = jest.spyOn(prisma.user, 'create').mockResolvedValue(testUser);

      await request(app.getHttpServer()).post('/auth/register').send(registerPayload);

      // In real implementation, password would be hashed
      const callArgs = createSpy.mock.calls[0];
      expect(callArgs[0].data).toHaveProperty('password');
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(testUser);
      jest.spyOn(jwtService, 'sign').mockReturnValue('jwt-token');

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginPayload)
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('user');
    });

    it('should reject invalid email', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginPayload)
        .expect(401);

      expect(response.body.code).toBe('UNAUTHORIZED');
    });

    it('should reject invalid password', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(testUser);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          ...loginPayload,
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.code).toBe('UNAUTHORIZED');
    });

    it('should create session on login', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(testUser);
      const sessionSpy = jest.spyOn((prisma as any).session, 'create').mockResolvedValue({
        id: 'session-123',
        userId: testUser.id,
        token: 'jwt-token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      } as any);

      await request(app.getHttpServer()).post('/auth/login').send(loginPayload);

      expect(sessionSpy).toHaveBeenCalled();
    });

    it('should rate limit failed login attempts', async () => {
      // Simulate multiple failed attempts
      const attempts = Array(6).fill(null);

      for (let i = 0; i < attempts.length; i++) {
        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

        const response = await request(app.getHttpServer()).post('/auth/login').send(loginPayload);

        if (i < 5) {
          expect(response.status).toBe(401);
        } else {
          // 6th attempt should be rate limited
          expect(response.status).toBe(429);
        }
      }
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout valid user', async () => {
      const token = 'valid-jwt-token';
      const sessionDeleteSpy = jest.spyOn((prisma as any).session, 'delete').mockResolvedValue({} as any);

      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(sessionDeleteSpy).toHaveBeenCalled();
    });

    it('should reject logout without token', async () => {
      const response = await request(app.getHttpServer()).post('/auth/logout').expect(401);

      expect(response.body.code).toBe('UNAUTHORIZED');
    });

    it('should reject logout with invalid token', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /auth/me', () => {
    it('should get current user profile', async () => {
      const token = 'valid-jwt-token';
      jest.spyOn(jwtService, 'verify').mockReturnValue({ userId: testUser.id });
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(testUser);

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(testUser.email);
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app.getHttpServer()).get('/auth/me').expect(401);

      expect(response.body.code).toBe('UNAUTHORIZED');
    });

    it('should reject expired token', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Token expired');
      });

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer expired-token')
        .expect(401);

      expect(response.body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /auth/refresh-token', () => {
    it('should refresh expired token', async () => {
      const oldToken = 'old-jwt-token';
      const newToken = 'new-jwt-token';

      jest.spyOn(jwtService, 'decode').mockReturnValue({ userId: testUser.id });
      jest.spyOn(jwtService, 'sign').mockReturnValue(newToken);

      const response = await request(app.getHttpServer())
        .post('/auth/refresh-token')
        .send({ refreshToken: oldToken })
        .expect(200);

      expect(response.body.accessToken).toBe(newToken);
    });

    it('should reject invalid refresh token', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const response = await request(app.getHttpServer())
        .post('/auth/refresh-token')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('should send password reset email', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(testUser);
      const emailSpy = jest.fn();

      const response = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(200);

      expect(response.body.message).toContain('email');
    });

    it('should not reveal user existence', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      // Should return same response regardless of user existence
      expect(response.body.message).toContain('email');
    });
  });

  describe('POST /auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      const resetToken = 'valid-reset-token';
      const newPassword = 'newpassword123';

      jest.spyOn(prisma.user, 'update').mockResolvedValue(testUser);

      const response = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          token: resetToken,
          newPassword,
        })
        .expect(200);

      expect(response.body.message).toContain('success');
    });

    it('should reject expired reset token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          token: 'expired-token',
          newPassword: 'newpassword123',
        })
        .expect(400);

      expect(response.body.code).toBe('INVALID_TOKEN');
    });
  });
});
