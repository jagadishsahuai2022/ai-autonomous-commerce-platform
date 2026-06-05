import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { AppException } from '../exceptions/app.exception';

interface ErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  timestamp: string;
  path: string;
  method: string;
  context?: Record<string, any>;
  details?: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<FastifyRequest>();
    const res = ctx.getResponse<FastifyReply>();

    let response: ErrorResponse;

    // Handle custom AppException
    if (exception instanceof AppException) {
      response = {
        statusCode: exception.statusCode,
        code: exception.code,
        message: exception.message,
        timestamp: new Date().toISOString(),
        path: req.url,
        method: req.method,
        context: exception.context,
      };

      this.logger.warn(
        `${exception.code} - ${exception.message}`,
        JSON.stringify({ context: exception.context, path: req.url })
      );

      return res.status(exception.statusCode).send(response);
    }

    // Handle NestJS HttpException
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      const status = exception.getStatus();

      response = {
        statusCode: status,
        code: 'HTTP_EXCEPTION',
        message: (exceptionResponse as any).message || exception.message,
        timestamp: new Date().toISOString(),
        path: req.url,
        method: req.method,
        details: (exceptionResponse as any).error,
      };

      this.logger.warn(
        `HTTP Exception: ${status}`,
        JSON.stringify({ message: response.message, path: req.url })
      );

      return res.status(status).send(response);
    }

    // Handle validation errors
    if ((exception as any)?.isValidationError) {
      const statusCode = HttpStatus.BAD_REQUEST;
      response = {
        statusCode,
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        timestamp: new Date().toISOString(),
        path: req.url,
        method: req.method,
        details: (exception as any).message,
      };

      this.logger.warn('Validation error', JSON.stringify({ details: (exception as any).message }));

      return res.status(statusCode).send(response);
    }

    // Handle unknown errors
    const statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception instanceof Error ? exception.message : 'Unknown error';

    response = {
      statusCode,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
      path: req.url,
      method: req.method,
      details: process.env.NODE_ENV === 'development' ? message : undefined,
    };

    this.logger.error(
      'Unexpected error',
      exception instanceof Error ? exception.stack : String(exception)
    );

    res.status(statusCode).send(response);
  }
}
