import {
  Injectable,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { MediaUtils } from '../../common/utils/media.utils';
import { StorageService } from '../../providers/storage/storage.service';
import type { AdPlacement, MediaType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Placement Service — validates media compatibility against ad placement specs.
 * Uses in-memory Map cache for O(1) lookup of placement configs.
 */
@Injectable()
export class PlacementService implements OnModuleInit {
  private readonly logger = new Logger(PlacementService.name);
  // In-memory cache: placementId -> AdPlacement (O(1) lookup)
  private readonly placementCache = new Map<number, AdPlacement>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  /** Pre-load all placements into memory on module init */
  async onModuleInit(): Promise<void> {
    await this.refreshCache();
  }

  /** Refresh the in-memory placement cache from DB */
  async refreshCache(): Promise<void> {
    const placements = await this.prisma.adPlacement.findMany();
    this.placementCache.clear();
    for (const p of placements) {
      this.placementCache.set(p.id, p);
    }
    this.logger.log(
      `Placement cache loaded: ${this.placementCache.size} entries`,
    );
  }

  /** Get a placement by ID (O(1) from cache, fallback to DB) */
  async getPlacement(placementId: number): Promise<AdPlacement> {
    let placement = this.placementCache.get(placementId);
    if (!placement) {
      // Cache miss — fetch from DB and cache
      const fromDb = await this.prisma.adPlacement.findUnique({
        where: { id: placementId },
      });
      if (!fromDb) {
        throw new BadRequestException(
          `AdPlacement with ID ${placementId} not found`,
        );
      }
      this.placementCache.set(placementId, fromDb);
      placement = fromDb;
    }
    return placement;
  }

  /** List all placements */
  async findAll(): Promise<AdPlacement[]> {
    if (this.placementCache.size === 0) {
      await this.refreshCache();
    }
    return Array.from(this.placementCache.values());
  }

  /**
   * Validate that a media file's dimensions match the targeted placement.
   * Uses ffprobe for video or checks image metadata.
   *
   * @throws BadRequestException if media is incompatible
   */
  async validateMediaCompatibility(
    mediaId: number,
    placementId: number,
  ): Promise<{ valid: boolean; message: string }> {
    const [media, placement] = await Promise.all([
      this.prisma.media.findUnique({ where: { id: mediaId } }),
      this.getPlacement(placementId),
    ]);

    if (!media) {
      throw new BadRequestException(`Media with ID ${mediaId} not found`);
    }

    // 1. Check media type compatibility
    if (!placement.allowedMediaTypes.includes(media.type as MediaType)) {
      throw new BadRequestException(
        `Media type "${media.type}" is not allowed for placement "${placement.name}". ` +
          `Allowed types: ${placement.allowedMediaTypes.join(', ')}`,
      );
    }

    // 2. Check dimensions via ffprobe (download to temp, probe, delete)
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), `validate-${mediaId}-`),
    );
    const tempPath = path.join(tempDir, 'media_file');

    try {
      // Extract storage key from URL
      const urlObj = new URL(media.url);
      const key = decodeURIComponent(
        urlObj.pathname.split('/').slice(2).join('/'),
      );

      await this.storageService.downloadToLocal(key, tempPath);
      const dimensions = await MediaUtils.getMediaDimensions(tempPath);

      // Check if aspect ratio matches
      const mediaAspect = dimensions.width / dimensions.height;
      const placementAspect = placement.width / placement.height;
      const aspectTolerance = 0.05; // 5% tolerance

      const aspectMatch =
        Math.abs(mediaAspect - placementAspect) / placementAspect <
        aspectTolerance;

      if (!aspectMatch) {
        throw new BadRequestException(
          `Media aspect ratio (${dimensions.width}x${dimensions.height}) ` +
            `does not match placement "${placement.name}" (${placement.width}x${placement.height}, ` +
            `aspect: ${placement.aspectRatio})`,
        );
      }

      // Check minimum resolution
      if (
        dimensions.width < placement.width ||
        dimensions.height < placement.height
      ) {
        this.logger.warn(
          `Media ${mediaId} resolution (${dimensions.width}x${dimensions.height}) ` +
            `is below placement minimum (${placement.width}x${placement.height})`,
        );
      }

      return {
        valid: true,
        message: `Media is compatible with placement "${placement.name}" (${placement.aspectRatio})`,
      };
    } finally {
      // Cleanup temp files
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch {
        this.logger.warn(`Failed to clean temp dir: ${tempDir}`);
      }
    }
  }
}
