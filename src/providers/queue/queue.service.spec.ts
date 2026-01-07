import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from './queue.service';
import { getQueueToken } from '@nestjs/bullmq';
import { TRANSCODE_QUEUE, TELEMETRY_QUEUE } from './queue.service';

describe('QueueService', () => {
  let service: QueueService;

  // Mock object untuk Queue BullMQ
  const mockQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        // [FIX] Provide Mock untuk Transcode Queue
        {
          provide: getQueueToken(TRANSCODE_QUEUE),
          useValue: mockQueue,
        },
        // [FIX] Provide Mock untuk Telemetry Queue (Wajib ada karena diinject di constructor)
        {
          provide: getQueueToken(TELEMETRY_QUEUE),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should add transcode job', async () => {
    await service.addTranscodeJob(1);
    expect(mockQueue.add).toHaveBeenCalledWith(
      expect.any(String),
      { mediaId: 1 },
      expect.any(Object),
    );
  });

  it('should add impression job', async () => {
    const payload = { screenId: 1, data: [] };
    await service.addImpressionJob(payload);
    expect(mockQueue.add).toHaveBeenCalledWith(
      expect.any(String),
      payload,
      expect.any(Object),
    );
  });
});
