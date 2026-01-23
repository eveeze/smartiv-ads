import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PageOptionsDto } from '../../common/dto/page-options.dto';
import { PageDto } from '../../common/dto/page.dto';
import { PageMetaDto } from '../../common/dto/page-meta.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User, Role } from '@prisma/client';
import { UserResponseDto } from './dto/user-response.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { AssignPropertyDto } from './dto/assign-property.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUsersService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    updateProfile: jest.fn(),
    createUser: jest.fn(),
    assignProperty: jest.fn(),
  };

  const mockUser: User = {
    id: 1,
    name: 'User 1',
    email: 'user@test.com',
    role: Role.ADVERTISER,
    phone: null,
    password: 'hash',
    isActive: true,
    passwordResetToken: null,
    passwordResetExpires: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    propertyId: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  // --- PHASE 8.5 TESTS ---

  describe('create', () => {
    it('should create new user', async () => {
      const dto: CreateUserDto = {
        email: 'test@mail.com',
        password: 'pass',
        name: 'Test',
        role: Role.ADVERTISER,
      };
      mockUsersService.createUser.mockResolvedValue({ ...mockUser, ...dto });

      const result = await controller.create(dto);
      // [FIX] Gunakan mockUsersService langsung untuk menghindari error unbound method
      expect(mockUsersService.createUser).toHaveBeenCalledWith(dto);
      expect(result).toBeInstanceOf(UserResponseDto);
    });
  });

  describe('assignProperty', () => {
    it('should assign property', async () => {
      const dto: AssignPropertyDto = { propertyId: 10 };
      mockUsersService.assignProperty.mockResolvedValue({
        ...mockUser,
        propertyId: 10,
      });

      const result = await controller.assignProperty(1, dto);
      expect(mockUsersService.assignProperty).toHaveBeenCalledWith(1, dto);
      expect(result.propertyId).toBe(10);
    });
  });

  // --- EXISTING TESTS ---

  describe('findAll', () => {
    it('should return page dto', async () => {
      const mockResult = new PageDto(
        [],
        new PageMetaDto({ itemCount: 0, pageOptionsDto: new PageOptionsDto() }),
      );

      mockUsersService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(new PageOptionsDto());
      expect(result).toBe(mockResult);
      expect(mockUsersService.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return user detail', async () => {
      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await controller.findOne(1);
      expect(result).toBeInstanceOf(UserResponseDto);
      expect(mockUsersService.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe('updateProfile', () => {
    it('should call service.updateProfile', async () => {
      const dto: UpdateProfileDto = { name: 'Updated Name' };
      const expectedResult = { ...mockUser, ...dto };

      mockUsersService.updateProfile.mockResolvedValue(expectedResult);

      const result = await controller.updateProfile(mockUser, dto);

      expect(mockUsersService.updateProfile).toHaveBeenCalledWith(
        mockUser.id,
        dto,
      );
      expect(result.name).toBe('Updated Name');
    });
  });
});
