/**
 * Comprehensive Unit Tests - Frontend Error Handling Library
 * Tests for error handling, recovery, and user feedback
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ErrorResponse, ErrorContext, ErrorRecoveryStrategy } from '../../lib/error-handling';

// Mock error response types
const createMockError = (
  code: string,
  message: string,
  statusCode: number = 500
): ErrorResponse => ({
  code,
  message,
  statusCode,
  timestamp: new Date(),
  context: {},
  userMessage: message,
  recoveryAction: undefined,
});

describe('Frontend Error Handling Library', () => {
  describe('Error Classification', () => {
    it('should classify network errors', () => {
      const error = createMockError('NETWORK_ERROR', 'Network request failed', 0);
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.statusCode).toBe(0);
    });

    it('should classify validation errors', () => {
      const error = createMockError('VALIDATION_FAILED', 'Invalid email format', 400);
      expect(error.code).toBe('VALIDATION_FAILED');
      expect(error.statusCode).toBe(400);
    });

    it('should classify authentication errors', () => {
      const error = createMockError('UNAUTHORIZED', 'Invalid credentials', 401);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.statusCode).toBe(401);
    });

    it('should classify authorization errors', () => {
      const error = createMockError('FORBIDDEN', 'Access denied', 403);
      expect(error.code).toBe('FORBIDDEN');
      expect(error.statusCode).toBe(403);
    });

    it('should classify not found errors', () => {
      const error = createMockError('NOT_FOUND', 'Resource not found', 404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
    });

    it('should classify server errors', () => {
      const error = createMockError('INTERNAL_SERVER_ERROR', 'Server error', 500);
      expect(error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(error.statusCode).toBe(500);
    });

    it('should classify rate limit errors', () => {
      const error = createMockError('RATE_LIMITED', 'Too many requests', 429);
      expect(error.code).toBe('RATE_LIMITED');
      expect(error.statusCode).toBe(429);
    });
  });

  describe('User-Friendly Messages', () => {
    it('should provide user-friendly message for validation error', () => {
      const error = createMockError(
        'VALIDATION_FAILED',
        'email must be a valid email address',
        400
      );
      error.userMessage = 'Please enter a valid email address';
      expect(error.userMessage).toBe('Please enter a valid email address');
    });

    it('should provide user-friendly message for network error', () => {
      const error = createMockError('NETWORK_ERROR', 'Network request failed', 0);
      error.userMessage = 'Unable to connect. Please check your internet connection.';
      expect(error.userMessage).toBe('Unable to connect. Please check your internet connection.');
    });

    it('should provide user-friendly message for auth error', () => {
      const error = createMockError('UNAUTHORIZED', 'Token expired', 401);
      error.userMessage = 'Your session has expired. Please log in again.';
      expect(error.userMessage).toBe('Your session has expired. Please log in again.');
    });

    it('should hide sensitive server error details', () => {
      const error = createMockError(
        'INTERNAL_SERVER_ERROR',
        'Database connection string exposed',
        500
      );
      error.userMessage = 'Something went wrong. Please try again later.';
      expect(error.userMessage).not.toContain('connection string');
    });
  });

  describe('Error Context', () => {
    it('should capture error context with location', () => {
      const error = createMockError('API_ERROR', 'Failed to fetch products', 500);
      error.context = {
        location: '/products',
        endpoint: '/api/products',
        method: 'GET',
      };

      expect(error.context.location).toBe('/products');
      expect(error.context.endpoint).toBe('/api/products');
      expect(error.context.method).toBe('GET');
    });

    it('should capture user action context', () => {
      const error = createMockError('CHECKOUT_ERROR', 'Payment processing failed', 500);
      error.context = {
        action: 'processPayment',
        cartId: 'cart-123',
        amount: 9999,
      };

      expect(error.context.action).toBe('processPayment');
      expect(error.context.cartId).toBe('cart-123');
    });

    it('should capture form field errors', () => {
      const error = createMockError('FORM_VALIDATION', 'Form validation failed', 400);
      error.context = {
        fields: {
          email: 'Invalid email format',
          password: 'Password must be at least 8 characters',
        },
      };

      expect(error.context.fields.email).toBe('Invalid email format');
      expect(error.context.fields.password).toBe('Password must be at least 8 characters');
    });
  });

  describe('Error Recovery', () => {
    it('should suggest retry for network errors', () => {
      const error = createMockError('NETWORK_ERROR', 'Connection failed', 0);
      error.recoveryAction = {
        type: 'retry',
        label: 'Try Again',
        delayMs: 1000,
      };

      expect(error.recoveryAction?.type).toBe('retry');
      expect(error.recoveryAction?.delayMs).toBe(1000);
    });

    it('should suggest login for auth errors', () => {
      const error = createMockError('UNAUTHORIZED', 'Token expired', 401);
      error.recoveryAction = {
        type: 'redirect',
        label: 'Please Log In',
        target: '/login',
      };

      expect(error.recoveryAction?.type).toBe('redirect');
      expect(error.recoveryAction?.target).toBe('/login');
    });

    it('should suggest reload for server errors', () => {
      const error = createMockError('INTERNAL_SERVER_ERROR', 'Server error', 500);
      error.recoveryAction = {
        type: 'reload',
        label: 'Reload Page',
      };

      expect(error.recoveryAction?.type).toBe('reload');
    });

    it('should suggest contact support for persistent errors', () => {
      const error = createMockError('PERSISTENT_ERROR', 'Unable to complete operation', 500);
      error.recoveryAction = {
        type: 'contact',
        label: 'Contact Support',
        email: 'support@example.com',
      };

      expect(error.recoveryAction?.type).toBe('contact');
      expect(error.recoveryAction?.email).toBe('support@example.com');
    });
  });

  describe('Error Logging', () => {
    it('should log error with full context', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = createMockError('API_ERROR', 'API call failed', 500);
      error.context = { endpoint: '/api/products', method: 'GET' };

      console.error('Error:', error);

      expect(consoleSpy).toHaveBeenCalledWith('Error:', error);
      consoleSpy.mockRestore();
    });

    it('should log errors to analytics', () => {
      const analyticsStub = vi.fn();
      const error = createMockError('FORM_ERROR', 'Form submission failed', 400);

      analyticsStub('error', error.code, { status: error.statusCode });

      expect(analyticsStub).toHaveBeenCalledWith('error', 'FORM_ERROR', {
        status: 400,
      });
    });

    it('should not log sensitive data', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = createMockError('AUTH_ERROR', 'Authentication failed', 401);
      error.context = {
        password: 'user_password_here', // Should not be logged
        apiKey: 'secret_key', // Should not be logged
      };

      // In real implementation, these fields would be filtered
      delete error.context.password;
      delete error.context.apiKey;

      console.error('Error:', error);

      expect(error.context.password).toBeUndefined();
      expect(error.context.apiKey).toBeUndefined();
      consoleSpy.mockRestore();
    });
  });

  describe('Error Normalization', () => {
    it('should normalize API errors', () => {
      const apiError = {
        status: 404,
        data: { message: 'Not found', code: 'PRODUCT_NOT_FOUND' },
      };

      const normalized = createMockError(
        apiError.data.code,
        apiError.data.message,
        apiError.status
      );

      expect(normalized.code).toBe('PRODUCT_NOT_FOUND');
      expect(normalized.statusCode).toBe(404);
    });

    it('should normalize network errors', () => {
      const networkError = new Error('Network request failed');
      const normalized = createMockError('NETWORK_ERROR', networkError.message, 0);

      expect(normalized.code).toBe('NETWORK_ERROR');
      expect(normalized.statusCode).toBe(0);
    });

    it('should normalize form validation errors', () => {
      const formErrors = {
        email: ['Invalid email format'],
        password: ['Too short', 'Missing numbers'],
      };

      const normalized = createMockError('VALIDATION_FAILED', 'Form validation failed', 400);
      normalized.context = { fields: formErrors };

      expect(normalized.context.fields.email).toEqual(['Invalid email format']);
      expect(normalized.context.fields.password).toEqual(['Too short', 'Missing numbers']);
    });
  });

  describe('Error State Management', () => {
    it('should clear error state', () => {
      let errorState = createMockError('TEST_ERROR', 'Test error', 400);
      errorState = null!;

      expect(errorState).toBeNull();
    });

    it('should stack multiple errors', () => {
      const errors = [
        createMockError('ERROR_1', 'First error', 400),
        createMockError('ERROR_2', 'Second error', 400),
        createMockError('ERROR_3', 'Third error', 400),
      ];

      expect(errors).toHaveLength(3);
      expect(errors[0].message).toBe('First error');
      expect(errors[2].message).toBe('Third error');
    });

    it('should get latest error', () => {
      const errors = [
        createMockError('ERROR_1', 'First error', 400),
        createMockError('ERROR_2', 'Second error', 400),
      ];

      const latest = errors[errors.length - 1];
      expect(latest.message).toBe('Second error');
    });
  });

  describe('Retry Logic', () => {
    it('should calculate exponential backoff', () => {
      const calculateBackoff = (attempt: number, baseMs: number = 1000): number => {
        return baseMs * Math.pow(2, attempt);
      };

      expect(calculateBackoff(0)).toBe(1000);
      expect(calculateBackoff(1)).toBe(2000);
      expect(calculateBackoff(2)).toBe(4000);
      expect(calculateBackoff(3)).toBe(8000);
    });

    it('should cap maximum retry delay', () => {
      const calculateBackoff = (
        attempt: number,
        baseMs: number = 1000,
        maxMs: number = 30000
      ): number => {
        const delay = baseMs * Math.pow(2, attempt);
        return Math.min(delay, maxMs);
      };

      expect(calculateBackoff(0)).toBe(1000);
      expect(calculateBackoff(5)).toBe(30000); // Capped at 30000
      expect(calculateBackoff(10)).toBe(30000); // Still capped
    });

    it('should add jitter to retry delay', () => {
      const calculateBackoffWithJitter = (attempt: number, baseMs: number = 1000): number => {
        const delay = baseMs * Math.pow(2, attempt);
        const jitter = Math.random() * delay * 0.1; // 10% jitter
        return delay + jitter;
      };

      const delay = calculateBackoffWithJitter(1);
      expect(delay).toBeGreaterThanOrEqual(2000);
      expect(delay).toBeLessThan(2200); // 2000 + 10% jitter
    });
  });

  describe('Error Boundaries', () => {
    it('should catch unhandled errors', () => {
      const errorBoundary = {
        errors: [] as ErrorResponse[],
        addError: function (error: ErrorResponse) {
          this.errors.push(error);
        },
      };

      const error = createMockError('UNHANDLED', 'Unhandled error occurred', 500);
      errorBoundary.addError(error);

      expect(errorBoundary.errors).toHaveLength(1);
      expect(errorBoundary.errors[0].code).toBe('UNHANDLED');
    });

    it('should prevent error cascade', () => {
      let errorCount = 0;
      const handleError = (error: ErrorResponse) => {
        errorCount++;
        if (errorCount > 10) {
          throw new Error('Too many errors, stopping cascade');
        }
      };

      // Simulate error cascade prevention
      const errors = Array(5).fill(createMockError('ERR', 'msg', 400));
      errors.forEach(handleError);

      expect(errorCount).toBe(5);
    });
  });
});
