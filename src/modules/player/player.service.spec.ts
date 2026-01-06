import { Test, TestingModule } from '@nestjs/testing';
import { PlayerService } from './player.service';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import {
  CampaignStatus,
  ScreenStatus,
  AdSlot,
  MediaType,
  // [FIX] Hapus ApprovalStatus jika tidak dipakai, atau gunakan jika perlu
} from '@prisma/client';
import { HeartbeatDto } from './dto/heartbeat.dto';

// --- Mock Data ---
const mockScreenId = 1;
const mockScreen = {
  id: mockScreenId,
  name: 'Lobby TV',
  orientation: 'LANDSCAPE',
  property: {
    name: 'Grand Hotel',
    logoUrl: 'logo.png',
    address: 'Jl. Sudirman',
    city: 'Jakarta',
  },
};

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
        // [FIX] Gunakan AdSlot yang valid (SCREENSAVER)
        targetSlot: AdSlot.SCREENSAVER,
      },
    ],
  },
];

// --- Mock Prisma ---
const mockPrisma = {
  screen: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  campaign: {
    findMany: jest.fn(),
  },
};

describe('PlayerService', () => {
  let service: PlayerService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlayerService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PlayerService>(PlayerService);
    prisma = module.get<PrismaService>(PrismaService);

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

      expect(prisma.screen.findUnique).toHaveBeenCalledWith({
        where: { id: mockScreenId },
        select: expect.any(Object),
      });
      expect(result.screenName).toBe(mockScreen.name);
      expect(result.propertyName).toBe(mockScreen.property.name);
      expect(result.propertyAddress).toContain('Jakarta'); // Cek gabungan address
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

      const result = await service.generatePlaylist(mockScreenId);

      // Verify Prisma Query
      expect(prisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: CampaignStatus.ACTIVE,
            screens: { some: { id: mockScreenId } },
          }),
        }),
      );

      // Verify Result Structure
      expect(result.totalItems).toBe(1);
      const item = result.items[0];
      expect(item.campaignId).toBe(101);
      expect(item.type).toBe(MediaType.VIDEO);
      expect(item.duration).toBe(30);
      // [FIX] Validasi sesuai enum AdSlot.SCREENSAVER
      expect(item.slot).toBe(AdSlot.SCREENSAVER);
      expect(typeof item.url).toBe('string');
    });

    it('should return empty playlist if no active campaigns found', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue([]);

      const result = await service.generatePlaylist(mockScreenId);

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
      const mockUpdatedScreen = {
        id: mockScreenId,
        status: ScreenStatus.ONLINE,
        lastPing: new Date(),
        ipAddress: dto.ipAddress,
      };

      mockPrisma.screen.update.mockResolvedValue(mockUpdatedScreen);

      const result = await service.recordHeartbeat(mockScreenId, dto);

      expect(prisma.screen.update).toHaveBeenCalledWith({
        where: { id: mockScreenId },
        data: expect.objectContaining({
          status: ScreenStatus.ONLINE,
          ipAddress: dto.ipAddress,
        }),
        select: expect.any(Object),
      });

      expect(result.status).toBe(ScreenStatus.ONLINE);
      expect(result.ipAddress).toBe(dto.ipAddress);
    });
  });
});
