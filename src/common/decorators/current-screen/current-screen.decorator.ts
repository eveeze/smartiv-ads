import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithScreen } from '../../interfaces/request/request-with-screen.interface'; // 👈 Import dari folder 'request'

export const CurrentScreen = createParamDecorator(
  (data: never, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithScreen>();
    return request.screen;
  },
);
