import { Test, TestingModule } from '@nestjs/testing';
import { CampaignsService } from './campaigns.service';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { FinanceService } from '../finance/finance.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, CampaignStatus, Role, User } from '@prisma/client';

// Mock Data Objects
const mockUser = { id: 1, role: Role.ADVERTISER } as User;
const mockAdmin = { id: 99, role: Role.SUPER_ADMIN } as User;

const mockMedia = {
  id: 1,
  uploaderId: 1,
  status: ApprovalStatus.APPROVED,
};

const mockScreen = { id: 10, name: 'Screen A' };

// Mock Prisma
const mockPrisma = {
  media: { findUnique: jest.fn() },
  screen: { findMany: jest.fn() },
  campaign: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  campaignItem: { create: jest.fn() },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn((callback) => callback(mockPrisma)),
};

// Mock Finance
const mockFinance = {
  calculateCampaignCost: jest.fn(),
  freezeBalanceForCampaign: jest.fn(),
  commitFrozenBalance: jest.fn(),
  releaseFrozenBalance: jest.fn(),
};

describe('CampaignsService', () => {
  let service: CampaignsService;

  // [FIX] Helper untuk tanggal dinamis agar test selalu valid (Future)
  const getFutureDate = (daysToAdd: number) => {
    const date = new Date();
    date.setDate(date.getDate() + daysToAdd);
    return date.toISOString().split('T')[0]; // Format YYYY-MM-DD
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

  // --- CREATE TESTS ---

  describe('create', () => {
    // [FIX] Gunakan tanggal dinamis
    const dto: CreateCampaignDto = {
      name: 'New Campaign',
      startDate: getFutureDate(5), // 5 hari dari sekarang
      endDate: getFutureDate(10), // 10 hari dari sekarang
      mediaId: 1,
      screenIds: [10],
    };

    it('should throw NotFoundException if media not found', async () => {
      mockPrisma.media.findUnique.mockResolvedValue(null);
      await expect(service.create(mockUser, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequest if media not owned by user', async () => {
      mockPrisma.media.findUnique.mockResolvedValue({
        ...mockMedia,
        uploaderId: 999,
      });
      await expect(service.create(mockUser, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequest if media not approved', async () => {
      mockPrisma.media.findUnique.mockResolvedValue({
        ...mockMedia,
        status: ApprovalStatus.PENDING,
      });
      await expect(service.create(mockUser, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequest if date range invalid', async () => {
      mockPrisma.media.findUnique.mockResolvedValue(mockMedia);
      // Start date lebih besar dari End date
      const invalidDto = {
        ...dto,
        startDate: getFutureDate(10),
        endDate: getFutureDate(5),
      };
      await expect(service.create(mockUser, invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequest if some screens not found', async () => {
      mockPrisma.media.findUnique.mockResolvedValue(mockMedia);
      mockPrisma.screen.findMany.mockResolvedValue([]); // No screens found
      await expect(service.create(mockUser, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create campaign successfully', async () => {
      mockPrisma.media.findUnique.mockResolvedValue(mockMedia);
      mockPrisma.screen.findMany.mockResolvedValue([mockScreen]);
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
      expect(mockPrisma.campaign.create).toHaveBeenCalled();
      expect(mockPrisma.campaignItem.create).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
      expect(result.status).toBe(CampaignStatus.PENDING_REVIEW);
    });
  });

  // --- FIND ALL TESTS ---

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

    it('should not filter by advertiserId if user is admin', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue([]);
      mockPrisma.campaign.count.mockResolvedValue(0);

      await service.findAll(mockAdmin, { page: 1, take: 10, skip: 0 });

      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ advertiserId: mockAdmin.id }),
        }),
      );
    });
  });

  // --- FIND ONE TESTS ---

  describe('findOne', () => {
    it('should throw NotFound if campaign not found', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);
      await expect(service.findOne(1, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFound if advertiser accesses other campaign', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({
        id: 1,
        advertiserId: 999, // Other user
      });
      await expect(service.findOne(1, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return campaign if valid', async () => {
      const mockCampaign = { id: 1, advertiserId: mockUser.id };
      mockPrisma.campaign.findUnique.mockResolvedValue(mockCampaign);
      const result = await service.findOne(1, mockUser);
      expect(result).toEqual(mockCampaign);
    });
  });

  // --- REVIEW TESTS ---

  describe('review', () => {
    const pendingCampaign = {
      id: 1,
      status: CampaignStatus.PENDING_REVIEW,
      advertiserId: 1,
      totalCost: BigInt(50000),
    };

    it('should throw BadRequest if not pending', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({
        ...pendingCampaign,
        status: CampaignStatus.DRAFT,
      });
      await expect(service.review(1, { approved: true }, 99)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should APPROVE campaign (commit balance)', async () => {
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
      expect(mockPrisma.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: CampaignStatus.ACTIVE },
        }),
      );
    });

    it('should REJECT campaign (release balance)', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(pendingCampaign);
      mockPrisma.campaign.update.mockResolvedValue({
        ...pendingCampaign,
        status: CampaignStatus.REJECTED,
      });

      await service.review(
        1,
        { approved: false, rejectionReason: 'Bad content' },
        99,
      );

      expect(mockFinance.releaseFrozenBalance).toHaveBeenCalledWith(
        pendingCampaign.advertiserId,
        pendingCampaign.totalCost,
        expect.anything(),
      );
      expect(mockPrisma.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            status: CampaignStatus.REJECTED,
            rejectionReason: 'Bad content',
          },
        }),
      );
    });
  });
});
