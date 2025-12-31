import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { PageOptionsDto } from '../../common/dto/page-options.dto';
import { Prisma, User } from '@prisma/client'; // Use explicit types
import { PageMetaDto } from '../../common/dto/page-meta.dto';
import { PageDto } from '../../common/dto/page.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

// Type definition for safe return user object (exclude password)
type SafeUser = Omit<User, 'password'>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    pageOptionsDto: PageOptionsDto,
  ): Promise<PageDto<Partial<User>>> {
    const where: Prisma.UserWhereInput = pageOptionsDto.search
      ? {
          OR: [
            { name: { contains: pageOptionsDto.search, mode: 'insensitive' } },
            { email: { contains: pageOptionsDto.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, itemCount] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: pageOptionsDto.skip,
        take: pageOptionsDto.take,
        orderBy: { createdAt: pageOptionsDto.order },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { media: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto });
    return new PageDto(data, pageMetaDto);
  }

  async findOne(id: number): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: { media: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Explicitly exclude password
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }

  // ==========================================
  // [NEW] UPDATE PROFILE (SELF SERVICE)
  // ==========================================
  async updateProfile(
    id: number,
    dto: UpdateProfileDto,
  ): Promise<Partial<User>> {
    // 1. Cek existence (Select ID only for performance - O(1))
    const userExists = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!userExists) {
      throw new NotFoundException('User not found');
    }

    // 2. Update aman: hanya field yang diizinkan (name, phone)
    // Email dan Role DIABAIKAN meskipun user mencoba mengirimnya.
    return this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        phone: dto.phone,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        updatedAt: true,
      },
    });
  }
}
