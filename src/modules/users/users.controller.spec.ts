import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PageOptionsDto } from '../../common/dto/page-options.dto';
import { PageDto } from '../../common/dto/page.dto';
import { PageMetaDto } from '../../common/dto/page-meta.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User, Role } from '@prisma/client';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  // Mock Service tanpa 'any'
  const mockUsersService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    updateProfile: jest.fn(),
  };

  const mockUser: User = {
    id: 1,
    name: 'User 1',
    email: 'user@test.com',
    role: Role.ADVERTISER,
    phone: null,
    password: 'hash',
    createdAt: new Date(),
    updatedAt: new Date(),
    propertyId: null, // [FIX] Ditambahkan agar sesuai tipe User Prisma
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  describe('findAll', () => {
    it('should return page dto', async () => {
      const mockResult = new PageDto(
        [],
        new PageMetaDto({ itemCount: 0, pageOptionsDto: new PageOptionsDto() }),
      );

      mockUsersService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(new PageOptionsDto());
      expect(result).toBe(mockResult);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return user detail', async () => {
      // Mock return tanpa password (SafeUser)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...safeUser } = mockUser;

      mockUsersService.findOne.mockResolvedValue(safeUser);

      const result = await controller.findOne(1);
      expect(result).toEqual(safeUser);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });
  });

  // [NEW TEST]
  describe('updateProfile', () => {
    it('should call service.updateProfile', async () => {
      const dto: UpdateProfileDto = { name: 'Updated Name' };
      const expectedResult = { ...mockUser, ...dto };

      mockUsersService.updateProfile.mockResolvedValue(expectedResult);

      const result = await controller.updateProfile(mockUser, dto);

      expect(service.updateProfile).toHaveBeenCalledWith(mockUser.id, dto);
      expect(result.name).toBe('Updated Name');
    });
  });
});
