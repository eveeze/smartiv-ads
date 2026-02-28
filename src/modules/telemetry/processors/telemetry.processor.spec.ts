import { Test, TestingModule } from '@nestjs/testing';
import { TelemetryProcessor } from './telemetry.processor';
import { PrismaService } from '../../../providers/prisma/prisma.service';
import { Job } from 'bullmq';
import { JOB_LOG_IMPRESSION } from '../../../providers/queue/queue.service';

describe('TelemetryProcessor', () => {
  let processor: TelemetryProcessor;

  const mockPrisma = {
    screen: {
      findUnique: jest.fn(),
    },
    impressionLog: {
      createMany: jest.fn(),
    },
    campaign: {
      findMany: jest.fn(),
    },
    publisherLedger: {
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelemetryProcessor,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    processor = module.get<TelemetryProcessor>(TelemetryProcessor);
    jest.clearAllMocks();
  });

  describe('process', () => {
    it('should skip processing if job name is not JOB_LOG_IMPRESSION', async () => {
      const job = { name: 'OTHER_JOB', data: {} } as Job;
      await processor.process(job);

      expect(mockPrisma.screen.findUnique).not.toHaveBeenCalled();
    });

    it('should skip processing if impressions array is empty', async () => {
      const job = {
        name: JOB_LOG_IMPRESSION,
        data: { screenId: 1, impressions: [] },
      } as unknown as Job;
      await processor.process(job);

      expect(mockPrisma.screen.findUnique).not.toHaveBeenCalled();
    });

    it('should log impressions and calculate revenue share', async () => {
      const job = {
        name: JOB_LOG_IMPRESSION,
        data: {
          screenId: 1,
          impressions: [
            { campaignId: 100, timestamp: new Date(), duration: 15 },
          ],
        },
      } as unknown as Job;

      mockPrisma.screen.findUnique.mockResolvedValue({
        id: 1,
        propertyId: 10,
        property: { revenueSharePercentage: 0.2 }, // 20%
      });

      mockPrisma.impressionLog.createMany.mockResolvedValue({ count: 1 });

      mockPrisma.campaign.findMany.mockResolvedValue([
        {
          id: 100,
          totalCost: 1000000n,
          startDate: new Date('2026-05-01'),
          endDate: new Date('2026-05-10'), // 9 days
          _count: { screens: 10 },
        },
      ]);

      mockPrisma.publisherLedger.upsert.mockResolvedValue({ id: 1 });

      await processor.process(job);

      expect(mockPrisma.screen.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: expect.any(Object),
      });

      expect(mockPrisma.impressionLog.createMany).toHaveBeenCalledWith({
        data: expect.any(Array),
        skipDuplicates: true,
      });

      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith({
        where: { id: { in: [100] } },
        select: expect.any(Object),
      });

      expect(mockPrisma.publisherLedger.upsert).toHaveBeenCalled();
    });

    it('should not calculate revenue share if percentage is 0', async () => {
      const job = {
        name: JOB_LOG_IMPRESSION,
        data: {
          screenId: 1,
          impressions: [
            { campaignId: 100, timestamp: new Date(), duration: 15 },
          ],
        },
      } as unknown as Job;

      mockPrisma.screen.findUnique.mockResolvedValue({
        id: 1,
        propertyId: 10,
        property: { revenueSharePercentage: 0 }, // 0%
      });

      mockPrisma.impressionLog.createMany.mockResolvedValue({ count: 1 });

      await processor.process(job);

      expect(mockPrisma.impressionLog.createMany).toHaveBeenCalled();
      expect(mockPrisma.campaign.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.publisherLedger.upsert).not.toHaveBeenCalled();
    });
  });
});
