import { Test, TestingModule } from '@nestjs/testing';
import { TranscodeProcessor } from './transcode.processor';
import { PrismaService } from '../../../providers/prisma/prisma.service';
import { StorageService } from '../../../providers/storage/storage.service';
import { Job } from 'bullmq';
import { JOB_TRANSCODE_VIDEO } from '../../../providers/queue/queue.service';

// ==========================================
// 1. DEFINISI TYPE-SAFE MOCK INTERFACES
// ==========================================

// Helper types untuk menghindari 'any'
type MockAsync<T> = jest.Mock<Promise<T>>;

// Interface Mock untuk Prisma
interface MockPrismaService {
  media: {
    findUnique: MockAsync<{ id: number; url: string } | null>;
    update: MockAsync<void>;
  };
}

// Interface Mock untuk Storage
interface MockStorageService {
  downloadToLocal: MockAsync<string>;
  uploadFile: MockAsync<void>;
}

// ==========================================
// 2. MOCKING EXTERNAL MODULES (Strict)
// ==========================================

// Mock MediaUtils Static Methods
jest.mock('../../../common/utils/media.utils', () => ({
  MediaUtils: {
    hasAudioStream: jest.fn().mockResolvedValue(true),
    getHlsUrl: jest.fn((id: number) => `http://mock/hls/${id}`),
    getThumbnailUrl: jest.fn((id: number) => `http://mock/thumb/${id}`),
  },
}));

// Mock fluent-ffmpeg
jest.mock('fluent-ffmpeg', () => {
  return () => ({
    screenshots: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    addOptions: jest.fn().mockReturnThis(),
    on: jest.fn().mockImplementation((event: string, callback: () => void) => {
      if (event === 'end') callback(); // Simulate success
      // [FIX] Return object with strict run type to avoid unsafe return
      return { run: jest.fn<void, []>() };
    }),
  });
});

// Mock fs module
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

// ==========================================
// 3. TEST SUITE
// ==========================================

describe('TranscodeProcessor', () => {
  let processor: TranscodeProcessor;

  // [FIX] Initialize mock functions with explicit Generic Types
  // Ini memberitahu TypeScript tipe data return value sejak awal
  const mockPrisma: MockPrismaService = {
    media: {
      findUnique: jest.fn<Promise<{ id: number; url: string } | null>, []>(),
      update: jest.fn<Promise<void>, []>(),
    },
  };

  const mockStorage: MockStorageService = {
    downloadToLocal: jest.fn<Promise<string>, []>(),
    uploadFile: jest.fn<Promise<void>, []>(),
  };

  // [FIX] Typing pada Job Data dengan 'as unknown as' untuk memuaskan strict type checking
  // karena Job memiliki constructor private/protected yang sulit dimock langsung
  const mockJob = {
    name: JOB_TRANSCODE_VIDEO,
    data: { mediaId: 1 },
  } as unknown as Job<{ mediaId: number }>;

  const mockMedia = {
    id: 1,
    url: 'http://minio/bucket/raw/video.mp4',
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
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should process video transcoding flow', async () => {
    mockPrisma.media.findUnique.mockResolvedValue(mockMedia);

    await processor.process(mockJob);

    // Verify Steps
    expect(mockPrisma.media.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
    });
    expect(mockStorage.downloadToLocal).toHaveBeenCalled();
    // Verify FFmpeg & Upload (Implicit via Mocks)
    expect(mockStorage.uploadFile).toHaveBeenCalled();

    // Verify Update DB
    expect(mockPrisma.media.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        isTranscoded: true,
        // [FIX] Casting matchers ke string karena DTO Prisma mengharapkan string murni
        // Menggunakan 'as unknown as string' adalah cara standar Jest untuk type matching
        hlsUrl: expect.stringContaining(
          'http://mock/hls/1',
        ) as unknown as string,
        thumbnailUrl: expect.stringContaining(
          'http://mock/thumb/1',
        ) as unknown as string,
      },
    });
  });
});
