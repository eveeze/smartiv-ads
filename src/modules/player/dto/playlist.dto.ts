// src/modules/player/dto/playlist.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdSlot, MediaType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

// [INPUT] Request dari TV: "Minta playlist untuk slot SCREENSAVER dong"
export class GetPlaylistDto {
  @ApiPropertyOptional({
    enum: AdSlot,
    description:
      'Filter playlist berdasarkan Slot Iklan (default: SCREENSAVER)',
    example: AdSlot.SCREENSAVER,
  })
  @IsOptional()
  @IsEnum(AdSlot)
  slot?: AdSlot;
}

// [OUTPUT] Item Playlist Individual
export class PlaylistItemDto {
  @ApiProperty({ example: 101 })
  campaignId: number;

  @ApiProperty({ example: 'Ramadhan Promo' })
  campaignName: string;

  @ApiProperty({ example: 55 })
  mediaId: number;

  @ApiProperty({ enum: MediaType, example: 'IMAGE' })
  type: MediaType;

  @ApiProperty({ example: 'https://cdn.smartiv.com/media/xyz.m3u8' })
  mediaUrl: string; // Diganti dari 'url' agar jelas (bisa HLS atau Image)

  @ApiProperty({ example: 15 })
  duration: number;

  @ApiProperty({ enum: AdSlot, example: 'SCREENSAVER' })
  slot: AdSlot;

  @ApiPropertyOptional({ example: 'https://promo.com' })
  actionUrl?: string; // [NEW] Link untuk QR Code interaction
}

// [OUTPUT] Response Wrapper
export class PlaylistResponseDto {
  @ApiProperty({ description: 'Slot yang diminta' })
  slot: AdSlot;

  @ApiProperty()
  generatedAt: Date;

  @ApiProperty()
  totalDuration: number;

  @ApiProperty({ type: [PlaylistItemDto] })
  items: PlaylistItemDto[];
}
