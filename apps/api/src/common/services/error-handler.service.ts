/**
 * Error Handler Service (NestJS API)
 * - Centralized error handling and normalization
 * - Error code mapping
 * - Structured error responses
 * - Recovery strategies
 */

import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import {
  ValidationException,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  InternalServerException,
  AppException,
} from '../exceptions/app.exception';

/**
 * Standard error codes used across the application
 */
export enum ErrorCode {
  // Validation errors (400)
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  VALIDATION_FAILED = 'VALIDATION_FAILED',

  // Authentication errors (401)
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  SESSION_EXPIRED = 'SESSION_EXPIRED',

  // Authorization errors (403)
  FORBIDDEN = 'FORBIDDEN',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_NOT_ACCESSIBLE = 'RESOURCE_NOT_ACCESSIBLE',

  // Not found errors (404)
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  ENTITY_NOT_FOUND = 'ENTITY_NOT_FOUND',
  PAGE_NOT_FOUND = 'PAGE_NOT_FOUND',

  // Conflict errors (409)
  RESOURCE_EXISTS = 'RESOURCE_EXISTS',
  STATE_CONFLICT = 'STATE_CONFLICT',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',

  // Server errors (500)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  SERVICE_ERROR = 'SERVICE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',

  // Business logic errors
  BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR',
  INVALID_STATE = 'INVALID_STATE',
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',

  // Cart/Product errors
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  INVALID_QUANTITY = 'INVALID_QUANTITY',
  CART_EMPTY = 'CART_EMPTY',

  // Payment errors
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  INVALID_PAYMENT_METHOD = 'INVALID_PAYMENT_METHOD',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',

  // Order errors
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  INVALID_ORDER_STATE = 'INVALID_ORDER_STATE',

  // Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Error context for additional debugging information
 */
export interface ErrorContext {
  userId?: string;
  resourceId?: string;
  operation?: string;
  timestamp?: Date;
  requestId?: string;
  [key: string]: any;
}

/**
 * Structured error response
 */
export interface ErrorResponse {
  statusCode: number;
  code: ErrorCode;
  message: string;
  timestamp: Date;
  requestId?: string;
  context?: ErrorContext;
  suggestion?: string;
}

@Injectable()
export class ErrorHandlerService {
  private readonly logger = new Logger(ErrorHandlerService.name);

  /**
   * Normalize and handle errors consistently
   */
  handleError(error: unknown, context?: ErrorContext): AppException {
    // If it's already an AppException, return as-is
    if (error instanceof AppException) {
      return error;
    }

    // If it's an HttpException, convert to AppException
    if (error instanceof HttpException) {
      return this.handleHttpException(error, context);
    }

    // If it's a standard Error
    if (error instanceof Error) {
      return this.handleStandardError(error, context);
    }

    // Unknown error type
    return this.handleUnknownError(error, context);
  }

  /**
   * Handle HTTP exceptions from external services or NestJS
   */
  private handleHttpException(exception: HttpException, context?: ErrorContext): AppException {
    const status = exception.getStatus();
    const response = exception.getResponse();

    const message = this.extractMessage(response);
    const code = this.mapStatusToCode(status);

    this.logger.warn(`HTTP Exception: ${code}`, {
      status,
      message,
      context,
    });

    return new AppException(status, message, code, context);
  }

  /**
   * Handle standard JavaScript errors
   */
  private handleStandardError(error: Error, context?: ErrorContext): AppException {
    const message = error.message || 'An error occurred';

    let code = ErrorCode.INTERNAL_ERROR;
    let status = HttpStatus.INTERNAL_SERVER_ERROR;

    // Map specific error types
    if (error.name === 'ValidationError') {
      code = ErrorCode.VALIDATION_FAILED;
      status = HttpStatus.BAD_REQUEST;
    } else if (error.name === 'TypeError') {
      code = ErrorCode.INVALID_INPUT;
      status = HttpStatus.BAD_REQUEST;
    } else if (error.name === 'SyntaxError') {
      code = ErrorCode.INVALID_FORMAT;
      status = HttpStatus.BAD_REQUEST;
    }

    this.logger.error(`Standard Error: ${code}`, {
      message,
      stack: error.stack,
      context,
    });

    return new AppException(status, message, code, context);
  }

