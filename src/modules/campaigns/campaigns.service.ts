import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { FinanceService } from '../finance/finance.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
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

  /**
   * Step 1 & 2: Create Campaign (Draft -> Freeze Balance)
   */
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

    // 2. Validasi Tanggal
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (start >= end)
      throw new BadRequestException('Start date must be before end date');
    if (start < new Date())
      throw new BadRequestException('Start date must be in the future');

    // ---------------------------------------------------------
    // [LOGIC BARU] Menentukan Target Screens
    // ---------------------------------------------------------
    let targetScreenIds: number[] = [];

    if (dto.propertyId) {
      // SCENARIO A: PROPERTY BUYOUT
      // Cari semua screen yang ONLINE di properti tersebut

      // Cek properti exist
      const propertyExists = await this.prisma.property.count({
        where: { id: dto.propertyId },
      });
      if (propertyExists === 0) {
        throw new NotFoundException('Property not found');
      }

      // Fetch semua screen aktif
      const propertyScreens = await this.prisma.screen.findMany({
        where: {
          propertyId: dto.propertyId,
          status: ScreenStatus.ONLINE, // Hanya ambil layar yang aktif
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
      // SCENARIO B: SPECIFIC SCREENS
      if (!dto.screenIds || dto.screenIds.length === 0) {
        throw new BadRequestException(
          'Either propertyId or screenIds must be provided',
        );
      }

      // Validasi apakah screen IDs valid dan aktif
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

    // 4. Hitung Biaya (Gunakan list screen ID yang sudah didapat tadi)
    const costEstimate = await this.financeService.calculateCampaignCost({
      screenIds: targetScreenIds,
      startDate: dto.startDate,
      endDate: dto.endDate,
    });
    const totalCost = BigInt(costEstimate.totalCost);

    // 5. Transaction: Create DB & Freeze Balance
    return await this.prisma.$transaction(async (tx) => {
      // a. Freeze Saldo
      await this.financeService.freezeBalanceForCampaign(
        user.id,
        totalCost,
        tx,
      );

      // b. Buat Campaign Header
      const campaign = await tx.campaign.create({
        data: {
          advertiserId: user.id,
          name: dto.name,
          startDate: start,
          endDate: end,
          totalCost: totalCost,
          status: CampaignStatus.PENDING_REVIEW,

          // Simpan Property ID jika Buyout (opsional, untuk reporting/tracking)
          // Jika selective screen, propertyId akan null
          propertyId: dto.propertyId ?? null,

          // Relasi Many-to-Many ke Screens (Ini inti dari targetingnya)
          screens: {
            connect: targetScreenIds.map((id) => ({ id })),
          },
        },
      });

      // c. Buat Campaign Item (Detail Media per Screen)
      // MVP: 1 Campaign = 1 Media untuk semua target screen
      await tx.campaignItem.create({
        data: {
          campaignId: campaign.id,
          mediaId: media.id,
          targetSlot: AdSlot.SCREENSAVER, // Default logic, nanti bisa dinamis
          targetRoomCategory: [], // All rooms
        },
      });

      // d. Create Audit Log
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

  async findAll(user: User, query: CampaignQueryDto) {
    const where: any = {};

    // Advertiser cuma bisa lihat punya sendiri
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
          property: { select: { name: true } }, // Include nama properti jika buyout
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
        screens: true, // Show target screens
        items: { include: { media: true } },
        advertiser: { select: { name: true, email: true } },
        property: { select: { name: true, city: true } },
      },
    });

    if (!campaign) throw new NotFoundException('Campaign not found');

    // Security Check: Advertiser cannot see others' campaign
    if (user.role === Role.ADVERTISER && campaign.advertiserId !== user.id) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  /**
   * Step 3: Admin Review
   */
  async review(id: number, dto: ReviewCampaignDto, adminId: number) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    if (campaign.status !== CampaignStatus.PENDING_REVIEW) {
      throw new BadRequestException('Campaign is not pending review');
    }

    return await this.prisma.$transaction(async (tx) => {
      if (dto.approved) {
        // APPROVE
        // 1. Potong Frozen Balance (Finalize Payment)
        await this.financeService.commitFrozenBalance(
          campaign.advertiserId,
          campaign.totalCost,
          campaign.id,
          tx,
        );

        // 2. Update Status -> ACTIVE
        return await tx.campaign.update({
          where: { id },
          data: { status: CampaignStatus.ACTIVE },
        });
      } else {
        // REJECT
        // 1. Kembalikan Frozen Balance (Refund)
        await this.financeService.releaseFrozenBalance(
          campaign.advertiserId,
          campaign.totalCost,
          tx,
        );

        // 2. Update Status -> REJECTED
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
