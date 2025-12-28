import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from './media.service';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { StorageService } from '../../providers/storage/storage.service';
import { QueueService } from '../../providers/queue/queue.service';
import { BadRequestException } from '@nestjs/common';
import { MediaType, User, Role } from '@prisma/client';

// Mock UUID untuk menghindari error ESM di Jest
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123'),
}));

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
    buffer: Buffer.from('fake-image'),
  } as Express.Multer.File;

  const mockPrisma = {
    media: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockStorage = {
    uploadFile: jest.fn(),
  };

  const mockQueue = {
    addTranscodeJob: jest.fn(),
  };

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

  describe('uploadMedia', () => {
    it('should upload image successfully (no transcoding queue)', async () => {
      mockStorage.uploadFile.mockResolvedValue('http://minio/bucket/image.jpg');
      mockPrisma.media.create.mockResolvedValue({
        id: 1,
        type: MediaType.IMAGE,
        isTranscoded: true,
      });

      const result = await service.uploadMedia(mockFile, mockUser);

      expect(storage.uploadFile).toHaveBeenCalled();

      // FIX: Tambahkan wrapper 'data' di dalam expect
      expect(prisma.media.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: MediaType.IMAGE,
            isTranscoded: true,
          }),
        }),
      );

      expect(queue.addTranscodeJob).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should upload video and add to transcoding queue', async () => {
      const videoFile = {
        ...mockFile,
        originalname: 'vid.mp4',
        mimetype: 'video/mp4',
      };

      mockStorage.uploadFile.mockResolvedValue('http://minio/bucket/vid.mp4');
      mockPrisma.media.create.mockResolvedValue({
        id: 2,
        type: MediaType.VIDEO,
        isTranscoded: false,
      });

      await service.uploadMedia(videoFile, mockUser);

      // FIX: Tambahkan wrapper 'data' di dalam expect
      expect(prisma.media.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: MediaType.VIDEO,
            isTranscoded: false,
          }),
        }),
      );

      expect(queue.addTranscodeJob).toHaveBeenCalledWith(2);
    });

    it('should throw error for unsupported file type', async () => {
      const invalidFile = { ...mockFile, mimetype: 'application/pdf' };

      await expect(service.uploadMedia(invalidFile, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return user media list', async () => {
      mockPrisma.media.findMany.mockResolvedValue([]);
      await service.findAll(1);
      expect(prisma.media.findMany).toHaveBeenCalledWith({
        where: { uploaderId: 1 },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
