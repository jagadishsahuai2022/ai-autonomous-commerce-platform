/**
 * CSRF Protection Service
 * Triple-submit cookie pattern, token validation, session binding
 */

import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';

export interface CSRFToken {
  token: string;
  sessionId: string;
  expiresAt: Date;
  origin: string;
}

@Injectable()
export class CSRFProtectionService {
  private readonly logger = new Logger(CSRFProtectionService.name);
  private readonly tokenStore = new Map<string, CSRFToken>();
  private readonly CSRF_TOKEN_EXPIRY = 3600000; // 1 hour
  private readonly ALLOWED_METHODS = ['GET', 'HEAD', 'OPTIONS'];
  private readonly SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS', 'TRACE'];

  /**
   * Generate CSRF token
   */
  generateCSRFToken(sessionId: string, origin: string): CSRFToken {
    const token = this.generateSecureToken();
    const expiresAt = new Date(Date.now() + this.CSRF_TOKEN_EXPIRY);

    const csrfToken: CSRFToken = {
      token,
      sessionId,
      expiresAt,
      origin,
    };

    this.tokenStore.set(token, csrfToken);

    // Cleanup expired tokens
    this.cleanupExpiredTokens();

    return csrfToken;
  }

  /**
   * Validate CSRF token
   */
  validateCSRFToken(
    token: string,
    sessionId: string,
    origin: string
  ): { valid: boolean; reason?: string } {
    // Safe methods don't need CSRF protection
    if (!token) {
      return { valid: false, reason: 'CSRF token missing' };
    }

    const stored = this.tokenStore.get(token);

    if (!stored) {
      return { valid: false, reason: 'Invalid CSRF token' };
    }

    if (Date.now() > stored.expiresAt.getTime()) {
      this.tokenStore.delete(token);
      return { valid: false, reason: 'CSRF token expired' };
    }

    if (stored.sessionId !== sessionId) {
      return { valid: false, reason: 'Session mismatch' };
    }

    if (stored.origin !== origin) {
      this.logger.warn(`Origin mismatch: expected ${stored.origin}, got ${origin}`);
      return { valid: false, reason: 'Origin mismatch' };
    }

    // Token validated, invalidate it (single use)
    this.tokenStore.delete(token);

    // Generate new token for next request
    return { valid: true };
  }

  /**
   * Extract CSRF token from request (multiple sources)
   */
  extractCSRFToken(req: any): string | null {
    // Try header first (preferred for AJAX)
    const headerToken =
      req.headers['x-csrf-token'] || req.headers['x-xsrf-token'] || req.headers['x-requested-with'];

    if (headerToken && typeof headerToken === 'string') {
      return headerToken;
    }

    // Try body (for form submissions)
    if (req.body && req.body._csrf) {
      return req.body._csrf as string;
    }

    // Try query parameter (fallback)
    if (req.query && req.query.csrf) {
      return req.query.csrf as string;
    }

    return null;
  }

  /**
   * Check if request method needs CSRF protection
   */
  requiresCSRFProtection(method: string): boolean {
    return !this.SAFE_METHODS.includes(method.toUpperCase());
  }

  /**
   * Validate request origin
   */
  validateOrigin(
    requestOrigin: string,
    allowedOrigins: string[]
  ): { valid: boolean; reason?: string } {
    if (!requestOrigin) {
      return { valid: false, reason: 'Origin header missing' };
    }

    const origin = new URL(requestOrigin).origin;

    if (!allowedOrigins.includes(origin)) {
      this.logger.warn(`Unauthorized origin: ${origin}`);
      return { valid: false, reason: 'Origin not allowed' };
    }

    return { valid: true };
  }

  /**
   * Generate secure token
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Clean expired tokens
   */
  private cleanupExpiredTokens(): void {
    if (this.tokenStore.size > 10000) {
      const now = Date.now();
      let removed = 0;

      for (const [key, value] of this.tokenStore.entries()) {
        if (value.expiresAt.getTime() < now) {
          this.tokenStore.delete(key);
          removed++;
        }
      }

      this.logger.debug(`Cleaned up ${removed} expired CSRF tokens`);
    }
  }

