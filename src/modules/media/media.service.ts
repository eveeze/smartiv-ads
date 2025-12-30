import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { StorageService } from '../../providers/storage/storage.service';
import { QueueService } from '../../providers/queue/queue.service';
import {
  ApprovalStatus,
  CampaignStatus,
  MediaType,
  Role,
  User,
} from '@prisma/client';
import { ReviewMediaDto } from './dto/review-media.dto';
import { getHlsUrl, getThumbnailUrl } from '../../common/utils/media.utils';
import { createReadStream, ReadStream } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly queueService: QueueService,
  ) {}

  async upload(file: Express.Multer.File, user: User) {
    // 1. Validasi File Type
    const allowedMimeTypes = ['image/', 'video/'];
    const isAllowed = allowedMimeTypes.some((type) =>
      file.mimetype.startsWith(type),
    );

    if (!isAllowed) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }

    // 2. Handle File Source (Disk vs Memory/Buffer)
    let content: Buffer | ReadStream;
    let filename = file.filename;

    if (file.path) {
      // Skenario: Disk Storage (Production)
      content = createReadStream(file.path);
      // Jika filename kosong (jarang terjadi di disk), ambil dari basename
      if (!filename) filename = path.basename(file.path);
    } else if (file.buffer) {
      // Skenario: Memory Storage (Testing / E2E)
      content = file.buffer;
      // Jika filename kosong, generate UUID + Extensi Asli
      if (!filename) {
        const ext = path.extname(file.originalname) || '.bin';
        filename = `${uuidv4()}${ext}`;
      }
    } else {
      throw new BadRequestException('File content is empty or invalid');
    }

    const key = `raw/${filename}`;
    const mimeType = file.mimetype;
    const isVideo = mimeType.startsWith('video/');

    // 3. Upload ke Storage (MinIO/S3)
    const url = await this.storageService.uploadFile(key, content, mimeType);

    // 4. Simpan ke Database
    const media = await this.prisma.media.create({
      data: {
        uploaderId: user.id,
        filename: key,
        originalName: file.originalname,
        mimeType: mimeType,
        size: file.size,
        type: isVideo ? MediaType.VIDEO : MediaType.IMAGE,
        url: url,
        status: ApprovalStatus.PENDING,
      },
    });

    // 5. Trigger Transcoding jika Video
    if (isVideo) {
      await this.queueService.addTranscodeJob(media.id);
    }

    return media;
  }

  async findAll(user: User) {
    const where: any = {};
    if (user.role === Role.ADVERTISER) {
      where.uploaderId = user.id;
    }

    const medias = await this.prisma.media.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return medias.map((m) => this.transformMediaUrl(m));
  }

  async findPending() {
    const medias = await this.prisma.media.findMany({
      where: { status: ApprovalStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      include: { uploader: { select: { name: true, email: true } } },
    });
    return medias.map((m) => this.transformMediaUrl(m));
  }

  async findOne(id: number, user: User) {
    const media = await this.prisma.media.findUnique({
      where: { id },
      include: { uploader: { select: { name: true, email: true } } },
    });

    if (!media) throw new NotFoundException('Media not found');

    if (user.role === Role.ADVERTISER && media.uploaderId !== user.id) {
      throw new NotFoundException('Media not found');
    }

    return this.transformMediaUrl(media);
  }

  async review(id: number, dto: ReviewMediaDto, adminId: number) {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) throw new NotFoundException('Media not found');

    return this.prisma.media.update({
      where: { id },
      data: {
        status: dto.status,
        rejectionReason:
          dto.status === ApprovalStatus.REJECTED ? dto.rejectionReason : null,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });
  }

  async remove(id: number, user: User) {
    const media = await this.prisma.media.findUnique({ where: { id } });

    if (!media) throw new NotFoundException('Media not found');
    if (media.uploaderId !== user.id)
      throw new BadRequestException('You can only delete your own media');

    const usageCount = await this.prisma.campaign.count({
      where: {
        items: {
          some: { mediaId: id },
        },
        status: {
          in: [CampaignStatus.ACTIVE, CampaignStatus.PENDING_REVIEW],
        },
      },
    });

    if (usageCount > 0) {
      throw new BadRequestException(
        'Cannot delete media because it is currently used in an active or pending campaign.',
      );
    }

    await this.storageService.delete(media.filename).catch((e) => {
      console.warn(`Failed to delete raw file for media ${id}:`, e);
    });

    return await this.prisma.media.delete({ where: { id } });
  }

  private transformMediaUrl(media: any) {
    return {
      ...media,
      hlsUrl:
        media.type === MediaType.VIDEO && media.isTranscoded
          ? getHlsUrl(media.id)
          : null,
      thumbnailUrl:
        media.type === MediaType.VIDEO && media.isTranscoded
          ? getThumbnailUrl(media.id)
          : null,
    };
  }
}
