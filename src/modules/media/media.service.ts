import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { StorageService } from '../../providers/storage/storage.service';
import { QueueService } from '../../providers/queue/queue.service';
import { ApprovalStatus, MediaType, User, Role } from '@prisma/client';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ReviewMediaDto } from './dto/review-media.dto';

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly queue: QueueService,
  ) {}

  async uploadMedia(file: Express.Multer.File, user: User) {
    if (!file) throw new BadRequestException('File is required');

    const mime = file.mimetype;
    let type: MediaType = MediaType.IMAGE;
    if (mime.startsWith('video/')) type = MediaType.VIDEO;
    else if (!mime.startsWith('image/'))
      throw new BadRequestException('Unsupported file type');

    const ext = path.extname(file.originalname);
    const key = `raw/${uuidv4()}${ext}`;

    // Upload raw file
    const url = await this.storage.uploadFile(key, file.buffer, mime);

    // Create DB Record
    const media = await this.prisma.media.create({
      data: {
        filename: key,
        originalName: file.originalname,
        mimeType: mime,
        size: file.size,
        type: type,
        url: url,
        uploaderId: user.id,
        isTranscoded: type === MediaType.IMAGE,
        status: ApprovalStatus.PENDING,
      },
    });

    // Jika video, kirim job ke BullMQ
    if (type === MediaType.VIDEO) {
      await this.queue.addTranscodeJob(media.id);
    }

    return media;
  }

  async findAll(user: User) {
    if (user.role === Role.SUPER_ADMIN) {
      return this.prisma.media.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          uploader: {
            select: { name: true, email: true },
          },
        },
      });
    }

    return this.prisma.media.findMany({
      where: { uploaderId: user.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  // [NEW] Get Detail Media (Untuk Halaman Detail/Preview)
  async findOne(id: number) {
    const media = await this.prisma.media.findUnique({
      where: { id },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!media) throw new NotFoundException(`Media with ID ${id} not found`);
    return media;
  }

  async getPendingMedia() {
    return this.prisma.media.findMany({
      where: { status: ApprovalStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      include: {
        uploader: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async reviewMedia(id: number, dto: ReviewMediaDto, adminId: number) {
    const media = await this.prisma.media.findUnique({
      where: { id },
    });

    if (!media) {
      throw new NotFoundException(`Media with ID ${id} not found`);
    }

    return this.prisma.media.update({
      where: { id },
      data: {
        status: dto.status,
        rejectionReason:
          dto.status === ApprovalStatus.REJECTED ? dto.rejectionReason : null,
        reviewedAt: new Date(),
        reviewedBy: adminId,
      },
    });
  }
}
