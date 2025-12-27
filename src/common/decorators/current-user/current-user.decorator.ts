import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Gunakan createParamDecorator untuk membuat Parameter Decorator
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    // 1. Ambil Request Object dari Context
    const request = ctx.switchToHttp().getRequest();

    // 2. Return user yang sudah ditempel oleh JwtStrategy (request.user)
    return request.user;
  },
);
