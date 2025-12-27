import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsHexColor,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

import { AdSlot, PropertyType } from '@prisma/client';

export class CreatePropertyDto {
  @ApiProperty({ example: 'Hotel Ken Dedes Yogyakarta' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({
    example: '0Q1MHI',
    description: 'Code from smartiv core system',
  })
  @IsString()
  @IsOptional()
  smartivCode?: string;

  @ApiPropertyOptional({
    example: '212',
    description: 'ID from smartiv core system',
  })
  @IsNumber()
  @IsOptional()
  smartivId?: number;

  @ApiPropertyOptional({ enum: PropertyType, example: 'HOTEL' })
  @IsOptional()
  @IsEnum(PropertyType)
  type?: PropertyType;

  @ApiPropertyOptional({ example: '#030303' })
  @IsOptional()
  @IsHexColor()
  baseColor?: string;

  @ApiPropertyOptional({ example: '#EDB007' })
  @IsOptional()
  @IsHexColor()
  activeColor?: string;

  @ApiPropertyOptional({ example: 'Jl. P. Mangkubumi No.72A' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    enum: AdSlot,
    isArray: true,
    example: [AdSlot.SCREENSAVER, AdSlot.INFO_SLIDER],
  })
  @IsArray()
  @IsEnum(AdSlot, { each: true })
  enabledSlots: AdSlot[];
}