  /**
   * Handle unknown/untyped errors
   */
  private handleUnknownError(error: unknown, context?: ErrorContext): AppException {
    const message = String(error) || 'Unknown error occurred';

    this.logger.error('Unknown Error', {
      error: error,
      message,
      context,
    });

    return new AppException(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'An unexpected error occurred',
      ErrorCode.UNKNOWN_ERROR,
      { original: message, ...context }
    );
  }

  /**
   * Create validation exception
   */
  createValidationError(
    field: string,
    message: string,
    context?: ErrorContext
  ): ValidationException {
    return new ValidationException(message, { field, ...context });
  }

  /**
   * Create not found exception
   */
  createNotFoundError(resource: string, context?: ErrorContext): NotFoundException {
    return new NotFoundException(resource, context);
  }

  /**
   * Create conflict exception
   */
  createConflictError(message: string, context?: ErrorContext): ConflictException {
    return new ConflictException(message, context);
  }

  /**
   * Create unauthorized exception
   */
  createUnauthorizedError(message = 'Unauthorized', context?: ErrorContext): UnauthorizedException {
    return new UnauthorizedException(message, context);
  }

  /**
   * Create forbidden exception
   */
  createForbiddenError(message = 'Forbidden', context?: ErrorContext): ForbiddenException {
    return new ForbiddenException(message, context);
  }

  /**
   * Create internal server exception
   */
  createInternalError(
    message = 'Internal server error',
    context?: ErrorContext
  ): InternalServerException {
    return new InternalServerException(message, context);
  }

  /**
   * Business logic error factory
   */
  createBusinessLogicError(code: ErrorCode, message: string, context?: ErrorContext): AppException {
    return new AppException(HttpStatus.BAD_REQUEST, message, code, context);
  }

  /**
   * Payment error factory
   */
  createPaymentError(message: string, context?: ErrorContext): AppException {
    return new AppException(HttpStatus.BAD_REQUEST, message, ErrorCode.PAYMENT_FAILED, context);
  }

  /**
   * Out of stock error factory
   */
  createOutOfStockError(productId: string, context?: ErrorContext): AppException {
    return new AppException(
      HttpStatus.BAD_REQUEST,
      `Product ${productId} is out of stock`,
      ErrorCode.OUT_OF_STOCK,
      { productId, ...context }
    );
  }

  /**
   * Rate limit error factory
   */
  createRateLimitError(retryAfter?: number, context?: ErrorContext): AppException {
    const message = `Too many requests. ${retryAfter ? `Please retry after ${retryAfter} seconds.` : ''}`;
    return new AppException(HttpStatus.TOO_MANY_REQUESTS, message, ErrorCode.RATE_LIMIT_EXCEEDED, {
      retryAfter,
      ...context,
    });
  }

  /**
   * Extract message from various response types
   */
  private extractMessage(response: any): string {
    if (typeof response === 'string') {
      return response;
    }

    if (response.message) {
      return response.message;
    }

    if (response.error) {
      return response.error;
    }

    return 'An error occurred';
  }

  /**
   * Map HTTP status codes to error codes
   */
  private mapStatusToCode(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.INVALID_INPUT;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.RESOURCE_NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.STATE_CONFLICT;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.RATE_LIMIT_EXCEEDED;
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return ErrorCode.INTERNAL_ERROR;
      case HttpStatus.SERVICE_UNAVAILABLE:
        return ErrorCode.SERVICE_ERROR;
      default:
        return ErrorCode.UNKNOWN_ERROR;
    }
  }

  /**
   * Create detailed error response for logging
   */
  createErrorLog(error: AppException, context?: ErrorContext, requestId?: string): ErrorResponse {
    return {
      statusCode: error.statusCode,
      code: error.code as ErrorCode,
      message: error.message,
      timestamp: new Date(),
      requestId,
      context: { ...error.context, ...context },
      suggestion: this.getSuggestion(error.code as ErrorCode),
    };
  }

