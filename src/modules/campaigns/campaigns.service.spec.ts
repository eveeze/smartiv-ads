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
  AdSlot,
  DurationPackage,
} from '@prisma/client';

// ==========================================
// 1. STRICT TYPE-SAFE MOCK DEFINITIONS
// ==========================================

// type MockAsync<T> = jest.Mock<Promise<T>>;

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

// [FIX] Added missing properties: description, title, actionUrl
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
  description: null,
  title: 'Test Media',
  actionUrl: null,
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

// [FIX] Added missing properties: targetSlot, durationPackage
const mockCampaign: Campaign = {
  id: 1,
  advertiserId: 1,
  name: 'Test Campaign',
  startDate: new Date(),
  endDate: new Date(),
  totalCost: BigInt(500000),
  status: CampaignStatus.DRAFT,
  propertyId: 100,
  createdAt: new Date(),
  updatedAt: new Date(),
  rejectionReason: null,
  targetSlot: AdSlot.SCREENSAVER,
  durationPackage: DurationPackage.WEEKLY,
};

// ==========================================
// 3. INIT DEPENDENCIES & MOCK IMPL
// ==========================================

// Define Mock Interface
interface MockPrismaService {
  media: { findUnique: jest.Mock<any, any> };
  property: { count: jest.Mock<any, any>; findUnique: jest.Mock<any, any> };
  screen: { findMany: jest.Mock<any, any> };
  campaign: {
    create: jest.Mock<any, any>;
    findUnique: jest.Mock<any, any>;
    findMany: jest.Mock<any, any>;
    count: jest.Mock<any, any>;
    update: jest.Mock<any, any>;
    delete: jest.Mock<any, any>;
  };
  campaignItem: { create: jest.Mock<any, any> };
  auditLog: { create: jest.Mock<any, any> };
  $transaction: jest.Mock<any, any>;
}

const mockPrisma: MockPrismaService = {
  media: { findUnique: jest.fn() },
  property: { count: jest.fn(), findUnique: jest.fn() },
  screen: { findMany: jest.fn() },
  campaign: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  campaignItem: { create: jest.fn() },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn((callback: (prisma: MockPrismaService) => unknown) =>
    callback(mockPrisma),
  ),
};

const mockFinance = {
  calculateCampaignCost: jest.fn(),
  freezeBalanceForCampaign: jest.fn(),
  commitFrozenBalance: jest.fn(),
  releaseFrozenBalance: jest.fn(),
};

