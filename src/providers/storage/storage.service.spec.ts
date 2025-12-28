import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { ConfigService } from '@nestjs/config';

describe('StorageService', () => {
  let service: StorageService;

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'minio.bucket') return 'test-bucket';
      if (key === 'minio.endpoint') return 'http://localhost:9000';
      return 'key';
    }),
    get: jest.fn().mockReturnValue('http://localhost:9000'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
