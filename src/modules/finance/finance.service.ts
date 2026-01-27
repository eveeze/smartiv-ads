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
import { FinanceUtils } from '../../common/utils/finance.utils';
import {
  TransactionType,
  TransactionStatus,
  WithdrawalStatus,
  Prisma,
  User,
  Wallet,
  Transaction,
  DurationPackage,
  ScreenStatus,
  RateCard,
} from '@prisma/client';

// Helper Type
interface MidtransNotification {
  order_id: string;
  transaction_status: string;
  fraud_status?: string;
}

type WalletWithTransactions = Wallet & { transactions: Transaction[] };

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
      const newWallet = await this.prisma.wallet.create({
        data: { userId },
        include: { transactions: true },
      });
      return this.formatWallet(newWallet as WalletWithTransactions);
    }

    return this.formatWallet(wallet as WalletWithTransactions);
  }

  private formatWallet(wallet: WalletWithTransactions) {
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

  // ===========================================================================
  // [REVISED] RATE CARD ENGINE (PHASE 2)
  // Logic: Harga = (Harga Paket Slot) x (Jumlah Screen Aktif)
  // ===========================================================================
  async calculateCampaignCost(dto: CalculateCostDto) {
    const { propertyId, targetSlot, durationPackage, startDate, endDate } = dto;
    const start = new Date(startDate);

    // 1. Hitung Durasi (Hari)
    let durationDays = 1;
    if (durationPackage === DurationPackage.CUSTOM) {
      if (!endDate)
        throw new BadRequestException(
          'End date is required for CUSTOM package',
        );
      const end = new Date(endDate);
      const diffTime = end.getTime() - start.getTime();
      durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } else if (durationPackage === DurationPackage.WEEKLY) {
      durationDays = 7;
    } else if (durationPackage === DurationPackage.MONTHLY) {
      durationDays = 30;
    }

    if (durationDays <= 0) {
      throw new BadRequestException('Durasi campaign minimal 1 hari');
    }

    // 2. Validasi Properti & Hitung Inventory (Screen Aktif)
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        _count: {
          select: {
            screens: {
              where: { status: ScreenStatus.ONLINE }, // Hanya hitung screen yang ONLINE
            },
          },
        },
      },
    });

    if (!property) throw new NotFoundException('Property not found');

    const activeScreenCount = property._count.screens;
    if (activeScreenCount === 0) {
      throw new BadRequestException(
        'Property ini tidak memiliki layar aktif (ONLINE)',
      );
    }

    // 3. Cari Rate Card yang Sesuai
    // Prioritas 1: Rate Card spesifik Property & Slot
    // Prioritas 2: Rate Card umum berdasarkan Classification & Slot
    const rateCards = await this.prisma.rateCard.findMany({
      where: {
        isActive: true,
        targetSlot: targetSlot,
        OR: [
          { propertyId: propertyId },
          { classification: property.classification },
        ],
      },
      orderBy: {
        propertyId: 'asc', // Prioritaskan yang punya propertyId (Specific)
      },
    });

    // Ambil yang paling spesifik (jika ada propertyId match, pakai itu. Jika tidak, pakai classification)
    const selectedRateCard =
      rateCards.find((rc) => rc.propertyId === propertyId) || rateCards[0];

    if (!selectedRateCard) {
      throw new BadRequestException(
        `Belum ada Rate Card untuk slot ${targetSlot} di properti tipe ini.`,
      );
    }

    // 4. Hitung Harga Satuan Berdasarkan Paket
    let unitPrice = BigInt(0);
    let appliedPackage = durationPackage;

    switch (durationPackage) {
      case DurationPackage.WEEKLY:
        // Jika ada harga khusus mingguan pakai itu, jika tidak: Harian x 7
        unitPrice =
          selectedRateCard.pricePerWeek ??
          selectedRateCard.pricePerDay * BigInt(7);
        break;

      case DurationPackage.MONTHLY:
        // Jika ada harga khusus bulanan pakai itu, jika tidak: Harian x 30
        unitPrice =
          selectedRateCard.pricePerMonth ??
          selectedRateCard.pricePerDay * BigInt(30);
        break;

      case DurationPackage.DAILY:
      case DurationPackage.CUSTOM:
      default:
        unitPrice = selectedRateCard.pricePerDay * BigInt(durationDays);
        appliedPackage = DurationPackage.CUSTOM; // Fallback untuk logika display
        break;
    }

    // 5. Total Akhir = Harga Paket x Jumlah Screen
    const totalCost = unitPrice * BigInt(activeScreenCount);

    return {
      totalCost: Number(totalCost),
      durationDays,
      screenCount: activeScreenCount,
      packageType: durationPackage,
      unitPriceApplied: Number(unitPrice),
      rateCardId: selectedRateCard.id,
      breakdown: {
        propertyName: property.name,
        targetSlot,
        pricePerUnit: Number(unitPrice),
        activeScreens: activeScreenCount,
      },
    };
  }

  // --- ADMIN DASHBOARD ---
  async getAllTransactions(query: TransactionQueryDto) {
    const { type, page = 1, take = 10, order = 'desc' } = query;
    const where: Prisma.TransactionWhereInput = {};
    if (type) where.type = type;

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
        skip: (page - 1) * take,
        take: take,
        orderBy: { createdAt: order },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto: query });
    const data = transactions.map((t) => ({ ...t, amount: Number(t.amount) }));

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
    const statusResponse = (await this.midtrans.verifyNotification(
      notification,
    )) as MidtransNotification;

    const orderId = statusResponse.order_id;
    const transactionStatus = statusResponse.transaction_status;
    const fraudStatus = statusResponse.fraud_status;

    this.logger.log(`Webhook: ${orderId} | Status: ${transactionStatus}`);

    const transaction = await this.prisma.transaction.findUnique({
      where: { referenceCode: orderId },
      include: { wallet: true },
    });

    if (!transaction) throw new NotFoundException('Transaction not found');
    if (transaction.status === TransactionStatus.SUCCESS) {
      return { status: 'ok', message: 'Already processed' };
    }

    let newStatus: TransactionStatus | null = null;
    if (transactionStatus === 'capture' && fraudStatus === 'accept') {
      newStatus = TransactionStatus.SUCCESS;
    } else if (transactionStatus === 'settlement') {
      newStatus = TransactionStatus.SUCCESS;
    } else if (['cancel', 'deny', 'expire'].includes(transactionStatus)) {
      newStatus = TransactionStatus.FAILED;
    }

    if (newStatus === TransactionStatus.SUCCESS) {
      await this.prisma.$transaction([
        this.prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: TransactionStatus.SUCCESS },
        }),
        this.prisma.wallet.update({
          where: { id: transaction.walletId },
          data: { balance: { increment: transaction.amount } },
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

  async getPendingWithdrawals() {
    const requests = await this.prisma.withdrawalRequest.findMany({
      where: { status: WithdrawalStatus.PENDING },
      include: {
        wallet: { include: { user: { select: { name: true, email: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return requests.map((req) => ({ ...req, amount: Number(req.amount) }));
  }

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
        await tx.wallet.update({
          where: { id: request.walletId },
          data: { frozenBalance: { decrement: request.amount } },
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

  // --- HELPERS ---
  async freezeBalanceForCampaign(
    userId: number,
    amount: bigint,
    tx: Prisma.TransactionClient,
  ) {
    return FinanceUtils.freezeBalanceForCampaign(tx, userId, amount);
  }
  async commitFrozenBalance(
    userId: number,
    amount: bigint,
    campaignId: number,
    tx: Prisma.TransactionClient,
  ) {
    return FinanceUtils.commitFrozenBalance(tx, userId, amount, campaignId);
  }
  async releaseFrozenBalance(
    userId: number,
    amount: bigint,
    tx: Prisma.TransactionClient,
  ) {
    return FinanceUtils.releaseFrozenBalance(tx, userId, amount);
  }

  // [NEW] Helper untuk proses Refund jika Campaign di-cancel setelah Active
  async processRefund(
    userId: number,
    amount: bigint,
    campaignId: number,
    tx: Prisma.TransactionClient,
  ) {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    // 1. Kembalikan Saldo (Increment)
    await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: { increment: amount },
      },
    });

    // 2. Catat Transaksi REFUND
    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        amount: amount,
        type: TransactionType.REFUND,
        status: TransactionStatus.SUCCESS,
        referenceCode: `REFUND-CAMP-${campaignId}-${Date.now()}`,
        description: `Refund for Cancelled Campaign #${campaignId}`,
      },
    });
  }
}
