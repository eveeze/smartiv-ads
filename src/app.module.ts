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
import { UsersModule } from './modules/users/users.module';
import configuration, {
  validationSchema,
} from './config/configuration/configuration';
import { TelemetryModule } from './modules/telemetry/telemetry.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { MailModule } from './modules/mail/mail.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    // Global Config Setup
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: validationSchema,
    }),

    // Feature Modules
    AuthModule,
    InventoryModule,
    MediaModule,
    CampaignsModule,
    FinanceModule,
    PlayerModule,
    DashboardModule,

    // Core Providers
    PrismaModule,
    StorageModule,
    QueueModule,
    UsersModule,
    TelemetryModule,
    AnalyticsModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
