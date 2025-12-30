import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { CreateScreenDto } from './dto/create-screen.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PageOptionsDto } from '../../common/dto/page-options.dto';
import { CreateRateCardDto } from './dto/create-rate-card.dto'; // [NEW]
import { UpdateRateCardDto } from './dto/update-rate-card.dto'; // [NEW]
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

  // Mock Service dengan nama method yang BENAR
  const mockInventoryService = {
    // Property
    createProperty: jest.fn(),
    findAllProperties: jest.fn(),
    findPropertiesList: jest.fn(), // FIX: getPropertiesList -> findPropertiesList
    findPropertyById: jest.fn(), // FIX: findOneProperty -> findPropertyById
    updateProperty: jest.fn(),
    removeProperty: jest.fn(),
    // Screen
    createScreen: jest.fn(),
    findAllScreens: jest.fn(),
    findScreensList: jest.fn(), // FIX: getScreensList -> findScreensList
    findScreenById: jest.fn(), // FIX: findOneScreen -> findScreenById
    updateScreen: jest.fn(),
    removeScreen: jest.fn(),
    // Rate Card (Phase 5.7)
    createRateCard: jest.fn(),
    findAllRateCards: jest.fn(),
    updateRateCard: jest.fn(),
    removeRateCard: jest.fn(),
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
        type: PropertyType.HOTEL,
        classification: PropertyClass.STANDARD,
        city: 'Jkt',
        smartivCode: 'HTL-01',
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

  describe('findPropertiesList', () => {
    it('should return lightweight property list', async () => {
      mockInventoryService.findPropertiesList.mockResolvedValue([mockProperty]);
      await controller.findPropertiesList(); // FIX: Call correct method
      expect(service.findPropertiesList).toHaveBeenCalled(); // FIX: Expect correct method
    });
  });

  describe('findPropertyById', () => {
    it('should return one property', async () => {
      mockInventoryService.findPropertyById.mockResolvedValue(mockProperty);
      const result = await controller.findPropertyById(1); // FIX: Call correct method
      expect(service.findPropertyById).toHaveBeenCalledWith(1); // FIX: Expect correct method
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
        orientation: ScreenOrientation.LANDSCAPE,
        roomCategory: 'LOBBY' as any,
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

  describe('findScreensList', () => {
    it('should return lightweight screens list', async () => {
      mockInventoryService.findScreensList.mockResolvedValue([mockScreen]);
      await controller.findScreensList(); // FIX: Call correct method
      expect(service.findScreensList).toHaveBeenCalledWith(undefined);
    });
  });

  describe('findScreenById', () => {
    it('should return one screen', async () => {
      mockInventoryService.findScreenById.mockResolvedValue(mockScreen);
      const result = await controller.findScreenById(1); // FIX: Call correct method
      expect(service.findScreenById).toHaveBeenCalledWith(1);
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

  // --- RATE CARD TESTS (NEW) ---

  describe('createRateCard', () => {
    it('should create rate card', async () => {
      const dto: CreateRateCardDto = {
        classification: PropertyClass.PREMIUM,
        pricePerDay: 500000,
      };
      mockInventoryService.createRateCard.mockResolvedValue({ id: 1, ...dto });
      const result = await controller.createRateCard(dto);
      expect(service.createRateCard).toHaveBeenCalledWith(dto);
      expect(result).toBeDefined();
    });
  });

  describe('findAllRateCards', () => {
    it('should return all rate cards', async () => {
      mockInventoryService.findAllRateCards.mockResolvedValue([]);
      await controller.findAllRateCards();
      expect(service.findAllRateCards).toHaveBeenCalled();
    });
  });

  describe('updateRateCard', () => {
    it('should update rate card', async () => {
      const dto: UpdateRateCardDto = { pricePerDay: 600000 };
      await controller.updateRateCard(1, dto);
      expect(service.updateRateCard).toHaveBeenCalledWith(1, dto);
    });
  });

  describe('removeRateCard', () => {
    it('should delete rate card', async () => {
      await controller.removeRateCard(1);
      expect(service.removeRateCard).toHaveBeenCalledWith(1);
    });
  });
});
