import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { PageOptionsDto } from '../../common/dto/page-options.dto';
import { Role, User } from '@prisma/client';
import { UpdateProfileDto } from './dto/update-profile.dto';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  // Mock Prisma dengan typing yang aman
  const mockPrisma = {
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockUser: User = {
    id: 1,
    name: 'User 1',
    email: 'u1@test.com',
    role: Role.ADVERTISER,
    password: 'hashed_password',
    phone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    propertyId: null, // [FIX] Ditambahkan agar sesuai tipe User Prisma
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

  describe('findAll', () => {
    it('should return paginated users list', async () => {
      const usersData = [{ ...mockUser, _count: { media: 5 } }];

      mockPrisma.user.findMany.mockResolvedValue(usersData);
      mockPrisma.user.count.mockResolvedValue(1);

      const pageOptions = new PageOptionsDto();
      const result = await service.findAll(pageOptions);

      expect(result.data).toEqual(usersData);
      expect(result.meta.itemCount).toBe(1);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        }),
      );
    });

    it('should filter by search query', async () => {
      const pageOptions = new PageOptionsDto();
      // Menggunakan Object.assign untuk bypass readonly property di test environment
      Object.assign(pageOptions, { search: 'John' });

      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await service.findAll(pageOptions);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'John', mode: 'insensitive' } },
              { email: { contains: 'John', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return user detail without password', async () => {
      const userDetail = { ...mockUser, _count: { media: 10 } };

      mockPrisma.user.findUnique.mockResolvedValue(userDetail);

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result).not.toHaveProperty('password'); // Password harus dihapus
      expect(result).toHaveProperty('_count');
    });

    it('should throw NotFoundException if user missing', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  // [NEW TEST] Update Profile
  describe('updateProfile', () => {
    it('should update user profile successfully', async () => {
      const userId = 1;
      const dto: UpdateProfileDto = { name: 'New Name', phone: '08123456789' };

      // Mock findUnique (Existence Check)
      mockPrisma.user.findUnique.mockResolvedValue({ id: userId });

      // Mock update return value
      const updatedUser = { ...mockUser, name: dto.name, phone: dto.phone };
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateProfile(userId, dto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { id: true },
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { name: dto.name, phone: dto.phone },
        select: expect.any(Object),
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
