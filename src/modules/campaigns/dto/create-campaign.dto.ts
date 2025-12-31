import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateCampaignDto {
  @ApiProperty({ example: 'Ramadhan Promo 2025' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '2025-05-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2025-05-07' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ description: 'ID Media yang sudah Approved', example: 1 })
  @IsInt()
  @Min(1)
  mediaId: number;

  @ApiPropertyOptional({
    description: 'List ID Screen yang ditarget. Wajib jika propertyId kosong.',
    example: [1, 2],
  })
  @ValidateIf((o) => !o.propertyId)
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  screenIds?: number[];

  @ApiPropertyOptional({
    description:
      'ID Property untuk target seluruh layar. Wajib jika screenIds kosong.',
    example: 5,
  })
  @ValidateIf((o) => !o.screenIds)
  @IsInt()
  @IsOptional()
  propertyId?: number;

  @ApiPropertyOptional({
    description: 'Jika true, simpan sebagai DRAFT tanpa memotong saldo.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  saveAsDraft?: boolean;
}
