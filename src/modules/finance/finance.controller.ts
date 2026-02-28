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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiStandardErrors } from '../../common/decorators/api-errors.decorator';
import {
  CalculateCostResponseDto,
  WalletDetailDto,
  TopupResponseDto,
  WithdrawalResponseDto,
  TransactionResponseDto,
  MessageResponseDto,
  PublisherReportDto,
} from '../../common/dto/api-response.dto';
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
  @ApiOperation({
    summary: 'Hitung Estimasi Biaya Campaign (Rate Card)',
    description:
      'Calculates the estimated campaign cost based on selected property, slot, and duration. Does not create any transaction.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns estimated cost breakdown.',
    type: CalculateCostResponseDto,
  })
  @ApiStandardErrors({
    badRequest: 'Invalid calculation parameters.',
    forbidden: false,
    notFound: 'No matching rate card found.',
  })
  calculateCost(@Body() dto: CalculateCostDto) {
    return this.financeService.calculateCampaignCost(dto);
  }

  // --- ADVERTISER ENDPOINTS ---

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('wallet')
  @ApiOperation({
    summary: 'Get My Wallet Balance & History',
    description:
      'Returns the current wallet balance and recent transaction history for the logged-in user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet object with balance and transactions.',
    type: WalletDetailDto,
  })
  @ApiStandardErrors({ badRequest: false, forbidden: false, notFound: false })
  getMyWallet(@CurrentUser() user: User) {
    return this.financeService.getMyWallet(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADVERTISER)
  @Post('topup')
  @ApiOperation({
    summary: 'Request Topup (Get Midtrans Token)',
    description:
      'Creates a top-up request and returns a Midtrans payment token/redirect URL for the user to complete payment.',
  })
  @ApiResponse({
    status: 201,
    description: 'Returns Midtrans snap token and redirect URL.',
    type: TopupResponseDto,
  })
  @ApiStandardErrors({
    badRequest: 'Invalid topup amount (must be > 0).',
    notFound: false,
  })
  requestTopup(@CurrentUser() user: User, @Body() dto: CreateTopupDto) {
    return this.financeService.requestTopup(user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADVERTISER)
  @Post('withdrawal')
  @ApiOperation({
    summary: 'Request Balance Withdrawal',
    description:
      'Creates a withdrawal request. Admin approval is required before funds are released.',
  })
  @ApiResponse({
    status: 201,
    description: 'Withdrawal request created (pending admin review).',
    type: WithdrawalResponseDto,
  })
  @ApiStandardErrors({
    badRequest: 'Insufficient wallet balance or invalid amount.',
    notFound: false,
  })
  requestWithdrawal(
    @CurrentUser() user: User,
    @Body() dto: WithdrawalRequestDto,
  ) {
    return this.financeService.requestWithdrawal(user, dto);
  }

  // --- PUBLIC WEBHOOK ---

  @Post('webhook/midtrans')
  @ApiOperation({
    summary: 'Midtrans Notification Webhook',
    description:
      'Receives payment status notifications from Midtrans. This is called by Midtrans servers, not by the frontend.',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed.',
    type: MessageResponseDto,
  })
  @ApiStandardErrors({
    badRequest: false,
    unauthorized: false,
    forbidden: false,
    notFound: false,
  })
  handleMidtransWebhook(@Body() notification: unknown) {
    return this.financeService.handleMidtransNotification(notification);
  }

  // --- ADMIN ENDPOINTS ---

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Get('admin/transactions')
  @ApiOperation({
    summary: 'Get All System Transactions (Audit Log)',
    description:
      'Returns all financial transactions across the platform. Supports filtering by type and pagination.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of transactions.',
    type: [TransactionResponseDto],
  })
  @ApiStandardErrors({ badRequest: false, notFound: false })
  getAllTransactions(@Query() query: TransactionQueryDto) {
    return this.financeService.getAllTransactions(query);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Get('admin/withdrawals')
  @ApiOperation({
    summary: 'Get Pending Withdrawals',
    description: 'Returns all withdrawal requests awaiting admin approval.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of pending withdrawal requests.',
    type: [WithdrawalResponseDto],
  })
  @ApiStandardErrors({ badRequest: false, notFound: false })
  getPendingWithdrawals() {
    return this.financeService.getPendingWithdrawals();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Patch('admin/withdrawals/:id/review')
  @ApiOperation({
    summary: 'Approve/Reject Withdrawal',
    description:
      'Admin approves or rejects a pending withdrawal request. Approved withdrawals deduct the wallet balance.',
  })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal reviewed (approved or rejected).',
    type: WithdrawalResponseDto,
  })
  @ApiStandardErrors({
    badRequest: 'Withdrawal is not in PENDING status.',
    notFound: 'Withdrawal request not found.',
  })
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
    description:
      'Returns earnings breakdown for the property operator. Includes total earning, daily breakdown, and revenue share percentage.',
  })
  @ApiResponse({
    status: 200,
    description: 'Publisher revenue report object.',
    type: PublisherReportDto,
  })
  @ApiStandardErrors({
    badRequest: false,
    notFound: 'Operator not assigned to any property.',
  })
  getPublisherReport(
    @CurrentUser() user: User,
    @Query() query: PublisherReportQueryDto,
  ) {
    return this.financeService.getPublisherReport(user, query);
  }
}
