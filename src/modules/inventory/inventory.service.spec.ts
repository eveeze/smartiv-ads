import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreatePropertyDto } from './dto/create-property.dto';
import { CreateScreenDto } from './dto/create-screen.dto';
import { CreateRateCardDto } from './dto/create-rate-card.dto';
import { AdSlot, PropertyClass } from '@prisma/client';

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
});
