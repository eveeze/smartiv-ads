import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdSlot, PropertyClass } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateRateCardDto {
  @ApiPropertyOptional({
    enum: PropertyClass,
    description: 'Klasifikasi properti (Wajib jika propertyId kosong)',
  })
  @ValidateIf((o) => !o.propertyId)
  @IsNotEmpty({
    message: 'classification is required when propertyId is missing',
  })
  @IsEnum(PropertyClass)
  classification?: PropertyClass;

  @ApiPropertyOptional({
    description: 'ID Properti spesifik (Wajib jika classification kosong)',
  })
  @ValidateIf((o) => !o.classification)
  @IsNotEmpty({
    message: 'propertyId is required when classification is missing',
  })
  @IsInt()
  propertyId?: number;

  @ApiPropertyOptional({
    enum: AdSlot,
    description: 'Slot iklan spesifik (opsional, jika kosong berlaku umum)',
  })
  @IsOptional()
  @IsEnum(AdSlot)
  targetSlot?: AdSlot;

  @ApiProperty({ description: 'Harga per hari dalam Rupiah', minimum: 1 })
  @IsNumber()
  @Min(1)
  pricePerDay: number;
}