  /**
   * Get user-friendly suggestion based on error code
   */
  getSuggestion(code: ErrorCode): string {
    const suggestions: Record<ErrorCode, string> = {
      [ErrorCode.INVALID_INPUT]: 'Please check your input and try again.',
      [ErrorCode.MISSING_REQUIRED_FIELD]: 'Please provide all required fields.',
      [ErrorCode.INVALID_FORMAT]: 'The format of your input is invalid.',
      [ErrorCode.VALIDATION_FAILED]: 'Your input did not pass validation.',
      [ErrorCode.UNAUTHORIZED]: 'Please log in to continue.',
      [ErrorCode.INVALID_CREDENTIALS]: 'Invalid email or password.',
      [ErrorCode.TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
      [ErrorCode.TOKEN_INVALID]: 'Your session token is invalid. Please log in again.',
      [ErrorCode.SESSION_EXPIRED]: 'Your session has expired. Please log in again.',
      [ErrorCode.FORBIDDEN]: 'You do not have permission to perform this action.',
      [ErrorCode.PERMISSION_DENIED]: 'You do not have permission to perform this action.',
      [ErrorCode.INSUFFICIENT_PERMISSIONS]: 'You do not have sufficient permissions.',
      [ErrorCode.RESOURCE_NOT_ACCESSIBLE]: 'This resource is not accessible to you.',
      [ErrorCode.RESOURCE_NOT_FOUND]: 'The requested resource was not found.',
      [ErrorCode.ENTITY_NOT_FOUND]: 'The requested entity was not found.',
      [ErrorCode.PAGE_NOT_FOUND]: 'The requested page was not found.',
      [ErrorCode.RESOURCE_EXISTS]: 'This resource already exists.',
      [ErrorCode.STATE_CONFLICT]: 'There is a conflict with the current state.',
      [ErrorCode.DUPLICATE_ENTRY]: 'This entry already exists.',
      [ErrorCode.RATE_LIMIT_EXCEEDED]: 'You are making too many requests. Please slow down.',
      [ErrorCode.TOO_MANY_REQUESTS]: 'Too many requests. Please try again later.',
      [ErrorCode.INTERNAL_ERROR]: 'An internal error occurred. Please try again later.',
      [ErrorCode.DATABASE_ERROR]: 'A database error occurred. Please try again later.',
      [ErrorCode.SERVICE_ERROR]: 'A service error occurred. Please try again later.',
      [ErrorCode.EXTERNAL_SERVICE_ERROR]:
        'An external service is currently unavailable. Please try again later.',
      [ErrorCode.BUSINESS_LOGIC_ERROR]: 'A business logic error occurred.',
      [ErrorCode.INVALID_STATE]: 'The current state is invalid for this operation.',
      [ErrorCode.OPERATION_NOT_ALLOWED]: 'This operation is not allowed.',
      [ErrorCode.OUT_OF_STOCK]: 'This product is out of stock.',
      [ErrorCode.INVALID_QUANTITY]: 'The quantity is invalid.',
      [ErrorCode.CART_EMPTY]: 'Your cart is empty.',
      [ErrorCode.PAYMENT_FAILED]: 'Payment failed. Please try again.',
      [ErrorCode.INVALID_PAYMENT_METHOD]: 'The payment method is invalid.',
      [ErrorCode.INSUFFICIENT_FUNDS]: 'You have insufficient funds.',
      [ErrorCode.ORDER_NOT_FOUND]: 'The order was not found.',
      [ErrorCode.INVALID_ORDER_STATE]: 'The order is in an invalid state for this operation.',
      [ErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again later.',
    };

    return suggestions[code] || 'An error occurred. Please try again.';
  }

  /**
   * Log error with context
   */
  logError(error: AppException, context?: ErrorContext, requestId?: string): void {
    const errorLog = this.createErrorLog(error, context, requestId);

    if (error.statusCode >= 500) {
      this.logger.error(`[${requestId}] ${error.code}`, errorLog);
    } else {
      this.logger.warn(`[${requestId}] ${error.code}`, errorLog);
    }
  }
}
