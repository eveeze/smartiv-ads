import { Test, TestingModule } from '@nestjs/testing';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { ReviewCampaignDto } from './dto/review-campaign.dto';
import { CampaignQueryDto } from './dto/campaign-query.dto';
import { Role, User, CampaignStatus } from '@prisma/client';

describe('CampaignsController', () => {
  let controller: CampaignsController;
  let service: CampaignsService;

  // Mock User Data
  const mockUser: User = {
    id: 1,
    email: 'advertiser@test.com',
    role: Role.ADVERTISER,
  } as unknown as User;

  const mockAdmin: User = {
    id: 99,
    email: 'admin@test.com',
    role: Role.SUPER_ADMIN,
  } as unknown as User;

  // Mock Service
  const mockCampaignsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    review: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getPendingCampaigns: jest.fn(),
    cancel: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CampaignsController],
      providers: [
        {
          provide: CampaignsService,
          useValue: mockCampaignsService,
        },
      ],
    }).compile();

    controller = module.get<CampaignsController>(CampaignsController);
    service = module.get<CampaignsService>(CampaignsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create with correct params', async () => {
      const dto: CreateCampaignDto = {
        name: 'Test Campaign',
        startDate: '2025-01-01',
        endDate: '2025-01-05',
        mediaId: 1,
        screenIds: [1, 2],
      };
      const expectedResult = { id: 1, ...dto };

      mockCampaignsService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(mockUser, dto);

      expect(service.create).toHaveBeenCalledWith(mockUser, dto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll', async () => {
      const query: CampaignQueryDto = { page: 1, take: 10, skip: 0 };
      const expectedResult = { data: [], meta: {} };

      mockCampaignsService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(mockUser, query);

      expect(service.findAll).toHaveBeenCalledWith(mockUser, query);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findPending', () => {
    it('should call service.findAll with PENDING_REVIEW status', async () => {
      const query: CampaignQueryDto = { page: 1, take: 10, skip: 0 };
      mockCampaignsService.findAll.mockResolvedValue({ data: [], meta: {} });

      await controller.findPending(mockUser, query);

      expect(service.findAll).toHaveBeenCalledWith(
        mockUser,
        expect.objectContaining({ status: CampaignStatus.PENDING_REVIEW }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a single campaign', async () => {
      const campaignId = 1;
      const expectedResult = { id: campaignId, name: 'Campaign 1' };

      mockCampaignsService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne(campaignId, mockUser);

      expect(service.findOne).toHaveBeenCalledWith(campaignId, mockUser);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('review', () => {
    it('should call service.review with approval dto', async () => {
      const campaignId = 1;
      const dto: ReviewCampaignDto = { approved: true };
      const expectedResult = { id: campaignId, status: 'ACTIVE' };

      mockCampaignsService.review.mockResolvedValue(expectedResult);

      const result = await controller.review(campaignId, dto, mockAdmin);

      expect(service.review).toHaveBeenCalledWith(
        campaignId,
        dto,
        mockAdmin.id,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  // [UPDATED] Menggunakan mockUser.id
  describe('update', () => {
    it('should call service.update', async () => {
      const campaignId = 1;
      const dto: UpdateCampaignDto = { name: 'Updated Name' };
      const expectedResult = { id: campaignId, name: 'Updated Name' };

      mockCampaignsService.update.mockResolvedValue(expectedResult);

      const result = await controller.update(campaignId, mockUser, dto);

      // FIX: Expect mockUser.id, not mockUser object
      expect(service.update).toHaveBeenCalledWith(campaignId, mockUser.id, dto);
      expect(result).toEqual(expectedResult);
    });
  });

  // [UPDATED] Menggunakan mockUser.id
  describe('remove', () => {
    it('should call service.remove', async () => {
      const campaignId = 1;
      const expectedResult = { id: campaignId };

      mockCampaignsService.remove.mockResolvedValue(expectedResult);

      const result = await controller.remove(campaignId, mockUser);

      // FIX: Expect mockUser.id, not mockUser object
      expect(service.remove).toHaveBeenCalledWith(campaignId, mockUser.id);
      expect(result).toEqual(expectedResult);
    });
  });
});
