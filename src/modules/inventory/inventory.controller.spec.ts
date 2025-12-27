import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { CreateScreenDto } from './dto/create-screen.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PageOptionsDto } from '../../common/dto/page-options.dto';
import {
  AdSlot,
  Property,
  Screen,
  ScreenStatus,
  ScreenOrientation,
  PropertyType,
  PropertyClass,
} from '@prisma/client';

describe('InventoryController', () => {
  let controller: InventoryController;
  let service: InventoryService;

  // Mock Service Lengkap
  const mockInventoryService = {
    createProperty: jest.fn(),
    findAllProperties: jest.fn(),
    findOneProperty: jest.fn(),
    updateProperty: jest.fn(),
    removeProperty: jest.fn(),
    createScreen: jest.fn(),
    findAllScreens: jest.fn(),
    findOneScreen: jest.fn(),
    updateScreen: jest.fn(),
    removeScreen: jest.fn(),
  };

  const mockProperty: Property = {
    id: 1,
    name: 'Test Hotel',
    type: PropertyType.HOTEL,
    classification: PropertyClass.STANDARD,
    smartivId: null,
    smartivCode: 'TEST01',
    baseColor: null,
    activeColor: null,
    logoUrl: null,
    address: 'Jl. Test',
    city: 'Jakarta',
    enabledSlots: [AdSlot.SCREENSAVER],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockScreen: Screen = {
    id: 1,
    propertyId: 1,
    name: 'Lobby TV',
    code: 'MAC-001',
    resolution: '1920x1080',
    orientation: ScreenOrientation.LANDSCAPE,
    ipAddress: null,
    roomCategory: 'LOBBY' as any,
    status: ScreenStatus.ONLINE,
    lastPing: null,
    priceOverride: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        {
          provide: InventoryService,
          useValue: mockInventoryService,
        },
      ],
    }).compile();

    controller = module.get<InventoryController>(InventoryController);
    service = module.get<InventoryService>(InventoryService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // --- PROPERTY TESTS ---

  describe('createProperty', () => {
    it('should create property', async () => {
      const dto: CreatePropertyDto = {
        name: 'Test',
        enabledSlots: [AdSlot.SCREENSAVER],
      };
      mockInventoryService.createProperty.mockResolvedValue(mockProperty);
      const result = await controller.createProperty(dto);
      expect(service.createProperty).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockProperty);
    });
  });

  describe('findAllProperties', () => {
    it('should return properties list', async () => {
      const pageOpts = new PageOptionsDto();
      mockInventoryService.findAllProperties.mockResolvedValue({
        data: [mockProperty],
        meta: {},
      });
      await controller.findAllProperties(pageOpts);
      expect(service.findAllProperties).toHaveBeenCalledWith(pageOpts);
    });
  });

  describe('findOneProperty', () => {
    it('should return one property', async () => {
      mockInventoryService.findOneProperty.mockResolvedValue(mockProperty);
      const result = await controller.findOneProperty(1);
      expect(service.findOneProperty).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockProperty);
    });
  });

  describe('updateProperty', () => {
    it('should update property', async () => {
      const dto: UpdatePropertyDto = { name: 'Updated' };
      mockInventoryService.updateProperty.mockResolvedValue({
        ...mockProperty,
        name: 'Updated',
      });
      const result = await controller.updateProperty(1, dto);
      expect(service.updateProperty).toHaveBeenCalledWith(1, dto);
      expect(result.name).toBe('Updated');
    });
  });

  describe('removeProperty', () => {
    it('should remove property', async () => {
      mockInventoryService.removeProperty.mockResolvedValue(mockProperty);
      await controller.removeProperty(1);
      expect(service.removeProperty).toHaveBeenCalledWith(1);
    });
  });

  // --- SCREEN TESTS ---

  describe('createScreen', () => {
    it('should create screen', async () => {
      const dto: CreateScreenDto = {
        propertyId: 1,
        code: 'CODE',
        name: 'Name',
      };
      mockInventoryService.createScreen.mockResolvedValue(mockScreen);
      const result = await controller.createScreen(dto);
      expect(service.createScreen).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockScreen);
    });
  });

  describe('findAllScreens', () => {
    it('should return screens list', async () => {
      const pageOpts = new PageOptionsDto();
      mockInventoryService.findAllScreens.mockResolvedValue({
        data: [mockScreen],
        meta: {},
      });
      await controller.findAllScreens(pageOpts);
      expect(service.findAllScreens).toHaveBeenCalledWith(pageOpts, undefined);
    });
  });

  describe('findOneScreen', () => {
    it('should return one screen', async () => {
      mockInventoryService.findOneScreen.mockResolvedValue(mockScreen);
      const result = await controller.findOneScreen(1);
      expect(service.findOneScreen).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockScreen);
    });
  });

  describe('updateScreen', () => {
    it('should update screen', async () => {
      mockInventoryService.updateScreen.mockResolvedValue(mockScreen);
      await controller.updateScreen(1, {});
      expect(service.updateScreen).toHaveBeenCalledWith(1, {});
    });
  });

  describe('removeScreen', () => {
    it('should remove screen', async () => {
      mockInventoryService.removeScreen.mockResolvedValue(mockScreen);
      await controller.removeScreen(1);
      expect(service.removeScreen).toHaveBeenCalledWith(1);
    });
  });
});
