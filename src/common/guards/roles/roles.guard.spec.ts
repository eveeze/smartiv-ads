import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should return true if no roles are required', () => {
    // Mock Reflector return null (tidak ada @Roles decorator)
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);

    const context = {
      getHandler: () => {},
      getClass: () => {},
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should return true if user has required role', () => {
    // Mock butuh Role.SUPER_ADMIN
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Role.SUPER_ADMIN]);

    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: Role.SUPER_ADMIN } }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should return false if user does not have required role', () => {
    // Mock butuh Role.SUPER_ADMIN
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Role.SUPER_ADMIN]);

    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: Role.ADVERTISER } }), // Role beda
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(false);
  });
});
