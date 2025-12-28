import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { PageOptionsDto } from '../../common/dto/page-options.dto';
import { Role } from '@prisma/client';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  // Mock Prisma dengan typing yang aman
  const mockPrisma = {
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
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
      const mockUsers = [
        {
          id: 1,
          name: 'User 1',
          email: 'u1@test.com',
          role: Role.ADVERTISER,
          _count: { media: 5 },
        },
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);
      mockPrisma.user.count.mockResolvedValue(1);

      const pageOptions = new PageOptionsDto();
      const result = await service.findAll(pageOptions);

      expect(result.data).toEqual(mockUsers);
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
      // Bypass readonly property untuk simulasi input query
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
      const mockUser = {
        id: 1,
        name: 'Detail User',
        email: 'detail@test.com',
        password: 'hashed_password', // Harus dihapus oleh service
        _count: { media: 10 },
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result).not.toHaveProperty('password');
      expect(result).toHaveProperty('_count');
    });

    it('should throw NotFoundException if user missing', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });
});
