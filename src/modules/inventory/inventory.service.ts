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
import { Property, Screen, Prisma } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // --- PROPERTY ---

  async createProperty(dto: CreatePropertyDto): Promise<Property> {
    if (dto.smartivCode) {
      const exists = await this.prisma.property.findUnique({
        where: { smartivCode: dto.smartivCode },
      });
      if (exists) {
        throw new ConflictException(
          'Property with this SmartIV Code already exists',
        );
      }
    }

    return this.prisma.property.create({
      data: {
        ...dto,
        enabledSlots: dto.enabledSlots || [],
      },
    });
  }

  async findAllProperties(
    pageOptionsDto: PageOptionsDto,
  ): Promise<{ data: Property[]; meta: any }> {
    // FIX: Pastikan 'take' memiliki nilai default agar tidak error matematika
    const take = pageOptionsDto.take || 10;
    const page = pageOptionsDto.page || 1;
    const skip = pageOptionsDto.skip;
    const { order, search } = pageOptionsDto;

    const where: Prisma.PropertyWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { smartivCode: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, count] = await this.prisma.$transaction([
      this.prisma.property.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: order },
        include: { _count: { select: { screens: true } } },
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      data,
      meta: {
        total: count,
        page: page,
        lastPage: Math.ceil(count / take), // take is guaranteed number now
      },
    };
  }

  async findOneProperty(id: number): Promise<Property> {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: { screens: true },
    });
    if (!property)
      throw new NotFoundException(`Property with ID ${id} not found`);
    return property;
  }

  async updateProperty(id: number, dto: UpdatePropertyDto): Promise<Property> {
    await this.findOneProperty(id);
    return this.prisma.property.update({
      where: { id },
      data: dto,
    });
  }

  async removeProperty(id: number): Promise<Property> {
    await this.findOneProperty(id);
    return this.prisma.property.delete({
      where: { id },
    });
  }

  // --- SCREEN ---

  async createScreen(dto: CreateScreenDto): Promise<Screen> {
    const property = await this.prisma.property.findUnique({
      where: { id: dto.propertyId },
    });
    if (!property) throw new NotFoundException('Property ID not found');

    const existingScreen = await this.prisma.screen.findUnique({
      where: { code: dto.code },
    });
    if (existingScreen)
      throw new ConflictException(`Screen code ${dto.code} already exists`);

    return this.prisma.screen.create({
      data: dto,
    });
  }

  async findAllScreens(
    pageOptionsDto: PageOptionsDto,
    propertyId?: number,
  ): Promise<{ data: Screen[]; meta: any }> {
    // FIX: Pastikan 'take' memiliki nilai default
    const take = pageOptionsDto.take || 10;
    const page = pageOptionsDto.page || 1;
    const skip = pageOptionsDto.skip;
    const { order, search } = pageOptionsDto;

    const where: Prisma.ScreenWhereInput = {
      ...(propertyId ? { propertyId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, count] = await this.prisma.$transaction([
      this.prisma.screen.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: order },
        include: { property: { select: { name: true } } },
      }),
      this.prisma.screen.count({ where }),
    ]);

    return {
      data,
      meta: {
        total: count,
        page: page,
        lastPage: Math.ceil(count / take), // take is guaranteed number now
      },
    };
  }

  async findOneScreen(id: number): Promise<Screen> {
    const screen = await this.prisma.screen.findUnique({
      where: { id },
      include: { property: true },
    });
    if (!screen) throw new NotFoundException(`Screen with ID ${id} not found`);
    return screen;
  }

  async updateScreen(id: number, dto: UpdateScreenDto): Promise<Screen> {
    await this.findOneScreen(id);
    return this.prisma.screen.update({
      where: { id },
      data: dto,
    });
  }

  async removeScreen(id: number): Promise<Screen> {
    await this.findOneScreen(id);
    return this.prisma.screen.delete({ where: { id } });
  }
}
