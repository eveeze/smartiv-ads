import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreatePropertyDto } from './dto/create-property.dto';
import { CreateScreenDto } from './dto/create-screen.dto';
import { AdSlot } from '@prisma/client';

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: PrismaService;

  const mockPrisma = {
    property: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
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
    $transaction: jest.fn((promises) => Promise.all(promises)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createProperty', () => {
    it('should create a property if code is unique', async () => {
      const dto: CreatePropertyDto = {
        name: 'Hotel Test',
        type: 'HOTEL',
        classification: 'PREMIUM',
        city: 'Jakarta',
        smartivCode: 'HTL-001',
        enabledSlots: [AdSlot.SCREENSAVER], // [FIX] Ditambahkan
      };

      mockPrisma.property.findUnique.mockResolvedValue(null);
      mockPrisma.property.create.mockResolvedValue({ id: 1, ...dto });

      const result = await service.createProperty(dto);
      expect(result).toHaveProperty('id', 1);
      expect(mockPrisma.property.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: dto.name,
          smartivCode: dto.smartivCode,
        }),
      });
    });

    it('should throw ConflictException if smartivCode exists', async () => {
      const dto: CreatePropertyDto = {
        name: 'Hotel Test',
        type: 'HOTEL',
        classification: 'PREMIUM',
        city: 'Jakarta',
        smartivCode: 'HTL-EXIST',
        enabledSlots: [], // [FIX] Ditambahkan
      };

      mockPrisma.property.findUnique.mockResolvedValue({ id: 99 });

      await expect(service.createProperty(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

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

    it('should throw ConflictException if screen code exists', async () => {
      const dto: CreateScreenDto = {
        propertyId: 1,
        name: 'Lobby TV',
        code: 'SCR-EXIST',
        orientation: 'LANDSCAPE',
        roomCategory: 'LOBBY',
      };

      mockPrisma.property.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.screen.findUnique.mockResolvedValue({ id: 50 });

      await expect(service.createScreen(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
