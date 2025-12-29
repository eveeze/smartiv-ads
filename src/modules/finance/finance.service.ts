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
import { CalculateCostDto } from './dto/calculate-cost.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { PageDto } from '../../common/dto/page.dto';
import { PageMetaDto } from '../../common/dto/page-meta.dto';
import {
  TransactionType,
  TransactionStatus,
  WithdrawalStatus,
  Prisma,
  User,
} from '@prisma/client';

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
      return this.prisma.wallet.create({
        data: { userId },
        include: { transactions: true },
      });
    }

    return {
      ...wallet,
      balance: Number(wallet.balance),
      frozenBalance: Number(wallet.frozenBalance),
      transactions: wallet.transactions.map((t) => ({
        ...t,
        amount: Number(t.amount),
      })),
    };
  }

  // --- RATE CARD ENGINE (NEW) ---
  async calculateCampaignCost(dto: CalculateCostDto) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    // Hitung selisih waktu dalam milidetik
    const diffTime = end.getTime() - start.getTime();
    // Konversi ke hari (round up agar 1 jam pun dihitung 1 hari sewa)
    const durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (durationDays <= 0) {
      throw new BadRequestException('Durasi campaign minimal 1 hari');
    }

    // Ambil data screen beserta Property & RateCard-nya (Eager Loading)
    const screens = await this.prisma.screen.findMany({
      where: { id: { in: dto.screenIds } },
      include: {
        property: {
          include: {
            rateCards: true,
          },
        },
      },
    });

    if (screens.length !== dto.screenIds.length) {
      throw new NotFoundException('Beberapa ID layar tidak ditemukan');
    }

    let totalCost = BigInt(0);
    const breakdown: Array<{
      screenId: number;
      screenName: string;
      dailyPrice: number;
      days: number;
      subtotal: number;
    }> = [];

    for (const screen of screens) {
      let dailyPrice = BigInt(0);

      // Hierarki Harga:
      // 1. Cek Override Price di level Screen (Spesifik)
      if (screen.priceOverride && screen.priceOverride > BigInt(0)) {
        dailyPrice = screen.priceOverride;
      }
      // 2. Cek Rate Card di level Property (berdasarkan Kelas Hotel)
      else {
        // Cari RateCard yang aktif dan sesuai klasifikasi properti
        const rateCard = screen.property.rateCards.find(
          (rc) =>
            rc.isActive && rc.classification === screen.property.classification,
        );

        if (rateCard) {
          dailyPrice = rateCard.pricePerDay;
        } else {
          // 3. Fallback Default (Safety Net)
          dailyPrice = BigInt(50000); // Default Rp 50.000
        }
      }

      const screenCost = dailyPrice * BigInt(durationDays);
      totalCost += screenCost;

      breakdown.push({
        screenId: screen.id,
        screenName: screen.name,
        dailyPrice: Number(dailyPrice),
        days: durationDays,
        subtotal: Number(screenCost),
      });
    }

    return {
      totalCost: Number(totalCost),
      durationDays,
      screenCount: screens.length,
      breakdown,
    };
  }

  // --- ADMIN DASHBOARD (NEW) ---
  async getAllTransactions(query: TransactionQueryDto) {
    // [FIX] Tambahkan default value (= 1, = 10) saat destructuring
    // Ini menjamin variabel page dan take selalu number (tidak undefined)
    const { type, page = 1, take = 10, order } = query;

    const where: Prisma.TransactionWhereInput = {};
    if (type) where.type = type;

    // Execute Query & Count in Parallel (Performance Optimization)
    const [transactions, itemCount] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          wallet: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
        skip: (page - 1) * take, // Aman karena page dan take pasti number
        take: take,
        orderBy: { createdAt: order },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto: query });

    const data = transactions.map((t) => ({
      ...t,
      amount: Number(t.amount), // Safe conversion for JSON
    }));

    return new PageDto(data, pageMetaDto);
  }

  // --- TOPUP FLOW ---
  async requestTopup(user: User, dto: CreateTopupDto) {
    const orderId = `TOPUP-${user.id}-${Date.now()}`;

    let wallet = await this.prisma.wallet.findUnique({
      where: { userId: user.id },
    });
    if (!wallet) {
      wallet = await this.prisma.wallet.create({ data: { userId: user.id } });
    }

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

    const midtransRes = await this.midtrans.createSnapTransaction({
      orderId: orderId,
      amount: dto.amount,
      customer: {
        firstName: user.name || 'Advertiser',
        email: user.email,
        phone: user.phone || undefined,
      },
    });

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
  async handleMidtransNotification(notification: unknown) {
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

    if (transactionStatus === 'capture') {
      if (fraudStatus === 'accept') {
        newStatus = TransactionStatus.SUCCESS;
      }
    } else if (transactionStatus === 'settlement') {
      newStatus = TransactionStatus.SUCCESS;
    } else if (
      transactionStatus === 'cancel' ||
      transactionStatus === 'deny' ||
      transactionStatus === 'expire'
    ) {
      newStatus = TransactionStatus.FAILED;
    }

    if (newStatus === TransactionStatus.SUCCESS) {
      // Atomic Transaction: Update Status & Increment Balance
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
      throw new BadRequestException('Saldo tidak mencukupi');
    }

    // Atomic: Freeze Balance & Create Request
    const result = await this.prisma.$transaction(async (tx) => {
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

    return { ...result, amount: Number(result.amount) };
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

    const result = await this.prisma.$transaction(async (tx) => {
      if (dto.approved) {
        // APPROVED: Potong Saldo Permanen & Catat Transaksi Keluar
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
        // REJECTED: Kembalikan Saldo Frozen ke Available
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

    return { ...result, amount: Number(result.amount) };
  }
}
