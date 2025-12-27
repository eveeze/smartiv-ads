import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AUTH_SERVICE } from './interfaces/auth-service/auth-service.interface';

describe('AuthController', () => {
  let controller: AuthController;

  // 1. Buat Mock Object sesuai interface IAuthService
  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      // 2. Sediakan Provider untuk AUTH_SERVICE
      providers: [
        {
          provide: AUTH_SERVICE,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // Tambahan test case sederhana untuk memastikan controller memanggil service
  it('should call authService.register', async () => {
    const dto = {
      email: 'test@test.com',
      password: '123',
      name: 'Test',
      phone: '123',
    };
    await controller.register(dto);
    expect(mockAuthService.register).toHaveBeenCalledWith(dto);
  });
});
