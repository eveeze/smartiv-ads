import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { StorageModule } from '../../providers/storage/storage.module';
import { PrismaModule } from '../../providers/prisma/prisma.module';
import { QueueModule } from '../../providers/queue/queue.module';
import { TranscodeProcessor } from './processors/transcode.processor';
import { PlacementService } from './placement.service';

@Module({
  imports: [StorageModule, QueueModule, PrismaModule],
  controllers: [MediaController],
  providers: [MediaService, TranscodeProcessor, PlacementService],
  exports: [PlacementService],
})
export class MediaModule {}
