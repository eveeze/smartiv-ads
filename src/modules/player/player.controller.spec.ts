import { Test, TestingModule } from '@nestjs/testing';
import { PlayerController } from './player.controller';
import { PlayerService } from './player.service';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { PlayerAuthGuard } from './guards/player-auth.guard'; // Import Guard asli
import {
  Screen,
  ScreenOrientation,
  ScreenStatus,
  RoomCategory,
} from '@prisma/client';

describe('PlayerController', () => {
  let controller: PlayerController;
  let service: PlayerService;

  // Mock Screen Object (Simulasi hasil dari @CurrentScreen)
  const mockScreen: Screen = {
    id: 1,
    propertyId: 1,
    name: 'Test Screen',
    code: 'DEVICE-001',
    orientation: ScreenOrientation.LANDSCAPE,
    status: ScreenStatus.ONLINE,
    roomCategory: RoomCategory.LOBBY,
    resolution: '1920x1080',
    ipAddress: null,
    lastPing: null,
    priceOverride: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPlayerService = {
    getConfig: jest.fn(),
    generatePlaylist: jest.fn(),
    recordHeartbeat: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlayerController],
      providers: [
        {
          provide: PlayerService,
          useValue: mockPlayerService,
        },
      ],
    })
      .overrideGuard(PlayerAuthGuard) // [FIX] Override Guard agar tidak butuh PrismaService
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<PlayerController>(PlayerController);
    service = module.get<PlayerService>(PlayerService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getConfig', () => {
    it('should call service.getConfig with screen id', async () => {
      const expectedResult = { screenId: 1, refreshInterval: 900 };
      mockPlayerService.getConfig.mockResolvedValue(expectedResult);

      const result = await controller.getConfig(mockScreen);

      expect(service.getConfig).toHaveBeenCalledWith(mockScreen.id);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getPlaylist', () => {
    it('should call service.generatePlaylist with screen id', async () => {
      const expectedResult = { totalItems: 0, items: [] };
      mockPlayerService.generatePlaylist.mockResolvedValue(expectedResult);

      const result = await controller.getPlaylist(mockScreen);

      expect(service.generatePlaylist).toHaveBeenCalledWith(mockScreen.id);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('heartbeat', () => {
    it('should call service.recordHeartbeat with payload', async () => {
      const dto: HeartbeatDto = { ipAddress: '10.0.0.1' };
      const expectedResult = { status: 'ONLINE' };
      mockPlayerService.recordHeartbeat.mockResolvedValue(expectedResult);

      const result = await controller.heartbeat(mockScreen, dto);

      expect(service.recordHeartbeat).toHaveBeenCalledWith(mockScreen.id, dto);
      expect(result).toEqual(expectedResult);
    });
  });
});
