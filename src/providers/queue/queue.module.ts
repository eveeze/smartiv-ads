import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  QueueService,
  TELEMETRY_QUEUE,
  TRANSCODE_QUEUE,
} from './queue.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('redis.host'),
          port: config.get('redis.port'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      {
        name: TRANSCODE_QUEUE, // Queue Lama
      },
      {
        name: TELEMETRY_QUEUE, // [NEW] Queue Baru
      },
    ),
  ],
  providers: [QueueService],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
