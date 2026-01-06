import { ApiProperty } from '@nestjs/swagger';
import { AdSlot, MediaType } from '@prisma/client';

export class PlaylistItemDto {
  @ApiProperty({ example: 101 })
  campaignId: number;

  @ApiProperty({ example: 'Ramadhan Promo' })
  campaignName: string;

  @ApiProperty({ example: 55 })
  mediaId: number;

  @ApiProperty({ enum: MediaType, example: 'IMAGE' })
  type: MediaType;

  @ApiProperty({ example: 'http://cdn.smartiv.com/media/xyz.jpg' })
  url: string;

  @ApiProperty({ example: 15, description: 'Duration in seconds' })
  duration: number;

  @ApiProperty({ enum: AdSlot, example: 'SCREENSAVER' })
  slot: AdSlot;
}

export class PlaylistResponseDto {
  @ApiProperty()
  generatedAt: Date;

  @ApiProperty({ example: 5 })
  totalItems: number;

  @ApiProperty({ type: [PlaylistItemDto] })
  items: PlaylistItemDto[];
}
