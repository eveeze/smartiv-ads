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

  async create(user: User, dto: CreateCampaignDto) {
    const media = await this.prisma.media.findUnique({
      where: { id: dto.mediaId },
    });
    if (!media) throw new NotFoundException('Media not found');
    if (media.uploaderId !== user.id)
      throw new BadRequestException('Media does not belong to you');
    if (media.status !== ApprovalStatus.APPROVED)
      throw new BadRequestException('Media is not APPROVED yet');

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (start >= end)
      throw new BadRequestException('Start date must be before end date');
    if (start < new Date())
      throw new BadRequestException('Start date must be in the future');

    let targetScreenIds: number[] = [];

    if (dto.propertyId) {
      // BUYOUT LOGIC
      const propertyExists = await this.prisma.property.count({
        where: { id: dto.propertyId },
      });
      if (propertyExists === 0) {
        throw new NotFoundException('Property not found');
      }

      const propertyScreens = await this.prisma.screen.findMany({
        where: {
          propertyId: dto.propertyId,
          status: ScreenStatus.ONLINE,
        },
        select: { id: true },
      });

      if (propertyScreens.length === 0) {
        throw new BadRequestException(
          'Property has no active screens available',
        );
      }

      targetScreenIds = propertyScreens.map((s) => s.id);
    } else {
      // SELECTIVE LOGIC
      if (!dto.screenIds || dto.screenIds.length === 0) {
        throw new BadRequestException(
          'Either propertyId or screenIds must be provided',
        );
      }

      const validScreens = await this.prisma.screen.findMany({
        where: {
          id: { in: dto.screenIds },
          status: ScreenStatus.ONLINE,
        },
        select: { id: true },
      });

      if (validScreens.length !== dto.screenIds.length) {
        throw new BadRequestException('Some screens are invalid or not ONLINE');
      }

      targetScreenIds = dto.screenIds;
    }

    const costEstimate = await this.financeService.calculateCampaignCost({
      screenIds: targetScreenIds,
      startDate: dto.startDate,
      endDate: dto.endDate,
    });
    const totalCost = BigInt(costEstimate.totalCost);

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
          startDate: start,
          endDate: end,
          totalCost: totalCost,
          status: CampaignStatus.PENDING_REVIEW,
          propertyId: dto.propertyId ?? null,
          screens: {
            connect: targetScreenIds.map((id) => ({ id })),
          },
        },
      });

      await tx.campaignItem.create({
        data: {
          campaignId: campaign.id,
          mediaId: media.id,
          targetSlot: AdSlot.SCREENSAVER,
          targetRoomCategory: [],
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'CAMPAIGN_CREATED',
          details: `Created campaign #${campaign.id} targeting ${
            targetScreenIds.length
          } screens. Type: ${
            dto.propertyId ? 'BUYOUT' : 'SELECTIVE'
          }. Cost: ${totalCost}`,
        },
      });

      return campaign;
    });
  }

  // ==========================================
  // [NEW] UPDATE CAMPAIGN (DRAFT ONLY)
  // ==========================================
  async update(id: number, userId: number, dto: UpdateCampaignDto) {
    // 1. Cek keberadaan & kepemilikan campaign
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: { screens: true },
    });

    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.advertiserId !== userId)
      throw new ForbiddenException('You do not own this campaign');

    // 2. Validasi Status (Hanya DRAFT yang boleh diedit)
    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new BadRequestException(
        'Only DRAFT campaigns can be edited. Please cancel and create a new one.',
      );
    }

    // 3. Validasi Tanggal
    let startDate = campaign.startDate;
    let endDate = campaign.endDate;

    if (dto.startDate) startDate = new Date(dto.startDate);
    if (dto.endDate) endDate = new Date(dto.endDate);

    if (dto.startDate || dto.endDate) {
      if (startDate >= endDate) {
        throw new BadRequestException('Start date must be before end date');
      }
      if (startDate < new Date()) {
        throw new BadRequestException('Start date must be in the future');
      }
    }

    // 4. Validasi Screens / Property (Jika berubah)
    let targetScreenIds: number[] = campaign.screens.map((s) => s.id);

    if (dto.propertyId) {
      // Logic Buyout Baru
      const propertyScreens = await this.prisma.screen.findMany({
        where: { propertyId: dto.propertyId, status: ScreenStatus.ONLINE },
        select: { id: true },
      });
      if (propertyScreens.length === 0)
        throw new BadRequestException('Property has no active screens');
      targetScreenIds = propertyScreens.map((s) => s.id);
    } else if (dto.screenIds) {
      // Logic Selective Baru
      const validScreens = await this.prisma.screen.findMany({
        where: { id: { in: dto.screenIds }, status: ScreenStatus.ONLINE },
        select: { id: true },
      });
      if (validScreens.length !== dto.screenIds.length) {
        throw new BadRequestException('Some screens are invalid or not ONLINE');
      }
      targetScreenIds = dto.screenIds;
    }

    // 5. Hitung Ulang Cost (Karena Draft, hanya update record, tidak freeze balance dulu)
    const costEstimate = await this.financeService.calculateCampaignCost({
      screenIds: targetScreenIds,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    });
    const newTotalCost = BigInt(costEstimate.totalCost);

    // 6. Update Database
    return this.prisma.campaign.update({
      where: { id },
      data: {
        name: dto.name,
        startDate: startDate,
        endDate: endDate,
        totalCost: newTotalCost,
        propertyId: dto.propertyId, // Bisa null jika ganti ke Selective
        screens: {
          set: targetScreenIds.map((sid) => ({ id: sid })), // Reset relasi screens
        },
      },
      include: {
        screens: { select: { id: true, name: true } },
      },
    });
  }

  // ==========================================
  // [NEW] DELETE CAMPAIGN (DRAFT ONLY)
  // ==========================================
  async remove(id: number, userId: number) {
    // 1. Cek keberadaan & kepemilikan
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
    });

    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.advertiserId !== userId)
      throw new ForbiddenException('You do not own this campaign');

    // 2. Validasi Status
    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new BadRequestException(
        'Only DRAFT campaigns can be deleted directly. Use CANCEL for active/pending campaigns.',
      );
    }

    // 3. Hapus (Hard Delete karena masih Draft dan belum ada transaksi keuangan)
    // Note: CampaignItem akan terhapus jika ada Cascade Delete di schema,
    // jika tidak, kita harus hapus manual items dulu. Asumsi: Prisma Cascade aktif.
    return this.prisma.campaign.delete({
      where: { id },
    });
  }

  async findAll(user: User, query: CampaignQueryDto) {
    const where: any = {};

    if (user.role === Role.ADVERTISER) {
      where.advertiserId = user.id;
    }

    if (query.status) {
      where.status = query.status;
    }

    const [data, itemCount] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        include: {
          items: { include: { media: true } },
          _count: { select: { screens: true } },
          property: { select: { name: true } },
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
        property: { select: { name: true, city: true } },
      },
    });

    if (!campaign) throw new NotFoundException('Campaign not found');

    if (user.role === Role.ADVERTISER && campaign.advertiserId !== user.id) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  async cancel(id: number, user: User) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    if (campaign.advertiserId !== user.id) {
      throw new BadRequestException('You do not own this campaign');
    }

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
      if (campaign.status === CampaignStatus.PENDING_REVIEW) {
        await this.financeService.releaseFrozenBalance(
          user.id,
          campaign.totalCost,
          tx,
        );

        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'CAMPAIGN_CANCELLED_REFUND',
            details: `Campaign #${id} cancelled by user. Full refund: ${campaign.totalCost}`,
          },
        });
      } else {
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'CAMPAIGN_STOPPED',
            details: `Active Campaign #${id} stopped by user. No automatic refund.`,
          },
        });
      }

      return await tx.campaign.update({
        where: { id },
        data: { status: CampaignStatus.CANCELLED },
      });
    });
  }

  async review(id: number, dto: ReviewCampaignDto, adminId: number) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    if (campaign.status !== CampaignStatus.PENDING_REVIEW) {
      throw new BadRequestException('Campaign is not pending review');
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
