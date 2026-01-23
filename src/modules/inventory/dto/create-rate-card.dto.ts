// src/modules/inventory/dto/create-rate-card.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
} from 'class-validator';
import { AdSlot, PropertyClass } from '@prisma/client';

export class CreateRateCardDto {
  @ApiPropertyOptional({
    description: 'ID Property (Opsional jika Rate Card Umum)',
  })
  @IsOptional()
  @IsNumber()
  propertyId?: number;

  @ApiPropertyOptional({
    enum: PropertyClass,
    description: 'Kelas Properti (Jika base rate umum)',
  })
  @IsOptional()
  @IsEnum(PropertyClass)
  classification?: PropertyClass;

  @ApiProperty({ enum: AdSlot, description: 'Slot Iklan yang dijual' })
  @IsEnum(AdSlot)
  @IsNotEmpty()
  targetSlot: AdSlot;

  @ApiProperty({ description: 'Harga Harian (Base)', example: 100000 })
  @IsNumber()
  @Min(0)
  pricePerDay: number;

  @ApiPropertyOptional({ description: 'Harga Paket Mingguan', example: 650000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerWeek?: number;

  @ApiPropertyOptional({ description: 'Harga Paket Bulanan', example: 2500000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerMonth?: number;
}
