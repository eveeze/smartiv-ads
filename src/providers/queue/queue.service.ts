import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { ImpressionItemDto } from '../../modules/telemetry/dto/create-impression.dto';

// --- Constants: Transcode ---
export const TRANSCODE_QUEUE = 'transcode-queue';
export const JOB_TRANSCODE_VIDEO = 'transcode-video';

// --- Constants: Telemetry ---
export const TELEMETRY_QUEUE = 'telemetry-queue';
export const JOB_LOG_IMPRESSION = 'log-impression';

// --- Type-safe Payload Interfaces ---
export interface TelemetryJobPayload {
  screenId: number;
  impressions: ImpressionItemDto[];
  receivedAt: Date;
}

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(TRANSCODE_QUEUE) private readonly transcodeQueue: Queue,
    @InjectQueue(TELEMETRY_QUEUE) private readonly telemetryQueue: Queue,
  ) {}

  async addTranscodeJob(mediaId: number): Promise<void> {
    await this.transcodeQueue.add(
      JOB_TRANSCODE_VIDEO,
      { mediaId },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  async addImpressionJob(payload: TelemetryJobPayload): Promise<void> {
    await this.telemetryQueue.add(JOB_LOG_IMPRESSION, payload, {
      removeOnComplete: true,
      removeOnFail: 1000,
    });
  }
}
