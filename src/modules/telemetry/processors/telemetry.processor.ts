import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../providers/prisma/prisma.service';
import {
  TELEMETRY_QUEUE,
  JOB_LOG_IMPRESSION,
} from '../../../providers/queue/queue.service';
import { ImpressionItemDto } from '../dto/create-impression.dto';

interface TelemetryJobData {
  screenId: number;
  impressions: ImpressionItemDto[];
  receivedAt: Date;
}

@Processor(TELEMETRY_QUEUE)
export class TelemetryProcessor extends WorkerHost {
  private readonly logger = new Logger(TelemetryProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<TelemetryJobData>): Promise<void> {
    if (job.name !== JOB_LOG_IMPRESSION) return;

    const { screenId, impressions } = job.data;

    if (!impressions || impressions.length === 0) return;

    try {
      // Validasi Screen (Optional: bisa diskip jika kita percaya auth guard)
      const screenExists = await this.prisma.screen.count({
        where: { id: screenId },
      });
      if (!screenExists) {
        this.logger.warn(`Screen ID ${screenId} not found, skipping logs.`);
        return;
      }

      // Bulk Insert menggunakan createMany (Sangat Cepat - O(1) roundtrip DB)
      // Map data DTO ke format Database Schema
      const dataToInsert = impressions.map((imp) => ({
        screenId,
        campaignId: imp.campaignId,
        timestamp: new Date(imp.timestamp),
        duration: imp.duration,
      }));

      // createMany lebih performan daripada loop create()
      await this.prisma.impressionLog.createMany({
        data: dataToInsert,
        skipDuplicates: true, // Safety mechanism
      });

      this.logger.log(
        `✅ Processed ${impressions.length} logs for Screen ${screenId}`,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process telemetry: ${msg}`);
      throw error; // Biarkan BullMQ menghandle retry
    }
  }
}
