import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { CreateScreenDto } from './dto/create-screen.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { UpdateScreenDto } from './dto/update-screen.dto';
import { PageOptionsDto } from '../../common/dto/page-options.dto';
import { PageMetaDto } from '../../common/dto/page-meta.dto'; // Sudah ada sekarang
import { PageDto } from '../../common/dto/page.dto'; // Sudah ada sekarang
import { Prisma } from '@prisma/client';
import { ScreenPageOptionsDto } from './dto/screen-page-options.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // --- PROPERTIES ---

  async createProperty(createPropertyDto: CreatePropertyDto) {
    // Check Uniqueness
    if (createPropertyDto.smartivCode) {
      const exists = await this.prisma.property.findUnique({
        where: { smartivCode: createPropertyDto.smartivCode },
      });
      if (exists) {
        throw new ConflictException(
          'Property with this SmartIV Code already exists',
        );
      }
    }

    return this.prisma.property.create({
      data: {
        ...createPropertyDto,
        enabledSlots: createPropertyDto.enabledSlots || [],
      },
    });
  }

  async findAllProperties(pageOptionsDto: PageOptionsDto) {
    // FIX: Gunakan 'search' bukan 'q'
    const where: Prisma.PropertyWhereInput = pageOptionsDto.search
      ? {
          OR: [
            { name: { contains: pageOptionsDto.search, mode: 'insensitive' } },
            {
              smartivCode: {
                contains: pageOptionsDto.search,
                mode: 'insensitive',
              },
            },
          ],
        }
      : {};

    const [data, itemCount] = await Promise.all([
      this.prisma.property.findMany({
        where,
        skip: pageOptionsDto.skip,
        take: pageOptionsDto.take,
        orderBy: { createdAt: pageOptionsDto.order },
        include: {
          _count: { select: { screens: true } },
        },
      }),
      this.prisma.property.count({ where }),
    ]);

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto });
    return new PageDto(data, pageMetaDto);
  }

  async getPropertiesList() {
    return this.prisma.property.findMany({
      select: {
        id: true,
        name: true,
        city: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOneProperty(id: number) {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: { screens: true },
    });
    if (!property)
      throw new NotFoundException(`Property with ID ${id} not found`);
    return property;
  }

  async updateProperty(id: number, updatePropertyDto: UpdatePropertyDto) {
    await this.findOneProperty(id);

    if (updatePropertyDto.smartivCode) {
      const exists = await this.prisma.property.findFirst({
        where: {
          smartivCode: updatePropertyDto.smartivCode,
          NOT: { id },
        },
      });
      if (exists) {
        throw new ConflictException('SmartIV Code is already taken');
      }
    }

    return this.prisma.property.update({
      where: { id },
      data: updatePropertyDto,
    });
  }

  async removeProperty(id: number) {
    await this.findOneProperty(id);
    return this.prisma.property.delete({
      where: { id },
    });
  }

  // --- SCREENS ---

  async createScreen(createScreenDto: CreateScreenDto) {
    const property = await this.prisma.property.findUnique({
      where: { id: createScreenDto.propertyId },
    });
    if (!property) throw new NotFoundException('Property ID not found');

    const existingScreen = await this.prisma.screen.findUnique({
      where: { code: createScreenDto.code },
    });
    if (existingScreen) {
      throw new ConflictException(
        `Screen code ${createScreenDto.code} already exists`,
      );
    }

    return this.prisma.screen.create({
      data: createScreenDto,
    });
  }

  async findAllScreens(pageOptionsDto: ScreenPageOptionsDto) {
    // FIX: Gunakan 'search' bukan 'q'
    const where: Prisma.ScreenWhereInput = {
      ...(pageOptionsDto.search
        ? { name: { contains: pageOptionsDto.search, mode: 'insensitive' } }
        : {}),
      propertyId: pageOptionsDto.propertyId,
    };

    const [data, itemCount] = await Promise.all([
      this.prisma.screen.findMany({
        where,
        skip: pageOptionsDto.skip,
        take: pageOptionsDto.take,
        orderBy: { createdAt: pageOptionsDto.order },
        include: {
          property: { select: { name: true } },
        },
      }),
      this.prisma.screen.count({ where }),
    ]);

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto });
    return new PageDto(data, pageMetaDto);
  }

  async getScreensList(propertyId?: number) {
    return this.prisma.screen.findMany({
      where: {
        propertyId: propertyId,
      },
      select: {
        id: true,
        name: true,
        code: true,
        property: {
          select: { name: true },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOneScreen(id: number) {
    const screen = await this.prisma.screen.findUnique({
      where: { id },
      include: { property: true },
    });
    if (!screen) throw new NotFoundException(`Screen with ID ${id} not found`);
    return screen;
  }

  async updateScreen(id: number, updateScreenDto: UpdateScreenDto) {
    await this.findOneScreen(id);
    return this.prisma.screen.update({
      where: { id },
      data: updateScreenDto,
    });
  }

  async removeScreen(id: number) {
    await this.findOneScreen(id);
    return this.prisma.screen.delete({
      where: { id },
    });
  }
}
