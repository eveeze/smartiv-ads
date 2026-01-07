import { Test, TestingModule } from '@nestjs/testing';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';
// [FIX] Relative import
import { PlayerAuthGuard } from '../player/guards/player-auth.guard';
import { CreateImpressionLogDto } from './dto/create-impression.dto';
import type { Screen } from '@prisma/client';

describe('TelemetryController', () => {
  let controller: TelemetryController;
  let service: TelemetryService;

  const mockTelemetryService = {
    ingestImpressions: jest.fn(),
  };

  const mockScreen = { id: 1, name: 'Test Screen' } as Screen;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelemetryController],
      providers: [
        {
          provide: TelemetryService,
          useValue: mockTelemetryService,
        },
      ],
    })
      .overrideGuard(PlayerAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<TelemetryController>(TelemetryController);
    service = module.get<TelemetryService>(TelemetryService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call service.ingestImpressions', async () => {
    const dto: CreateImpressionLogDto = { impressions: [] };
    mockTelemetryService.ingestImpressions.mockResolvedValue({
      success: true,
      queued: 0,
    });

    const result = await controller.ingest(mockScreen, dto);

    expect(service.ingestImpressions).toHaveBeenCalledWith(mockScreen.id, dto);
    expect(result).toEqual({ success: true, queued: 0 });
  });
});
