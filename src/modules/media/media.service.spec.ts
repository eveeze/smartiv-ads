import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from './media.service';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { StorageService } from '../../providers/storage/storage.service';
import { QueueService } from '../../providers/queue/queue.service';
import { BadRequestException } from '@nestjs/common';
import { MediaType, User, Role } from '@prisma/client';

// Mock fs.createReadStream karena digunakan di service
jest.mock('fs', () => {
  const originalFs = jest.requireActual('fs');
  return {
    ...originalFs,
    createReadStream: jest.fn().mockReturnValue('mock-stream'),
  };
});

describe('MediaService', () => {
  let service: MediaService;
  let prisma: PrismaService;
  let storage: StorageService;
  let queue: QueueService;

  const mockUser: User = {
    id: 1,
    email: 'test@example.com',
    password: 'hash',
    name: 'Test User',
    role: Role.ADVERTISER,
    phone: null,
    propertyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockFile = {
    originalname: 'test.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    path: '/tmp/test.jpg',
  } as Express.Multer.File;

  const mockPrisma = {
    media: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    campaign: { count: jest.fn() },
  };

  // [FIX] Tambahkan .mockResolvedValue(undefined) agar return Promise
  const mockStorage = {
    uploadFile: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  const mockQueue = { addTranscodeJob: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
        { provide: QueueService, useValue: mockQueue },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
    prisma = module.get<PrismaService>(PrismaService);
    storage = module.get<StorageService>(StorageService);
    queue = module.get<QueueService>(QueueService);

    jest.clearAllMocks();
  });

  describe('upload', () => {
    it('should upload image successfully', async () => {
      mockStorage.uploadFile.mockResolvedValue('http://minio/image.jpg');
      mockPrisma.media.create.mockResolvedValue({
        id: 1,
        type: MediaType.IMAGE,
      });

      await service.upload(mockFile, mockUser);

      expect(storage.uploadFile).toHaveBeenCalledWith(
        expect.any(String),
        'mock-stream',
        expect.any(String),
      );
      expect(prisma.media.create).toHaveBeenCalled();
      expect(queue.addTranscodeJob).not.toHaveBeenCalled();
    });

    it('should upload video and trigger transcode', async () => {
      const videoFile = { ...mockFile, mimetype: 'video/mp4' };
      mockStorage.uploadFile.mockResolvedValue('http://minio/video.mp4');
      mockPrisma.media.create.mockResolvedValue({
        id: 2,
        type: MediaType.VIDEO,
      });

      await service.upload(videoFile, mockUser);

      expect(queue.addTranscodeJob).toHaveBeenCalledWith(2);
    });

    it('should throw error for unsupported file type', async () => {
      const invalidFile = { ...mockFile, mimetype: 'application/pdf' }; // PDF not allowed

      await expect(service.upload(invalidFile, mockUser)).rejects.toThrow(
        BadRequestException,
      );

      expect(storage.uploadFile).not.toHaveBeenCalled();
      expect(prisma.media.create).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    const mediaId = 1;
    const media = {
      id: mediaId,
      uploaderId: mockUser.id,
      filename: 'raw/test.jpg',
    };

    it('should delete unused media', async () => {
      mockPrisma.media.findUnique.mockResolvedValue(media);
      mockPrisma.campaign.count.mockResolvedValue(0); // Not used

      await service.remove(mediaId, mockUser);

      expect(storage.delete).toHaveBeenCalledWith('raw/test.jpg');
      expect(prisma.media.delete).toHaveBeenCalledWith({
        where: { id: mediaId },
      });
    });

    it('should throw Error if media is used in active campaign', async () => {
      mockPrisma.media.findUnique.mockResolvedValue(media);
      mockPrisma.campaign.count.mockResolvedValue(1); // Used!

      await expect(service.remove(mediaId, mockUser)).rejects.toThrow(
        BadRequestException,
      );
      // Storage delete tidak boleh dipanggil jika validasi gagal
      expect(storage.delete).not.toHaveBeenCalled();
    });
  });
});
