import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { StorageService } from '../../providers/storage/storage.service';
import { QueueService } from '../../providers/queue/queue.service';
import { MediaType, User } from '@prisma/client';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MediaService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private queue: QueueService,
  ) {}

  async uploadMedia(file: Express.Multer.File, user: User) {
    if (!file) throw new BadRequestException('File is required');

    // 1. Tentukan Tipe (Image/Video)
    const mime = file.mimetype;
    let type: MediaType = 'IMAGE';
    if (mime.startsWith('video/')) type = 'VIDEO';
    else if (!mime.startsWith('image/'))
      throw new BadRequestException('Unsupported file type');

    // 2. Upload Raw File ke MinIO
    const ext = path.extname(file.originalname);
    const key = `raw/${uuidv4()}${ext}`; // raw/random-uuid.mp4

    const url = await this.storage.uploadFile(key, file.buffer, mime);

    // 3. Simpan ke Database
    const media = await this.prisma.media.create({
      data: {
        filename: key,
        originalName: file.originalname,
        mimeType: mime,
        size: file.size,
        type: type,
        url: url,
        uploaderId: user.id,
        isTranscoded: type === 'IMAGE', // Image dianggap auto-transcoded (selesai)
      },
    });

    // 4. Jika Video, Masukkan ke Queue
    if (type === 'VIDEO') {
      await this.queue.addTranscodeJob(media.id);
    }

    return media;
  }

  async findAll(userId: number) {
    return this.prisma.media.findMany({
      where: { uploaderId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
