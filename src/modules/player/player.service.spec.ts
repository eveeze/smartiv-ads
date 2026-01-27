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
import { PlaylistResponseDto, GetPlaylistDto } from './dto/playlist.dto';

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
  property: {
    findUnique: jest.Mock<Promise<unknown>, [Prisma.PropertyFindUniqueArgs]>;
  };
}

// ==========================================
// 2. MOCK DATA
// ==========================================
const mockScreenId = 1;

// Mock Data Screen Object
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
} as unknown as Screen; // Casting karena mock relation tidak penuh

// Mock Property Result (untuk getConfig)
const mockProperty = {
  id: 100,
  name: 'Grand Hotel',
  timezone: 'Asia/Jakarta',
  logoUrl: 'logo.png',
  baseColor: '#ffffff',
  address: 'Jl. Sudirman',
  city: 'Jakarta',
};

// Mock Campaign Result (untuk getPlaylist)
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
          actionUrl: 'https://promo.com',
        },
        durationSec: 30,
        targetSlot: AdSlot.SCREENSAVER,
        actionUrl: null,
      },
    ],
  },
];

// ==========================================
// 3. INIT DEPENDENCIES & MOCK IMPL
// ==========================================

const mockPrisma: MockPrismaService = {
  screen: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  campaign: {
    findMany: jest.fn(),
  },
  property: {
    findUnique: jest.fn(),
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
    it('should return complete config when property exists', async () => {
      mockPrisma.property.findUnique.mockResolvedValue(mockProperty);

      // Method getConfig sekarang menerima object Screen, bukan ID
      const result = await service.getConfig(mockScreen);

      expect(mockPrisma.property.findUnique).toHaveBeenCalledWith({
        where: { id: mockScreen.propertyId },
        select: expect.any(Object) as Prisma.PropertySelect,
      });

      // Assertions on the result
      expect(result.screenName).toBe(mockScreen.name);
      expect(result.property.name).toBe(mockProperty.name);
      expect(result.property.timezone).toBe(mockProperty.timezone);
      expect(result.property.address).toContain('Jakarta'); // Gabungan address + city
      expect(result.refreshInterval).toBeDefined();
    });

    it('should throw NotFoundException if property does not exist', async () => {
      mockPrisma.property.findUnique.mockResolvedValue(null);

      await expect(service.getConfig(mockScreen)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ===================================
  // TEST: getPlaylist
  // ===================================
  describe('getPlaylist', () => {
    it('should return mapped playlist items filtered by slot', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue(mockCampaigns);

      const dto: GetPlaylistDto = { slot: AdSlot.SCREENSAVER };
      const result: PlaylistResponseDto = await service.getPlaylist(
        mockScreen,
        dto,
      );

      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: CampaignStatus.ACTIVE,
            targetSlot: AdSlot.SCREENSAVER, // Pastikan filter slot aktif
            screens: { some: { id: mockScreen.id } },
          }),
        }),
      );

      // Verify Result Structure
      expect(result.slot).toBe(AdSlot.SCREENSAVER);
      expect(result.totalDuration).toBeGreaterThan(0);
      expect(result.items.length).toBe(1);

      const item = result.items[0];
      expect(item.campaignId).toBe(101);
      expect(item.type).toBe(MediaType.VIDEO);
      expect(item.duration).toBe(30);
      expect(item.slot).toBe(AdSlot.SCREENSAVER);

      // [FIX] Cek apakah URL berisi ID media atau 'master.m3u8' (format HLS),
      // karena backend mengubah video.mp4 -> .../50/master.m3u8
      expect(item.mediaUrl).toMatch(/50\/master\.m3u8/);
    });

    it('should return empty playlist if no campaigns found', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue([]);

      const dto: GetPlaylistDto = { slot: AdSlot.INFO_SLIDER };
      const result: PlaylistResponseDto = await service.getPlaylist(
        mockScreen,
        dto,
      );

      expect(result.items).toEqual([]);
      expect(result.totalDuration).toBe(0);
    });
  });

  // ===================================
  // TEST: heartbeat
  // ===================================
  describe('heartbeat', () => {
    it('should update screen status and timestamp', async () => {
      const dto: HeartbeatDto = { ipAddress: '192.168.1.100' };

      // [FIX] Convert DTO 'string | undefined' to 'string | null' for Prisma compatibility
      const mockUpdatedScreen = {
        ...mockScreen,
        ipAddress: dto.ipAddress ?? null,
        status: ScreenStatus.ONLINE,
      } as unknown as Screen; // Explicit casting to satisfy the mockResolvedValue type

      mockPrisma.screen.update.mockResolvedValue(mockUpdatedScreen);

      // Method heartbeat sekarang menerima object Screen
      const result = await service.heartbeat(mockScreen, dto);

      expect(mockPrisma.screen.update).toHaveBeenCalledWith({
        where: { id: mockScreen.id },
        data: expect.objectContaining({
          status: ScreenStatus.ONLINE,
          ipAddress: dto.ipAddress,
        }),
      });

      expect(result.status).toBe('ok');
      expect(result.serverTime).toBeDefined();
    });
  });
});
