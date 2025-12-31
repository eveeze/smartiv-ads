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
} from '@prisma/client';

// --- Mock Data ---
const mockUser = {
  id: 1,
  role: Role.ADVERTISER,
  email: 'advertiser@test.com',
} as User;

const mockAdmin = {
  id: 99,
  role: Role.SUPER_ADMIN,
  email: 'admin@test.com',
} as User;

const mockMedia = {
  id: 1,
  uploaderId: 1,
  status: ApprovalStatus.APPROVED,
};

const mockScreenA = { id: 10, name: 'Screen A', status: ScreenStatus.ONLINE };
const mockScreenB = { id: 11, name: 'Screen B', status: ScreenStatus.ONLINE };

// --- Mocks Dependencies ---
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
  $transaction: jest.fn((callback) => callback(mockPrisma)),
};

const mockFinance = {
  calculateCampaignCost: jest.fn(),
  freezeBalanceForCampaign: jest.fn(),
  commitFrozenBalance: jest.fn(),
  releaseFrozenBalance: jest.fn(),
};

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
  // TEST: CREATE CAMPAIGN
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
      mockPrisma.screen.findMany.mockResolvedValue([]); // Kosong
      await expect(service.create(mockUser, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create SELECTIVE campaign successfully', async () => {
      mockPrisma.media.findUnique.mockResolvedValue(mockMedia);
      mockPrisma.screen.findMany.mockResolvedValue([{ id: 10 }]);

      mockFinance.calculateCampaignCost.mockResolvedValue({
        totalCost: 500000,
      });
      mockPrisma.campaign.create.mockResolvedValue({
        id: 1,
        status: CampaignStatus.PENDING_REVIEW,
        totalCost: BigInt(500000),
      });

      const result = await service.create(mockUser, dto);

      expect(mockFinance.calculateCampaignCost).toHaveBeenCalled();
      expect(mockFinance.freezeBalanceForCampaign).toHaveBeenCalled();
      expect(result.status).toBe(CampaignStatus.PENDING_REVIEW);
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
      });
      mockPrisma.campaign.create.mockResolvedValue({
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
      expect(mockFinance.calculateCampaignCost).toHaveBeenCalledWith(
        expect.objectContaining({ screenIds: [10, 11] }),
      );
    });
  });

  // ==========================
  // TEST: FIND CAMPAIGNS
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
  // TEST: CANCEL CAMPAIGN
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
        id: campaignId,
        advertiserId: 999, // ID beda
      });
      await expect(service.cancel(campaignId, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequest if status is REJECTED', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({
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
      expect(mockPrisma.campaign.update).toHaveBeenCalled();
    });

    it('should STOP campaign without refund if status is ACTIVE', async () => {
      const activeCampaign = {
        id: campaignId,
        advertiserId: mockUser.id,
        status: CampaignStatus.ACTIVE,
        totalCost: BigInt(500000),
      };

      mockPrisma.campaign.findUnique.mockResolvedValue(activeCampaign);
      mockPrisma.campaign.update.mockResolvedValue({
        ...activeCampaign,
        status: CampaignStatus.CANCELLED,
      });

      await service.cancel(campaignId, mockUser);

      expect(mockFinance.releaseFrozenBalance).not.toHaveBeenCalled();
      expect(mockPrisma.campaign.update).toHaveBeenCalled();
    });
  });

  // ==========================
  // TEST: ADMIN REVIEW
  // ==========================
  describe('review', () => {
    const pendingCampaign = {
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
  // TEST: UPDATE DRAFT (FIXED)
  // ==========================
  describe('update', () => {
    const campaignId = 1;
    const updateDto: UpdateCampaignDto = { name: 'Updated Draft Name' };

    it('should throw Forbidden if user is not owner', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({
        id: campaignId,
        advertiserId: 999,
        status: CampaignStatus.DRAFT,
        screens: [],
      });
      // [FIX] Mengirim mockUser.id (number) bukan mockUser (object)
      await expect(
        service.update(campaignId, mockUser.id, updateDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequest if campaign is not DRAFT', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({
        id: campaignId,
        advertiserId: mockUser.id,
        status: CampaignStatus.PENDING_REVIEW,
        screens: [],
      });
      // [FIX] Mengirim mockUser.id
      await expect(
        service.update(campaignId, mockUser.id, updateDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update DRAFT campaign successfully', async () => {
      const existingCampaign = {
        id: campaignId,
        advertiserId: mockUser.id,
        status: CampaignStatus.DRAFT,
        startDate: new Date(getFutureDate(5)),
        endDate: new Date(getFutureDate(10)),
        screens: [{ id: 10 }],
      };

      mockPrisma.campaign.findUnique.mockResolvedValue(existingCampaign);
      mockFinance.calculateCampaignCost.mockResolvedValue({ totalCost: 60000 });
      mockPrisma.campaign.update.mockResolvedValue({
        ...existingCampaign,
        name: updateDto.name,
      });

      // [FIX] Mengirim mockUser.id
      const result = await service.update(campaignId, mockUser.id, updateDto);

      expect(mockPrisma.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: campaignId },
          data: expect.objectContaining({ name: updateDto.name }),
        }),
      );
      expect(result.name).toBe(updateDto.name);
    });
  });

  // ==========================
  // TEST: DELETE DRAFT (FIXED)
  // ==========================
  describe('remove', () => {
    const campaignId = 1;

    it('should throw Forbidden if user is not owner', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({
        id: campaignId,
        advertiserId: 999,
        status: CampaignStatus.DRAFT,
      });
      // [FIX] Mengirim mockUser.id
      await expect(service.remove(campaignId, mockUser.id)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequest if campaign is not DRAFT', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({
        id: campaignId,
        advertiserId: mockUser.id,
        status: CampaignStatus.ACTIVE,
      });
      // [FIX] Mengirim mockUser.id
      await expect(service.remove(campaignId, mockUser.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should delete DRAFT campaign successfully', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({
        id: campaignId,
        advertiserId: mockUser.id,
        status: CampaignStatus.DRAFT,
      });
      mockPrisma.campaign.delete.mockResolvedValue({ id: campaignId });

      // [FIX] Mengirim mockUser.id
      await service.remove(campaignId, mockUser.id);

      expect(mockPrisma.campaign.delete).toHaveBeenCalledWith({
        where: { id: campaignId },
      });
    });
  });
});
