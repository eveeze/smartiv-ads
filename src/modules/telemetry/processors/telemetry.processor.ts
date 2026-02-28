import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../providers/prisma/prisma.service';
import {
  TELEMETRY_QUEUE,
  JOB_LOG_IMPRESSION,
} from '../../../providers/queue/queue.service';
import type { ImpressionItemDto } from '../dto/create-impression.dto';

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
      // Validasi Screen + get property info in one query
      const screen = await this.prisma.screen.findUnique({
        where: { id: screenId },
        select: {
          id: true,
          propertyId: true,
          property: {
            select: { revenueSharePercentage: true },
          },
        },
      });

      if (!screen) {
        this.logger.warn(`Screen ID ${screenId} not found, skipping logs.`);
        return;
      }

      // Build insertion data — O(n) mapping
      const dataToInsert = impressions.map((imp) => ({
        screenId,
        campaignId: imp.campaignId,
        timestamp: new Date(imp.timestamp),
        duration: imp.duration,
      }));

      // Bulk Insert using createMany — O(1) roundtrip DB
      await this.prisma.impressionLog.createMany({
        data: dataToInsert,
        skipDuplicates: true,
      });

      this.logger.log(
        `✅ Processed ${impressions.length} logs for Screen ${screenId}`,
      );

      // [Phase 13] Revenue Share Calculation (Background, non-blocking)
      await this.calculateRevenueShare(
        screen.propertyId,
        screen.property.revenueSharePercentage,
        impressions,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process telemetry: ${msg}`);
      throw error; // Let BullMQ handle retry
    }
  }

  /**
   * [Phase 13] Calculate and accumulate publisher revenue share.
   * Uses upsert with daily accumulation to minimize DB rows.
   * Revenue = (totalCost / durationDays / screenCount) * sharePercentage per impression batch
   */
  private async calculateRevenueShare(
    propertyId: number,
    sharePercentage: number,
    impressions: ImpressionItemDto[],
  ): Promise<void> {
    if (sharePercentage <= 0) return; // No revenue share configured

    try {
      // Get unique campaign IDs from this batch
      const campaignIds = [
        ...new Set(impressions.map((imp) => imp.campaignId)),
      ];

      // Fetch campaign costs in bulk (O(1) roundtrip)
      const campaigns = await this.prisma.campaign.findMany({
        where: { id: { in: campaignIds } },
        select: {
          id: true,
          totalCost: true,
          startDate: true,
          endDate: true,
          _count: { select: { screens: true } },
        },
      });

      // Build a Map for O(1) campaign lookup
      const campaignMap = new Map(campaigns.map((c) => [c.id, c]));

      // Calculate total revenue for this batch
      let batchRevenue = BigInt(0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const imp of impressions) {
        const campaign = campaignMap.get(imp.campaignId);
        if (!campaign || campaign._count.screens === 0) continue;

        const durationMs =
          campaign.endDate.getTime() - campaign.startDate.getTime();
        const durationDays = Math.max(
          1,
          Math.ceil(durationMs / (1000 * 60 * 60 * 24)),
        );

        // CPM per screen per day = totalCost / durationDays / screenCount
        const dailyCpmPerScreen =
          campaign.totalCost /
          BigInt(durationDays) /
          BigInt(campaign._count.screens);

        // Share = dailyCpmPerScreen * sharePercentage / impressions-per-day (estimated)
        // Simplified: revenue per impression = dailyCPM * share% / 1000 (CPM model)
        const revenuePerImpression =
          (dailyCpmPerScreen * BigInt(Math.round(sharePercentage * 100))) /
          BigInt(10000);

        batchRevenue += revenuePerImpression;
      }

      if (batchRevenue <= BigInt(0)) return;

      // Upsert PublisherLedger — accumulate per day (avoids row explosion)
      await this.prisma.publisherLedger.upsert({
        where: {
          propertyId_date: {
            propertyId,
            date: today,
          },
        },
        create: {
          propertyId,
          date: today,
          totalImpressions: impressions.length,
          totalRevenue: batchRevenue,
        },
        update: {
          totalImpressions: { increment: impressions.length },
          totalRevenue: { increment: batchRevenue },
        },
      });

      this.logger.debug(
        `Revenue share calculated for property ${propertyId}: +${batchRevenue.toString()} IDR`,
      );
    } catch (error) {
      // Revenue calculation failure is non-critical — don't fail the job
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Revenue share calculation failed (non-critical): ${msg}`,
      );
    }
  }
}
