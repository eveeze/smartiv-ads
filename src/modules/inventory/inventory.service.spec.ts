import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../../providers/prisma/prisma.service';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreatePropertyDto } from './dto/create-property.dto';
import { CreateScreenDto } from './dto/create-screen.dto';
import { CreateRateCardDto } from './dto/create-rate-card.dto';
import { AdSlot, PropertyClass } from '@prisma/client';
import { Order } from '../../common/dto/page-options.dto';

describe('InventoryService', () => {
  let service: InventoryService;
  // let prisma: PrismaService;

  const mockPrisma = {
    property: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    screen: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    rateCard: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    industryCategory: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    campaign: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    // prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // --- PROPERTY TESTS ---
  describe('createProperty', () => {
    it('should create a property if code is unique', async () => {
      const dto: CreatePropertyDto = {
        name: 'Hotel Test',
        type: 'HOTEL',
        classification: 'PREMIUM',
        city: 'Jakarta',
        smartivCode: 'HTL-001',
        enabledSlots: [AdSlot.SCREENSAVER],
      };

      mockPrisma.property.findUnique.mockResolvedValue(null);
      mockPrisma.property.create.mockResolvedValue({ id: 1, ...dto });

      const result = await service.createProperty(dto);
      expect(result).toHaveProperty('id', 1);
    });
  });

  // --- SCREEN TESTS ---
  describe('createScreen', () => {
    it('should throw NotFoundException if property does not exist', async () => {
      const dto: CreateScreenDto = {
        propertyId: 999,
        name: 'Lobby TV',
        code: 'SCR-001',
        orientation: 'LANDSCAPE',
        roomCategory: 'LOBBY',
      };

      mockPrisma.property.findUnique.mockResolvedValue(null);

      await expect(service.createScreen(dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // --- RATE CARD TESTS (PHASE 5.7) ---
  describe('createRateCard', () => {
    it('should create rate card if configuration is unique', async () => {
      const dto: CreateRateCardDto = {
        classification: PropertyClass.PREMIUM,
        pricePerDay: 500000,
        targetSlot: AdSlot.SCREENSAVER,
      };

      // 1. Mock Check Uniqueness (findFirst -> null)
      mockPrisma.rateCard.findFirst.mockResolvedValue(null);

      // 2. Mock Create
      mockPrisma.rateCard.create.mockResolvedValue({
        id: 1,
        ...dto,
        pricePerDay: BigInt(dto.pricePerDay),
      });

      const result = await service.createRateCard(dto);

      // Verify Logic
      expect(mockPrisma.rateCard.findFirst).toHaveBeenCalled();

      // [FIX] Tambahkan wrapper { data: ... } agar sesuai implementasi Prisma
      expect(mockPrisma.rateCard.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          classification: PropertyClass.PREMIUM,
          pricePerDay: BigInt(500000),
        }),
      });

      expect(result).toBeDefined();
    });

    it('should throw ConflictException if duplicate configuration exists', async () => {
      const dto: CreateRateCardDto = {
        classification: PropertyClass.PREMIUM,
        pricePerDay: 600000,
        targetSlot: AdSlot.SCREENSAVER,
      };

      // 1. Mock Check Uniqueness (findFirst -> returns existing record)
      mockPrisma.rateCard.findFirst.mockResolvedValue({ id: 1 });

      await expect(service.createRateCard(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAllRateCards', () => {
    it('should return rate cards', async () => {
      const mockData = [
        {
          id: 1,
          classification: 'PREMIUM',
          pricePerDay: BigInt(500000),
          property: { name: 'Test' },
        },
      ];
      mockPrisma.rateCard.findMany.mockResolvedValue(mockData);

      const result = await service.findAllRateCards();
      expect(result).toHaveLength(1);
      expect(result[0].pricePerDay).toBe(BigInt(500000));
    });
  });

  // --- PHASE 12: Brand Safety Blocklist Tests ---
  describe('getBlocklist', () => {
    it('should return property blocklist', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({
        id: 1,
        blocklist: [{ id: 10, name: 'Alcohol', code: 'ALCOHOL' }],
      });

      const result = await service.getBlocklist(1);
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('ALCOHOL');
    });

    it('should throw NotFoundException if property not found', async () => {
      mockPrisma.property.findUnique.mockResolvedValue(null);
      await expect(service.getBlocklist(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateBlocklist', () => {
    it('should update blocklist with valid categories', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.industryCategory.count.mockResolvedValue(2);
      mockPrisma.property.update.mockResolvedValue({
        id: 1,
        blocklist: [{ id: 10 }, { id: 11 }],
      });

      const result = await service.updateBlocklist(1, {
        categoryIds: [10, 11],
      });
      expect(result.blocklist).toHaveLength(2);
      expect(mockPrisma.property.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { blocklist: { set: [{ id: 10 }, { id: 11 }] } },
        }),
      );
    });

    it('should throw BadRequestException if invalid categories provided', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.industryCategory.count.mockResolvedValue(1); // Only 1 matched for 2 ids

      await expect(
        service.updateBlocklist(1, { categoryIds: [10, 99] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkAvailability', () => {
    it('should return available campaigns excluded from blocklist', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({
        id: 1,
        blocklist: [{ id: 10 }],
      });
      mockPrisma.campaign.findMany.mockResolvedValue([
        { id: 100, name: 'Safe Campaign' },
      ]);

      const result = await service.checkAvailability(1);
      expect(result.propertyId).toBe(1);
      expect(result.blockedCategories).toBe(1);
      expect(result.availableCampaigns).toHaveLength(1);
      expect(result.availableCampaigns[0].name).toBe('Safe Campaign');
    });

    it('should return all active campaigns if no categories are blocked', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({
        id: 1,
        blocklist: [],
      });
      mockPrisma.campaign.findMany.mockResolvedValue([
        { id: 100 },
        { id: 101 },
      ]);

      const result = await service.checkAvailability(1);
      expect(result.blockedCategories).toBe(0);
      expect(result.availableCampaigns).toHaveLength(2);
    });
  });

  // --- PROPERTY ADDITIONAL TESTS ---
  describe('findAllProperties', () => {
    it('should return paginated properties', async () => {
      const mockData = [{ id: 1, name: 'Hotel A' }];
      mockPrisma.property.findMany.mockResolvedValue(mockData);
      mockPrisma.property.count.mockResolvedValue(1);

      const result = await service.findAllProperties({
        page: 1,
        take: 10,
        order: Order.DESC,
        skip: 0,
      });
      expect(result.data).toHaveLength(1);
      expect(result.meta).toBeDefined();
    });
  });

  describe('findPropertiesList', () => {
    it('should return simplified property list', async () => {
      mockPrisma.property.findMany.mockResolvedValue([
        { id: 1, name: 'Hotel A', city: 'Jakarta', classification: 'PREMIUM' },
      ]);
      const result = await service.findPropertiesList();
      expect(result).toHaveLength(1);
    });
  });

  describe('findPropertyById', () => {
    it('should return property when found', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({
        id: 1,
        name: 'Hotel A',
      });
      const result = await service.findPropertyById(1);
      expect(result.id).toBe(1);
    });

    it('should throw NotFoundException when property not found', async () => {
      mockPrisma.property.findUnique.mockResolvedValue(null);
      await expect(service.findPropertyById(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateProperty', () => {
    it('should update property when it exists', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.property.update.mockResolvedValue({ id: 1, name: 'Updated' });
      const result = await service.updateProperty(1, { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('should throw NotFoundException if property does not exist', async () => {
      mockPrisma.property.findUnique.mockResolvedValue(null);
      await expect(service.updateProperty(999, { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeProperty', () => {
    it('should delete property when it exists', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.property.delete.mockResolvedValue({ id: 1 });
      const result = await service.removeProperty(1);
      expect(result.id).toBe(1);
    });

    it('should throw NotFoundException if property does not exist', async () => {
      mockPrisma.property.findUnique.mockResolvedValue(null);
      await expect(service.removeProperty(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // --- SCREEN ADDITIONAL TESTS ---
  describe('createScreen - success', () => {
    it('should create screen when property exists and code is unique', async () => {
      const dto: CreateScreenDto = {
        propertyId: 1,
        name: 'Lobby TV',
        code: 'SCR-001',
        orientation: 'LANDSCAPE',
        roomCategory: 'LOBBY',
      };
      mockPrisma.property.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.screen.findUnique.mockResolvedValue(null);
      mockPrisma.screen.create.mockResolvedValue({ id: 1, ...dto });

      const result = await service.createScreen(dto);
      expect(result.id).toBe(1);
      expect(mockPrisma.screen.create).toHaveBeenCalledWith({ data: dto });
    });

    it('should throw BadRequestException if screen code already exists', async () => {
      const dto: CreateScreenDto = {
        propertyId: 1,
        name: 'Lobby TV',
        code: 'SCR-DUPLICATE',
        orientation: 'LANDSCAPE',
        roomCategory: 'LOBBY',
      };
      mockPrisma.property.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.screen.findUnique.mockResolvedValue({
        id: 99,
        code: 'SCR-DUPLICATE',
      });

      await expect(service.createScreen(dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAllScreens', () => {
    it('should return paginated screens without propertyId filter', async () => {
      mockPrisma.screen.findMany.mockResolvedValue([{ id: 1 }]);
      mockPrisma.screen.count.mockResolvedValue(1);

      const result = await service.findAllScreens({
        page: 1,
        take: 10,
        order: Order.DESC,
        skip: 0,
      });
      expect(result.data).toHaveLength(1);
      expect(result.meta).toBeDefined();
    });

    it('should filter by propertyId when provided', async () => {
      mockPrisma.screen.findMany.mockResolvedValue([{ id: 1, propertyId: 5 }]);
      mockPrisma.screen.count.mockResolvedValue(1);

      const result = await service.findAllScreens(
        { page: 1, take: 10, order: Order.DESC, skip: 0 },
        5,
      );
      expect(result.data).toHaveLength(1);
      expect(mockPrisma.screen.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { propertyId: 5 } }),
      );
    });
  });

  describe('findScreensList', () => {
    it('should return simplified screen list', async () => {
      mockPrisma.screen.findMany.mockResolvedValue([
        { id: 1, name: 'TV 1', code: 'S-1', orientation: 'LANDSCAPE' },
      ]);
      const result = await service.findScreensList();
      expect(result).toHaveLength(1);
    });

    it('should filter by propertyId when provided', async () => {
      mockPrisma.screen.findMany.mockResolvedValue([]);
      await service.findScreensList(5);
      expect(mockPrisma.screen.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { propertyId: 5 } }),
      );
    });
  });

  describe('findScreenById', () => {
    it('should return screen when found', async () => {
      mockPrisma.screen.findUnique.mockResolvedValue({ id: 1, name: 'TV 1' });
      const result = await service.findScreenById(1);
      expect(result.id).toBe(1);
    });

    it('should throw NotFoundException when screen not found', async () => {
      mockPrisma.screen.findUnique.mockResolvedValue(null);
      await expect(service.findScreenById(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateScreen', () => {
    it('should update screen when it exists', async () => {
      mockPrisma.screen.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.screen.update.mockResolvedValue({ id: 1, name: 'Updated TV' });
      const result = await service.updateScreen(1, { name: 'Updated TV' });
      expect(result.name).toBe('Updated TV');
    });

    it('should throw NotFoundException if screen does not exist', async () => {
      mockPrisma.screen.findUnique.mockResolvedValue(null);
      await expect(service.updateScreen(999, { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeScreen', () => {
    it('should delete screen when it exists', async () => {
      mockPrisma.screen.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.screen.delete.mockResolvedValue({ id: 1 });
      const result = await service.removeScreen(1);
      expect(result.id).toBe(1);
    });

    it('should throw NotFoundException if screen does not exist', async () => {
      mockPrisma.screen.findUnique.mockResolvedValue(null);
      await expect(service.removeScreen(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // --- RATE CARD ADDITIONAL TESTS ---
  describe('updateRateCard', () => {
    it('should update rate card when it exists', async () => {
      mockPrisma.rateCard.findUnique.mockResolvedValue({
        id: 1,
        isActive: true,
        pricePerDay: BigInt(500000),
      });
      mockPrisma.rateCard.update.mockResolvedValue({
        id: 1,
        pricePerDay: BigInt(700000),
      });

      const result = await service.updateRateCard(1, { pricePerDay: 700000 });
      expect(result.pricePerDay).toBe(BigInt(700000));
    });

    it('should throw NotFoundException if rate card not found', async () => {
      mockPrisma.rateCard.findUnique.mockResolvedValue(null);
      await expect(
        service.updateRateCard(999, { pricePerDay: 100 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when reactivating rate card with existing active conflict', async () => {
      mockPrisma.rateCard.findUnique.mockResolvedValue({
        id: 1,
        isActive: false,
        classification: 'PREMIUM',
        targetSlot: 'SCREENSAVER',
        propertyId: null,
      });
      // Another active rate card with same config exists
      mockPrisma.rateCard.findFirst.mockResolvedValue({
        id: 2,
        isActive: true,
      });

      await expect(
        service.updateRateCard(1, { isActive: true }),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow reactivation when no active conflict exists', async () => {
      mockPrisma.rateCard.findUnique.mockResolvedValue({
        id: 1,
        isActive: false,
        classification: 'PREMIUM',
        targetSlot: 'SCREENSAVER',
        propertyId: null,
      });
      mockPrisma.rateCard.findFirst.mockResolvedValue(null);
      mockPrisma.rateCard.update.mockResolvedValue({ id: 1, isActive: true });

      const result = await service.updateRateCard(1, { isActive: true });
      expect(result.isActive).toBe(true);
    });
  });

  describe('removeRateCard', () => {
    it('should delete rate card when it exists', async () => {
      mockPrisma.rateCard.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.rateCard.delete.mockResolvedValue({ id: 1 });
      const result = await service.removeRateCard(1);
      expect(result.id).toBe(1);
    });

    it('should throw NotFoundException if rate card not found', async () => {
      mockPrisma.rateCard.findUnique.mockResolvedValue(null);
      await expect(service.removeRateCard(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // --- INDUSTRY CATEGORIES (PHASE 12) ---
  describe('findAllCategories', () => {
    it('should return all industry categories', async () => {
      mockPrisma.industryCategory.findMany.mockResolvedValue([
        { id: 1, name: 'Travel', code: 'TRAVEL' },
        { id: 2, name: 'F&B', code: 'FNB' },
      ]);
      const result = await service.findAllCategories();
      expect(result).toHaveLength(2);
      expect(mockPrisma.industryCategory.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      });
    });
  });
});
