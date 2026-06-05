/**
 * User Decorator
 * Extracts authenticated user from request context
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  userId: number;
  email: string;
  iat?: number;
  exp?: number;
}

export const User = createParamDecorator((data: string, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user as AuthenticatedUser;

  // Return specific field if requested, otherwise return whole user object
  return data ? user?.[data] : user;
});
