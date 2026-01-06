import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../providers/prisma/prisma.service';

@Injectable()
export class PlayerAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const deviceId = request.headers['x-device-id'];

    if (!deviceId) {
      throw new UnauthorizedException('Missing X-Device-ID header');
    }

    // Validasi Device ID ke Database (Optimized Select)
    const screen = await this.prisma.screen.findUnique({
      where: { code: deviceId.toString() }, // Pastikan string
      select: {
        id: true,
        propertyId: true,
        name: true,
        code: true,
        orientation: true,
      },
    });

    if (!screen) {
      throw new UnauthorizedException('Device ID is not registered');
    }

    // Attach screen ke request agar bisa diakses Controller
    request['screen'] = screen;
    return true;
  }
}
