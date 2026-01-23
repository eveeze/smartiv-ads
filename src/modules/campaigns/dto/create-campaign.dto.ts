// src/modules/campaigns/dto/create-campaign.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdSlot, DurationPackage } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateCampaignDto {
  @ApiProperty({ example: 'Promo Lebaran 2026' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'ID Properti yang ditarget', example: 1 })
  @IsInt()
  @Min(1)
  propertyId: number;

  @ApiProperty({
    description: 'Slot Iklan yang dipilih',
    enum: AdSlot,
    example: AdSlot.SCREENSAVER,
  })
  @IsEnum(AdSlot)
  targetSlot: AdSlot;

  @ApiProperty({
    description: 'Paket Durasi',
    enum: DurationPackage,
    example: DurationPackage.WEEKLY,
  })
  @IsEnum(DurationPackage)
  durationPackage: DurationPackage;

  @ApiProperty({ description: 'Tanggal Mulai Tayang', example: '2026-05-01' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({
    description: 'Tanggal Selesai (Wajib jika paket CUSTOM)',
    example: '2026-05-10',
  })
  @ValidateIf((o) => o.durationPackage === DurationPackage.CUSTOM)
  @IsDateString()
  endDate?: string;

  @ApiProperty({ description: 'ID Media Content (Video/Image)', example: 10 })
  @IsInt()
  @Min(1)
  mediaId: number;

  @ApiPropertyOptional({
    description: 'Simpan sebagai draft tanpa potong saldo',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  saveAsDraft?: boolean;
}
