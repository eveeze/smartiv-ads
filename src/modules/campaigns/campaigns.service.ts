import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { FinanceService } from '../finance/finance.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import {
  AdSlot,
  ApprovalStatus,
  CampaignStatus,
  User,
  Role,
  ScreenStatus,
  DurationPackage,
} from '@prisma/client';
import { ReviewCampaignDto } from './dto/review-campaign.dto';
import { CampaignQueryDto } from './dto/campaign-query.dto';
import { PageMetaDto } from '../../common/dto/page-meta.dto';
import { PageDto } from '../../common/dto/page.dto';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeService: FinanceService,
  ) {}

  // ===========================================================================
  // [REVISED] CREATE CAMPAIGN (PHASE 3)
  // Logic: Pilih Property + Slot + Paket -> Auto Tag Screens
  // ===========================================================================
  async create(user: User, dto: CreateCampaignDto) {
    // 1. Validasi Media
    const media = await this.prisma.media.findUnique({
      where: { id: dto.mediaId },
    });
    if (!media) throw new NotFoundException('Media not found');
    if (media.uploaderId !== user.id)
      throw new BadRequestException('Media does not belong to you');
    if (media.status !== ApprovalStatus.APPROVED)
      throw new BadRequestException('Media is not APPROVED yet');

    // 2. Validasi Properti & Slot Availability
    const property = await this.prisma.property.findUnique({
      where: { id: dto.propertyId },
    });
    if (!property) throw new NotFoundException('Property not found');

    // Cek apakah slot yang diminta diaktifkan di properti ini
    if (!property.enabledSlots.includes(dto.targetSlot)) {
      throw new BadRequestException(
        `Slot ${dto.targetSlot} tidak tersedia di properti ${property.name}`,
      );
    }

    // 3. Hitung Tanggal (Start & End) berdasarkan Paket
    const start = new Date(dto.startDate);
    if (start < new Date()) {
      // Toleransi sedikit untuk waktu server vs client
    }

    let end = new Date(start);
    if (dto.durationPackage === DurationPackage.CUSTOM) {
      if (!dto.endDate)
        throw new BadRequestException('End date wajib untuk paket CUSTOM');
      end = new Date(dto.endDate);
    } else if (dto.durationPackage === DurationPackage.WEEKLY) {
      end.setDate(start.getDate() + 7);
    } else if (dto.durationPackage === DurationPackage.MONTHLY) {
      end.setDate(start.getDate() + 30);
    } else {
      // DAILY
      end.setDate(start.getDate() + 1);
    }

    if (start >= end) {
      throw new BadRequestException('Start date must be before end date');
    }

    // 4. Cari Layar Aktif (Inventory)
    // Sistem otomatis menargetkan SEMUA layar ONLINE di properti tsb
    const availableScreens = await this.prisma.screen.findMany({
      where: {
        propertyId: dto.propertyId,
        status: ScreenStatus.ONLINE,
      },
      select: { id: true },
    });

    if (availableScreens.length === 0) {
      throw new BadRequestException(
        'Properti ini tidak memiliki layar yang sedang ONLINE saat ini.',
      );
    }

    // 5. Hitung Biaya (Finance Service Phase 2 Integration)
    const costCalculation = await this.financeService.calculateCampaignCost({
      propertyId: dto.propertyId,
      targetSlot: dto.targetSlot,
      durationPackage: dto.durationPackage,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });

    const totalCost = BigInt(costCalculation.totalCost);

    // ==========================================
    // EXECUTION: DRAFT vs SUBMIT
    // ==========================================

    if (dto.saveAsDraft) {
      // DRAFT: Simpan data, connect screen, tapi status DRAFT (tanpa potong saldo)
      return this.prisma.campaign.create({
        data: {
          advertiserId: user.id,
          name: dto.name,
          propertyId: dto.propertyId,
          targetSlot: dto.targetSlot,
          durationPackage: dto.durationPackage,
          startDate: start,
          endDate: end,
          totalCost: totalCost,
          status: CampaignStatus.DRAFT,
          screens: {
            connect: availableScreens.map((s) => ({ id: s.id })),
          },
          items: {
            create: {
              mediaId: media.id,
              targetSlot: dto.targetSlot,
              actionUrl: media.actionUrl,
            },
          },
        },
        include: {
          screens: { select: { id: true, name: true } },
          items: true,
        },
      });
    }

    // SUBMIT: Transaction (Freeze Saldo + Create Campaign)
    return await this.prisma.$transaction(async (tx) => {
      await this.financeService.freezeBalanceForCampaign(
        user.id,
        totalCost,
        tx,
      );

      const campaign = await tx.campaign.create({
        data: {
          advertiserId: user.id,
          name: dto.name,
          propertyId: dto.propertyId,
          targetSlot: dto.targetSlot,
          durationPackage: dto.durationPackage,
          startDate: start,
          endDate: end,
          totalCost: totalCost,
          status: CampaignStatus.PENDING_REVIEW,
          screens: {
            connect: availableScreens.map((s) => ({ id: s.id })),
          },
        },
      });

      await tx.campaignItem.create({
        data: {
          campaignId: campaign.id,
          mediaId: media.id,
          targetSlot: dto.targetSlot,
          actionUrl: media.actionUrl,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'CAMPAIGN_CREATED',
          details: `Created campaign #${campaign.id}. Pkg: ${dto.durationPackage}. Screens: ${availableScreens.length}. Cost: ${totalCost}`,
        },
      });

      return campaign;
    });
  }

  // ==========================================
  // [REVISED] SUBMIT DRAFT
  // ==========================================
  async submit(id: number, userId: number) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: { screens: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.advertiserId !== userId)
      throw new ForbiddenException('You do not own this campaign');

    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT campaigns can be submitted');
    }

    if (campaign.screens.length === 0) {
      throw new BadRequestException(
        'Campaign ini tidak memiliki target layar. Silakan edit atau buat baru.',
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      await this.financeService.freezeBalanceForCampaign(
        userId,
        campaign.totalCost,
        tx,
      );

      const updated = await tx.campaign.update({
        where: { id },
        data: { status: CampaignStatus.PENDING_REVIEW },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CAMPAIGN_SUBMITTED',
          details: `Draft #${id} submitted. Cost: ${campaign.totalCost}`,
        },
      });

      return updated;
    });
  }

  // ==========================================
  // [REVISED] UPDATE (DRAFT ONLY)
  // ==========================================
  async update(id: number, userId: number, dto: UpdateCampaignDto) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
    });

    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.advertiserId !== userId)
      throw new ForbiddenException('You do not own this campaign');

    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT campaigns can be edited.');
    }

    const newPropertyId = dto.propertyId ?? campaign.propertyId;
    const newSlot = dto.targetSlot ?? campaign.targetSlot;
    const newPackage = dto.durationPackage ?? campaign.durationPackage;
    const newStartStr = dto.startDate ?? campaign.startDate.toISOString();
    const newEndStr = dto.endDate ?? campaign.endDate.toISOString();

    const start = new Date(newStartStr);
    let end = new Date(start);

    if (newPackage === DurationPackage.CUSTOM) {
      end = new Date(newEndStr);
    } else if (newPackage === DurationPackage.WEEKLY) {
      end.setDate(start.getDate() + 7);
    } else if (newPackage === DurationPackage.MONTHLY) {
      end.setDate(start.getDate() + 30);
    } else {
      end.setDate(start.getDate() + 1);
    }

    if (!newPropertyId) throw new BadRequestException('Property ID missing');

    const availableScreens = await this.prisma.screen.findMany({
      where: {
        propertyId: newPropertyId,
        status: ScreenStatus.ONLINE,
      },
      select: { id: true },
    });

    const costCalc = await this.financeService.calculateCampaignCost({
      propertyId: newPropertyId,
      targetSlot: newSlot,
      durationPackage: newPackage,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });

    return this.prisma.campaign.update({
      where: { id },
      data: {
        name: dto.name,
        propertyId: newPropertyId,
        targetSlot: newSlot,
        durationPackage: newPackage,
        startDate: start,
        endDate: end,
        totalCost: BigInt(costCalc.totalCost),
        screens: {
          set: availableScreens.map((s) => ({ id: s.id })),
        },
      },
      include: { screens: { select: { id: true, name: true } } },
    });
  }

  // ==========================================
  // STANDARD CRUD (READ/DELETE/CANCEL)
  // ==========================================
  async findAll(user: User, query: CampaignQueryDto) {
    const where: any = {};
    if (user.role === Role.ADVERTISER) where.advertiserId = user.id;
    if (query.status) where.status = query.status;

    const [data, itemCount] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        include: {
          items: { include: { media: true } },
          _count: { select: { screens: true } },
          property: { select: { name: true, city: true } },
        },
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: query.order },
      }),
      this.prisma.campaign.count({ where }),
    ]);

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto: query });
    return new PageDto(data, pageMetaDto);
  }

  async findOne(id: number, user: User) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        screens: true,
        items: { include: { media: true } },
        advertiser: { select: { name: true, email: true } },
        property: { select: { name: true, city: true, timezone: true } },
      },
    });

    if (!campaign) throw new NotFoundException('Campaign not found');
    if (user.role === Role.ADVERTISER && campaign.advertiserId !== user.id) {
      throw new NotFoundException('Campaign not found');
    }
    return campaign;
  }

  async remove(id: number, userId: number) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.advertiserId !== userId)
      throw new ForbiddenException('You do not own this campaign');
    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new BadRequestException(
        'Only DRAFT campaigns can be deleted directly.',
      );
    }
    return this.prisma.campaign.delete({ where: { id } });
  }

  // [UPDATED] Handle Refund on Cancel
  async cancel(id: number, user: User) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.advertiserId !== user.id)
      throw new ForbiddenException('Ownership error');

    const allowedStatuses: CampaignStatus[] = [
      CampaignStatus.PENDING_REVIEW,
      CampaignStatus.ACTIVE,
    ];

    if (!allowedStatuses.includes(campaign.status)) {
      throw new BadRequestException(
        `Cannot cancel campaign with status ${campaign.status}`,
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      // Logic Baru: Refund atau Release Frozen
      if (campaign.status === CampaignStatus.PENDING_REVIEW) {
        // Uang masih Frozen -> Release
        await this.financeService.releaseFrozenBalance(
          user.id,
          campaign.totalCost,
          tx,
        );
      } else if (campaign.status === CampaignStatus.ACTIVE) {
        await this.financeService.processRefund(
          user.id,
          campaign.totalCost,
          campaign.id,
          tx,
        );
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'CAMPAIGN_CANCELLED',
          details: `Campaign #${id} cancelled by user. Status was ${campaign.status}`,
        },
      });

      return await tx.campaign.update({
        where: { id },
        data: { status: CampaignStatus.CANCELLED },
      });
    });
  }

  async review(id: number, dto: ReviewCampaignDto, adminId: number) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign || campaign.status !== CampaignStatus.PENDING_REVIEW) {
      throw new BadRequestException('Invalid campaign for review');
    }

    return await this.prisma.$transaction(async (tx) => {
      if (dto.approved) {
        await this.financeService.commitFrozenBalance(
          campaign.advertiserId,
          campaign.totalCost,
          campaign.id,
          tx,
        );
        return await tx.campaign.update({
          where: { id },
          data: { status: CampaignStatus.ACTIVE },
        });
      } else {
        await this.financeService.releaseFrozenBalance(
          campaign.advertiserId,
          campaign.totalCost,
          tx,
        );
        return await tx.campaign.update({
          where: { id },
          data: {
            status: CampaignStatus.REJECTED,
            rejectionReason: dto.rejectionReason,
          },
        });
      }
    });
  }
}
