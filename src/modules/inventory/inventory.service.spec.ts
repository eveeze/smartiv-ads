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
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    screen: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
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
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('createProperty', () => {
    const dto: CreatePropertyDto = {
      name: 'Test Hotel',
      enabledSlots: [AdSlot.SCREENSAVER],
      smartivCode: 'TEST01',
    };

    it('should create a property successfully', async () => {
      mockPrisma.property.findUnique.mockResolvedValue(null); // No duplicate
      mockPrisma.property.create.mockResolvedValue({ id: 1, ...dto });

      const result = await service.createProperty(dto);
      expect(result).toHaveProperty('id', 1);
      expect(result.name).toBe(dto.name);
    });

    it('should throw ConflictException if smartivCode exists', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({ id: 1, ...dto }); // Exists

      await expect(service.createProperty(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('createScreen', () => {
    const dto: CreateScreenDto = {
      propertyId: 1,
      code: 'SCREEN-001',
      name: 'Lobby TV',
    };

    it('should create a screen successfully', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({ id: 1 }); // Property exists
      mockPrisma.screen.findUnique.mockResolvedValue(null); // Code unique
      mockPrisma.screen.create.mockResolvedValue({ id: 10, ...dto });

      const result = await service.createScreen(dto);
      expect(result).toHaveProperty('id', 10);
      expect(result.code).toBe(dto.code);
    });

    it('should throw NotFoundException if property does not exist', async () => {
      mockPrisma.property.findUnique.mockResolvedValue(null); // Property missing

      await expect(service.createScreen(dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if screen code exists', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.screen.findUnique.mockResolvedValue({ id: 99, ...dto }); // Code exists

      await expect(service.createScreen(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
