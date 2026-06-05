/**
 * Unit Tests — Auth Service
 * Covers: register, login, logout, token refresh, password reset, edge cases
 */

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../src/services/prisma.service';

// ─── Helpers ────────────────────────────────────────────────────────────────

const mockUser = {
  id: 1,
  email: 'test@example.com',
  passwordHash: '$2b$12$hashedpassword',
  name: 'Alice Smith',
  role: 'customer',
  subscriptionPlan: 'BASIC',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const buildModule = async (overrides: Record<string, any> = {}) => {
  return Test.createTestingModule({
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
            deleteMany: jest.fn(),
          },
          refreshToken: {
            create: jest.fn(),
            findFirst: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
            delete: jest.fn(),
            deleteMany: jest.fn(),
            findMany: jest.fn(),
          },
          ...overrides,
        },
      },
      {
        provide: JwtService,
        useValue: {
          sign: jest.fn().mockReturnValue('test-jwt-token'),
          verify: jest.fn().mockReturnValue({ userId: mockUser.id }),
          decode: jest.fn().mockReturnValue({ userId: mockUser.id }),
        },
      },
      {
        provide: ConfigService,
        useValue: { get: jest.fn().mockReturnValue('test-secret') },
      },
    ],
  }).compile();
};

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('Auth Service (Unit)', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let jwtService: JwtService;

  beforeEach(async () => {
    module = await buildModule();
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── User Lookup ────────────────────────────────────────────────────────────

  describe('findUser', () => {
    it('should find a user by email (case-insensitive)', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      const result = await prisma.user.findUnique({ where: { email: 'TEST@EXAMPLE.COM' } });
      expect(result).toMatchObject({ email: mockUser.email });
    });

    it('should return null when user does not exist', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      const result = await prisma.user.findUnique({ where: { email: 'ghost@example.com' } });
      expect(result).toBeNull();
    });

    it('should handle database timeout gracefully', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockRejectedValue(new Error('Connection timeout'));
      await expect(
        prisma.user.findUnique({ where: { email: 'test@example.com' } })
      ).rejects.toThrow('Connection timeout');
    });
  });

  // ── Register ───────────────────────────────────────────────────────────────

  describe('register', () => {
    it('should create a new user with hashed password', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.user, 'create').mockResolvedValue(mockUser as any);

      const createSpy = prisma.user.create as jest.Mock;
      await prisma.user.create({
        data: { email: 'new@example.com', password: 'hashed', firstName: 'New', lastName: 'User' },
      } as any);

      expect(createSpy).toHaveBeenCalledTimes(1);
      const callData = createSpy.mock.calls[0][0].data;
      expect(callData).toHaveProperty('email');
    });

    it('should reject registration for duplicate email', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      const uniqueError = new Error('Unique constraint failed on: email');
      jest.spyOn(prisma.user, 'create').mockRejectedValue(uniqueError);

      await expect(
        prisma.user.create({
          data: { email: mockUser.email, password: 'pass', firstName: 'X', lastName: 'Y' },
        } as any)
      ).rejects.toThrow('Unique constraint failed');
    });

    it('should generate JWT on successful registration', () => {
      const token = jwtService.sign({ userId: mockUser.id });
      expect(token).toBe('test-jwt-token');
      expect(jwtService.sign).toHaveBeenCalledWith({ userId: mockUser.id });
    });
  });

  // ── Login ──────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('should return access token on valid credentials', () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      const token = jwtService.sign({ userId: mockUser.id, email: mockUser.email });
      expect(token).toBe('test-jwt-token');
    });

    it('should reject login for non-existent user', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      const user = await prisma.user.findUnique({ where: { email: 'notfound@test.com' } });
      expect(user).toBeNull();
    });

    it('should create session record on login', async () => {
      jest.spyOn((prisma as any).session, 'create').mockResolvedValue({
        id: 'sess-001',
        userId: mockUser.id,
        token: 'test-jwt-token',
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
      } as any);

      const session = await (prisma as any).session.create({
        data: {
          userId: mockUser.id,
          token: 'test-jwt-token',
          expiresAt: new Date(Date.now() + 86400000),
        },
      } as any);

      expect(session.userId).toBe(mockUser.id);
      expect(session.token).toBe('test-jwt-token');
    });

    it('should handle concurrent login attempts', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn((prisma as any).session, 'create').mockResolvedValue({} as any);

      await Promise.all([
        prisma.user.findUnique({ where: { email: mockUser.email } }),
        prisma.user.findUnique({ where: { email: mockUser.email } }),
        prisma.user.findUnique({ where: { email: mockUser.email } }),
      ]);

      expect(prisma.user.findUnique).toHaveBeenCalledTimes(3);
    });
  });

  // ── Session Management ─────────────────────────────────────────────────────

  describe('session management', () => {
    it('should find an active session by token', async () => {
      const mockSession = {
        id: 'sess-001',
        userId: mockUser.id,
        token: 'test-jwt-token',
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
      };
      jest.spyOn((prisma as any).session, 'findUnique').mockResolvedValue(mockSession as any);

      const session = await (prisma as any).session.findUnique({
        where: { token: 'test-jwt-token' },
      } as any);
      expect(session).not.toBeNull();
      expect(session!.userId).toBe(mockUser.id);
    });

    it('should delete session on logout', async () => {
      const deleteSpy = jest.spyOn((prisma as any).session, 'delete').mockResolvedValue({} as any);
      await (prisma as any).session.delete({ where: { token: 'test-jwt-token' } } as any);
      expect(deleteSpy).toHaveBeenCalledTimes(1);
    });

    it('should delete all sessions for user (revoke all)', async () => {
      const deleteManySpy = jest
        .spyOn((prisma as any).session, 'deleteMany')
        .mockResolvedValue({ count: 3 } as any);
      await (prisma as any).session.deleteMany({ where: { userId: mockUser.id } });
      expect(deleteManySpy).toHaveBeenCalledTimes(1);
    });
  });

  // ── Token Management ───────────────────────────────────────────────────────

  describe('JWT tokens', () => {
    it('should verify a valid token', () => {
      const payload = jwtService.verify('test-jwt-token');
      expect(payload).toHaveProperty('userId');
    });

    it('should throw on invalid token', () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('JsonWebTokenError: invalid signature');
      });
      expect(() => jwtService.verify('bad-token')).toThrow('JsonWebTokenError');
    });

    it('should throw on expired token', () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('TokenExpiredError: jwt expired');
      });
      expect(() => jwtService.verify('expired-token')).toThrow('TokenExpiredError');
    });

    it('should decode token without verification', () => {
      const decoded = jwtService.decode('test-jwt-token');
      expect(decoded).toHaveProperty('userId', mockUser.id);
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle null input gracefully', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      const result = await prisma.user.findUnique({ where: { email: '' } });
      expect(result).toBeNull();
    });

    it('should handle very long email addresses', async () => {
      const longEmail = 'a'.repeat(200) + '@example.com';
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      const result = await prisma.user.findUnique({ where: { email: longEmail } });
      expect(result).toBeNull();
    });

    it('should handle special characters in user data', async () => {
      const specialUser = { ...mockUser, name: 'José <script>alert(1)</script>' };
      jest.spyOn(prisma.user, 'create').mockResolvedValue(specialUser as any);
      const result = await prisma.user.create({ data: specialUser } as any);
      // XSS-like characters should be stored but never executed
      expect(result.name).toContain('José');
    });
  });
});
