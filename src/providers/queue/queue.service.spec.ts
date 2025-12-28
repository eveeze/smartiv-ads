import { Test, TestingModule } from '@nestjs/testing';
import { QueueService, TRANSCODE_QUEUE } from './queue.service';
import { getQueueToken } from '@nestjs/bullmq';

describe('QueueService', () => {
  let service: QueueService;

  const mockQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: getQueueToken(TRANSCODE_QUEUE), // Token injection untuk @InjectQueue
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
    await service.addTranscodeJob(123);
    expect(mockQueue.add).toHaveBeenCalledWith(
      expect.any(String),
      { mediaId: 123 },
      expect.any(Object),
    );
  });
});
