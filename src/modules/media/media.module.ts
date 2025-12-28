import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { StorageModule } from '../../providers/storage/storage.module';
import { PrismaModule } from '../../providers/prisma/prisma.module'; // 1. Import PrismaModule
import { QueueModule } from '../../providers/queue/queue.module';
import { TranscodeProcessor } from './processors/transcode.processor';

@Module({
  imports: [
    StorageModule,
    QueueModule,
    PrismaModule, // 2. Masukkan ke imports array
  ],
  controllers: [MediaController],
  providers: [MediaService, TranscodeProcessor],
})
export class MediaModule {}
