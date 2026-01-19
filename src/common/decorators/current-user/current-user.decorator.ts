import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithUser } from '../../interfaces/request/request-with-user.interface'; // Sesuaikan path import

export const CurrentUser = createParamDecorator(
  (data: never, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
