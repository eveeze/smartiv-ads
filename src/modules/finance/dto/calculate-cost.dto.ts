// src/modules/finance/dto/calculate-cost.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdSlot, DurationPackage } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  ValidateIf,
} from 'class-validator';

export class CalculateCostDto {
  @ApiProperty({ description: 'ID Properti yang ditarget', example: 1 })
  @IsInt()
  @IsNotEmpty()
  propertyId: number;

  @ApiProperty({
    description: 'Jenis Slot Iklan',
    enum: AdSlot,
    example: AdSlot.SCREENSAVER,
  })
  @IsEnum(AdSlot)
  @IsNotEmpty()
  targetSlot: AdSlot;

  @ApiProperty({
    description: 'Paket Durasi (DAILY, WEEKLY, MONTHLY, CUSTOM)',
    enum: DurationPackage,
    example: DurationPackage.WEEKLY,
  })
  @IsEnum(DurationPackage)
  @IsNotEmpty()
  durationPackage: DurationPackage;

  // Tanggal Wajib jika CUSTOM, atau untuk menentukan ketersediaan slot
  @ApiProperty({ example: '2026-05-01' })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiPropertyOptional({
    description: 'Wajib diisi jika packageType = CUSTOM',
    example: '2026-05-05',
  })
  @ValidateIf((o) => o.durationPackage === DurationPackage.CUSTOM)
  @IsDateString()
  endDate?: string;
}
