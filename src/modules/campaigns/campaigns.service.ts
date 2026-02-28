import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { FinanceService } from '../finance/finance.service';
import { StorageService } from '../../providers/storage/storage.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import {
  ApprovalStatus,
  CampaignStatus,
  User,
  Role,
  ScreenStatus,
  DurationPackage,
  Prisma,
  MediaType,
} from '@prisma/client';
import { ReviewCampaignDto } from './dto/review-campaign.dto';
import { CampaignQueryDto } from './dto/campaign-query.dto';
import { PageMetaDto } from '../../common/dto/page-meta.dto';
import { PageDto } from '../../common/dto/page.dto';
import { MediaUtils } from '../../common/utils/media.utils';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeService: FinanceService,
    private readonly storageService: StorageService,
  ) {}

  // ===========================================================================
  // CREATE CAMPAIGN
  // ===========================================================================
  async create(user: User, dto: CreateCampaignDto) {
    const media = await this.prisma.media.findUnique({
      where: { id: dto.mediaId },
    });
    if (!media) throw new NotFoundException('Media not found');
    if (media.uploaderId !== user.id)
      throw new BadRequestException('Media does not belong to you');
    if (media.status !== ApprovalStatus.APPROVED)
      throw new BadRequestException('Media is not APPROVED yet');

    const property = await this.prisma.property.findUnique({
      where: { id: dto.propertyId },
    });
    if (!property) throw new NotFoundException('Property not found');

    if (!property.enabledSlots.includes(dto.targetSlot)) {
      throw new BadRequestException(
        `Slot ${dto.targetSlot} tidak tersedia di properti ${property.name}`,
      );
    }

    const start = new Date(dto.startDate);
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
      end.setDate(start.getDate() + 1);
    }

    if (start >= end) {
      throw new BadRequestException('Start date must be before end date');
    }

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

    const costCalculation = await this.financeService.calculateCampaignCost({
      propertyId: dto.propertyId,
      targetSlot: dto.targetSlot,
      durationPackage: dto.durationPackage,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });

    const totalCost = BigInt(costCalculation.totalCost);

    if (dto.saveAsDraft) {
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

  // ===========================================================================
  // SUBMIT DRAFT
  // ===========================================================================
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
        'Campaign ini tidak memiliki target layar.',
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

  // ===========================================================================
  // UPDATE (DRAFT ONLY)
  // ===========================================================================
  async update(id: number, userId: number, dto: UpdateCampaignDto) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
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
      where: { propertyId: newPropertyId, status: ScreenStatus.ONLINE },
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
        screens: { set: availableScreens.map((s) => ({ id: s.id })) },
      },
      include: { screens: { select: { id: true, name: true } } },
    });
  }

  // ===========================================================================
  // STANDARD CRUD (READ/DELETE/CANCEL)
  // ===========================================================================
  async findAll(user: User, query: CampaignQueryDto) {
    const where: Prisma.CampaignWhereInput = {};
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
      if (campaign.status === CampaignStatus.PENDING_REVIEW) {
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

  async review(id: number, dto: ReviewCampaignDto) {
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

  // ===========================================================================
  // [Phase 14] CAMPAIGN PREVIEW URL (Sales Tools)
  // ===========================================================================
  async getPreviewUrl(id: number, user: User) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        items: { include: { media: true }, take: 1 },
        property: { select: { name: true, city: true } },
      },
    });

    if (!campaign) throw new NotFoundException('Campaign not found');
    if (user.role === Role.ADVERTISER && campaign.advertiserId !== user.id) {
      throw new NotFoundException('Campaign not found');
    }

    const firstItem = campaign.items[0];
    if (!firstItem?.media) {
      throw new BadRequestException('Campaign has no media items');
    }

    const media = firstItem.media;
    const isTranscodedVideo =
      media.isTranscoded && media.type === MediaType.VIDEO;

    // Generate presigned URLs for preview — parallel
    const [mediaUrl, thumbnailUrl, previewUrl] = await Promise.all([
      this.storageService
        .getPresignedUrl(media.filename)
        .catch(() => media.url),
      isTranscodedVideo
        ? this.storageService
            .getPresignedUrl(MediaUtils.getThumbnailKey(media.id))
            .catch(() => media.thumbnailUrl)
        : Promise.resolve(media.thumbnailUrl),
      isTranscodedVideo
        ? this.storageService
            .getPresignedUrl(MediaUtils.getPreviewKey(media.id))
            .catch(() => media.previewUrl)
        : Promise.resolve(null),
    ]);

    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      property: campaign.property,
      media: {
        id: media.id,
        type: media.type,
        title: media.title,
        url: mediaUrl,
        thumbnailUrl,
        previewUrl,
      },
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      slot: campaign.targetSlot,
    };
  }
}
