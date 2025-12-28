import { Test, TestingModule } from '@nestjs/testing';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaType, User, Role } from '@prisma/client';

describe('MediaController', () => {
  let controller: MediaController;
  let service: MediaService;

  const mockUser: User = {
    id: 1,
    email: 'test@example.com',
    password: 'hash',
    name: 'Test',
    phone: null,
    role: Role.ADVERTISER,
    propertyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMediaService = {
    uploadMedia: jest.fn(),
    findAll: jest.fn(),
    getPendingMedia: jest.fn(), // [NEW] Mock method baru
    reviewMedia: jest.fn(), // [NEW] Mock method baru
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        {
          provide: MediaService,
          useValue: mockMediaService,
        },
      ],
    }).compile();

    controller = module.get<MediaController>(MediaController);
    service = module.get<MediaService>(MediaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadFile', () => {
    it('should call service.uploadMedia', async () => {
      const file = { originalname: 'test.jpg' } as any;
      await controller.uploadFile(file, mockUser);
      expect(service.uploadMedia).toHaveBeenCalledWith(file, mockUser);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll', async () => {
      await controller.findAll(mockUser);
      // FIX: Expect User Object, bukan User ID
      expect(service.findAll).toHaveBeenCalledWith(mockUser);
    });
  });
});
