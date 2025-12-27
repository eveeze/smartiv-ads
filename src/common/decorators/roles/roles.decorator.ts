import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

// Key konstanta agar tidak hardcode string di berbagai tempat
export const ROLES_KEY = 'roles';

// Menerima argumen berupa Enum Role, bukan string biasa
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
