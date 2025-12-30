import { Test, TestingModule } from '@nestjs/testing';
import { TranscodeProcessor } from './transcode.processor';
import { PrismaService } from '../../../providers/prisma/prisma.service';
import { StorageService } from '../../../providers/storage/storage.service';
import { Job } from 'bullmq';
import { JOB_TRANSCODE_VIDEO } from '../../../providers/queue/queue.service';

// Mock Modules
jest.mock('fs', () => ({
  mkdtempSync: jest.fn().mockReturnValue('/tmp/mock-dir'),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue(Buffer.from('mock-data')),
  rmSync: jest.fn(),
  readdirSync: jest.fn().mockReturnValue([]),
  statSync: jest.fn().mockReturnValue({ isDirectory: () => false }),
}));

// [FIX] Mock MediaUtils LENGKAP (termasuk helper functions)
jest.mock('../../../common/utils/media.utils', () => ({
  MediaUtils: {
    hasAudioStream: jest.fn().mockResolvedValue(true),
  },
  getHlsUrl: jest.fn((id) => `http://mock-hls/${id}/master.m3u8`),
  getThumbnailUrl: jest.fn((id) => `http://mock-thumb/${id}.jpg`),
}));

// Mock fluent-ffmpeg
jest.mock('fluent-ffmpeg', () => {
  return jest.fn().mockImplementation(() => ({
    screenshots: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    addOptions: jest.fn().mockReturnThis(),
    on: jest.fn().mockImplementation((event, callback) => {
      if (event === 'end') callback();
      return { run: jest.fn() }; // Chainable run()
    }),
    run: jest.fn(),
  }));
});

describe('TranscodeProcessor', () => {
  let processor: TranscodeProcessor;
  let prisma: PrismaService;
  let storage: StorageService;

  const mockJob = {
    name: JOB_TRANSCODE_VIDEO,
    data: { mediaId: 1 },
  } as unknown as Job;

  const mockPrisma = {
    media: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockStorage = {
    downloadToLocal: jest.fn().mockResolvedValue(undefined),
    uploadFile: jest.fn().mockResolvedValue('http://s3.url/file.m3u8'),
    getFileUrl: jest.fn((key) => `http://s3.url/${key}`),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TranscodeProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile();

    processor = module.get<TranscodeProcessor>(TranscodeProcessor);
    prisma = module.get<PrismaService>(PrismaService);
    storage = module.get<StorageService>(StorageService);

    jest.clearAllMocks();
  });

  it('should process video transcoding flow', async () => {
    mockPrisma.media.findUnique.mockResolvedValue({
      id: 1,
      url: 'http://minio:9000/bucket/raw/test.mp4',
    });

    await processor.process(mockJob);

    expect(prisma.media.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(storage.downloadToLocal).toHaveBeenCalled();

    // [FIX] Expectation disesuaikan dengan logic baru (menggunakan helper mock)
    expect(prisma.media.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          isTranscoded: true,
          hlsUrl: 'http://mock-hls/1/master.m3u8',
          thumbnailUrl: 'http://mock-thumb/1.jpg',
        }),
      }),
    );
  });

  it('should skip if job name is incorrect', async () => {
    const wrongJob = { name: 'wrong-job', data: {} } as Job;
    await processor.process(wrongJob);
    expect(prisma.media.findUnique).not.toHaveBeenCalled();
  });
});
