import { ApiProperty } from '@nestjs/swagger';

export class AdvertiserSummaryDto {
  @ApiProperty()
  activeCampaigns: number;

  @ApiProperty()
  pendingCampaigns: number;

  @ApiProperty({ description: 'Total spent in IDR' })
  totalSpent: string; // BigInt serialized as string

  @ApiProperty({ description: 'Current wallet balance' })
  remainingBalance: string; // BigInt serialized as string
}

export class ScreenStatusStatsDto {
  @ApiProperty()
  ONLINE: number;
  @ApiProperty()
  OFFLINE: number;
  @ApiProperty()
  MAINTENANCE: number;
}

export class AdminSummaryDto {
  @ApiProperty()
  totalRevenue: string;

  @ApiProperty()
  totalScreens: number;

  @ApiProperty()
  screenStats: ScreenStatusStatsDto;
}
