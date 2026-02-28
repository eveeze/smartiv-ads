import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Param,
  Patch,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import { CreateTopupDto } from './dto/create-topup.dto';
import { WithdrawalRequestDto } from './dto/withdrawal-request.dto';
import { ReviewWithdrawalDto } from './dto/review-withdrawal.dto';
import { CalculateCostDto } from './dto/calculate-cost.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { PublisherReportQueryDto } from './dto/publisher-report-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles/roles.guard';
import { Roles } from '../../common/decorators/roles/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user/current-user.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { User } from '@prisma/client';

@ApiTags('Finance (Wallet & Payment)')
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // --- HELPER (CALCULATOR) ---

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('calculate-cost')
  @ApiOperation({ summary: 'Hitung Estimasi Biaya Campaign (Rate Card)' })
  calculateCost(@Body() dto: CalculateCostDto) {
    return this.financeService.calculateCampaignCost(dto);
  }

  // --- ADVERTISER ENDPOINTS ---

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('wallet')
  @ApiOperation({ summary: 'Get My Wallet Balance & History' })
  getMyWallet(@CurrentUser() user: User) {
    return this.financeService.getMyWallet(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADVERTISER)
  @Post('topup')
  @ApiOperation({ summary: 'Request Topup (Get Midtrans Token)' })
  requestTopup(@CurrentUser() user: User, @Body() dto: CreateTopupDto) {
    return this.financeService.requestTopup(user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADVERTISER)
  @Post('withdrawal')
  @ApiOperation({ summary: 'Request Balance Withdrawal' })
  requestWithdrawal(
    @CurrentUser() user: User,
    @Body() dto: WithdrawalRequestDto,
  ) {
    return this.financeService.requestWithdrawal(user, dto);
  }

  // --- PUBLIC WEBHOOK ---

  @Post('webhook/midtrans')
  @ApiOperation({ summary: 'Midtrans Notification Webhook' })
  handleMidtransWebhook(@Body() notification: unknown) {
    return this.financeService.handleMidtransNotification(notification);
  }

  // --- ADMIN ENDPOINTS ---

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Get('admin/transactions')
  @ApiOperation({ summary: 'Get All System Transactions (Audit Log)' })
  getAllTransactions(@Query() query: TransactionQueryDto) {
    return this.financeService.getAllTransactions(query);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Get('admin/withdrawals')
  @ApiOperation({ summary: 'Get Pending Withdrawals' })
  getPendingWithdrawals() {
    return this.financeService.getPendingWithdrawals();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Patch('admin/withdrawals/:id/review')
  @ApiOperation({ summary: 'Approve/Reject Withdrawal' })
  reviewWithdrawal(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewWithdrawalDto,
    @CurrentUser() admin: User,
  ) {
    return this.financeService.reviewWithdrawal(id, dto, admin.id);
  }

  // --- PUBLISHER (OPERATOR) ENDPOINTS ---

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROPERTY_OPERATOR, Role.SUPER_ADMIN)
  @Get('publisher/report')
  @ApiOperation({
    summary: 'Get publisher revenue report (Daily breakdown)',
  })
  getPublisherReport(
    @CurrentUser() user: User,
    @Query() query: PublisherReportQueryDto,
  ) {
    return this.financeService.getPublisherReport(user, query);
  }
}
