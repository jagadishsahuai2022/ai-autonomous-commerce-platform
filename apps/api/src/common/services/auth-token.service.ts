import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../services/prisma.service';
import * as crypto from 'crypto';

/**
 * PRODUCTION-GRADE JWT + REFRESH TOKEN SYSTEM
 * Secure token management with automatic refresh capability
 */

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface TokenPayload {
  userId: number;
  email: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthTokenService {
  private readonly ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes
  private readonly REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days
  private readonly REFRESH_TOKEN_LENGTH = 64;

  constructor(
    private jwtService: JwtService,
    private prismaService: PrismaService
  ) {}

  /**
   * Generate access and refresh tokens
   */
  async generateTokens(userId: number, email: string): Promise<AuthTokens> {
    const payload: TokenPayload = {
      userId,
      email,
    };

    // Generate access token (short-lived)
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      secret: process.env.JWT_SECRET,
    });

    // Generate refresh token (long-lived, stored in DB)
    const refreshToken = crypto.randomBytes(this.REFRESH_TOKEN_LENGTH).toString('hex');
    const hashedRefreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Store refresh token in database
    await this.storeRefreshToken(userId, hashedRefreshToken);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      tokenType: 'Bearer',
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
    // Hash the refresh token
    const hashedRefreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Find token in database
    const storedToken = await this.prismaService.refreshToken.findFirst({
      where: {
        hashedToken: hashedRefreshToken,
        expiresAt: {
          gt: new Date(), // Not expired
        },
        isRevoked: false,
      },
      include: {
        user: true,
      },
    });

    if (!storedToken) {
      throw new Error('Invalid or expired refresh token');
    }

    // Verify token not used too recently (prevent token reuse attacks)
    const lastUsedMs = storedToken.lastUsedAt?.getTime() || 0;
    const now = Date.now();
    if (now - lastUsedMs < 1000) {
      // Immediate reuse within 1 second - potential attack
      await this.revokeRefreshToken(refreshToken);
      throw new Error('Refresh token reuse detected - token revoked');
    }

    // Generate new tokens
    const newTokens = await this.generateTokens(storedToken.userId, storedToken.user.email);

    // Update last used timestamp
    await this.prismaService.refreshToken.update({
      where: { id: storedToken.id },
      data: { lastUsedAt: new Date() },
    });

    return newTokens;
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): TokenPayload {
    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });
      return payload as TokenPayload;
    } catch (error) {
      throw new Error(`Invalid access token: ${error.message}`);
    }
  }

  /**
   * Revoke refresh token
   */
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const hashedRefreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');

    await this.prismaService.refreshToken.updateMany({
      where: { hashedToken: hashedRefreshToken },
      data: { isRevoked: true },
    });
  }

  /**
   * Revoke all refresh tokens for a user (logout)
   */
  async revokeAllUserTokens(userId: number): Promise<void> {
    await this.prismaService.refreshToken.updateMany({
      where: {
        userId,
        isRevoked: false,
      },
      data: { isRevoked: true },
    });
  }

  /**
   * Get refresh token info
   */
  async getRefreshTokenInfo(refreshToken: string) {
    const hashedRefreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');

    return this.prismaService.refreshToken.findFirst({
      where: { hashedToken: hashedRefreshToken },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        lastUsedAt: true,
        isRevoked: true,
        createdAt: true,
        ipAddress: true,
        userAgent: true,
      },
    });
  }

  /**
   * Cleanup expired refresh tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.prismaService.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    return result.count;
  }

  /**
   * Store refresh token in database
   */
  private async storeRefreshToken(userId: number, hashedToken: string): Promise<void> {
    const expiresAt = new Date(Date.now() + this.REFRESH_TOKEN_EXPIRY * 1000);

    await this.prismaService.refreshToken.create({
      data: {
        userId,
        hashedToken,
        expiresAt,
        isRevoked: false,
        // Store request metadata for security analysis
        ipAddress: process.env.CURRENT_REQUESTER_IP,
        userAgent: process.env.CURRENT_REQUESTER_USER_AGENT,
      },
    });
  }
}

// Add this to schema.prisma:
/*
model RefreshToken {
  id              Int       @id @default(autoincrement())
  userId          Int
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  hashedToken     String    @unique
  isRevoked       Boolean   @default(false)
  
  expiresAt       DateTime
  createdAt       DateTime  @default(now())
  lastUsedAt      DateTime?
  
  ipAddress       String?
  userAgent       String?
  
  @@index([userId])
  @@index([expiresAt])
  @@index([isRevoked])
}
*/
