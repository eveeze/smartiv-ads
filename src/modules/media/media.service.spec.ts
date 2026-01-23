import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from './media.service';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { StorageService } from '../../providers/storage/storage.service';
import { QueueService } from '../../providers/queue/queue.service';
import { BadRequestException } from '@nestjs/common';
import { MediaType, User, Role } from '@prisma/client';

// ==========================================
// 1. DEFINISI TYPE-SAFE MOCK INTERFACES
// ==========================================

type MockFn = jest.Mock<any, any>;

interface MockPrismaService {
  media: {
    create: MockFn;
    findMany: MockFn;
    findUnique: MockFn;
    delete: MockFn;
    update: MockFn;
  };
  campaign: { count: MockFn };
}

interface MockStorageService {
  uploadFile: MockFn;
  delete: MockFn;
}

interface MockQueueService {
  addTranscodeJob: MockFn;
}

// ==========================================
// 2. MOCK IMPLEMENTATIONS
// ==========================================

// Mock fs.createReadStream
jest.mock('fs', () => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const originalFs = jest.requireActual('fs');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return {
    ...originalFs,
    createReadStream: jest.fn().mockReturnValue('mock-stream'),
  };
});

describe('MediaService', () => {
  let service: MediaService;

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
    isActive: true, // [FIX] Added missing field
    passwordResetToken: null, // [FIX] Added missing field
    passwordResetExpires: null, // [FIX] Added missing field
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
  } as unknown as MockPrismaService;

  const mockStorage = {
    uploadFile: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  } as unknown as MockStorageService;

  const mockQueue = {
    addTranscodeJob: jest.fn(),
  } as unknown as MockQueueService;

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

      // [FIX] Gunakan mockStorage langsung agar tidak kena error unbound method
      expect(mockStorage.uploadFile).toHaveBeenCalledWith(
        expect.any(String),
        'mock-stream',
        expect.any(String),
      );
      expect(mockPrisma.media.create).toHaveBeenCalled();
      expect(mockQueue.addTranscodeJob).not.toHaveBeenCalled();
    });

    it('should upload video and trigger transcode', async () => {
      const videoFile = { ...mockFile, mimetype: 'video/mp4' };
      mockStorage.uploadFile.mockResolvedValue('http://minio/video.mp4');
      mockPrisma.media.create.mockResolvedValue({
        id: 2,
        type: MediaType.VIDEO,
      });

      await service.upload(videoFile, mockUser);

      expect(mockQueue.addTranscodeJob).toHaveBeenCalledWith(2);
    });

    it('should throw error for unsupported file type', async () => {
      const invalidFile = { ...mockFile, mimetype: 'application/pdf' }; // PDF not allowed

      await expect(service.upload(invalidFile, mockUser)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockStorage.uploadFile).not.toHaveBeenCalled();
      expect(mockPrisma.media.create).not.toHaveBeenCalled();
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

      expect(mockStorage.delete).toHaveBeenCalledWith('raw/test.jpg');
      expect(mockPrisma.media.delete).toHaveBeenCalledWith({
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
      expect(mockStorage.delete).not.toHaveBeenCalled();
    });
  });
});
