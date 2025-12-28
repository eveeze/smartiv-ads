import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export const TRANSCODE_QUEUE = 'transcode-queue';
export const JOB_TRANSCODE_VIDEO = 'transcode-video';

@Injectable()
export class QueueService {
  constructor(@InjectQueue(TRANSCODE_QUEUE) private transcodeQueue: Queue) {}

  async addTranscodeJob(mediaId: number) {
    await this.transcodeQueue.add(
      JOB_TRANSCODE_VIDEO,
      { mediaId },
      {
        attempts: 3, // Retry 3 kali jika gagal
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true, // Hapus job dari Redis jika sukses (hemat memori)
        removeOnFail: false, // Simpan job gagal untuk debugging
      },
    );
  }
}
