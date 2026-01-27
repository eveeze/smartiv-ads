import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { CampaignStatus } from '@prisma/client';
import { AdvertiserSummaryDto, AdminSummaryDto } from './dto/summary.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // ADVERTISER DASHBOARD
  // ==========================================
  async getAdvertiserSummary(userId: number): Promise<AdvertiserSummaryDto> {
    // Gunakan Promise.all untuk eksekusi paralel (Performa Optimal)
    const [activeCount, pendingCount, spendingAgg, wallet] = await Promise.all([
      // 1. Count Active
      this.prisma.campaign.count({
        where: { advertiserId: userId, status: CampaignStatus.ACTIVE },
      }),
      // 2. Count Pending
      this.prisma.campaign.count({
        where: { advertiserId: userId, status: CampaignStatus.PENDING_REVIEW },
      }),
      // 3. Sum Total Cost (Revenue dari sisi user)
      this.prisma.campaign.aggregate({
        _sum: { totalCost: true },
        where: {
          advertiserId: userId,
          // Hanya hitung campaign yang valid (bukan draft/cancelled)
          status: {
            notIn: [
              CampaignStatus.DRAFT,
              CampaignStatus.CANCELLED,
              CampaignStatus.REJECTED,
            ],
          },
        },
      }),
      // 4. Get Wallet
      this.prisma.wallet.findUnique({
        where: { userId },
        select: { balance: true },
      }),
    ]);

    return {
      activeCampaigns: activeCount,
      pendingCampaigns: pendingCount,
      totalSpent: spendingAgg._sum.totalCost?.toString() || '0',
      remainingBalance: wallet?.balance?.toString() || '0',
    };
  }

  // ==========================================
  // SUPER ADMIN DASHBOARD
  // ==========================================
  async getAdminSummary(): Promise<AdminSummaryDto> {
    const [revenueAgg, screenGroups, totalScreens] = await Promise.all([
      // 1. Total Revenue (Semua campaign non-draft/cancelled)
      this.prisma.campaign.aggregate({
        _sum: { totalCost: true },
        where: {
          status: {
            notIn: [
              CampaignStatus.DRAFT,
              CampaignStatus.CANCELLED,
              CampaignStatus.REJECTED,
            ],
          },
        },
      }),

      // 2. Screen Stats by Group (Group By Status)
      // Ini jauh lebih cepat daripada fetch all screens lalu filter di JS
      this.prisma.screen.groupBy({
        by: ['status'],
        _count: {
          status: true,
        },
      }),

      // 3. Total Screen count
      this.prisma.screen.count(),
    ]);

    // Mapping GroupBy result ke DTO yang bersih
    const stats = {
      ONLINE: 0,
      OFFLINE: 0,
      MAINTENANCE: 0,
    };

    screenGroups.forEach((group) => {
      if (group.status in stats) {
        stats[group.status] = group._count.status;
      }
    });

    return {
      totalRevenue: revenueAgg._sum.totalCost?.toString() || '0',
      totalScreens: totalScreens,
      screenStats: stats,
    };
  }
}
