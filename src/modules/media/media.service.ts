import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { StorageService } from '../../providers/storage/storage.service';
import { QueueService } from '../../providers/queue/queue.service';
import { ApprovalStatus, MediaType, User, Role } from '@prisma/client';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ReviewMediaDto } from './dto/review-media.dto'; // Import DTO baru

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

    const url = await this.storage.uploadFile(key, file.buffer, mime);

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
        status: ApprovalStatus.PENDING, // Default status
      },
    });

    if (type === MediaType.VIDEO) {
      await this.queue.addTranscodeJob(media.id);
    }

    return media;
  }

  // Ambil list media berdasarkan role
  async findAll(user: User) {
    // Jika Super Admin, bisa melihat semua (opsional bisa dikasih filter)
    if (user.role === Role.SUPER_ADMIN) {
      return this.prisma.media.findMany({
        orderBy: { createdAt: 'desc' },
        include: { uploader: { select: { name: true, email: true } } },
      });
    }

    // Jika Advertiser, hanya lihat miliknya sendiri
    return this.prisma.media.findMany({
      where: { uploaderId: user.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  // [NEW] Khusus Admin: Ambil antrian media yang statusnya PENDING
  async getPendingMedia() {
    return this.prisma.media.findMany({
      where: { status: ApprovalStatus.PENDING },
      orderBy: { createdAt: 'asc' }, // Yang lama di review duluan
      include: {
        uploader: {
          select: { id: true, name: true, email: true }, // Tampilkan info uploader
        },
      },
    });
  }

  // [NEW] Khusus Admin: Proses Review (Approve/Reject)
  async reviewMedia(id: number, dto: ReviewMediaDto, adminId: number) {
    // 1. Cek existensi media
    const media = await this.prisma.media.findUnique({
      where: { id },
    });

    if (!media) {
      throw new NotFoundException(`Media with ID ${id} not found`);
    }

    // 2. Update status
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
