import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles/roles.guard';
import { User, Role } from '@prisma/client';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let service: AnalyticsService;

  const mockAnalyticsService = {
    getAdvertiserSummary: jest.fn(),
    getAdminSummary: jest.fn(),
  };

  const mockUser = { id: 1, role: Role.ADVERTISER } as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    service = module.get<AnalyticsService>(AnalyticsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAdvertiserSummary', () => {
    it('should call service with current user id', async () => {
      const mockResult = {
        activeCampaigns: 1,
        pendingCampaigns: 0,
        totalSpent: '100',
        remainingBalance: '1000',
      };
      mockAnalyticsService.getAdvertiserSummary.mockResolvedValue(mockResult);

      const result = await controller.getAdvertiserSummary(mockUser);

      expect(service.getAdvertiserSummary).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getAdminSummary', () => {
    it('should call service.getAdminSummary', async () => {
      const mockResult = {
        totalRevenue: '5000',
        totalScreens: 10,
        screenStats: { ONLINE: 5, OFFLINE: 5, MAINTENANCE: 0 },
      };
      mockAnalyticsService.getAdminSummary.mockResolvedValue(mockResult);

      const result = await controller.getAdminSummary();

      expect(service.getAdminSummary).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });
  });
});
