/**
 * Payment Token Service
 * Part 4: Secure payment tokenization without exposing raw card/bank data
 */

import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PaymentToken } from '../schemas/acp.types';

export interface TokenizationRequest {
  userId: string;
  paymentMethodData: {
    type: 'card' | 'wallet' | 'bank_account';
    encryptedPayload: string; // Client-side encrypted
  };
  authorizationLimit: number;
  currency: string;
}

export interface TokenValidationResult {
  valid: boolean;
  tokenId?: string;
  authorization?: {
    authorized: boolean;
    limit: number;
    used: number;
    remaining: number;
  };
  error?: string;
}

@Injectable()
export class ACPPaymentTokenService {
  private readonly logger = new Logger(ACPPaymentTokenService.name);
  private readonly tokenStore = new Map<string, PaymentToken>();
  private readonly TOKEN_EXPIRY = 86400000; // 24 hours
  private readonly ENCRYPTION_KEY = process.env.PAYMENT_TOKEN_SECRET || 'default-secret';

  /**
   * Generate secure payment token
   * Keeps raw payment data encrypted and isolated
   */
  async tokenizePayment(
    request: TokenizationRequest
  ): Promise<{ token: PaymentToken; publicToken: string }> {
    try {
      // Step 1: Validate authorization limits
      if (request.authorizationLimit <= 0) {
        throw new BadRequestException('Authorization limit must be positive');
      }

      // Step 2: Decrypt and validate payment method
      const validationResult = this.validatePaymentMethod(
        request.paymentMethodData.encryptedPayload,
        request.paymentMethodData.type
      );

      if (!validationResult.valid) {
        throw new BadRequestException('Invalid payment method');
      }

      // Step 3: Generate token
      const tokenId = this.generateSecureTokenId();
      const expiresAt = new Date(Date.now() + this.TOKEN_EXPIRY);

      // Step 4: Store encrypted token
      const token: PaymentToken = {
        tokenId,
        userId: request.userId,
        encryptedData: this.encryptPaymentData(request.paymentMethodData.encryptedPayload),
        authorizationLimit: request.authorizationLimit,
        currency: request.currency,
        expiresAt,
        issuedAt: new Date(),
        metadata: {
          paymentType: request.paymentMethodData.type,
          lastValidated: new Date(),
        },
      };

      // Step 5: Store in secure store
      this.tokenStore.set(tokenId, token);

      // Step 6: Create public token for client
      const publicToken = this.createPublicToken(tokenId);

      this.logger.log(`Payment token generated: ${tokenId} for user ${request.userId}`);

      return { token, publicToken };
    } catch (error) {
      this.logger.error(`Token generation failed: ${error}`);
      throw error;
    }
  }

  /**
   * Validate payment token and check authorization
   */
  async validateToken(
    tokenId: string,
    userId: string,
    requestAmount: number
  ): Promise<TokenValidationResult> {
    try {
      // Step 1: Retrieve token
      const token = this.tokenStore.get(tokenId);

      if (!token) {
        return { valid: false, error: 'Token not found' };
      }

      // Step 2: Verify token ownership
      if (token.userId !== userId) {
        this.logger.warn(`Token mismatch: expected ${token.userId}, got ${userId}`);
        return { valid: false, error: 'Token does not belong to user' };
      }

      // Step 3: Check expiry
      if (new Date() > token.expiresAt) {
        this.tokenStore.delete(tokenId);
        return { valid: false, error: 'Token expired' };
      }

      // Step 4: Check authorization limit
      const currentUsage = await this.getCurrentTokenUsage(tokenId);
      const remaining = token.authorizationLimit - currentUsage;

      if (requestAmount > remaining) {
        return {
          valid: false,
          error: `Insufficient authorization. Requested: ${requestAmount}, Remaining: ${remaining}`,
        };
      }

      // Step 5: All valid
      return {
        valid: true,
        tokenId,
        authorization: {
          authorized: true,
          limit: token.authorizationLimit,
          used: currentUsage,
          remaining,
        },
      };
    } catch (error) {
      this.logger.error(`Token validation failed: ${error}`);
      return { valid: false, error: error instanceof Error ? error.message : 'Validation failed' };
    }
  }

