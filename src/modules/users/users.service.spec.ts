import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../providers/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserPageOptionsDto } from './dto/user-page-options.dto';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcryptjs';

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}));

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  // Mock Prisma dengan typing yang aman
  const mockPrisma = {
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    property: {
      findUnique: jest.fn(),
    },
    wallet: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockUser: User = {
    id: 1,
    name: 'User 1',
    email: 'u1@test.com',
    role: Role.ADVERTISER,
    password: 'hashed_password',
    phone: null,
    isActive: true,
    passwordResetToken: null,
    passwordResetExpires: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    propertyId: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // --- PHASE 8.5 TESTS ---

  describe('createUser', () => {
    const createDto: CreateUserDto = {
      email: 'new@test.com',
      password: 'password',
      name: 'New User',
      role: Role.PROPERTY_OPERATOR,
      propertyId: 1,
    };

    it('should create user and wallet successfully', async () => {
      // Mock Dependencies
      mockPrisma.user.findUnique.mockResolvedValue(null); // Email not exist
      mockPrisma.property.findUnique.mockResolvedValue({ id: 1 }); // Property exist
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_pwd');

      // Mock Transaction
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        // Simulasi context transaction (menggunakan mockPrisma biasa di test ini)
        return callback(prisma);
      });
      mockPrisma.user.create.mockResolvedValue({ ...mockUser, id: 2 });
      mockPrisma.wallet.create.mockResolvedValue({ id: 1 });

      const result = await service.createUser(createDto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: createDto.email },
        select: { id: true },
      });
      expect(prisma.property.findUnique).toHaveBeenCalled();
      expect(prisma.user.create).toHaveBeenCalled();
      expect(prisma.wallet.create).toHaveBeenCalled();
      expect(result.id).toBe(2);
    });

    it('should throw ConflictException if email exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1 });
      await expect(service.createUser(createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException if property not found for operator', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.property.findUnique.mockResolvedValue(null); // Property Missing

      await expect(service.createUser(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('assignProperty', () => {
    it('should assign property to operator', async () => {
      const userId = 1;
      const dto = { propertyId: 10 };

      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        role: Role.PROPERTY_OPERATOR,
      });
      mockPrisma.property.findUnique.mockResolvedValue({ id: 10 });
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, propertyId: 10 });

      const result = await service.assignProperty(userId, dto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { propertyId: 10 },
      });
      expect(result.propertyId).toBe(10);
    });

    it('should throw BadRequest if user is not operator', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        role: Role.ADVERTISER,
      });
      await expect(
        service.assignProperty(1, { propertyId: 10 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // --- EXISTING TESTS (Phase 8) ---

  describe('findAll', () => {
    it('should return paginated users list', async () => {
      const usersData = [{ ...mockUser, _count: { media: 5, campaigns: 2 } }];

      // Mock Transaction Result [data, count]
      mockPrisma.$transaction.mockResolvedValue([usersData, 1]);

      const pageOptions = new UserPageOptionsDto();
      const result = await service.findAll(pageOptions);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.data[0].email).toEqual(usersData[0].email);
      expect(result.meta.itemCount).toBe(1);
    });

    it('should filter by search query', async () => {
      const pageOptions = new UserPageOptionsDto();
      Object.assign(pageOptions, { q: 'John' });

      mockPrisma.$transaction.mockResolvedValue([[], 0]);
      await service.findAll(pageOptions);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return user detail', async () => {
      const userDetail = {
        ...mockUser,
        wallet: {},
        property: null,
        _count: { media: 10, campaigns: 5 },
      };

      mockPrisma.user.findUnique.mockResolvedValue(userDetail);
      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result).toHaveProperty('password'); // Password exists in service layer
    });

    it('should throw NotFoundException if user missing', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('should update user profile successfully', async () => {
      const userId = 1;
      const dto: UpdateProfileDto = { name: 'New Name', phone: '08123456789' };

      mockPrisma.user.findUnique.mockResolvedValue({ id: userId });
      const updatedUser = { ...mockUser, name: dto.name, phone: dto.phone };
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateProfile(userId, dto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { name: dto.name, phone: dto.phone },
      });

      expect(result.name).toBe(dto.name);
      expect(result.phone).toBe(dto.phone);
    });

    it('should throw NotFoundException if user to update does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.updateProfile(999, { name: 'Ghost' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
