import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

// 1. MOCK MODULE BCRYPTJS DI SINI
jest.mock('bcryptjs');

// [FIX] Interface Helper untuk Mock Prisma

type MockFn = jest.Mock<any, any>;

interface MockPrismaService {
  user: {
    findUnique: MockFn;
    create: MockFn;
    update: MockFn;
  };
  wallet: {
    create: MockFn;
  };
  $transaction: MockFn;
}

interface MockJwtService {
  signAsync: MockFn;
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  // [FIX] Hapus jwtService jika tidak digunakan langsung di 'it' block, atau gunakan jika perlu

  // [FIX] Casting ke Interface agar aman di callback transaction
  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    wallet: {
      create: jest.fn(),
    },
    // [FIX] Implementasi transaction yang Type Safe
    $transaction: jest
      .fn()
      .mockImplementation((callback: (prisma: MockPrismaService) => unknown) =>
        callback(mockPrisma as unknown as MockPrismaService),
      ),
  } as unknown as MockPrismaService;

  const mockJwtService: MockJwtService = {
    signAsync: jest.fn(),
  };

  const mockMailService = {
    sendUserConfirmation: jest.fn(),
    sendForgotPassword: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    // jwtService = module.get<JwtService>(JwtService); // Uncomment jika ingin dipakai

    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      phone: '08123456789',
    };

    it('should register a new user successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const hashedPassword = 'hashed_password';
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      mockPrisma.user.create.mockResolvedValue({
        id: 1,
        ...registerDto,
        password: hashedPassword,
        role: 'ADVERTISER',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('id');
      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe(registerDto.email);
      // [FIX] Gunakan mockPrisma langsung untuk menghindari unbound method
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(mockPrisma.wallet.create).toHaveBeenCalledWith({
        data: { userId: 1, balance: 0 },
      });
    });

    it('should throw BadRequestException if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockUser = {
      id: 1,
      email: loginDto.email,
      password: 'hashed_password',
      name: 'Test User',
      role: 'ADVERTISER',
    };

    it('should return access token and user info if credentials are valid', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signAsync.mockResolvedValue('mock_token');

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken', 'mock_token');
      expect(result.user.email).toBe(loginDto.email);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password invalid', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
