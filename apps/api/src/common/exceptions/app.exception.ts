/**
 * Custom application exceptions
 */

export class AppException extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly message: string,
    public readonly code: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppException';
  }
}

export class ValidationException extends AppException {
  constructor(message: string, context?: Record<string, any>) {
    super(400, message, 'VALIDATION_FAILED', context);
    this.name = 'ValidationException';
  }
}

export class UnauthorizedException extends AppException {
  constructor(message = 'Unauthorized', context?: Record<string, any>) {
    super(401, message, 'UNAUTHORIZED', context);
    this.name = 'UnauthorizedException';
  }
}

export class ForbiddenException extends AppException {
  constructor(message = 'Forbidden', context?: Record<string, any>) {
    super(403, message, 'FORBIDDEN', context);
    this.name = 'ForbiddenException';
  }
}

export class NotFoundException extends AppException {
  constructor(resource: string, context?: Record<string, any>) {
    super(404, `${resource} not found`, 'RESOURCE_NOT_FOUND', context);
    this.name = 'NotFoundException';
  }
}

export class ConflictException extends AppException {
  constructor(message: string, context?: Record<string, any>) {
    super(409, message, 'STATE_CONFLICT', context);
    this.name = 'ConflictException';
  }
}

export class InternalServerException extends AppException {
  constructor(message = 'Internal server error', context?: Record<string, any>) {
    super(500, message, 'INTERNAL_SERVER_ERROR', context);
    this.name = 'InternalServerException';
  }
}
