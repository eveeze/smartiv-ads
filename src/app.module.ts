import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { MediaModule } from './modules/media/media.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { FinanceModule } from './modules/finance/finance.module';
import { PlayerModule } from './modules/player/player.module';
import { InternalModule } from './modules/internal/internal.module';
import { PrismaService } from './providers/prisma/prisma.service';
import { StorageService } from './providers/storage/storage.service';
import { QueueService } from './providers/queue/queue.service';
import { PrismaModule } from './providers/prisma/prisma.module';
import { StorageModule } from './providers/storage/storage.module';
import { QueueModule } from './providers/queue/queue.module';

@Module({
  imports: [AuthModule, InventoryModule, MediaModule, CampaignsModule, FinanceModule, PlayerModule, InternalModule, PrismaModule, StorageModule, QueueModule],
  controllers: [AppController],
  providers: [AppService, PrismaService, StorageService, QueueService],
})
export class AppModule {}
