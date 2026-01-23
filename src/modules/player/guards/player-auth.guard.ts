import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../providers/prisma/prisma.service';
import { RequestWithScreen } from '../../../common/interfaces/request/request-with-screen.interface';

@Injectable()
export class PlayerAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithScreen>();

    const deviceIdHeader = request.headers['x-device-id'];

    if (!deviceIdHeader) {
      throw new UnauthorizedException('Missing X-Device-ID header');
    }

    const deviceId = Array.isArray(deviceIdHeader)
      ? deviceIdHeader[0]
      : deviceIdHeader;

    const screen = await this.prisma.screen.findUnique({
      where: { code: deviceId },
    });

    if (!screen) {
      throw new UnauthorizedException('Device ID is not registered');
    }
    request.screen = screen;

    return true;
  }
}
