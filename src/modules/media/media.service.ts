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
  Prisma,
} from '@prisma/client';
import type { User, Media } from '@prisma/client';
import { ReviewMediaDto } from './dto/review-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { UploadMediaDto } from './dto/upload-media.dto';
import { MediaUtils } from '../../common/utils/media.utils';
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

  async upload(file: Express.Multer.File, user: User, dto?: UploadMediaDto) {
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
      content = createReadStream(file.path);
      if (!filename) filename = path.basename(file.path);
    } else if (file.buffer) {
      content = file.buffer;
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

    // 3. Upload ke Storage
    const url = await this.storageService.uploadFile(key, content, mimeType);

    // 4. Parse Tags (Phase 10 Step 4)
    const tagConnections = this.parseTagsInput(dto?.tags);

    // 5. Simpan ke Database
    const media = await this.prisma.media.create({
      data: {
        uploaderId: user.id,
        filename: key,
        originalName: file.originalname,
        mimeType: mimeType,
        size: file.size,
        type: isVideo ? MediaType.VIDEO : MediaType.IMAGE,
        url: url,
        title: dto?.title,
        description: dto?.description,
        actionUrl: dto?.actionUrl,
        status: ApprovalStatus.PENDING,
        ...(tagConnections.length > 0
          ? {
              tags: {
                connectOrCreate: tagConnections,
              },
            }
          : {}),
      },
      include: { tags: true },
    });

    // 6. Trigger Transcoding jika Video
    if (isVideo) {
      await this.queueService.addTranscodeJob(media.id);
    }

    return media;
  }

  async findAll(user: User, search?: string) {
    const where: Prisma.MediaWhereInput = {};

    if (user.role === Role.ADVERTISER) {
      where.uploaderId = user.id;
    }

    // [Phase 10 Step 4] Search by tag name
    if (search) {
      where.tags = {
        some: {
          name: { contains: search.toLowerCase(), mode: 'insensitive' },
        },
      };
    }

    const medias = await this.prisma.media.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { tags: true },
    });

    return Promise.all(medias.map((m) => this.transformMediaUrl(m)));
  }

  async findPending() {
    const medias = await this.prisma.media.findMany({
      where: { status: ApprovalStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      include: {
        uploader: { select: { name: true, email: true } },
        tags: true,
      },
    });
    return Promise.all(medias.map((m) => this.transformMediaUrl(m)));
  }

  async findOne(id: number, user: User) {
    const media = await this.prisma.media.findUnique({
      where: { id },
      include: {
        uploader: { select: { name: true, email: true } },
        tags: true,
      },
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

  async update(id: number, dto: UpdateMediaDto, user: User) {
    const media = await this.prisma.media.findUnique({ where: { id } });

    if (!media) throw new NotFoundException('Media not found');
    if (media.uploaderId !== user.id)
      throw new BadRequestException('You can only update your own media');

    return this.prisma.media.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        actionUrl: dto.actionUrl,
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

    await this.storageService.delete(media.filename).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`Failed to delete raw file for media ${id}: ${msg}`);
    });

    return await this.prisma.media.delete({ where: { id } });
  }

  // [Phase 10 Step 4] Get All Tags (for frontend autocomplete)
  async findAllTags() {
    return this.prisma.mediaTag.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  // --- Private Helpers ---

  private async transformMediaUrl<T extends Media>(media: T) {
    // [Phase 10 Step 3] Generate signed URLs dynamically
    const isVideo = media.type === MediaType.VIDEO && media.isTranscoded;

    const [signedUrl, hlsUrl, thumbnailUrl, previewUrl] = await Promise.all([
      this.storageService
        .getPresignedUrl(media.filename)
        .catch(() => media.url),
      isVideo
        ? this.storageService
            .getPresignedUrl(MediaUtils.getHlsKey(media.id))
            .catch(() => MediaUtils.getHlsUrl(media.id))
        : Promise.resolve(null),
      isVideo
        ? this.storageService
            .getPresignedUrl(MediaUtils.getThumbnailKey(media.id))
            .catch(() => MediaUtils.getThumbnailUrl(media.id))
        : Promise.resolve(null),
      isVideo
        ? this.storageService
            .getPresignedUrl(MediaUtils.getPreviewKey(media.id))
            .catch(() => MediaUtils.getPreviewUrl(media.id))
        : Promise.resolve(null),
    ]);

    return {
      ...media,
      url: signedUrl,
      hlsUrl,
      thumbnailUrl,
      previewUrl,
    };
  }

  /**
   * Parse comma-separated tags string into Prisma connectOrCreate format.
   * Sanitizes: lowercase + trim for consistency.
   */
  private parseTagsInput(
    tagsInput?: string,
  ): Array<{ where: { name: string }; create: { name: string } }> {
    if (!tagsInput) return [];

    return tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0)
      .map((name) => ({
        where: { name },
        create: { name },
      }));
  }
}
