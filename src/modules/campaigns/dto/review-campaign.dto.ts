import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ReviewCampaignDto {
  @ApiProperty({ description: 'Setuju atau Tolak', example: true })
  @IsBoolean()
  approved: boolean;

  @ApiProperty({ required: false, example: 'Konten melanggar aturan' })
  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
