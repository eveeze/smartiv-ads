import { Test, TestingModule } from '@nestjs/testing';
import { PlayerService } from './player.service';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import {
  CampaignStatus,
  ScreenStatus,
  AdSlot,
  MediaType,
  Screen,
  Prisma,
} from '@prisma/client';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { PlaylistResponseDto } from './dto/playlist.dto';

// ==========================================
// 1. STRICT TYPE-SAFE MOCK DEFINITIONS
// ==========================================

interface MockPrismaService {
  screen: {
    findUnique: jest.Mock<
      Promise<Screen | null>,
      [Prisma.ScreenFindUniqueArgs]
    >;
    update: jest.Mock<Promise<Screen>, [Prisma.ScreenUpdateArgs]>;
  };
  campaign: {
    findMany: jest.Mock<Promise<unknown[]>, [Prisma.CampaignFindManyArgs]>;
  };
}

// ==========================================
// 2. MOCK DATA
// ==========================================
const mockScreenId = 1;

// Mock Data casting is necessary here because we are simulating a DB result with relations
const mockScreen = {
  id: mockScreenId,
  name: 'Lobby TV',
  orientation: 'LANDSCAPE',
  status: ScreenStatus.ONLINE,
  propertyId: 100,
  resolution: '1920x1080',
  ipAddress: null,
  lastPing: null,
  code: 'SCR-001',
  roomCategory: 'LOBBY',
  createdAt: new Date(),
  updatedAt: new Date(),
  priceOverride: null,
  property: {
    name: 'Grand Hotel',
    logoUrl: 'logo.png',
    address: 'Jl. Sudirman',
    city: 'Jakarta',
  },
} as unknown as Screen;

const mockCampaigns = [
  {
    id: 101,
    name: 'Campaign A',
    items: [
      {
        media: {
          id: 50,
          url: 'video.mp4',
          type: MediaType.VIDEO,
        },
        durationSec: 30,
        targetSlot: AdSlot.SCREENSAVER,
      },
    ],
  },
];

// ==========================================
// 3. INIT DEPENDENCIES & MOCK IMPL
// ==========================================

// [FIX] Initialize mocks with explicit Generics to avoid 'any' return type
const mockPrisma: MockPrismaService = {
  screen: {
    findUnique: jest.fn<
      Promise<Screen | null>,
      [Prisma.ScreenFindUniqueArgs]
    >(),
    update: jest.fn<Promise<Screen>, [Prisma.ScreenUpdateArgs]>(),
  },
  campaign: {
    findMany: jest.fn<Promise<unknown[]>, [Prisma.CampaignFindManyArgs]>(),
  },
};

describe('PlayerService', () => {
  let service: PlayerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlayerService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PlayerService>(PlayerService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ===================================
  // TEST: getConfig
  // ===================================
  describe('getConfig', () => {
    it('should return complete config when screen exists', async () => {
      mockPrisma.screen.findUnique.mockResolvedValue(mockScreen);

      const result = await service.getConfig(mockScreenId);

      expect(mockPrisma.screen.findUnique).toHaveBeenCalledWith({
        where: { id: mockScreenId },
        // [FIX] Casting 'expect.any' to the specific Prisma type to satisfy linter
        select: expect.any(Object) as Prisma.ScreenSelect,
      });

      // Assertions on the result

      expect(result.screenName).toBe(mockScreen.name);

      expect(result.propertyName).toBe(
        (
          mockScreen as unknown as {
            property: { name: string };
          }
        ).property.name,
      );

      expect(result.propertyAddress).toContain('Jakarta');

      expect(result.refreshInterval).toBeDefined();
    });

    it('should throw NotFoundException if screen does not exist', async () => {
      mockPrisma.screen.findUnique.mockResolvedValue(null);

      await expect(service.getConfig(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ===================================
  // TEST: generatePlaylist
  // ===================================
  describe('generatePlaylist', () => {
    it('should return mapped playlist items', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue(mockCampaigns);

      const result: PlaylistResponseDto =
        await service.generatePlaylist(mockScreenId);

      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith(
        // [FIX] Casting the matcher to Prisma Arguments type
        expect.objectContaining({
          where: expect.objectContaining({
            status: CampaignStatus.ACTIVE,
            screens: { some: { id: mockScreenId } },
          }) as Prisma.CampaignWhereInput,
        }) as Prisma.CampaignFindManyArgs,
      );

      // Verify Result Structure
      expect(result.totalItems).toBe(1);
      const item = result.items[0];
      expect(item.campaignId).toBe(101);
      expect(item.type).toBe(MediaType.VIDEO);
      expect(item.duration).toBe(30);
      expect(item.slot).toBe(AdSlot.SCREENSAVER);
      expect(typeof item.url).toBe('string');
    });

    it('should return empty playlist if no active campaigns found', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue([]);

      const result: PlaylistResponseDto =
        await service.generatePlaylist(mockScreenId);

      expect(result.totalItems).toBe(0);
      expect(result.items).toEqual([]);
    });
  });

  // ===================================
  // TEST: recordHeartbeat
  // ===================================
  describe('recordHeartbeat', () => {
    it('should update screen status and timestamp', async () => {
      const dto: HeartbeatDto = { ipAddress: '192.168.1.100' };
      const mockUpdatedScreen: Screen = {
        id: mockScreenId,
        name: 'Lobby TV',
        orientation: 'LANDSCAPE',
        status: ScreenStatus.ONLINE,
        propertyId: 100,
        resolution: '1920x1080',
        ipAddress: dto.ipAddress!,
        lastPing: new Date(),
        code: 'SCR-001',
        roomCategory: 'LOBBY',
        createdAt: new Date(),
        updatedAt: new Date(),
        priceOverride: null,
      };

      mockPrisma.screen.update.mockResolvedValue(mockUpdatedScreen);

      // [FIX] Gunakan Pick type untuk menyesuaikan dengan return value partial dari service
      // Ini mengatasi error TS2740: Type is missing properties
      const result: Pick<Screen, 'id' | 'status' | 'ipAddress' | 'lastPing'> =
        await service.recordHeartbeat(mockScreenId, dto);

      expect(mockPrisma.screen.update).toHaveBeenCalledWith({
        where: { id: mockScreenId },
        data: expect.objectContaining({
          status: ScreenStatus.ONLINE,
          ipAddress: dto.ipAddress,
        }) as Prisma.ScreenUpdateInput,
        select: expect.any(Object) as Prisma.ScreenSelect,
      });

      expect(result.status).toBe(ScreenStatus.ONLINE);
      expect(result.ipAddress).toBe(dto.ipAddress);
    });
  });
});
