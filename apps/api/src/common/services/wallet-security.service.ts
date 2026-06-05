/**
 * Wallet Security Service
 * Transaction signing, wallet operations security, transaction verification
 */

import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';

export interface WalletTransaction {
  transactionId: string;
  walletId: string;
  userId: number;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  reason: string;
  signature: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface TransactionSignature {
  signature: string;
  publicKey: string;
  timestamp: number;
  nonce: string;
}

@Injectable()
export class WalletSecurityService {
  private readonly logger = new Logger(WalletSecurityService.name);
  private readonly nonceStore = new Map<string, { nonce: string; expiry: number }>();

  /**
   * Generate keypair for wallet
   */
  generateWalletKeypair(): { publicKey: string; privateKey: string } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    return { publicKey, privateKey };
  }

  /**
   * Create transaction signature
   */
  signTransaction(
    transaction: Omit<WalletTransaction, 'signature'>,
    privateKey: string
  ): TransactionSignature {
    const nonce = this.generateNonce();
    const timestamp = Date.now();

    const payload = JSON.stringify({
      transactionId: transaction.transactionId,
      walletId: transaction.walletId,
      userId: transaction.userId,
      amount: transaction.amount,
      type: transaction.type,
      reason: transaction.reason,
      timestamp: transaction.timestamp,
      nonce,
      sigTimestamp: timestamp,
    });

    const sign = crypto.createSign('sha256');
    sign.update(payload);
    const signature = sign.sign(privateKey, 'hex');

    return {
      signature,
      publicKey: this.extractPublicKey(privateKey),
      timestamp,
      nonce,
    };
  }

