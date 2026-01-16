import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { Prisma, Role, User } from '@prisma/client';
import { PageMetaDto } from '../../common/dto/page-meta.dto';
import { PageDto } from '../../common/dto/page.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserPageOptionsDto } from './dto/user-page-options.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { AssignPropertyDto } from './dto/assign-property.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // PHASE 8.5: ADMIN MANAGED ONBOARDING
  // ==========================================

  async createUser(dto: CreateUserDto): Promise<User> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    if (dto.role === Role.PROPERTY_OPERATOR && dto.propertyId) {
      const propertyExists = await this.prisma.property.findUnique({
        where: { id: dto.propertyId },
        select: { id: true },
      });
      if (!propertyExists) {
        throw new BadRequestException('Property ID not found');
      }
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    return this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          name: dto.name,
          phone: dto.phone,
          role: dto.role,
          propertyId: dto.propertyId || null,
          isActive: true,
        },
      });

      await tx.wallet.create({
        data: {
          userId: newUser.id,
          balance: 0,
          frozenBalance: 0,
        },
      });

      return newUser;
    });
  }

  async assignProperty(userId: number, dto: AssignPropertyDto): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) throw new NotFoundException('User not found');

    if (user.role !== Role.PROPERTY_OPERATOR) {
      throw new BadRequestException(
        'Can only assign property to PROPERTY_OPERATOR role',
      );
    }

    if (dto.propertyId) {
      const propertyExists = await this.prisma.property.findUnique({
        where: { id: dto.propertyId },
        select: { id: true },
      });
      if (!propertyExists) {
        throw new NotFoundException('Property not found');
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { propertyId: dto.propertyId },
    });
  }

  // ==========================================
  // EXISTING METHODS
  // ==========================================

  async findAll(
    pageOptionsDto: UserPageOptionsDto,
  ): Promise<PageDto<UserResponseDto>> {
    const { skip, take, order, role, q } = pageOptionsDto;

    const where: Prisma.UserWhereInput = {
      ...(role ? { role } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [users, itemCount] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: order },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          propertyId: true, // Pastikan propertyId di-select
          _count: {
            select: { campaigns: true, media: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto });
    const data = users.map((user) => new UserResponseDto(user));

    return new PageDto(data, pageMetaDto);
  }

  async findOne(id: number): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        wallet: true,
        property: {
          select: { id: true, name: true },
        },
        _count: {
          select: { media: true, campaigns: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async updateStatus(id: number, dto: UpdateUserStatusDto): Promise<User> {
    await this.checkExistence(id);

    return this.prisma.user.update({
      where: { id },
      data: { isActive: dto.isActive },
    });
  }

  async updateProfile(id: number, dto: UpdateProfileDto): Promise<User> {
    await this.checkExistence(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        phone: dto.phone,
      },
    });
  }

  private async checkExistence(id: number) {
    const exists = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('User not found');
  }
}
