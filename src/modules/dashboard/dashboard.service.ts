import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { CampaignStatus, ScreenStatus } from '@prisma/client';
import type { User } from '@prisma/client';

// --- Response Interfaces (exported for controller return types) ---

export interface OperatorDashboard {
  revenueCurrentMonth: string;
  totalImpressions: number;
  activeCampaigns: number;
  screenSummary: {
    total: number;
    online: number;
    offline: number;
  };
}

export interface ScheduleDay {
  date: string;
  campaigns: Array<{
    id: number;
    name: string;
    slot: string;
    startDate: string;
    endDate: string;
  }>;
}

export interface PropertyProfile {
  id: number;
  name: string;
  type: string;
  classification: string;
  address: string | null;
  city: string | null;
  logoUrl: string | null;
  timezone: string;
  enabledSlots: string[];
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // [Phase 10.5 Step 1] Operator Dashboard
  async getOperatorDashboard(user: User): Promise<OperatorDashboard> {
    const propertyId = user.propertyId;
    if (!propertyId) {
      throw new NotFoundException('User is not associated with any property');
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    // Parallel queries — O(1) roundtrips
    const [ledgerAgg, impressionCount, activeCampaignCount, screenGroups] =
      await Promise.all([
        // 1. Revenue this month from PublisherLedger
        this.prisma.publisherLedger.aggregate({
          _sum: { totalRevenue: true },
          where: {
            propertyId,
            date: { gte: startOfMonth },
          },
        }),

        // 2. Today's impressions via screens belonging to this property
        this.prisma.impressionLog.count({
          where: {
            screen: { propertyId },
            timestamp: { gte: startOfDay },
          },
        }),

        // 3. Active campaigns in this property
        this.prisma.campaign.count({
          where: {
            propertyId,
            status: CampaignStatus.ACTIVE,
          },
        }),

        // 4. Screen summary (groupBy status — single DB roundtrip)
        this.prisma.screen.groupBy({
          by: ['status'],
          where: { propertyId },
          _count: { status: true },
        }),
      ]);

    // Map screen stats with O(n) where n = number of statuses (max 3)
    let total = 0;
    let online = 0;
    let offline = 0;
    for (const group of screenGroups) {
      const count = group._count.status;
      total += count;
      if (group.status === ScreenStatus.ONLINE) online = count;
      else if (group.status === ScreenStatus.OFFLINE) offline = count;
    }

    return {
      revenueCurrentMonth: ledgerAgg._sum.totalRevenue?.toString() || '0',
      totalImpressions: impressionCount,
      activeCampaigns: activeCampaignCount,
      screenSummary: { total, online, offline },
    };
  }

  // [Phase 10.5 Step 2] Schedule View (Calendar Format)
  async getPropertySchedule(user: User): Promise<ScheduleDay[]> {
    const propertyId = user.propertyId;
    if (!propertyId) {
      throw new NotFoundException('User is not associated with any property');
    }

    const now = new Date();

    const campaigns = await this.prisma.campaign.findMany({
      where: {
        propertyId,
        status: CampaignStatus.ACTIVE,
        endDate: { gte: now },
      },
      select: {
        id: true,
        name: true,
        targetSlot: true,
        startDate: true,
        endDate: true,
      },
      orderBy: { startDate: 'asc' },
    });

    // Build calendar map — O(campaigns × days)
    const calendarMap = new Map<string, ScheduleDay>();

    for (const campaign of campaigns) {
      const start = campaign.startDate > now ? campaign.startDate : now;
      const end = campaign.endDate;

      // Iterate each day of the campaign (capped at 90 days to prevent memory overflow)
      const dayIterator = new Date(start);
      const maxDays = 90;
      let dayCount = 0;

      while (dayIterator <= end && dayCount < maxDays) {
        const dateKey = dayIterator.toISOString().slice(0, 10); // YYYY-MM-DD

        let day = calendarMap.get(dateKey);
        if (!day) {
          day = { date: dateKey, campaigns: [] };
          calendarMap.set(dateKey, day);
        }

        day.campaigns.push({
          id: campaign.id,
          name: campaign.name,
          slot: campaign.targetSlot,
          startDate: campaign.startDate.toISOString(),
          endDate: campaign.endDate.toISOString(),
        });

        dayIterator.setDate(dayIterator.getDate() + 1);
        dayCount++;
      }
    }

    // Sort by date and return as array
    return Array.from(calendarMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }

  // [Phase 10.5 Step 3] Property Profile (Read-Only)
  async getMyPropertyProfile(user: User): Promise<PropertyProfile> {
    const propertyId = user.propertyId;
    if (!propertyId) {
      throw new NotFoundException('User is not associated with any property');
    }

    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        name: true,
        type: true,
        classification: true,
        address: true,
        city: true,
        logoUrl: true,
        timezone: true,
        enabledSlots: true,
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    return property;
  }
}
