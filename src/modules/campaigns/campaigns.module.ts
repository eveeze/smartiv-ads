import { Module } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { PrismaModule } from '../../providers/prisma/prisma.module';
import { FinanceModule } from '../finance/finance.module';
import { StorageModule } from '../../providers/storage/storage.module';

@Module({
  imports: [PrismaModule, FinanceModule, StorageModule],
  controllers: [CampaignsController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
