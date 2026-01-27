import { Test, TestingModule } from '@nestjs/testing';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { User, Role } from '@prisma/client';
import { UploadMediaDto } from './dto/upload-media.dto';

describe('MediaController', () => {
  let controller: MediaController;
  // let service: MediaService;

  const mockUser: User = {
    id: 1,
    role: Role.ADVERTISER,
  } as unknown as User;

  const mockMediaService = {
    upload: jest.fn(), // [FIX] Nama method harus 'upload', bukan 'uploadMedia'
    findAll: jest.fn(),
    findPending: jest.fn(),
    findOne: jest.fn(),
    review: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [{ provide: MediaService, useValue: mockMediaService }],
    }).compile();

    controller = module.get<MediaController>(MediaController);
    // service = module.get<MediaService>(MediaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadFile', () => {
    it('should call service.upload', async () => {
      const file = { originalname: 'test.jpg' } as Express.Multer.File;
      const dto = new UploadMediaDto();

      // [FIX] Panggil dengan 3 argumen: file, dto, user
      await controller.uploadFile(file, dto, mockUser);

      expect(mockMediaService.upload).toHaveBeenCalledWith(file, mockUser);
    });
  });
});
