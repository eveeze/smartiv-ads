import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdateBlocklistDto } from './dto/blocklist.dto';
import { PageOptionsDto } from '../../common/dto/page-options.dto';
import { PageDto } from '../../common/dto/page.dto';
import { PageMetaDto } from '../../common/dto/page-meta.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { CreateScreenDto } from './dto/create-screen.dto';
import { UpdateScreenDto } from './dto/update-screen.dto';
import { CampaignStatus, Prisma } from '@prisma/client';
import type { Property, Screen } from '@prisma/client';
import { CreateRateCardDto } from './dto/create-rate-card.dto';
import { UpdateRateCardDto } from './dto/update-rate-card.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // PROPERTY MANAGEMENT
  // ==========================================

  async createProperty(dto: CreatePropertyDto): Promise<Property> {
    return this.prisma.property.create({
      data: dto,
    });
  }

  async findAllProperties(
    pageOptionsDto: PageOptionsDto,
  ): Promise<PageDto<Property>> {
    // [FIX] Default value untuk menghindari 'undefined' error di TS strict mode
    const { page = 1, take = 10, order } = pageOptionsDto;

    const [data, total] = await Promise.all([
      this.prisma.property.findMany({
        skip: (page - 1) * take,
        take: take,
        orderBy: { createdAt: order },
        include: { _count: { select: { screens: true } } },
      }),
      this.prisma.property.count(),
    ]);

    const meta = new PageMetaDto({ itemCount: total, pageOptionsDto });
    return new PageDto(data, meta);
  }

  async findPropertiesList() {
    return this.prisma.property.findMany({
      select: { id: true, name: true, city: true, classification: true },
      orderBy: { name: 'asc' },
    });
  }

  async findPropertyById(id: number): Promise<Property> {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: { screens: true },
    });

    if (!property)
      throw new NotFoundException(`Property with ID ${id} not found`);
    return property;
  }

  async updateProperty(id: number, dto: UpdatePropertyDto): Promise<Property> {
    await this.findPropertyById(id); // Ensure exists
    return this.prisma.property.update({
      where: { id },
      data: dto,
    });
  }

  async removeProperty(id: number): Promise<Property> {
    await this.findPropertyById(id); // Ensure exists
    return this.prisma.property.delete({
      where: { id },
    });
  }

  // ==========================================
  // SCREEN MANAGEMENT
  // ==========================================

  async createScreen(dto: CreateScreenDto): Promise<Screen> {
    const propertyExists = await this.prisma.property.findUnique({
      where: { id: dto.propertyId },
    });
    if (!propertyExists) throw new NotFoundException('Property not found');

    const codeExists = await this.prisma.screen.findUnique({
      where: { code: dto.code },
    });
    if (codeExists)
      throw new BadRequestException('Screen Code/MAC already exists');

    return this.prisma.screen.create({
      data: dto,
    });
  }

  async findAllScreens(
    pageOptionsDto: PageOptionsDto,
    propertyId?: number,
  ): Promise<PageDto<Screen>> {
    // [FIX] Default value untuk menghindari 'undefined'
    const { page = 1, take = 10, order } = pageOptionsDto;

    // [FIX] Menggunakan Type Safe Prisma Where Input, bukan 'any'
    const where: Prisma.ScreenWhereInput = {};
    if (propertyId) where.propertyId = propertyId;

    const [data, total] = await Promise.all([
      this.prisma.screen.findMany({
        where,
        skip: (page - 1) * take,
        take: take,
        orderBy: { createdAt: order },
        include: { property: { select: { name: true } } },
      }),
      this.prisma.screen.count({ where }),
    ]);

    const meta = new PageMetaDto({ itemCount: total, pageOptionsDto });
    return new PageDto(data, meta);
  }

  async findScreensList(propertyId?: number) {
    // [FIX] Menggunakan Type Safe Prisma Where Input, bukan 'any'
    const where: Prisma.ScreenWhereInput = {};
    if (propertyId) where.propertyId = propertyId;

    return this.prisma.screen.findMany({
      where,
      select: { id: true, name: true, code: true, orientation: true },
      orderBy: { name: 'asc' },
    });
  }

  async findScreenById(id: number): Promise<Screen> {
    const screen = await this.prisma.screen.findUnique({
      where: { id },
      include: { property: true },
    });
    if (!screen) throw new NotFoundException(`Screen with ID ${id} not found`);
    return screen;
  }

  async updateScreen(id: number, dto: UpdateScreenDto): Promise<Screen> {
    await this.findScreenById(id);
    return this.prisma.screen.update({
      where: { id },
      data: dto,
    });
  }

  async removeScreen(id: number): Promise<Screen> {
    await this.findScreenById(id);
    return this.prisma.screen.delete({
      where: { id },
    });
  }

  // ==========================================
  // RATE CARD MANAGEMENT (PHASE 5.7)
  // ==========================================

  async createRateCard(dto: CreateRateCardDto) {
    // Note: Validasi 'classification vs propertyId' sudah ditangani DTO (@ValidateIf)

    // Cek Uniqueness (Anti Duplikat Konfigurasi)
    const existingRateCard = await this.prisma.rateCard.findFirst({
      where: {
        propertyId: dto.propertyId || null,
        classification: dto.classification || null,
        targetSlot: dto.targetSlot || null,
        isActive: true, // Hanya cek yang aktif
      },
    });

    if (existingRateCard) {
      throw new ConflictException(
        'Active Rate Card with this specific configuration already exists. Please update the existing one or deactivate it first.',
      );
    }

    // Konversi ke BigInt untuk database
    return this.prisma.rateCard.create({
      data: {
        propertyId: dto.propertyId,
        classification: dto.classification,
        targetSlot: dto.targetSlot,
        pricePerDay: BigInt(dto.pricePerDay),
        currency: 'IDR',
      },
    });
  }

  async findAllRateCards() {
    // [OPTIMIZED] Tidak perlu mapping manual BigInt -> Number
    // Global serializer di main.ts akan menangani konversi ke String saat JSON response dikirim.
    return this.prisma.rateCard.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        property: { select: { name: true } },
      },
    });
  }

  async updateRateCard(id: number, dto: UpdateRateCardDto) {
    const rateCard = await this.prisma.rateCard.findUnique({ where: { id } });
    if (!rateCard) throw new NotFoundException('Rate Card not found');

    // [BUG FIX] Validasi Duplikat saat mengaktifkan kembali Rate Card
    if (dto.isActive === true && rateCard.isActive === false) {
      const activeConflict = await this.prisma.rateCard.findFirst({
        where: {
          propertyId: rateCard.propertyId,
          classification: rateCard.classification,
          targetSlot: rateCard.targetSlot,
          isActive: true,
          // Exclude diri sendiri (walaupun harusnya id beda karena status awal false, tapi best practice)
          id: { not: id },
        },
      });

      if (activeConflict) {
        throw new ConflictException(
          'Cannot activate this Rate Card because another active Rate Card with the same configuration already exists.',
        );
      }
    }

    return this.prisma.rateCard.update({
      where: { id },
      data: {
        pricePerDay: dto.pricePerDay ? BigInt(dto.pricePerDay) : undefined,
        isActive: dto.isActive,
      },
    });
  }

  async removeRateCard(id: number) {
    const rateCard = await this.prisma.rateCard.findUnique({ where: { id } });
    if (!rateCard) throw new NotFoundException('Rate Card not found');

    // Hard Delete (Sesuai policy sistem saat ini)
    return this.prisma.rateCard.delete({
      where: { id },
    });
  }

  // ==========================================
  // BRAND SAFETY BLOCKLIST (PHASE 12)
  // ==========================================

  async getBlocklist(propertyId: number) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        blocklist: {
          select: { id: true, name: true, code: true },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!property) {
      throw new NotFoundException(`Property with ID ${propertyId} not found`);
    }

    return property.blocklist;
  }

  async updateBlocklist(propertyId: number, dto: UpdateBlocklistDto) {
    await this.findPropertyById(propertyId); // Ensure exists

    // Validate all category IDs exist in one query
    if (dto.categoryIds.length > 0) {
      const existingCount = await this.prisma.industryCategory.count({
        where: { id: { in: dto.categoryIds } },
      });

      if (existingCount !== dto.categoryIds.length) {
        throw new BadRequestException('One or more category IDs are invalid');
      }
    }

    // Atomic set — replaces entire blocklist in one operation
    return this.prisma.property.update({
      where: { id: propertyId },
      data: {
        blocklist: {
          set: dto.categoryIds.map((id) => ({ id })),
        },
      },
      include: {
        blocklist: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  /**
   * [Phase 12] Check campaign availability with blocklist filtering.
   * Uses DB-level filtering (NOT { categoryId IN blockedIds }) — no JS loops.
   */
  async checkAvailability(propertyId: number) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        blocklist: { select: { id: true } },
      },
    });

    if (!property) {
      throw new NotFoundException(`Property with ID ${propertyId} not found`);
    }

    const blockedIds = property.blocklist.map((cat) => cat.id);

    // DB-level filtering: exclude campaigns whose category is blocked
    const where: Prisma.CampaignWhereInput = {
      propertyId,
      status: CampaignStatus.ACTIVE,
    };

    if (blockedIds.length > 0) {
      where.OR = [
        { categoryId: null }, // Campaigns without category always pass
        { NOT: { categoryId: { in: blockedIds } } },
      ];
    }

    const campaigns = await this.prisma.campaign.findMany({
      where,
      select: {
        id: true,
        name: true,
        targetSlot: true,
        status: true,
        category: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      propertyId,
      blockedCategories: blockedIds.length,
      availableCampaigns: campaigns,
    };
  }

  // ==========================================
  // INDUSTRY CATEGORIES (PHASE 12)
  // ==========================================

  async findAllCategories() {
    return this.prisma.industryCategory.findMany({
      orderBy: { name: 'asc' },
    });
  }
}
