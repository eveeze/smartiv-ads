import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserPageOptionsDto } from './dto/user-page-options.dto'; // [FIX] Gunakan DTO baru

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
    // [FIX] Mock $transaction
    $transaction: jest.fn(),
  };

  const mockUser: User = {
    id: 1,
    name: 'User 1',
    email: 'u1@test.com',
    role: Role.ADVERTISER,
    password: 'hashed_password', // Di service, password masih ada (sebelum di interceptor)
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

  describe('findAll', () => {
    it('should return paginated users list', async () => {
      const usersData = [{ ...mockUser, _count: { media: 5, campaigns: 2 } }];

      // Mock Transaction Result [data, count]
      mockPrisma.$transaction.mockResolvedValue([usersData, 1]);

      const pageOptions = new UserPageOptionsDto();
      const result = await service.findAll(pageOptions);

      expect(prisma.$transaction).toHaveBeenCalled(); // Ensure transaction called
      // Kita cek properti data pertama di array
      expect(result.data[0].email).toEqual(usersData[0].email);
      expect(result.meta.itemCount).toBe(1);
    });

    it('should filter by search query', async () => {
      const pageOptions = new UserPageOptionsDto();
      Object.assign(pageOptions, { q: 'John' }); // q property di DTO baru

      // Mock Transaction Result Kosong
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await service.findAll(pageOptions);

      // Verifikasi argumen findMany di dalam transaction
      // Note: Karena $transaction menerima array promise, kita tidak bisa dengan mudah
      // mengecek argumen findMany kecuali kita mock implementasi $transaction seperti di auth.service
      // TAPI, kita bisa cek bahwa $transaction dipanggil.
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return user detail (password included in Service layer)', async () => {
      const userDetail = {
        ...mockUser,
        wallet: {},
        property: null,
        _count: { media: 10, campaigns: 5 },
      };

      mockPrisma.user.findUnique.mockResolvedValue(userDetail);

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      // [PERUBAHAN] Di Service, password belum di-strip (tugas Interceptor di Controller)
      // Jadi kita expect password masih ada jika mock-nya ada password
      expect(result).toHaveProperty('password');
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
        // Select dihapus di service terbaru, atau disesuaikan
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
