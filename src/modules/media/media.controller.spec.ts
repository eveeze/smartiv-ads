import { Test, TestingModule } from '@nestjs/testing';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { User, Role } from '@prisma/client';

// FIX: Mock UUID disini juga
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}));

// Mock Service agar file aslinya tidak diload (Double Safety)
const mockMediaService = {
  uploadMedia: jest.fn(),
  findAll: jest.fn(),
};

describe('MediaController', () => {
  let controller: MediaController;
  let service: MediaService;

  const mockUser: User = {
    id: 1,
    email: 'test@example.com',
    password: 'hash',
    name: 'Test',
    role: Role.ADVERTISER,
    phone: null,
    propertyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [{ provide: MediaService, useValue: mockMediaService }],
    }).compile();

    controller = module.get<MediaController>(MediaController);
    service = module.get<MediaService>(MediaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadFile', () => {
    it('should call service.uploadMedia', async () => {
      const file = {} as Express.Multer.File;
      await controller.uploadFile(file, mockUser);
      expect(service.uploadMedia).toHaveBeenCalledWith(file, mockUser);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll', async () => {
      await controller.findAll(mockUser);
      expect(service.findAll).toHaveBeenCalledWith(mockUser.id);
    });
  });
});
