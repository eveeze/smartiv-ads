import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { CreateScreenDto } from './dto/create-screen.dto';
import { Property, Screen } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // --- PROPERTY ---

  async createProperty(dto: CreatePropertyDto): Promise<Property> {
    // Cek duplikasi smartivCode (jika ada inputnya)
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

  async findAllProperties(): Promise<Property[]> {
    return this.prisma.property.findMany({
      include: {
        _count: { select: { screens: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneProperty(id: number): Promise<Property> {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: { screens: true },
    });

    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    return property;
  }

  async createScreen(dto: CreateScreenDto): Promise<Screen> {
    // 1. Validasi Property Ada
    const property = await this.prisma.property.findUnique({
      where: { id: dto.propertyId },
    });
    if (!property) {
      throw new NotFoundException('Property ID not found');
    }

    // 2. Validasi Kode Unik
    const existingScreen = await this.prisma.screen.findUnique({
      where: { code: dto.code },
    });
    if (existingScreen) {
      throw new ConflictException(
        `Screen with code ${dto.code} already exists`,
      );
    }

    // 3. Buat Screen
    return this.prisma.screen.create({
      data: dto,
    });
  }

  async findAllScreens(): Promise<Screen[]> {
    return this.prisma.screen.findMany({
      include: {
        property: {
          select: { name: true, smartivCode: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
