import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../../decorators/roles/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Ambil Role yang dibutuhkan dari Handler (method) atau Class (controller)
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 2. Jika tidak ada decorator @Roles, berarti endpoint ini public (atau hanya butuh login)
    if (!requiredRoles) {
      return true;
    }

    // 3. Ambil user dari request (User ini sudah ditempel oleh JwtAuthGuard sebelumnya)
    const { user } = context.switchToHttp().getRequest();

    // 4. Cek apakah role user ada di daftar requiredRoles
    return requiredRoles.some((role) => user?.role === role);
  }
}
