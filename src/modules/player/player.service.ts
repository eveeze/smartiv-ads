// src/modules/player/player.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../providers/prisma/prisma.service';
// [FIX] Gunakan 'import type' untuk interface yang hanya dipakai sebagai tipe parameter
import type { Screen } from '@prisma/client';
import { ScreenStatus, CampaignStatus, AdSlot } from '@prisma/client';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { GetPlaylistDto, PlaylistResponseDto } from './dto/playlist.dto';
import { MediaUtils } from '../../common/utils/media.utils';

@Injectable()
export class PlayerService {
  private readonly logger = new Logger(PlayerService.name);

  constructor(private readonly prisma: PrismaService) {}

  // =================================================================
  // 1. HEARTBEAT (Ping Status)
  // =================================================================
  async heartbeat(screen: Screen, dto: HeartbeatDto) {
    await this.prisma.screen.update({
      where: { id: screen.id },
      data: {
        status: ScreenStatus.ONLINE,
        lastPing: new Date(),
        ipAddress: dto.ipAddress,
      },
    });

    return { status: 'ok', serverTime: new Date() };
  }

  // =================================================================
  // 2. GET CONFIG (Timezone & Basic Settings)
  // =================================================================
  async getConfig(screen: Screen) {
    const property = await this.prisma.property.findUnique({
      where: { id: screen.propertyId },
      select: {
        id: true,
        name: true,
        timezone: true,
        logoUrl: true,
        baseColor: true,
        address: true,
        city: true,
      },
    });

    if (!property) throw new NotFoundException('Property info not found');

    const fullAddress = [property.address, property.city]
      .filter(Boolean)
      .join(', ');

    return {
      screenId: screen.id,
      screenName: screen.name,
      orientation: screen.orientation,
      property: {
        name: property.name,
        address: fullAddress,
        timezone: property.timezone,
        logo: MediaUtils.getFullUrl(property.logoUrl),
        themeColor: property.baseColor,
      },
      refreshInterval: 60,
    };
  }

  // =================================================================
  // 3. GET PLAYLIST (Smart Slot Based)
  // =================================================================
  async getPlaylist(
    screen: Screen,
    dto: GetPlaylistDto,
  ): Promise<PlaylistResponseDto> {
    const targetSlot = dto.slot || AdSlot.SCREENSAVER;
    const now = new Date();

    const campaigns = await this.prisma.campaign.findMany({
      where: {
        status: CampaignStatus.ACTIVE,
        targetSlot: targetSlot,
        screens: {
          some: { id: screen.id },
        },
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: {
        items: {
          include: { media: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Mapping Data ke DTO yang bersih
    const playlistItems = campaigns.flatMap((campaign) =>
      campaign.items.map((item) => {
        // [LOGIC] Tentukan URL (HLS untuk Video, Direct untuk Image)
        const rawUrl =
          item.media.type === 'VIDEO'
            ? MediaUtils.getHlsUrl(item.media.id)
            : MediaUtils.getFullUrl(item.media.url);

        // [FIX] TS2322: Pastikan string tidak null (fallback ke empty string)
        const finalUrl = rawUrl ?? '';

        // [FIX] Action URL priority. Gunakan undefined untuk optional field, bukan null
        const finalActionUrl =
          item.actionUrl || item.media.actionUrl || undefined;

        return {
          campaignId: campaign.id,
          campaignName: campaign.name,
          mediaId: item.media.id,
          type: item.media.type,
          mediaUrl: finalUrl,
          duration: item.durationSec,
          slot: targetSlot,
          actionUrl: finalActionUrl,
        };
      }),
    );

    const totalDuration = playlistItems.reduce(
      (acc, curr) => acc + curr.duration,
      0,
    );

    this.logger.log(
      `Screen #${screen.id} req playlist for ${targetSlot}. Found ${playlistItems.length} items.`,
    );

    return {
      slot: targetSlot,
      generatedAt: now,
      totalDuration,
      items: playlistItems,
    };
  }
}
