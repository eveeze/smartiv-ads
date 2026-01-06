import { Test, TestingModule } from '@nestjs/testing';
import { TranscodeProcessor } from './transcode.processor';
import { PrismaService } from '../../../providers/prisma/prisma.service';
import { StorageService } from '../../../providers/storage/storage.service';
import { Job } from 'bullmq';
import { JOB_TRANSCODE_VIDEO } from '../../../providers/queue/queue.service';
import { MediaUtils } from '../../../common/utils/media.utils';

// [FIX] Mocking MediaUtils Class Static Methods
jest.mock('../../../common/utils/media.utils', () => ({
  MediaUtils: {
    hasAudioStream: jest.fn().mockResolvedValue(true),
    getHlsUrl: jest.fn((id) => `http://mock/hls/${id}`),
    getThumbnailUrl: jest.fn((id) => `http://mock/thumb/${id}`),
  },
}));

// Mock Modules
jest.mock('fluent-ffmpeg', () => {
  return () => ({
    screenshots: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    addOptions: jest.fn().mockReturnThis(),
    on: jest.fn().mockImplementation((event, callback) => {
      if (event === 'end') callback(); // Simulate success
      return { run: jest.fn() };
    }),
  });
});

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  mkdtempSync: jest.fn().mockReturnValue('/tmp/mock-dir'),
  existsSync: jest.fn().mockReturnValue(false),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue(Buffer.from('mock')),
  readdirSync: jest.fn().mockReturnValue(['stream.m3u8']),
  statSync: jest.fn().mockReturnValue({ isDirectory: () => false }),
  rmSync: jest.fn(),
}));

describe('TranscodeProcessor', () => {
  let processor: TranscodeProcessor;
  let prisma: PrismaService;
  let storage: StorageService;

  const mockJob = {
    name: JOB_TRANSCODE_VIDEO,
    data: { mediaId: 1 },
  } as Job;

  const mockMedia = {
    id: 1,
    url: 'http://minio/bucket/raw/video.mp4',
  };

  const mockPrisma = {
    media: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockStorage = {
    downloadToLocal: jest.fn(),
    uploadFile: jest.fn(),
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

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should process video transcoding flow', async () => {
    mockPrisma.media.findUnique.mockResolvedValue(mockMedia);

    await processor.process(mockJob);

    // Verify Steps
    expect(prisma.media.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(storage.downloadToLocal).toHaveBeenCalled();
    // Verify FFmpeg & Upload (Implicit via Mocks)
    expect(storage.uploadFile).toHaveBeenCalled();

    // Verify Update DB
    expect(prisma.media.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        isTranscoded: true,
        hlsUrl: expect.stringContaining('http://mock/hls/1'),
        thumbnailUrl: expect.stringContaining('http://mock/thumb/1'),
      },
    });
  });
});
