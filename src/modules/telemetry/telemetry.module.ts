import { Module } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { TelemetryController } from './telemetry.controller';
import { TelemetryProcessor } from './processors/telemetry.processor';
import { QueueModule } from '../../providers/queue/queue.module';
import { PrismaModule } from '../../providers/prisma/prisma.module';

@Module({
  imports: [QueueModule, PrismaModule],
  controllers: [TelemetryController],
  providers: [TelemetryService, TelemetryProcessor],
})
export class TelemetryModule {}
