import { Test, TestingModule } from '@nestjs/testing';
import { CampaignsService } from './campaigns.service';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { FinanceService } from '../finance/finance.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  CampaignStatus,
  Role,
  User,
  ScreenStatus,
  Campaign,
  Media,
  Screen,
  RoomCategory,
  ScreenOrientation,
} from '@prisma/client';

// ==========================================
// 1. STRICT TYPE-SAFE MOCK DEFINITIONS
// ==========================================

// Helper type: Mock function yang return Promise<T> (Async)
type MockAsync<T> = jest.Mock<Promise<T>>;

interface MockPrismaService {
  media: {
    findUnique: MockAsync<Media | null>;
  };
  property: {
    count: MockAsync<number>;
  };
  screen: {
    findMany: MockAsync<Screen[]>;
  };
  campaign: {
    create: MockAsync<Campaign>;
    findMany: MockAsync<Campaign[]>;
    count: MockAsync<number>;
    findUnique: MockAsync<Campaign | null>;
    update: MockAsync<Campaign>;
    delete: MockAsync<Campaign>;
  };
  campaignItem: {
    create: MockAsync<void>;
  };
  auditLog: {
    create: MockAsync<void>;
  };
  // [FIX] Transaction Mock Generic Definition
  $transaction: jest.Mock;
}

interface MockFinanceService {
  calculateCampaignCost: MockAsync<{
    totalCost: number;
    durationDays: number;
    screenCount: number;
    breakdown: unknown[];
  }>;
  freezeBalanceForCampaign: MockAsync<void>;
  commitFrozenBalance: MockAsync<void>;
  releaseFrozenBalance: MockAsync<void>;
}

// ==========================================
// 2. MOCK DATA (Fully Typed)
// ==========================================
const mockUser: User = {
  id: 1,
  role: Role.ADVERTISER,
  email: 'advertiser@test.com',
  name: 'Test Advertiser',
  password: 'hashed',
  phone: '08123456789',
  createdAt: new Date(),
  updatedAt: new Date(),
  propertyId: null,
  isActive: true,
  passwordResetToken: null,
  passwordResetExpires: null,
};

const mockMedia: Media = {
  id: 1,
  uploaderId: 1,
  status: ApprovalStatus.APPROVED,
  filename: 'test.jpg',
  originalName: 'test.jpg',
  mimeType: 'image/jpeg',
  size: 100,
  type: 'IMAGE',
  url: 'http://test.com/test.jpg',
  createdAt: new Date(),
  updatedAt: new Date(),
  reviewedAt: new Date(),
  reviewedBy: null,
  rejectionReason: null,
  isTranscoded: false,
  hlsUrl: null,
  thumbnailUrl: null,
};

const mockScreenA: Screen = {
  id: 10,
  name: 'Screen A',
  status: ScreenStatus.ONLINE,
  propertyId: 100,
  orientation: ScreenOrientation.LANDSCAPE,
  resolution: '1920x1080',
  ipAddress: '127.0.0.1',
  lastPing: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  code: 'SCR-A',
  roomCategory: RoomCategory.STANDARD,
  priceOverride: null,
};

const mockScreenB: Screen = {
  ...mockScreenA,
  id: 11,
  name: 'Screen B',
};

const mockCampaign: Campaign = {
  id: 1,
  advertiserId: 1,
  name: 'Test Campaign',
  startDate: new Date(),
  endDate: new Date(),
  totalCost: BigInt(500000),
  status: CampaignStatus.DRAFT,
  propertyId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  rejectionReason: null,
};

// ==========================================
// 3. INIT DEPENDENCIES & MOCK IMPL
// ==========================================

const mockPrisma = {
  media: { findUnique: jest.fn() },
  property: { count: jest.fn() },
  screen: { findMany: jest.fn() },
  campaign: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  campaignItem: { create: jest.fn() },
  auditLog: { create: jest.fn() },
  // [FIX] Typed Transaction Mock Implementation
  $transaction: jest
    .fn()
    .mockImplementation(
      (callback: (tx: MockPrismaService) => Promise<unknown>) =>
        callback(mockPrisma as unknown as MockPrismaService),
    ),
} as unknown as MockPrismaService;

