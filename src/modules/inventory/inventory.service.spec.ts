import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreatePropertyDto } from './dto/create-property.dto';
import { AdSlot } from '@prisma/client';
import { PageOptionsDto } from '../../common/dto/page-options.dto';

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: PrismaService;

  const mockPrisma = {
    property: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    screen: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
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
    it('should create property', async () => {
      const dto: CreatePropertyDto = {
        name: 'T',
        enabledSlots: [],
        smartivCode: 'C',
      };
      mockPrisma.property.findUnique.mockResolvedValue(null);
      mockPrisma.property.create.mockResolvedValue({ id: 1, ...dto });

      const res = await service.createProperty(dto);
      expect(res.id).toBe(1);
    });

    it('should fail if code exists', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({ id: 1 });
      await expect(
        service.createProperty({
          name: 'N',
          enabledSlots: [],
          smartivCode: 'C',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAllProperties', () => {
    it('should return paginated result', async () => {
      const pageOptions = new PageOptionsDto();
      // Mock $transaction return: [data, count]
      mockPrisma.$transaction.mockResolvedValue([[{ id: 1 }], 1]);

      const res = await service.findAllProperties(pageOptions);
      expect(res.data).toHaveLength(1);
      expect(res.meta.total).toBe(1);
    });
  });

  describe('updateProperty', () => {
    it('should update property', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({ id: 1 }); // Exist
      mockPrisma.property.update.mockResolvedValue({ id: 1, name: 'Updated' });

      const res = await service.updateProperty(1, { name: 'Updated' });
      expect(res.name).toBe('Updated');
    });

    it('should throw if not found', async () => {
      mockPrisma.property.findUnique.mockResolvedValue(null);
      await expect(service.updateProperty(99, {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeProperty', () => {
    it('should delete property', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.property.delete.mockResolvedValue({ id: 1 });

      await service.removeProperty(1);
      expect(prisma.property.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });
});
