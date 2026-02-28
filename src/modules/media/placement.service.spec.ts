import { Test, TestingModule } from '@nestjs/testing';
import { PlacementService } from './placement.service';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { StorageService } from '../../providers/storage/storage.service';
import { MediaType } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';

jest.mock('../../common/utils/media.utils', () => ({
  MediaUtils: {
    getMediaDimensions: jest.fn(),
  },
}));

import { MediaUtils } from '../../common/utils/media.utils';

// Mock fs to prevent actual file system operations in tests
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  mkdtempSync: jest.fn().mockReturnValue('/tmp/mock-dir'),
  existsSync: jest.fn().mockReturnValue(true),
  rmSync: jest.fn(),
}));

describe('PlacementService', () => {
  let service: PlacementService;
  let prisma: PrismaService;
  let storageService: StorageService;

  const mockPlacements = [
    {
      id: 1,
      code: 'FULLSCREEN',
      name: 'Full Screen',
      width: 1920,
      height: 1080,
      aspectRatio: '16:9',
      allowedMediaTypes: [MediaType.VIDEO, MediaType.IMAGE],
    },
    {
      id: 2,
      code: 'BANNER_BOTTOM',
      name: 'Bottom Banner',
      width: 1920,
      height: 200,
      aspectRatio: '9.6:1',
      allowedMediaTypes: [MediaType.IMAGE],
    },
  ];

  const mockPrisma = {
    adPlacement: {
      findMany: jest.fn().mockResolvedValue(mockPlacements),
      findUnique: jest.fn(),
    },
    media: {
      findUnique: jest.fn(),
    },
  };

  const mockStorageService = {
    downloadToLocal: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlacementService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<PlacementService>(PlacementService);
    prisma = module.get<PrismaService>(PrismaService);
    storageService = module.get<StorageService>(StorageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should initialize cache with placements from database', async () => {
      await service.onModuleInit();
      expect(prisma.adPlacement.findMany).toHaveBeenCalled();

      const fullscreen = await service.getPlacement(1);
      expect(fullscreen.name).toBe('Full Screen');
    });
  });

  describe('getPlacement', () => {
    beforeEach(async () => {
      await service.onModuleInit(); // preload cache
    });

    it('should return a placement if exists', async () => {
      const placement = await service.getPlacement(2);
      expect(placement.width).toBe(1920);
    });

    it('should throw BadRequestException if placement does not exist', async () => {
      mockPrisma.adPlacement.findUnique.mockResolvedValueOnce(null);
      await expect(service.getPlacement(999)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateMediaCompatibility', () => {
    beforeEach(async () => {
      await service.onModuleInit(); // preload cache
    });

    it('should pass for compatible video in FULLSCREEN', async () => {
      mockPrisma.media.findUnique.mockResolvedValueOnce({
        id: 10,
        type: MediaType.VIDEO,
        url: 'http://test/vid.mp4',
        originalName: 'vid.mp4',
      });

      (MediaUtils.getMediaDimensions as jest.Mock).mockResolvedValue({
        width: 1920,
        height: 1080,
      });

      const result = await service.validateMediaCompatibility(10, 1);
      expect(result.valid).toBe(true);
      expect(storageService.downloadToLocal).toHaveBeenCalled();
    });

    it('should throw BadRequestException if media type not allowed (Video in Banner)', async () => {
      mockPrisma.media.findUnique.mockResolvedValueOnce({
        id: 11,
        type: MediaType.VIDEO, // BANNER_BOTTOM only allows IMAGE
        url: 'http://test/vid.mp4',
        originalName: 'vid.mp4',
      });

      await expect(service.validateMediaCompatibility(11, 2)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for invalid dimensions', async () => {
      mockPrisma.media.findUnique.mockResolvedValueOnce({
        id: 12,
        type: MediaType.IMAGE,
        url: 'http://test/img.jpg',
        originalName: 'img.jpg',
      });

      (MediaUtils.getMediaDimensions as jest.Mock).mockResolvedValue({
        width: 1080,
        height: 1920,
      });

      await expect(
        service.validateMediaCompatibility(12, 1), // FULLSCREEN
      ).rejects.toThrow(BadRequestException);
    });
  });
});