const mockFinance = {
  calculateCampaignCost: jest.fn(),
  freezeBalanceForCampaign: jest.fn(),
  commitFrozenBalance: jest.fn(),
  releaseFrozenBalance: jest.fn(),
} as unknown as MockFinanceService;

// ==========================================
// 4. TEST SUITE
// ==========================================
describe('CampaignsService', () => {
  let service: CampaignsService;

  const getFutureDate = (daysToAdd: number) => {
    const date = new Date();
    date.setDate(date.getDate() + daysToAdd);
    return date.toISOString().split('T')[0];
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FinanceService, useValue: mockFinance },
      ],
    }).compile();

    service = module.get<CampaignsService>(CampaignsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==========================
  // CREATE CAMPAIGN
  // ==========================
  describe('create', () => {
    const dto: CreateCampaignDto = {
      name: 'New Campaign',
      startDate: getFutureDate(5),
      endDate: getFutureDate(10),
      mediaId: 1,
      screenIds: [10],
    };

    it('should throw NotFoundException if media not found', async () => {
      mockPrisma.media.findUnique.mockResolvedValue(null);
      await expect(service.create(mockUser, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequest if selective screens not found/offline', async () => {
      mockPrisma.media.findUnique.mockResolvedValue(mockMedia);
      mockPrisma.screen.findMany.mockResolvedValue([]);
      await expect(service.create(mockUser, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create SELECTIVE campaign successfully (SUBMIT)', async () => {
      mockPrisma.media.findUnique.mockResolvedValue(mockMedia);
      mockPrisma.screen.findMany.mockResolvedValue([mockScreenA]);

      mockFinance.calculateCampaignCost.mockResolvedValue({
        totalCost: 500000,
        durationDays: 5,
        screenCount: 1,
        breakdown: [],
      });
      mockPrisma.campaign.create.mockResolvedValue({
        ...mockCampaign,
        status: CampaignStatus.PENDING_REVIEW,
      });

      // [FIX] Explicit Type for Result
      const result: Campaign = await service.create(mockUser, dto);

      expect(mockFinance.calculateCampaignCost).toHaveBeenCalled();
      expect(mockFinance.freezeBalanceForCampaign).toHaveBeenCalled();
      expect(result.status).toBe(CampaignStatus.PENDING_REVIEW);
    });

    it('should create DRAFT campaign successfully (NO FREEZE)', async () => {
      const draftDto = { ...dto, saveAsDraft: true };

      mockPrisma.media.findUnique.mockResolvedValue(mockMedia);
      mockPrisma.screen.findMany.mockResolvedValue([mockScreenA]);
      mockFinance.calculateCampaignCost.mockResolvedValue({
        totalCost: 500000,
        durationDays: 5,
        screenCount: 1,
        breakdown: [],
      });

      mockPrisma.campaign.create.mockResolvedValue({
        ...mockCampaign,
        status: CampaignStatus.DRAFT,
      });

      // [FIX] Explicit Type for Result + Casting result
      const result: Campaign = await service.create(mockUser, draftDto);

      expect(mockFinance.calculateCampaignCost).toHaveBeenCalled();
      expect(mockFinance.freezeBalanceForCampaign).not.toHaveBeenCalled();
      expect(result.status).toBe(CampaignStatus.DRAFT);
    });

    it('should create BUYOUT campaign successfully', async () => {
      const buyoutDto = {
        ...dto,
        screenIds: undefined,
        propertyId: 100,
      };

      mockPrisma.media.findUnique.mockResolvedValue(mockMedia);
      mockPrisma.property.count.mockResolvedValue(1);
      mockPrisma.screen.findMany.mockResolvedValue([mockScreenA, mockScreenB]);
      mockFinance.calculateCampaignCost.mockResolvedValue({
        totalCost: 1000000,
        durationDays: 5,
        screenCount: 2,
        breakdown: [],
      });
      mockPrisma.campaign.create.mockResolvedValue({
        ...mockCampaign,
        id: 2,
        status: CampaignStatus.PENDING_REVIEW,
        propertyId: 100,
      });

      await service.create(mockUser, buyoutDto);

      expect(mockPrisma.screen.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { propertyId: 100, status: ScreenStatus.ONLINE },
        }),
      );
    });
  });

  // ==========================
  // FIND ALL
  // ==========================
  describe('findAll', () => {
    it('should filter by advertiserId if user is advertiser', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue([]);
      mockPrisma.campaign.count.mockResolvedValue(0);

      await service.findAll(mockUser, { page: 1, take: 10, skip: 0 });

      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ advertiserId: mockUser.id }),
        }),
      );
    });
  });

  // ==========================
  // CANCEL
  // ==========================
  describe('cancel', () => {
    const campaignId = 1;

    it('should throw NotFound if campaign not found', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);
      await expect(service.cancel(campaignId, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequest if user is not owner', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({
        ...mockCampaign,
        id: campaignId,
        advertiserId: 999,
      });
      await expect(service.cancel(campaignId, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequest if status is REJECTED', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({
        ...mockCampaign,
        id: campaignId,
        advertiserId: mockUser.id,
        status: CampaignStatus.REJECTED,
      });
      await expect(service.cancel(campaignId, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should REFUND frozen balance if status is PENDING_REVIEW', async () => {
      const pendingCampaign = {
        ...mockCampaign,
        id: campaignId,
        advertiserId: mockUser.id,
        status: CampaignStatus.PENDING_REVIEW,
        totalCost: BigInt(500000),
      };

      mockPrisma.campaign.findUnique.mockResolvedValue(pendingCampaign);
      mockPrisma.campaign.update.mockResolvedValue({
        ...pendingCampaign,
        status: CampaignStatus.CANCELLED,
      });

      await service.cancel(campaignId, mockUser);

      expect(mockFinance.releaseFrozenBalance).toHaveBeenCalledWith(
        mockUser.id,
        pendingCampaign.totalCost,
        expect.anything(),
      );
    });
  });

  // ==========================
  // REVIEW
  // ==========================
  describe('review', () => {
    const pendingCampaign = {
      ...mockCampaign,
      id: 1,
      status: CampaignStatus.PENDING_REVIEW,
      advertiserId: 1,
      totalCost: BigInt(50000),
    };

    it('should APPROVE campaign and commit balance', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(pendingCampaign);
      mockPrisma.campaign.update.mockResolvedValue({
        ...pendingCampaign,
        status: CampaignStatus.ACTIVE,
      });

      await service.review(1, { approved: true }, 99);

      expect(mockFinance.commitFrozenBalance).toHaveBeenCalledWith(
        pendingCampaign.advertiserId,
        pendingCampaign.totalCost,
        pendingCampaign.id,
        expect.anything(),
      );
    });
  });

  // ==========================
  // UPDATE DRAFT
  // ==========================
  describe('update', () => {
    const campaignId = 1;
    const updateDto: UpdateCampaignDto = { name: 'Updated Draft Name' };

    it('should throw Forbidden if user is not owner', async () => {
      const existing = {
        ...mockCampaign,
        id: campaignId,
        advertiserId: 999,
        status: CampaignStatus.DRAFT,
        screens: [],
      };
      // [FIX] Double casting to satisfy type checker and linter
      mockPrisma.campaign.findUnique.mockResolvedValue(
        existing as unknown as Campaign,
      );

      await expect(
        service.update(campaignId, mockUser.id, updateDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequest if campaign is not DRAFT', async () => {
      const existing = {
        ...mockCampaign,
        id: campaignId,
        advertiserId: mockUser.id,
        status: CampaignStatus.PENDING_REVIEW,
        screens: [],
      };
      // [FIX] Double casting
      mockPrisma.campaign.findUnique.mockResolvedValue(
        existing as unknown as Campaign,
      );

      await expect(
        service.update(campaignId, mockUser.id, updateDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update DRAFT campaign successfully', async () => {
      const existingCampaign = {
        ...mockCampaign,
        id: campaignId,
        advertiserId: mockUser.id,
        status: CampaignStatus.DRAFT,
        startDate: new Date(getFutureDate(5)),
        endDate: new Date(getFutureDate(10)),
        screens: [mockScreenA],
      };

      // [FIX] Double casting (as unknown as Campaign) allows extra props 'screens' without lint error
      mockPrisma.campaign.findUnique.mockResolvedValue(
        existingCampaign as unknown as Campaign,
      );

      mockFinance.calculateCampaignCost.mockResolvedValue({
        totalCost: 60000,
        durationDays: 5,
        screenCount: 1,
        breakdown: [],
      });
      mockPrisma.campaign.update.mockResolvedValue({
        ...existingCampaign,
        name: updateDto.name!, // [FIX] Non-null assertion
      });

      // [FIX] Explicit Variable Type
      const result: Campaign = await service.update(
        campaignId,
        mockUser.id,
        updateDto,
      );

      expect(mockPrisma.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: campaignId },
          data: expect.objectContaining({ name: updateDto.name! }),
        }),
      );
      expect(result.name).toBe(updateDto.name!);
    });
  });

  // ==========================
  // SUBMIT
  // ==========================
  describe('submit', () => {
    const campaignId = 1;

    it('should throw BadRequest if status is not DRAFT', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({
        ...mockCampaign,
        id: campaignId,
        advertiserId: mockUser.id,
        status: CampaignStatus.PENDING_REVIEW,
      });
      await expect(service.submit(campaignId, mockUser.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should freeze balance and update status to PENDING_REVIEW', async () => {
      const draftCampaign = {
        ...mockCampaign,
        id: campaignId,
        advertiserId: mockUser.id,
        status: CampaignStatus.DRAFT,
        totalCost: BigInt(500000),
        startDate: new Date(getFutureDate(1)),
        endDate: new Date(getFutureDate(5)),
      };

      mockPrisma.campaign.findUnique.mockResolvedValue(draftCampaign);
      mockPrisma.campaign.update.mockResolvedValue({
        ...draftCampaign,
        status: CampaignStatus.PENDING_REVIEW,
      });

      await service.submit(campaignId, mockUser.id);

      expect(mockFinance.freezeBalanceForCampaign).toHaveBeenCalledWith(
        mockUser.id,
        draftCampaign.totalCost,
        expect.anything(),
      );
      expect(mockPrisma.campaign.update).toHaveBeenCalledWith({
        where: { id: campaignId },
        data: { status: CampaignStatus.PENDING_REVIEW },
      });
    });
  });

  // ==========================
  // REMOVE (DELETE)
  // ==========================
  describe('remove', () => {
    const campaignId = 1;

    it('should throw Forbidden if user is not owner', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({
        ...mockCampaign,
        id: campaignId,
        advertiserId: 999,
        status: CampaignStatus.DRAFT,
      });
      await expect(service.remove(campaignId, mockUser.id)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequest if campaign is not DRAFT', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({
        ...mockCampaign,
        id: campaignId,
        advertiserId: mockUser.id,
        status: CampaignStatus.ACTIVE,
      });
      await expect(service.remove(campaignId, mockUser.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should delete DRAFT campaign successfully', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({
        ...mockCampaign,
        id: campaignId,
        advertiserId: mockUser.id,
        status: CampaignStatus.DRAFT,
      });
      mockPrisma.campaign.delete.mockResolvedValue({
        ...mockCampaign,
        id: campaignId,
      });

      await service.remove(campaignId, mockUser.id);

      expect(mockPrisma.campaign.delete).toHaveBeenCalledWith({
        where: { id: campaignId },
      });
    });
  });
});