  /**
   * Use token for a transaction
   */
  async consumeToken(
    tokenId: string,
    userId: string,
    amount: number,
    orderId: string
  ): Promise<{ success: boolean; newRemaining: number }> {
    try {
      const token = this.tokenStore.get(tokenId);

      if (!token) {
        throw new ForbiddenException('Token not found');
      }

      if (token.userId !== userId) {
        throw new ForbiddenException('Unauthorized');
      }

      // Record usage
      const usage = await this.recordTokenUsage(tokenId, amount, orderId);

      // Update last used
      token.lastUsed = new Date();

      return {
        success: true,
        newRemaining: token.authorizationLimit - usage,
      };
    } catch (error) {
      this.logger.error(`Token consumption failed: ${error}`);
      throw error;
    }
  }

  /**
   * Revoke token
   */
  revokeToken(tokenId: string, userId: string): boolean {
    const token = this.tokenStore.get(tokenId);

    if (!token) {
      return false;
    }

    if (token.userId !== userId) {
      throw new ForbiddenException('Cannot revoke token owned by another user');
    }

    this.tokenStore.delete(tokenId);
    this.logger.log(`Token revoked: ${tokenId}`);

    return true;
  }

  /**
   * Refresh token expiry
   */
  refreshToken(tokenId: string, userId: string): { expiresAt: Date } {
    const token = this.tokenStore.get(tokenId);

    if (!token) {
      throw new BadRequestException('Token not found');
    }

    if (token.userId !== userId) {
      throw new ForbiddenException('Unauthorized');
    }

    token.expiresAt = new Date(Date.now() + this.TOKEN_EXPIRY);
    return { expiresAt: token.expiresAt };
  }

  /**
   * Validate payment method format
   */
  private validatePaymentMethod(
    encryptedPayload: string,
    type: 'card' | 'wallet' | 'bank_account'
  ): { valid: boolean } {
    try {
      // Verify encryption format
      if (!encryptedPayload || encryptedPayload.length < 50) {
        return { valid: false };
      }

      // Type-specific validation would go here
      // For now, accept if properly encrypted

      return { valid: true };
    } catch {
      return { valid: false };
    }
  }

  /**
   * Encrypt payment data
   */
  private encryptPaymentData(data: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        'aes-256-cbc',
        Buffer.from(this.ENCRYPTION_KEY, 'hex').slice(0, 32),
        iv
      );

      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      this.logger.error(`Encryption failed: ${error}`);
      throw error;
    }
  }

  /**
   * Generate unique token ID
   */
  private generateSecureTokenId(): string {
    return `tok_${crypto.randomUUID()}_${Date.now()}`;
  }

  /**
   * Create public token for client-side reference
   */
  private createPublicToken(tokenId: string): string {
    // Return masked version for client
    return `pub_${tokenId.slice(4, 14)}...${tokenId.slice(-8)}`;
  }

  /**
   * Get current token usage
   */
  private async getCurrentTokenUsage(tokenId: string): Promise<number> {
    // In production, this would query a transaction history DB
    // For now, return 0 (new token)
    return 0;
  }

  /**
   * Record token usage
   */
  private async recordTokenUsage(
    tokenId: string,
    amount: number,
    orderId: string
  ): Promise<number> {
    // In production, this would store in DB
    // For now, return the amount as usage
    return amount;
  }

  /**
   * Get token status
   */
  getTokenStatus(
    tokenId: string,
    userId: string
  ): {
    exists: boolean;
    isExpired: boolean;
    remaining?: number;
  } {
    const token = this.tokenStore.get(tokenId);

    if (!token) {
      return { exists: false, isExpired: false };
    }

    if (token.userId !== userId) {
      return { exists: false, isExpired: false };
    }

    const isExpired = new Date() > token.expiresAt;

    return {
      exists: true,
      isExpired,
      remaining: isExpired ? 0 : token.authorizationLimit,
    };
  }
}