  /**
   * Set CSRF token in response cookie
   */
  setCSRFTokenCookie(token: string, res: any): void {
    res.setCookie('XSRF-TOKEN', token, {
      httpOnly: false, // Accessible to JS for AJAX headers
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: this.CSRF_TOKEN_EXPIRY / 1000, // Fastify uses seconds
      path: '/',
    });
  }

  /**
   * Set SameSite cookie security header
   */
  setSameSiteCookie(name: string, value: string, res: any, maxAge: number = 86400000): void {
    res.setCookie(name, value, {
      httpOnly: true, // Prevents XSS access
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict', // No cross-site cookie sending
      maxAge: Math.floor(maxAge / 1000), // Fastify uses seconds
      path: '/',
    });
  }

  /**
   * Validate SameSite policy
   */
  validateSameSitePolicy(cookieHeader: string): { valid: boolean; reason?: string } {
    if (!cookieHeader) {
      return { valid: false, reason: 'No cookies present' };
    }

    // Cookies should have secure, httponly, samesite flags
    const hasSameSite = cookieHeader.includes('SameSite=');
    const hasHttpOnly = cookieHeader.includes('HttpOnly');
    const hasSecure =
      process.env.NODE_ENV === 'production' ? cookieHeader.includes('Secure') : true;

    if (!hasSameSite || !hasHttpOnly) {
      return { valid: false, reason: 'Missing SameSite/HttpOnly flags' };
    }

    if (!hasSecure && process.env.NODE_ENV === 'production') {
      return { valid: false, reason: 'Missing Secure flag in production' };
    }

    return { valid: true };
  }

  /**
   * Apply X-Frame-Options header
   */
  setXFrameOptions(res: any, action: 'DENY' | 'SAMEORIGIN' = 'DENY'): void {
    res.setHeader('X-Frame-Options', action);
  }

  /**
   * Apply X-Content-Type-Options header
   */
  setXContentTypeOptions(res: any): void {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }

  /**
   * Apply Content-Security-Policy header
   */
  setCSPHeader(res: any): void {
    const csp =
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self'; " +
      "connect-src 'self'; " +
      "frame-ancestors 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self'";

    res.setHeader('Content-Security-Policy', csp);
  }

  /**
   * Apply all security headers
   */
  setAllSecurityHeaders(res: any): void {
    this.setXFrameOptions(res, 'DENY');
    this.setXContentTypeOptions(res);
    this.setCSPHeader(res);
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  }

  /**
   * Detect potential XSS attempts
   */
  detectXSSAttempt(input: string): { suspicious: boolean; reason?: string } {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /on\w+\s*=\s*["\'][^"\']*["\']/gi,
      /javascript:/gi,
      /eval\(/gi,
      /expression\(/gi,
    ];

    for (const pattern of xssPatterns) {
      if (pattern.test(input)) {
        return {
          suspicious: true,
          reason: `Potential XSS: ${pattern.source}`,
        };
      }
    }

    return { suspicious: false };
  }

  /**
   * Detect potential SQL injection attempts
   */
  detectSQLInjection(input: string): { suspicious: boolean; reason?: string } {
    const sqlPatterns = [
      /(\bUNION\b.*\bSELECT\b)/gi,
      /(\bDROP\b.*\bTABLE\b)/gi,
      /(\bINSERT\b.*\bINTO\b)/gi,
      /(\bUPDATE\b.*\bSET\b)/gi,
      /(--|#|;)/g,
      /(\bOR\b\s+1\s*=\s*1)/gi,
    ];

    for (const pattern of sqlPatterns) {
      if (pattern.test(input)) {
        return {
          suspicious: true,
          reason: `Potential SQL injection: ${pattern.source}`,
        };
      }
    }

    return { suspicious: false };
  }

  /**
   * Sanitize user input
   */
  sanitizeInput(input: string, maxLength: number = 1000): string {
    let sanitized = input.trim().slice(0, maxLength);

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // HTML entities for special characters
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');

    return sanitized;
  }
}
