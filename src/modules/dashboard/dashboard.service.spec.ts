import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { CampaignStatus, ScreenStatus, Role } from '@prisma/client';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: PrismaService;

  const mockPrisma = {
    publisherLedger: {
      aggregate: jest.fn(),
    },
    impressionLog: {
      count: jest.fn(),
    },
    campaign: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    screen: {
      groupBy: jest.fn(),
    },
    property: {
      findUnique: jest.fn(),
    },
  };

  const mockUser = {
    id: 1,
    propertyId: 10,
    role: Role.PROPERTY_OPERATOR,
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOperatorDashboard', () => {
    it('should return operator dashboard metrics', async () => {
      mockPrisma.publisherLedger.aggregate.mockResolvedValue({
        _sum: { totalRevenue: 1500000n },
      });
      mockPrisma.impressionLog.count.mockResolvedValue(150);
      mockPrisma.campaign.count.mockResolvedValue(5);
      mockPrisma.screen.groupBy.mockResolvedValue([
        { status: ScreenStatus.ONLINE, _count: { status: 3 } },
        { status: ScreenStatus.OFFLINE, _count: { status: 1 } },
      ]);

      const result = await service.getOperatorDashboard(mockUser);

      expect(result.revenueCurrentMonth).toBe('1500000');
      expect(result.totalImpressions).toBe(150);
      expect(result.activeCampaigns).toBe(5);
      expect(result.screenSummary.total).toBe(4);
      expect(result.screenSummary.online).toBe(3);
      expect(result.screenSummary.offline).toBe(1);
    });

    it('should throw NotFoundException if user has no property', async () => {
      await expect(
        service.getOperatorDashboard({ id: 2 } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPropertySchedule', () => {
    it('should return campaign schedule calendar view', async () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      mockPrisma.campaign.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Promo 1',
          targetSlot: 'SCREENSAVER',
          startDate: now,
          endDate: tomorrow,
        },
      ]);

      const result = await service.getPropertySchedule(mockUser);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].campaigns[0].name).toBe('Promo 1');
      expect(result[0].date).toBe(now.toISOString().slice(0, 10));
    });
  });

  describe('getMyPropertyProfile', () => {
    it('should return property profile details', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({
        id: 10,
        name: 'Grand Hotel',
        city: 'Jakarta',
      });

      const result = await service.getMyPropertyProfile(mockUser);

      expect(result.name).toBe('Grand Hotel');
      expect(result.city).toBe('Jakarta');
    });

    it('should throw NotFoundException if property not found in DB', async () => {
      mockPrisma.property.findUnique.mockResolvedValue(null);
      await expect(service.getMyPropertyProfile(mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
