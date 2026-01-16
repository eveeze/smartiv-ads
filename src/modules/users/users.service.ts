import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { Prisma, User } from '@prisma/client';
import { PageMetaDto } from '../../common/dto/page-meta.dto';
import { PageDto } from '../../common/dto/page.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserPageOptionsDto } from './dto/user-page-options.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserResponseDto } from './dto/user-response.dto'; // [NEW]

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Return PageDto<UserResponseDto> agar type-safe dengan Controller
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
        // Kita tidak perlu select manual disini kalau pakai Interceptor di Controller,
        // TAPI untuk performa Query List, select manual tetap lebih baik.
        // Password TIDAK kita ambil dari DB.
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { campaigns: true, media: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto });

    // Mapping manual ke DTO Response untuk List
    const data = users.map((user) => new UserResponseDto(user));

    return new PageDto(data, pageMetaDto);
  }

  // Return User biasa (Prisma Type), nanti Controller yang wrap ke DTO
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

  // ==========================================
  // BEST PRACTICE: HELPER METHODS
  // ==========================================

  /**
   * Mengapa ini "Private" dan bukan "Common Util"?
   * * 1. Domain Context: Logic pengecekan user sangat spesifik untuk entity User
   * (menggunakan prisma.user.findUnique).
   * 2. Type Safety: Membuat util generic untuk Prisma di NestJS cukup kompleks
   * dan seringkali mengorbankan type safety (menggunakan 'any').
   * 3. Encapsulation: Service ini bertanggung jawab penuh atas lifecycle User.
   * * Jika logic ini dipakai di 10 service berbeda, baru kita refactor ke Common/BaseService.
   * Untuk saat ini, private method adalah solusi paling rapi dan performan (O(1)).
   */
  private async checkExistence(id: number) {
    // Select ID only -> Query paling ringan (O(1))
    const exists = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('User not found');
  }
}
