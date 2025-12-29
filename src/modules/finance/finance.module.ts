import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { PrismaModule } from '../../providers/prisma/prisma.module';
import { PaymentModule } from '../../providers/payment/payment.module';

@Module({
  imports: [PrismaModule, PaymentModule],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