  /**
   * Verify transaction signature
   */
  verifyTransactionSignature(
    transaction: WalletTransaction,
    publicKey: string
  ): { valid: boolean; reason?: string } {
    try {
      const payload = JSON.stringify({
        transactionId: transaction.transactionId,
        walletId: transaction.walletId,
        userId: transaction.userId,
        amount: transaction.amount,
        type: transaction.type,
        reason: transaction.reason,
        timestamp: transaction.timestamp,
      });

      const verify = crypto.createVerify('sha256');
      verify.update(payload);

      const isValid = verify.verify(publicKey, transaction.signature, 'hex');

      if (!isValid) {
        return { valid: false, reason: 'Signature verification failed' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, reason: 'Signature verification error' };
    }
  }

  /**
   * Generate one-time nonce for transaction
   */
  private generateNonce(): string {
    const nonce = `nonce_${crypto.randomUUID()}_${Date.now()}`;
    const expiry = Date.now() + 300000; // 5 minutes

    this.nonceStore.set(nonce, { nonce, expiry });

    // Cleanup old nonces
    if (this.nonceStore.size > 1000) {
      const now = Date.now();
      for (const [key, value] of this.nonceStore.entries()) {
        if (value.expiry < now) {
          this.nonceStore.delete(key);
        }
      }
    }

    return nonce;
  }

  /**
   * Extract public key from private key
   */
  private extractPublicKey(privateKey: string): string {
    const keyObject = crypto.createPrivateKey(privateKey);
    return crypto.createPublicKey(keyObject).export({
      type: 'spki',
      format: 'pem',
    }) as string;
  }

  /**
   * Validate wallet balance before transaction
   */
  validateTransactionAmount(
    currentBalance: number,
    transactionAmount: number,
    minBalance: number = 100
  ): { valid: boolean; reason?: string } {
    if (transactionAmount <= 0) {
      return { valid: false, reason: 'Transaction amount must be positive' };
    }

    if (!Number.isFinite(transactionAmount)) {
      return { valid: false, reason: 'Invalid transaction amount' };
    }

    if (transactionAmount > currentBalance) {
      return {
        valid: false,
        reason: `Insufficient balance. Required: ₹${transactionAmount}, Available: ₹${currentBalance}`,
      };
    }

    if (currentBalance - transactionAmount < minBalance) {
      return {
        valid: false,
        reason: `Transaction would drop balance below minimum of ₹${minBalance}`,
      };
    }

    return { valid: true };
  }

  /**
   * Generate transaction ID with checksum
   */
  generateTransactionId(userId: number, timestamp: number): string {
    const data = `txn_${userId}_${timestamp}_${crypto.randomUUID()}`;
    const checksum = this.computeChecksum(data);
    return `${data}_${checksum}`;
  }

  /**
   * Verify transaction ID integrity
   */
  verifyTransactionId(transactionId: string): boolean {
    const parts = transactionId.split('_');
    if (parts.length < 4) return false;

    const checksum = parts.pop();
    const data = parts.join('_');
    const expected = this.computeChecksum(data);

    return checksum === expected;
  }

  /**
   * Compute checksum for transaction ID
   */
  private computeChecksum(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex').slice(0, 8);
  }

  /**
   * Detect fraudulent transaction patterns
   */
  async detectFraudPatterns(
    userId: number,
    recentTransactions: WalletTransaction[]
  ): Promise<{ isSuspicious: boolean; riskScore: number; flags: string[] }> {
    const flags: string[] = [];
    let riskScore = 0;

    // Check for rapid transactions
    const last10Min = recentTransactions.filter((t) => Date.now() - t.timestamp.getTime() < 600000);
    if (last10Min.length > 5) {
      flags.push('RAPID_TRANSACTIONS');
      riskScore += 20;
    }

    // Check for unusual amounts
    const avgAmount =
      recentTransactions.length > 0
        ? recentTransactions.reduce((sum, t) => sum + t.amount, 0) / recentTransactions.length
        : 0;

    const unusualAmounts = recentTransactions.filter((t) => t.amount > avgAmount * 3);
    if (unusualAmounts.length > 2) {
      flags.push('UNUSUAL_AMOUNTS');
      riskScore += 15;
    }

    // Check for large debits
    const largeDebits = recentTransactions.filter((t) => t.type === 'DEBIT' && t.amount > 50000);
    if (largeDebits.length > 1) {
      flags.push('LARGE_DEBITS');
      riskScore += 25;
    }

    return {
      isSuspicious: riskScore > 40,
      riskScore: Math.min(100, riskScore),
      flags,
    };
  }

  /**
   * Generate withdrawal verification code
   */
  generateWithdrawalCode(): { code: string; expiresAt: Date } {
    const code = crypto.randomBytes(4).readUInt32BE(0).toString().padStart(6, '0');
    const expiresAt = new Date(Date.now() + 900000); // 15 minutes

    return { code, expiresAt };
  }

  /**
   * Validate withdrawal code
   */
  validateWithdrawalCode(
    providedCode: string,
    expectedCode: string,
    expiryTime: Date
  ): { valid: boolean; reason?: string } {
    if (Date.now() > expiryTime.getTime()) {
      return { valid: false, reason: 'Code has expired' };
    }

    if (providedCode !== expectedCode) {
      return { valid: false, reason: 'Invalid code' };
    }

    return { valid: true };
  }

  /**
   * Create transaction audit log
   */
  createAuditLog(
    transaction: WalletTransaction,
    action: string
  ): {
    timestamp: Date;
    action: string;
    transactionId: string;
    userId: number;
    amount: number;
    status: string;
    metadata: Record<string, any>;
  } {
    return {
      timestamp: new Date(),
      action,
      transactionId: transaction.transactionId,
      userId: transaction.userId,
      amount: transaction.amount,
      status: 'RECORDED',
      metadata: {
        type: transaction.type,
        reason: transaction.reason,
        ipAddress: '0.0.0.0', // Should be captured from request
        userAgent: 'N/A', // Should be captured from request
        signature: transaction.signature.slice(0, 16) + '...', // Partial signature for audit
      },
    };
  }

  /**
   * Validate wallet address format
   */
  validateWalletAddress(address: string): { valid: boolean; sanitized?: string } {
    if (!address || typeof address !== 'string') {
      return { valid: false };
    }

    const sanitized = address.trim().toLowerCase();

    // Check if valid format (UUID or custom ID)
    if (!/^[a-z0-9_-]{8,}$/.test(sanitized)) {
      return { valid: false };
    }

    return { valid: true, sanitized };
  }
}
