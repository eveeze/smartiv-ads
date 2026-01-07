import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

// --- Constants: Transcode (LAMA) ---
export const TRANSCODE_QUEUE = 'transcode-queue';
export const JOB_TRANSCODE_VIDEO = 'transcode-video';

// --- Constants: Telemetry (BARU) ---
export const TELEMETRY_QUEUE = 'telemetry-queue';
export const JOB_LOG_IMPRESSION = 'log-impression';

@Injectable()
export class QueueService {
  constructor(
    // Inject Queue Transcode (LAMA)
    @InjectQueue(TRANSCODE_QUEUE) private transcodeQueue: Queue,
    // Inject Queue Telemetry (BARU)
    @InjectQueue(TELEMETRY_QUEUE) private telemetryQueue: Queue,
  ) {}

  async addTranscodeJob(mediaId: number) {
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

  // --- Telemetry Job (BARU) ---
  async addImpressionJob(payload: any) {
    await this.telemetryQueue.add(JOB_LOG_IMPRESSION, payload, {
      removeOnComplete: true,
      removeOnFail: 1000,
    });
  }
}
