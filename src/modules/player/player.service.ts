import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { CampaignStatus, ScreenStatus } from '@prisma/client';
import { MediaUtils } from '../../common/utils/media.utils';
import { HeartbeatDto } from './dto/heartbeat.dto';
// [FIX] Import DTO yang sudah modular
import { PlaylistResponseDto, PlaylistItemDto } from './dto/playlist.dto';

@Injectable()
export class PlayerService {
  constructor(private readonly prisma: PrismaService) {}

  // ... (Method getConfig tetap sama) ...
  async getConfig(screenId: number) {
    const screen = await this.prisma.screen.findUnique({
      where: { id: screenId },
      select: {
        id: true,
        name: true,
        orientation: true,
        property: {
          select: {
            name: true,
            logoUrl: true,
            address: true,
            city: true,
          },
        },
      },
    });

    if (!screen) throw new NotFoundException('Screen not found');

    const fullAddress = [screen.property?.address, screen.property?.city]
      .filter(Boolean)
      .join(', ');

    return {
      screenId: screen.id,
      screenName: screen.name,
      orientation: screen.orientation,
      propertyName: screen.property?.name,
      propertyAddress: fullAddress || null,
      propertyLogo: MediaUtils.getFullUrl(screen.property?.logoUrl),
      refreshInterval: 900,
      serverTime: new Date().toISOString(),
    };
  }

  // ==========================================
  // 2. PLAYLIST GENERATION
  // ==========================================
  // [FIX] Explicit Return Type untuk Type Safety & Documentation
  async generatePlaylist(screenId: number): Promise<PlaylistResponseDto> {
    const today = new Date();

    const campaigns = await this.prisma.campaign.findMany({
      where: {
        status: CampaignStatus.ACTIVE,
        startDate: { lte: today },
        endDate: { gte: today },
        screens: {
          some: { id: screenId },
        },
      },
      select: {
        id: true,
        name: true,
        items: {
          include: {
            media: true,
          },
        },
      },
    });

    // [FIX] Gunakan DTO Class, bukan interface lokal
    const playlist: PlaylistItemDto[] = [];

    for (const campaign of campaigns) {
      for (const item of campaign.items) {
        playlist.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          mediaId: item.media.id,
          type: item.media.type,
          url: MediaUtils.getFullUrl(item.media.url) || '',
          duration: item.durationSec,
          slot: item.targetSlot,
        });
      }
    }

    return {
      generatedAt: new Date(),
      totalItems: playlist.length,
      items: playlist,
    };
  }

  // ... (Method recordHeartbeat tetap sama) ...
  async recordHeartbeat(screenId: number, dto: HeartbeatDto) {
    return this.prisma.screen.update({
      where: { id: screenId },
      data: {
        status: ScreenStatus.ONLINE,
        lastPing: new Date(),
        ipAddress: dto.ipAddress,
      },
      select: {
        id: true,
        status: true,
        lastPing: true,
        ipAddress: true,
      },
    });
  }
}
