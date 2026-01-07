import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { CampaignStatus, ScreenStatus } from '@prisma/client';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    campaign: {
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    wallet: {
      findUnique: jest.fn(),
    },
    screen: {
      groupBy: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ===========================================
  // TEST: Advertiser Summary
  // ===========================================
  describe('getAdvertiserSummary', () => {
    it('should aggregate advertiser data correctly', async () => {
      const userId = 1;

      // Mock Responses
      mockPrismaService.campaign.count
        .mockResolvedValueOnce(5) // Active
        .mockResolvedValueOnce(2); // Pending

      mockPrismaService.campaign.aggregate.mockResolvedValue({
        _sum: { totalCost: BigInt(1500000) },
      });

      mockPrismaService.wallet.findUnique.mockResolvedValue({
        balance: BigInt(500000),
      });

      const result = await service.getAdvertiserSummary(userId);

      // Verify Prisma Calls
      expect(prisma.campaign.count).toHaveBeenCalledTimes(2); // Active + Pending
      expect(prisma.campaign.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          _sum: { totalCost: true },
          where: expect.objectContaining({ advertiserId: userId }),
        }),
      );

      // Verify Result Structure (BigInt converted to String)
      expect(result).toEqual({
        activeCampaigns: 5,
        pendingCampaigns: 2,
        totalSpent: '1500000',
        remainingBalance: '500000',
      });
    });

    it('should handle null values in aggregation gracefully', async () => {
      const userId = 2;
      mockPrismaService.campaign.count.mockResolvedValue(0);
      // Case: No campaigns, aggregate returns null
      mockPrismaService.campaign.aggregate.mockResolvedValue({
        _sum: { totalCost: null },
      });
      // Case: No wallet
      mockPrismaService.wallet.findUnique.mockResolvedValue(null);

      const result = await service.getAdvertiserSummary(userId);

      expect(result.totalSpent).toBe('0');
      expect(result.remainingBalance).toBe('0');
    });
  });

  // ===========================================
  // TEST: Admin Summary
  // ===========================================
  describe('getAdminSummary', () => {
    it('should calculate total revenue and map screen stats', async () => {
      // Mock Revenue
      mockPrismaService.campaign.aggregate.mockResolvedValue({
        _sum: { totalCost: BigInt(9000000) },
      });

      // Mock Screen GroupBy
      mockPrismaService.screen.groupBy.mockResolvedValue([
        { status: ScreenStatus.ONLINE, _count: { status: 10 } },
        { status: ScreenStatus.OFFLINE, _count: { status: 5 } },
        // Maintenance missing to test default 0
      ]);

      // Mock Total Screen
      mockPrismaService.screen.count.mockResolvedValue(15);

      const result = await service.getAdminSummary();

      expect(result.totalRevenue).toBe('9000000');
      expect(result.totalScreens).toBe(15);
      expect(result.screenStats).toEqual({
        ONLINE: 10,
        OFFLINE: 5,
        MAINTENANCE: 0, // Should default to 0
      });
    });
  });
});
