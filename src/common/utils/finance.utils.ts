import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';

export class FinanceUtils {
  /**
   * Memindahkan saldo dari Balance ke FrozenBalance.
   * Digunakan saat Campaign dibuat (Pending Review).
   */
  static async freezeBalanceForCampaign(
    tx: Prisma.TransactionClient,
    userId: number,
    amount: bigint,
  ) {
    const wallet = await tx.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) throw new NotFoundException('Wallet not found');

    if (wallet.balance < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    // Pindahkan: Kurangi Balance, Tambah Frozen
    await tx.wallet.update({
      where: { userId },
      data: {
        balance: { decrement: amount },
        frozenBalance: { increment: amount },
      },
    });
  }

  /**
   * Finalisasi pembayaran: Kurangi FrozenBalance secara permanen & catat transaksi.
   * Digunakan saat Campaign Approved.
   */
  static async commitFrozenBalance(
    tx: Prisma.TransactionClient,
    userId: number,
    amount: bigint,
    campaignId: number,
  ) {
    // 1. Kurangi Frozen Balance (Uang benar-benar keluar dari dompet user)
    await tx.wallet.update({
      where: { userId },
      data: {
        frozenBalance: { decrement: amount },
      },
    });

    // 2. Ambil Wallet ID untuk log transaksi
    const wallet = await tx.wallet.findUnique({ where: { userId } });

    // [FIX] Tambahkan validasi null check
    if (!wallet) {
      throw new NotFoundException(`Wallet not found for user ${userId}`);
    }

    // 3. Catat Transaksi SPEND
    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        amount: amount,
        type: TransactionType.SPEND,
        status: TransactionStatus.SUCCESS,
        description: `Payment for Campaign #${campaignId}`,
        referenceCode: `CAMP-${campaignId}-${Date.now()}`,
      },
    });
  }

  /**
   * Refund saldo: Kembalikan dari FrozenBalance ke Balance utama.
   * Digunakan saat Campaign Rejected.
   */
  static async releaseFrozenBalance(
    tx: Prisma.TransactionClient,
    userId: number,
    amount: bigint,
  ) {
    await tx.wallet.update({
      where: { userId },
      data: {
        frozenBalance: { decrement: amount },
        balance: { increment: amount },
      },
    });
  }
}
