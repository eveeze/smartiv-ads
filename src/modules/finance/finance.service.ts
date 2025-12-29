import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { MidtransService } from '../../providers/payment/midtrans.service';
import { CreateTopupDto } from './dto/create-topup.dto';
import { WithdrawalRequestDto } from './dto/withdrawal-request.dto';
import { ReviewWithdrawalDto } from './dto/review-withdrawal.dto';
import {
  TransactionType,
  TransactionStatus,
  WithdrawalStatus,
} from '@prisma/client';
import { User } from '@prisma/client';

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly midtrans: MidtransService,
  ) {}

  // --- WALLET INFO ---
  async getMyWallet(userId: number) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: {
        transactions: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!wallet) {
      // Auto create if not exists (fallback mechanism)
      return this.prisma.wallet.create({
        data: { userId },
      });
    }

    return {
      ...wallet,
      balance: Number(wallet.balance), // Convert BigInt to Number for JSON
      frozenBalance: Number(wallet.frozenBalance),
    };
  }

  // --- TOPUP FLOW ---
  async requestTopup(user: User, dto: CreateTopupDto) {
    const orderId = `TOPUP-${user.id}-${Date.now()}`;

    // 1. Pastikan Wallet Ada
    let wallet = await this.prisma.wallet.findUnique({
      where: { userId: user.id },
    });
    if (!wallet) {
      wallet = await this.prisma.wallet.create({ data: { userId: user.id } });
    }

    // 2. Buat Record Transaction PENDING
    const transaction = await this.prisma.transaction.create({
      data: {
        walletId: wallet.id,
        amount: BigInt(dto.amount),
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.PENDING,
        referenceCode: orderId,
        description: 'Topup via Midtrans',
      },
    });

    // 3. Request Token ke Midtrans
    const midtransRes = await this.midtrans.createSnapTransaction({
      orderId: orderId,
      amount: dto.amount,
      customer: {
        firstName: user.name || 'Advertiser',
        email: user.email,
        phone: user.phone || undefined,
      },
    });

    // 4. Update Transaction dengan Token
    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        paymentToken: midtransRes.token,
        paymentUrl: midtransRes.redirectUrl,
      },
    });

    return {
      transactionId: transaction.id,
      orderId,
      token: midtransRes.token,
      redirectUrl: midtransRes.redirectUrl,
    };
  }

  // --- WEBHOOK HANDLER ---
  async handleMidtransNotification(notification: any) {
    const statusResponse = await this.midtrans.verifyNotification(notification);
    const orderId = statusResponse.order_id;
    const transactionStatus = statusResponse.transaction_status;
    const fraudStatus = statusResponse.fraud_status;

    this.logger.log(
      `Webhook: ${orderId} | Status: ${transactionStatus} | Fraud: ${fraudStatus}`,
    );

    const transaction = await this.prisma.transaction.findUnique({
      where: { referenceCode: orderId },
      include: { wallet: true },
    });

    if (!transaction) throw new NotFoundException('Transaction not found');
    if (transaction.status === TransactionStatus.SUCCESS) {
      return { status: 'ok', message: 'Already processed' };
    }

    let newStatus: TransactionStatus | null = null;

    // Logic Status Midtrans
    if (transactionStatus == 'capture') {
      if (fraudStatus == 'challenge') {
        // Challenge -> Manual Review needed (Ignore for now)
      } else if (fraudStatus == 'accept') {
        newStatus = TransactionStatus.SUCCESS;
      }
    } else if (transactionStatus == 'settlement') {
      newStatus = TransactionStatus.SUCCESS;
    } else if (
      transactionStatus == 'cancel' ||
      transactionStatus == 'deny' ||
      transactionStatus == 'expire'
    ) {
      newStatus = TransactionStatus.FAILED;
    }

    if (newStatus === TransactionStatus.SUCCESS) {
      // ATOMIC: Update Status & Tambah Saldo
      await this.prisma.$transaction([
        this.prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: TransactionStatus.SUCCESS },
        }),
        this.prisma.wallet.update({
          where: { id: transaction.walletId },
          data: {
            balance: { increment: transaction.amount },
          },
        }),
      ]);
      this.logger.log(`✅ Topup Success: ${orderId}`);
    } else if (newStatus === TransactionStatus.FAILED) {
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: TransactionStatus.FAILED },
      });
      this.logger.warn(`❌ Topup Failed: ${orderId}`);
    }

    return { status: 'ok' };
  }

  // --- WITHDRAWAL FLOW ---
  async requestWithdrawal(user: User, dto: WithdrawalRequestDto) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: user.id },
    });

    if (!wallet) throw new BadRequestException('Wallet not found');

    const amountBig = BigInt(dto.amount);
    const available = wallet.balance - wallet.frozenBalance;

    if (available < amountBig) {
      throw new BadRequestException('Insufficient available balance');
    }

    // ATOMIC: Freeze Balance & Create Request
    return this.prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { frozenBalance: { increment: amountBig } },
      });

      return tx.withdrawalRequest.create({
        data: {
          walletId: wallet.id,
          amount: amountBig,
          bankName: dto.bankName,
          accountNo: dto.accountNo,
          accountName: dto.accountName,
          status: WithdrawalStatus.PENDING,
        },
      });
    });
  }

  // Admin Only
  async getPendingWithdrawals() {
    const requests = await this.prisma.withdrawalRequest.findMany({
      where: { status: WithdrawalStatus.PENDING },
      include: {
        wallet: { include: { user: { select: { name: true, email: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Convert BigInt for JSON safety
    return requests.map((req) => ({
      ...req,
      amount: Number(req.amount),
    }));
  }

  // Admin Only
  async reviewWithdrawal(
    requestId: number,
    dto: ReviewWithdrawalDto,
    adminId: number,
  ) {
    const request = await this.prisma.withdrawalRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException('Invalid request ID or status');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.approved) {
        // APPROVED: Deduct balance permanen, Release frozen, Create Transaction Log
        await tx.wallet.update({
          where: { id: request.walletId },
          data: {
            balance: { decrement: request.amount },
            frozenBalance: { decrement: request.amount },
          },
        });

        await tx.transaction.create({
          data: {
            walletId: request.walletId,
            amount: request.amount,
            type: TransactionType.WITHDRAWAL,
            status: TransactionStatus.SUCCESS,
            description: `Withdrawal Approved. Note: ${dto.adminNote || '-'}`,
            referenceCode: `WD-${requestId}`,
          },
        });

        return tx.withdrawalRequest.update({
          where: { id: requestId },
          data: {
            status: WithdrawalStatus.APPROVED,
            approvedBy: adminId,
            adminNote: dto.adminNote,
          },
        });
      } else {
        // REJECTED: Release frozen back to balance
        await tx.wallet.update({
          where: { id: request.walletId },
          data: {
            frozenBalance: { decrement: request.amount },
          },
        });

        return tx.withdrawalRequest.update({
          where: { id: requestId },
          data: {
            status: WithdrawalStatus.REJECTED,
            approvedBy: adminId,
            adminNote: dto.adminNote,
          },
        });
      }
    });
  }
}
