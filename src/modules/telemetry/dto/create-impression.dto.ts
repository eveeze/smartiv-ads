import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  Min,
  ValidateNested,
} from 'class-validator';

export class ImpressionItemDto {
  @ApiProperty({ description: 'ID Campaign yang diputar', example: 10 })
  @IsInt()
  @Min(1)
  campaignId: number;

  @ApiProperty({
    description: 'Waktu mulai tayang (ISO8601)',
    example: '2026-01-07T10:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  timestamp: string;

  @ApiProperty({ description: 'Durasi tayang dalam detik', example: 15 })
  @IsInt()
  @Min(1)
  duration: number;
}

export class CreateImpressionLogDto {
  @ApiProperty({ type: [ImpressionItemDto], description: 'Array log impresi' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImpressionItemDto)
  impressions: ImpressionItemDto[];
}
