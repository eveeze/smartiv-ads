import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { MediaModule } from './modules/media/media.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { FinanceModule } from './modules/finance/finance.module';
import { PlayerModule } from './modules/player/player.module';
import { PrismaModule } from './providers/prisma/prisma.module';
import { StorageModule } from './providers/storage/storage.module';
import { QueueModule } from './providers/queue/queue.module';
import configuration, {
  validationSchema,
} from './config/configuration/configuration';

@Module({
  imports: [
    // Global Config Setup
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration], // Load factory function
      validationSchema: validationSchema, // Validate using Joi
    }),

    // Feature Modules
    AuthModule,
    InventoryModule,
    MediaModule,
    CampaignsModule,
    FinanceModule,
    PlayerModule,

    // Core Providers
    PrismaModule,
    StorageModule,
    QueueModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
