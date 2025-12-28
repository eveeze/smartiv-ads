import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { PageOptionsDto } from '../../common/dto/page-options.dto';
import { Prisma } from '@prisma/client';
import { PageMetaDto } from '../../common/dto/page-meta.dto';
import { PageDto } from '../../common/dto/page.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pageOptionsDto: PageOptionsDto) {
    // FIX: Gunakan 'search' bukan 'q'
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

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: { media: true },
        },
      },
    });

    if (!user) throw new NotFoundException(`User with ID ${id} not found`);

    // Hapus password
    const { password, ...result } = user;
    return result;
  }
}
