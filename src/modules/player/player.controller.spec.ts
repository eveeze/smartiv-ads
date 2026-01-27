import { Test, TestingModule } from '@nestjs/testing';
import { PlayerController } from './player.controller';
import { PlayerService } from './player.service';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { PlayerAuthGuard } from './guards/player-auth.guard';
import {
  Screen,
  ScreenOrientation,
  ScreenStatus,
  RoomCategory,
  AdSlot,
} from '@prisma/client';
import { GetPlaylistDto } from './dto/playlist.dto';

// ==========================================
// 1. DEFINISI TYPE-SAFE MOCK INTERFACE
// ==========================================

type MockFn = jest.Mock<any, any>;

interface MockPlayerService {
  getConfig: MockFn;
  getPlaylist: MockFn; // [FIX] Updated name from generatePlaylist
  heartbeat: MockFn; // [FIX] Updated name from recordHeartbeat
}

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

  // [FIX] Gunakan Interface agar type-safe
  const mockPlayerService: MockPlayerService = {
    getConfig: jest.fn(),
    getPlaylist: jest.fn(),
    heartbeat: jest.fn(),
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
      .overrideGuard(PlayerAuthGuard) // Override Guard
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
    it('should call service.getConfig with screen object', async () => {
      const expectedResult = { screenId: 1, refreshInterval: 900 };
      mockPlayerService.getConfig.mockResolvedValue(expectedResult);

      const result = await controller.getConfig(mockScreen);

      expect(mockPlayerService.getConfig).toHaveBeenCalledWith(mockScreen);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getPlaylist', () => {
    it('should call service.getPlaylist with screen and query', async () => {
      const query: GetPlaylistDto = { slot: AdSlot.SCREENSAVER };
      const expectedResult = { totalDuration: 0, items: [] };
      mockPlayerService.getPlaylist.mockResolvedValue(expectedResult);

      const result = await controller.getPlaylist(mockScreen, query);

      expect(mockPlayerService.getPlaylist).toHaveBeenCalledWith(
        mockScreen,
        query,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('heartbeat', () => {
    it('should call service.heartbeat with payload', async () => {
      const dto: HeartbeatDto = { ipAddress: '10.0.0.1' };
      const expectedResult = { status: 'ok' };
      mockPlayerService.heartbeat.mockResolvedValue(expectedResult);

      const result = await controller.heartbeat(mockScreen, dto);

      expect(mockPlayerService.heartbeat).toHaveBeenCalledWith(mockScreen, dto);
      expect(result).toEqual(expectedResult);
    });
  });
});
