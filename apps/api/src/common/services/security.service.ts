/**
 * Production-Grade Security Hardening
 * Input validation, wallet security, JWT refresh flow, encryption
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

export interface SecurityContext {
  userId: number;
  email: string;
  roles: string[];
  permissions: string[];
  mfaEnabled: boolean;
  lastLoginTime: Date;
  sessionId: string;
}

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);
  private readonly BCRYPT_ROUNDS = 12;

  constructor(private jwtService: JwtService) {}

  /**
   * Validate and sanitize user input
   */
  validateInput(input: string, maxLength: number = 1000, pattern?: RegExp): string {
    if (!input || typeof input !== 'string') {
      throw new BadRequestException('Invalid input');
    }

    let sanitized = input.trim();

    // Check length
    if (sanitized.length === 0 || sanitized.length > maxLength) {
      throw new BadRequestException(`Input length must be between 1 and ${maxLength}`);
    }

    // Check pattern if provided
    if (pattern && !pattern.test(sanitized)) {
      throw new BadRequestException('Input format invalid');
    }

    // Remove dangerous characters
    sanitized = sanitized.replace(/[<>\"'%&]/g, '');

    return sanitized;
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): string {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validated = this.validateInput(email, 255, emailRegex);
    return validated.toLowerCase();
  }

  /**
   * Validate amount for financial operations
   */
  validateAmount(amount: number, maxAmount: number = 10000000): number {
    if (!Number.isFinite(amount)) {
      throw new BadRequestException('Invalid amount');
    }

    // Amount must be positive
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    // Check maximum
    if (amount > maxAmount) {
      throw new BadRequestException(`Amount exceeds maximum of ₹${maxAmount}`);
    }

    // Must be exact to paise (2 decimal places)
    if (!Number.isInteger(amount * 100)) {
      throw new BadRequestException('Amount must be exact to paise');
    }

    return amount;
  }

  /**
   * Hash password securely
   */
  async hashPassword(password: string): Promise<string> {
    this.validatePasswordStrength(password);
    return bcrypt.hash(password, this.BCRYPT_ROUNDS);
  }

  /**
   * Verify password
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Validate password strength
   */
  private validatePasswordStrength(password: string): void {
    const minLength = 12;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*]/.test(password);

    if (password.length < minLength) {
      throw new BadRequestException(`Password must be at least ${minLength} characters`);
    }

    if (!hasUppercase || !hasLowercase || !hasNumbers || !hasSpecial) {
      throw new BadRequestException(
        'Password must contain uppercase, lowercase, numbers, and special characters'
      );
    }
  }

  /**
   * Generate secure JWT with refresh token
   */
  async generateTokenPair(context: SecurityContext): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const accessTokenExpiry = 900; // 15 minutes
    const refreshTokenExpiry = 604800; // 7 days

    const payload = {
      sub: context.userId,
      email: context.email,
      roles: context.roles,
      permissions: context.permissions,
      sessionId: context.sessionId,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: accessTokenExpiry,
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: refreshTokenExpiry,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: accessTokenExpiry,
    };
  }

  /**
   * Rotate refresh token
   */
  async rotateRefreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      const payload = this.jwtService.verify(refreshToken);

      const context: SecurityContext = {
        userId: payload.sub,
        email: payload.email,
        roles: payload.roles || [],
        permissions: payload.permissions || [],
        mfaEnabled: false,
        lastLoginTime: new Date(),
        sessionId: payload.sessionId,
      };

      const tokens = await this.generateTokenPair(context);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      this.logger.error(`Token rotation failed: ${error}`);
      throw new BadRequestException('Invalid refresh token');
    }
  }

  /**
   * Generate cryptographically secure random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Encrypt sensitive data (wallet secrets, etc.)
   */
  async encryptSensitive(data: string, key: string): Promise<string> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt sensitive data
   */
  async decryptSensitive(encrypted: string, key: string): Promise<string> {
    const [ivHex, encryptedData] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Generate HMAC for request signing
   */
  generateHMAC(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Verify HMAC for request integrity
   */
  verifyHMAC(data: string, signature: string, secret: string): boolean {
    const expected = this.generateHMAC(data, secret);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  /**
   * Rate limit check for auth attempts
   */
  async checkAuthRateLimit(email: string): Promise<{ allowed: boolean; retriesRemaining: number }> {
    // This would integrate with Redis in production
    // For now, return allowed
    return { allowed: true, retriesRemaining: 5 };
  }

  /**
   * Validate JWT signature and expiry
   */
  validateJWT(token: string): { valid: boolean; payload?: any; error?: string } {
    try {
      const payload = this.jwtService.verify(token);
      return { valid: true, payload };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid token',
      };
    }
  }

  /**
   * Generate secure session ID
   */
  generateSessionId(): string {
    return `session_${crypto.randomUUID()}_${Date.now()}`;
  }

  /**
   * Sanitize response data (remove sensitive fields)
   */
  sanitizeResponseData(data: any, excludeFields: string[] = []): any {
    const defaultExcluded = ['password', 'passwordHash', 'secret', 'apiKey', 'refreshToken'];
    const allExcluded = [...defaultExcluded, ...excludeFields];

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeResponseData(item, excludeFields));
    }

    if (data && typeof data === 'object') {
      const sanitized = { ...data };
      for (const field of allExcluded) {
        delete sanitized[field];
      }
      return sanitized;
    }

    return data;
  }
}
