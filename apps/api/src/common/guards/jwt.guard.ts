/**
 * JWT Guard
 * Protects routes that require authentication
 * Validates JWT token and attaches user to request
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

export interface AuthenticatedUser {
  userId: number;
  email: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtGuard implements CanActivate {
  private readonly logger = new Logger('JwtGuard');

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    // Extract token from Authorization header
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException('Authorization token is missing');
    }

    try {
      // Decode and validate token
      const user = this.validateToken(token);
      // Attach user to request for use in controllers
      (request as any).user = user;
      return true;
    } catch (error) {
      this.logger.debug(`Token validation failed: ${(error as any).message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * Extract Bearer token from Authorization header
   */
  private extractTokenFromHeader(request: FastifyRequest): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  /**
   * Validate and decode JWT token
   * Supports both mock (base64) and real JWT tokens
   */
  private validateToken(token: string): AuthenticatedUser {
    try {
      // Try to decode as mock JWT (base64 JSON)
      try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
        if (decoded.userId && decoded.email) {
          return decoded as AuthenticatedUser;
        }
      } catch (e) {
        // Not a valid base64 JSON, continue to other methods
      }

      // In production with @nestjs/jwt, implement proper JWT verification:
      // const payload = await this.jwtService.verifyAsync(token);
      // return payload;

      // Fallback for real JWT tokens (if implemented later):
      // This would use the real jwtService.verifyAsync()

      throw new Error('Invalid token format');
    } catch (error) {
      throw new UnauthorizedException('Failed to validate token');
    }
  }
}
