import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { CreateScreenDto } from './dto/create-screen.dto';
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

  // Mock Object yang lengkap sesuai method di Service
  const mockInventoryService = {
    createProperty: jest.fn(),
    findAllProperties: jest.fn(),
    findOneProperty: jest.fn(),
    createScreen: jest.fn(),
    findAllScreens: jest.fn(),
  };

  // Sample Data untuk Mock Return
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
    roomCategory: 'LOBBY' as any, // Cast karena Enum RoomCategory mungkin belum di-export di spec ini
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

  // --- 1. Test createProperty ---
  describe('createProperty', () => {
    it('should create a property', async () => {
      const dto: CreatePropertyDto = {
        name: 'Test Hotel',
        enabledSlots: [AdSlot.SCREENSAVER],
        smartivCode: 'TEST01',
      };

      mockInventoryService.createProperty.mockResolvedValue(mockProperty);

      const result = await controller.createProperty(dto);

      expect(service.createProperty).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockProperty);
    });
  });

  // --- 2. Test findAllProperties ---
  describe('findAllProperties', () => {
    it('should return an array of properties', async () => {
      const mockResult = [mockProperty];
      mockInventoryService.findAllProperties.mockResolvedValue(mockResult);

      const result = await controller.findAllProperties();

      expect(service.findAllProperties).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // --- 3. Test findOneProperty ---
  describe('findOneProperty', () => {
    it('should return a single property details', async () => {
      const propertyId = 1;
      mockInventoryService.findOneProperty.mockResolvedValue(mockProperty);

      const result = await controller.findOneProperty(propertyId);

      expect(service.findOneProperty).toHaveBeenCalledWith(propertyId);
      expect(result).toEqual(mockProperty);
    });
  });

  // --- 4. Test createScreen ---
  describe('createScreen', () => {
    it('should create a screen', async () => {
      const dto: CreateScreenDto = {
        propertyId: 1,
        code: 'MAC-001',
        name: 'Lobby TV',
      };

      mockInventoryService.createScreen.mockResolvedValue(mockScreen);

      const result = await controller.createScreen(dto);

      expect(service.createScreen).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockScreen);
    });
  });

  // --- 5. Test findAllScreens ---
  describe('findAllScreens', () => {
    it('should return an array of screens', async () => {
      const mockResult = [mockScreen];
      mockInventoryService.findAllScreens.mockResolvedValue(mockResult);

      const result = await controller.findAllScreens();

      expect(service.findAllScreens).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
