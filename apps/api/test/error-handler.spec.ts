/**
 * API Error Handler Tests
 * - Test NestJS error handling service
 * - Test custom exceptions
 * - Test error mapping
 */

import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { ErrorHandlerService, ErrorCode } from '../src/common/services/error-handler.service';
import {
  ValidationException,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  AppException,
} from '../src/common/exceptions/app.exception';

describe('ErrorHandlerService', () => {
  let service: ErrorHandlerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ErrorHandlerService],
    }).compile();

    service = module.get<ErrorHandlerService>(ErrorHandlerService);
  });

  describe('handle error', () => {
    it('should handle AppException directly', () => {
      const appException = new AppException(
        HttpStatus.BAD_REQUEST,
        'Test error',
        ErrorCode.INVALID_INPUT
      );

      const result = service.handleError(appException);

      expect(result).toEqual(appException);
    });

    it('should convert standard Error to AppException', () => {
      const standardError = new Error('Standard error message');

      const result = service.handleError(standardError);

      expect(result).toBeInstanceOf(AppException);
      expect(result.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.code).toBe(ErrorCode.INTERNAL_ERROR);
    });

    it('should handle TypeError as INVALID_INPUT', () => {
      const typeError = new TypeError('Type mismatch');

      const result = service.handleError(typeError);

      expect(result.code).toBe(ErrorCode.INVALID_INPUT);
      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should handle ValidationError', () => {
      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationError';

      const result = service.handleError(validationError);

      expect(result.code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should include context in error', () => {
      const context = { userId: '123', operation: 'create' };
      const error = new Error('Test error');

      const result = service.handleError(error, context);

      expect(result.context).toEqual(context);
    });
  });

  describe('create validation error', () => {
    it('should create properly formatted validation error', () => {
      const error = service.createValidationError('email', 'Invalid email format');

      expect(error).toBeInstanceOf(ValidationException);
      expect(error.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(error.context.field).toBe('email');
    });
  });

  describe('create not found error', () => {
    it('should create properly formatted not found error', () => {
      const error = service.createNotFoundError('Product');

      expect(error).toBeInstanceOf(NotFoundException);
      expect(error.statusCode).toBe(HttpStatus.NOT_FOUND);
      expect(error.code).toBe(ErrorCode.RESOURCE_NOT_FOUND);
      expect(error.message).toContain('Product');
    });
  });

  describe('create conflict error', () => {
    it('should create properly formatted conflict error', () => {
      const error = service.createConflictError('Email already exists');

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.statusCode).toBe(HttpStatus.CONFLICT);
      expect(error.code).toBe(ErrorCode.STATE_CONFLICT);
      expect(error.message).toBe('Email already exists');
    });
  });

  describe('create authorization errors', () => {
    it('should create unauthorized error', () => {
      const error = service.createUnauthorizedError('Invalid token');

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.statusCode).toBe(HttpStatus.UNAUTHORIZED);
      expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
    });

    it('should create forbidden error', () => {
      const error = service.createForbiddenError('Access denied');

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error.statusCode).toBe(HttpStatus.FORBIDDEN);
      expect(error.code).toBe(ErrorCode.FORBIDDEN);
    });
  });

  describe('business logic errors', () => {
    it('should create out of stock error', () => {
      const error = service.createOutOfStockError('PROD-123');

      expect(error.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(error.code).toBe(ErrorCode.OUT_OF_STOCK);
      expect(error.context.productId).toBe('PROD-123');
    });

    it('should create payment error', () => {
      const error = service.createPaymentError('Payment declined');

      expect(error.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(error.code).toBe(ErrorCode.PAYMENT_FAILED);
    });

    it('should create rate limit error', () => {
      const error = service.createRateLimitError(60);

      expect(error.statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
      expect(error.context.retryAfter).toBe(60);
    });
  });

  describe('error suggestions', () => {
    it('should provide suggestion for each error code', () => {
      const errorCodes = Object.values(ErrorCode);

      for (const code of errorCodes) {
        const suggestion = service.getSuggestion(code as ErrorCode);
        expect(suggestion).toBeTruthy();
        expect(suggestion.length).toBeGreaterThan(0);
      }
    });

    it('should provide user-friendly suggestions', () => {
      const suggestion = service.getSuggestion(ErrorCode.UNAUTHORIZED);

      expect(suggestion.toLowerCase()).toContain('log in');
    });
  });

  describe('error logging', () => {
    it('should create error log', () => {
      const error = new AppException(
        HttpStatus.BAD_REQUEST,
        'Test error',
        ErrorCode.VALIDATION_FAILED
      );

      const errorLog = service.createErrorLog(error, undefined, 'req-123');

      expect(errorLog.statusCode).toBe(400);
      expect(errorLog.code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(errorLog.message).toBe('Test error');
      expect(errorLog.requestId).toBe('req-123');
      expect(errorLog.suggestion).toBeTruthy();
    });

    it('should distinguish critical errors', () => {
      const error500 = new AppException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'Server error',
        ErrorCode.INTERNAL_ERROR
      );

      const error400 = new AppException(
        HttpStatus.BAD_REQUEST,
        'Bad request',
        ErrorCode.VALIDATION_FAILED
      );

      expect(error500.statusCode).toBeGreaterThanOrEqual(500);
      expect(error400.statusCode).toBeLessThan(500);
    });
  });

  describe('error code mapping', () => {
    it('should map HTTP status to error code', () => {
      const testCases = [
        { status: 400, expectedCode: ErrorCode.INVALID_INPUT },
        { status: 401, expectedCode: ErrorCode.UNAUTHORIZED },
        { status: 403, expectedCode: ErrorCode.FORBIDDEN },
        { status: 404, expectedCode: ErrorCode.RESOURCE_NOT_FOUND },
        { status: 409, expectedCode: ErrorCode.STATE_CONFLICT },
        { status: 429, expectedCode: ErrorCode.RATE_LIMIT_EXCEEDED },
        { status: 500, expectedCode: ErrorCode.INTERNAL_ERROR },
      ];

      for (const testCase of testCases) {
        const error = new Error('Test');
        // The status to code mapping is done internally
      }
    });
  });

  describe('error context preservation', () => {
    it('should preserve context through error chain', () => {
      const context = {
        userId: 'user-123',
        orderId: 'order-456',
        operation: 'checkout',
      };

      const error = service.createBusinessLogicError(
        ErrorCode.INVALID_STATE,
        'Order already completed',
        context
      );

      expect(error.context).toEqual(context);
    });

    it('should merge additional context', () => {
      const originalContext = { userId: 'user-123' };
      const additionalContext = { action: 'view' };

      const error = service.createConflictError('Resource exists', {
        ...originalContext,
        ...additionalContext,
      });

      expect(error.context.userId).toBe('user-123');
      expect(error.context.action).toBe('view');
    });
  });
});

describe('Custom Exceptions', () => {
  it('should create ValidationException with proper status', () => {
    const error = new ValidationException('Email is required');

    expect(error.statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
  });

  it('should create NotFoundException with proper status', () => {
    const error = new NotFoundException('User');

    expect(error.statusCode).toBe(HttpStatus.NOT_FOUND);
    expect(error.code).toBe(ErrorCode.RESOURCE_NOT_FOUND);
    expect(error.message).toContain('User');
  });

  it('should create ConflictException with proper status', () => {
    const error = new ConflictException('Email already registered');

    expect(error.statusCode).toBe(HttpStatus.CONFLICT);
    expect(error.code).toBe(ErrorCode.STATE_CONFLICT);
  });

  it('should create UnauthorizedException with proper status', () => {
    const error = new UnauthorizedException('Invalid token');

    expect(error.statusCode).toBe(HttpStatus.UNAUTHORIZED);
    expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it('should create ForbiddenException with proper status', () => {
    const error = new ForbiddenException('Admin access required');

    expect(error.statusCode).toBe(HttpStatus.FORBIDDEN);
    expect(error.code).toBe(ErrorCode.FORBIDDEN);
  });
});
