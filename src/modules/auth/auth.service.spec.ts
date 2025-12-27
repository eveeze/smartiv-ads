import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

// 1. MOCK MODULE BCRYPTJS DI SINI
jest.mock('bcryptjs');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    wallet: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);

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

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(prisma);
      });

      const hashedPassword = 'hashed_password';
      // 2. GUNAKAN IMPLEMENTASI MOCK LANGSUNG
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
      expect(prisma.user.create).toHaveBeenCalled();
      expect(prisma.wallet.create).toHaveBeenCalledWith({
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
      // 3. GUNAKAN IMPLEMENTASI MOCK COMPARE
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
      // 4. GUNAKAN IMPLEMENTASI MOCK COMPARE FALSE
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