// ==========================================
// 4. TEST SUITE
// ==========================================
describe('CampaignsService', () => {
  let service: CampaignsService;

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

  // ==========================
  // CREATE CAMPAIGN
  // ==========================
  describe('create', () => {
    // [FIX] DTO menyesuaikan CreateCampaignDto baru
    const dto: CreateCampaignDto = {
      name: 'New Campaign',
      startDate: '2026-05-01',
      mediaId: 1,
      propertyId: 100,
      targetSlot: AdSlot.SCREENSAVER,
      durationPackage: DurationPackage.WEEKLY,
    };

    it('should throw NotFoundException if media not found', async () => {
      mockPrisma.media.findUnique.mockResolvedValue(null);
      await expect(service.create(mockUser, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if property not found', async () => {
      mockPrisma.media.findUnique.mockResolvedValue(mockMedia);
      mockPrisma.property.findUnique.mockResolvedValue(null);

      await expect(service.create(mockUser, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequest if no online screens found', async () => {
      mockPrisma.media.findUnique.mockResolvedValue(mockMedia);
      mockPrisma.property.findUnique.mockResolvedValue({
        id: 100,
        name: 'Hotel',
        enabledSlots: [AdSlot.SCREENSAVER],
      });
      mockPrisma.screen.findMany.mockResolvedValue([]); // No screens

      await expect(service.create(mockUser, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create campaign successfully (SUBMIT)', async () => {
      mockPrisma.media.findUnique.mockResolvedValue(mockMedia);
      mockPrisma.property.findUnique.mockResolvedValue({
        id: 100,
        name: 'Hotel',
        enabledSlots: [AdSlot.SCREENSAVER],
      });
      mockPrisma.screen.findMany.mockResolvedValue([mockScreenA]);

      mockFinance.calculateCampaignCost.mockResolvedValue({
        totalCost: 500000,
      });
      mockPrisma.campaign.create.mockResolvedValue({
        ...mockCampaign,
        status: CampaignStatus.PENDING_REVIEW,
      });

      const result = await service.create(mockUser, dto);

      expect(mockFinance.calculateCampaignCost).toHaveBeenCalled();
      expect(mockFinance.freezeBalanceForCampaign).toHaveBeenCalled();
      expect(result.status).toBe(CampaignStatus.PENDING_REVIEW);
    });

    it('should create DRAFT campaign successfully (NO FREEZE)', async () => {
      const draftDto = { ...dto, saveAsDraft: true };

      mockPrisma.media.findUnique.mockResolvedValue(mockMedia);
      mockPrisma.property.findUnique.mockResolvedValue({
        id: 100,
        name: 'Hotel',
        enabledSlots: [AdSlot.SCREENSAVER],
      });
      mockPrisma.screen.findMany.mockResolvedValue([mockScreenA]);
      mockFinance.calculateCampaignCost.mockResolvedValue({
        totalCost: 500000,
      });

      mockPrisma.campaign.create.mockResolvedValue({
        ...mockCampaign,
        status: CampaignStatus.DRAFT,
      });

      const result = await service.create(mockUser, draftDto);

      expect(mockFinance.calculateCampaignCost).toHaveBeenCalled();
      expect(mockFinance.freezeBalanceForCampaign).not.toHaveBeenCalled();
      expect(result.status).toBe(CampaignStatus.DRAFT);
    });
  });

  // ==========================
  // CANCEL
  // ==========================
  describe('cancel', () => {
    const campaignId = 1;

    it('should throw ForbiddenException if user is not owner', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({
        ...mockCampaign,
        id: campaignId,
        advertiserId: 999,
        status: CampaignStatus.PENDING_REVIEW,
      });
      // [FIX] Changed expectation to ForbiddenException
      await expect(service.cancel(campaignId, mockUser)).rejects.toThrow(
        ForbiddenException,
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
    it('should APPROVE campaign and commit balance', async () => {
      const pendingCampaign = {
        ...mockCampaign,
        id: 1,
        status: CampaignStatus.PENDING_REVIEW,
        advertiserId: 1,
        totalCost: BigInt(50000),
      };

      mockPrisma.campaign.findUnique.mockResolvedValue(pendingCampaign);
      mockPrisma.campaign.update.mockResolvedValue({
        ...pendingCampaign,
        status: CampaignStatus.ACTIVE,
      });

      await service.review(1, { approved: true });

      expect(mockFinance.commitFrozenBalance).toHaveBeenCalled();
    });
  });

  // ==========================
  // UPDATE DRAFT
  // ==========================
  describe('update', () => {
    const campaignId = 1;
    const updateDto: UpdateCampaignDto = { name: 'Updated Draft Name' };

    it('should update DRAFT campaign successfully', async () => {
      const existingCampaign = {
        ...mockCampaign,
        id: campaignId,
        advertiserId: mockUser.id,
        status: CampaignStatus.DRAFT,
        propertyId: 100, // [FIX] Required for validation
      };

      mockPrisma.campaign.findUnique.mockResolvedValue(existingCampaign);
      mockPrisma.screen.findMany.mockResolvedValue([mockScreenA]); // Online screens
      mockFinance.calculateCampaignCost.mockResolvedValue({
        totalCost: 60000,
      });
      mockPrisma.campaign.update.mockResolvedValue({
        ...existingCampaign,
        name: updateDto.name!,
      });

      const result = await service.update(campaignId, mockUser.id, updateDto);

      expect(mockPrisma.campaign.update).toHaveBeenCalled();
      expect(result.name).toBe(updateDto.name!);
    });
  });

  // ==========================
  // SUBMIT
  // ==========================
  describe('submit', () => {
    const campaignId = 1;

    it('should freeze balance and update status to PENDING_REVIEW', async () => {
      const draftCampaign = {
        ...mockCampaign,
        id: campaignId,
        advertiserId: mockUser.id,
        status: CampaignStatus.DRAFT,
        totalCost: BigInt(500000),
        screens: [{ id: 10 }], // [FIX] Add screens to satisfy length check
      };

      // Casting to unknown to bypass strict type check for 'screens' include
      mockPrisma.campaign.findUnique.mockResolvedValue(draftCampaign as any);
      mockPrisma.campaign.update.mockResolvedValue({
        ...draftCampaign,
        status: CampaignStatus.PENDING_REVIEW,
      } as any);

      await service.submit(campaignId, mockUser.id);

      expect(mockFinance.freezeBalanceForCampaign).toHaveBeenCalled();
      expect(mockPrisma.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: campaignId },
          data: { status: CampaignStatus.PENDING_REVIEW },
        }),
      );
    });
  });
});
