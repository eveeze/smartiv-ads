import { Test, TestingModule } from '@nestjs/testing';
import { TelemetryService } from './telemetry.service';
// [FIX] Gunakan relative path
import { QueueService } from '../../../src/providers/queue/queue.service';
import { CreateImpressionLogDto } from './dto/create-impression.dto';

describe('TelemetryService', () => {
  let service: TelemetryService;
  let queueService: QueueService;

  const mockQueueService = {
    addImpressionJob: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelemetryService,
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
      ],
    }).compile();

    service = module.get<TelemetryService>(TelemetryService);
    queueService = module.get<QueueService>(QueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('ingestImpressions', () => {
    it('should push impressions to queue', async () => {
      const screenId = 1;
      const dto: CreateImpressionLogDto = {
        impressions: [
          { campaignId: 10, duration: 15, timestamp: new Date().toISOString() },
        ],
      };

      await service.ingestImpressions(screenId, dto);

      expect(queueService.addImpressionJob).toHaveBeenCalledWith(
        expect.objectContaining({
          screenId,
          impressions: dto.impressions,
        }),
      );
    });
  });
});
