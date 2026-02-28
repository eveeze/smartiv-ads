import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from './media.service';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { StorageService } from '../../providers/storage/storage.service';
import { QueueService } from '../../providers/queue/queue.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, MediaType, User, Role } from '@prisma/client';

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
  mediaTag: { findMany: MockFn };
  campaign: { count: MockFn };
}

interface MockStorageService {
  uploadFile: MockFn;
  delete: MockFn;
  getPresignedUrl: MockFn;
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
    mediaTag: { findMany: jest.fn() },
    campaign: { count: jest.fn() },
  } as unknown as MockPrismaService;

  const mockStorage = {
    uploadFile: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
    getPresignedUrl: jest.fn().mockResolvedValue('https://signed-url.com/file'),
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

  // --- FIND ALL ---
  describe('findAll', () => {
    it('should return all media for ADVERTISER (filtered by uploaderId)', async () => {
      mockPrisma.media.findMany.mockResolvedValue([
        {
          id: 1,
          uploaderId: 1,
          filename: 'f.jpg',
          type: 'IMAGE',
          isTranscoded: false,
          url: 'http://test/f.jpg',
        },
      ]);

      const result = await service.findAll(mockUser);
      expect(result).toHaveLength(1);
      expect(mockPrisma.media.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ uploaderId: mockUser.id }),
        }),
      );
    });

    it('should filter by tag search when provided', async () => {
      mockPrisma.media.findMany.mockResolvedValue([]);

      await service.findAll(mockUser, 'promo');
      expect(mockPrisma.media.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            uploaderId: mockUser.id,
            tags: {
              some: { name: { contains: 'promo', mode: 'insensitive' } },
            },
          }),
        }),
      );
    });

    it('should return all media for SUPER_ADMIN (no uploaderId filter)', async () => {
      const adminUser = { ...mockUser, role: Role.SUPER_ADMIN };
      mockPrisma.media.findMany.mockResolvedValue([]);

      await service.findAll(adminUser);
      expect(mockPrisma.media.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ uploaderId: expect.anything() }),
        }),
      );
    });
  });

  // --- FIND PENDING ---
  describe('findPending', () => {
    it('should return pending approval media', async () => {
      mockPrisma.media.findMany.mockResolvedValue([
        {
          id: 1,
          status: ApprovalStatus.PENDING,
          filename: 'f.jpg',
          type: 'IMAGE',
          isTranscoded: false,
          url: 'http://test/f.jpg',
        },
      ]);

      const result = await service.findPending();
      expect(result).toHaveLength(1);
      expect(mockPrisma.media.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: ApprovalStatus.PENDING },
        }),
      );
    });
  });

  // --- FIND ONE ---
  describe('findOne', () => {
    it('should return media when found and owned by user', async () => {
      mockPrisma.media.findUnique.mockResolvedValue({
        id: 1,
        uploaderId: 1,
        filename: 'f.jpg',
        type: 'IMAGE',
        isTranscoded: false,
        url: 'http://test/f.jpg',
      });
      const result = await service.findOne(1, mockUser);
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when media not found', async () => {
      mockPrisma.media.findUnique.mockResolvedValue(null);
      await expect(service.findOne(999, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if ADVERTISER does not own media', async () => {
      mockPrisma.media.findUnique.mockResolvedValue({
        id: 1,
        uploaderId: 999,
        filename: 'f.jpg',
        type: 'IMAGE',
        isTranscoded: false,
        url: 'http://test/f.jpg',
      });
      await expect(service.findOne(1, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // --- REVIEW ---
  describe('review', () => {
    it('should approve media', async () => {
      mockPrisma.media.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.media.update.mockResolvedValue({
        id: 1,
        status: ApprovalStatus.APPROVED,
      });

      const result = await service.review(
        1,
        { status: ApprovalStatus.APPROVED },
        100,
      );
      expect(result.status).toBe(ApprovalStatus.APPROVED);
      expect(mockPrisma.media.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ApprovalStatus.APPROVED,
            reviewedBy: 100,
          }),
        }),
      );
    });

    it('should reject media with reason', async () => {
      mockPrisma.media.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.media.update.mockResolvedValue({
        id: 1,
        status: ApprovalStatus.REJECTED,
      });

      const result = await service.review(
        1,
        { status: ApprovalStatus.REJECTED, rejectionReason: 'Low quality' },
        100,
      );
      expect(result.status).toBe(ApprovalStatus.REJECTED);
    });

    it('should throw NotFoundException if media not found', async () => {
      mockPrisma.media.findUnique.mockResolvedValue(null);
      await expect(
        service.review(999, { status: ApprovalStatus.APPROVED }, 100),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // --- UPDATE ---
  describe('update', () => {
    it('should update media owned by user', async () => {
      mockPrisma.media.findUnique.mockResolvedValue({
        id: 1,
        uploaderId: mockUser.id,
      });
      mockPrisma.media.update.mockResolvedValue({
        id: 1,
        title: 'Updated Title',
      });

      const result = await service.update(
        1,
        { title: 'Updated Title' },
        mockUser,
      );
      expect(result.title).toBe('Updated Title');
    });

    it('should throw NotFoundException if media not found', async () => {
      mockPrisma.media.findUnique.mockResolvedValue(null);
      await expect(
        service.update(999, { title: 'X' }, mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user does not own media', async () => {
      mockPrisma.media.findUnique.mockResolvedValue({ id: 1, uploaderId: 999 });
      await expect(service.update(1, { title: 'X' }, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // --- REMOVE ADDITIONAL EDGE CASES ---
  describe('remove - additional edge cases', () => {
    it('should throw NotFoundException if media not found', async () => {
      mockPrisma.media.findUnique.mockResolvedValue(null);
      await expect(service.remove(999, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if user does not own media', async () => {
      mockPrisma.media.findUnique.mockResolvedValue({
        id: 1,
        uploaderId: 999,
        filename: 'f.jpg',
      });
      await expect(service.remove(1, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should still delete media even if storage delete fails', async () => {
      const media = {
        id: 1,
        uploaderId: mockUser.id,
        filename: 'raw/test.jpg',
      };
      mockPrisma.media.findUnique.mockResolvedValue(media);
      mockPrisma.campaign.count.mockResolvedValue(0);
      mockStorage.delete.mockRejectedValue(new Error('S3 Error'));
      mockPrisma.media.delete.mockResolvedValue(media);

      const result = await service.remove(1, mockUser);
      expect(result).toBeDefined();
      expect(mockPrisma.media.delete).toHaveBeenCalled();
    });
  });

  // --- FIND ALL TAGS ---
  describe('findAllTags', () => {
    it('should return all tags ordered alphabetically', async () => {
      mockPrisma.mediaTag.findMany.mockResolvedValue([
        { id: 1, name: 'food' },
        { id: 2, name: 'promo' },
      ]);

      const result = await service.findAllTags();
      expect(result).toHaveLength(2);
      expect(mockPrisma.mediaTag.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      });
    });
  });
});
