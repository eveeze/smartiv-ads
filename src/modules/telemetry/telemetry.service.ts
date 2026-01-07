import { Injectable, Logger } from '@nestjs/common';
// [FIX] Gunakan relative path agar Jest bisa membaca module ini dengan aman
import { QueueService } from '../../../src/providers/queue/queue.service';
import { CreateImpressionLogDto } from './dto/create-impression.dto';

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(private readonly queueService: QueueService) {}

  async ingestImpressions(screenId: number, dto: CreateImpressionLogDto) {
    const payload = {
      screenId,
      impressions: dto.impressions,
      receivedAt: new Date(),
    };

    await this.queueService.addImpressionJob(payload);

    this.logger.debug(
      `Queued ${dto.impressions.length} impressions for Screen ${screenId}`,
    );

    return { success: true, queued: dto.impressions.length };
  }
}
